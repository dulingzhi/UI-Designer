// ============================================================
// TextureCache — 文件 / MPQ 纹理 → THREE.Texture 缓存
// ============================================================
// Phase 2:
//   1. BLP 直接解码为 ImageData → DataTexture
//   2. 其他图片格式读为 Blob → ImageData → DataTexture
//   3. Backdrop 边框 atlas 拆成 8 张子纹理，供九宫格重复平铺

import { readFile } from '@tauri-apps/plugin-fs';
import * as THREE from 'three';
import { decodeBLP } from '../utils/blpDecoder';
import { mpqManager } from '../utils/mpqManager';
import {
  COMPACT_BORDER_LAYOUT,
  DEFAULT_BORDER_LAYOUT,
  HORIZONTAL_BORDER_LAYOUT,
  type EdgeFlag,
  type SubTextureLayout,
} from '../utils/textureAtlas';

type BorderTextureMap = Map<EdgeFlag, THREE.Texture>;

/** 1×1 品红 fallback 纹理（标记缺失纹理） */
let fallbackTexture: THREE.DataTexture | null = null;

function createTextureFromPixels(
  pixels: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(pixels), width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = true;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function getFallbackTexture(): THREE.DataTexture {
  if (!fallbackTexture) {
    fallbackTexture = createTextureFromPixels(new Uint8Array([255, 0, 255, 255]), 1, 1);
  }
  return fallbackTexture;
}

function isDataOrHttpPath(path: string): boolean {
  return path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://');
}

function isAbsolutePath(path: string): boolean {
  return /^[a-zA-Z]:[\\/]/.test(path) || path.startsWith('/');
}

function getExtension(path: string): string {
  const sanitized = path.split('?')[0].split('#')[0];
  const ext = sanitized.split('.').pop();
  return ext?.toLowerCase() ?? '';
}

function detectBorderLayout(width: number, height: number): { layout: SubTextureLayout; subSize: number } {
  const aspectRatio = width / height;

  if (aspectRatio >= 7 && aspectRatio <= 9) {
    return { layout: HORIZONTAL_BORDER_LAYOUT, subSize: height };
  }
  if (aspectRatio >= 0.4 && aspectRatio <= 0.6) {
    return { layout: COMPACT_BORDER_LAYOUT, subSize: Math.floor(width / 2) };
  }
  if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
    return { layout: DEFAULT_BORDER_LAYOUT, subSize: Math.floor(width / 3) };
  }

  return { layout: DEFAULT_BORDER_LAYOUT, subSize: Math.max(1, Math.floor(width / 3)) };
}

export class TextureCache {
  private textures = new Map<string, Promise<THREE.Texture>>();
  private borderAtlases = new Map<string, Promise<BorderTextureMap>>();
  private ownedTextures = new Set<THREE.Texture>();
  /** 记录每个 key 最近访问次数，用于 LRU 淘汰 */
  private accessOrder = new Map<string, number>();
  private accessCounter = 0;
  /** 最大缓存条目数 (textures + borderAtlases 合计) */
  private readonly maxEntries = 256;

  async loadTexture(path: string): Promise<THREE.Texture> {
    const key = this.normalizeKey(path);
    this.touchAccess(key);
    const existing = this.textures.get(key);
    if (existing) return existing;

    const promise = this.loadTextureInternal(path)
      .catch((error) => {
        this.textures.delete(key);
        this.accessOrder.delete(key);
        throw error;
      });

    this.textures.set(key, promise);
    this.evictIfNeeded();
    return promise;
  }

  async loadBorderAtlas(path: string): Promise<BorderTextureMap> {
    const key = `${this.normalizeKey(path)}::border`;
    this.touchAccess(key);
    const existing = this.borderAtlases.get(key);
    if (existing) return existing;

    const promise = this.loadBorderAtlasInternal(path)
      .catch((error) => {
        this.borderAtlases.delete(key);
        this.accessOrder.delete(key);
        throw error;
      });

    this.borderAtlases.set(key, promise);
    this.evictIfNeeded();
    return promise;
  }

  getFallback(): THREE.DataTexture {
    return getFallbackTexture();
  }

  dispose(): void {
    for (const texture of this.ownedTextures) {
      texture.dispose();
    }
    this.ownedTextures.clear();
    this.textures.clear();
    this.borderAtlases.clear();
    this.accessOrder.clear();
  }

  private touchAccess(key: string): void {
    this.accessOrder.set(key, ++this.accessCounter);
  }

  /** 当总条目数超过 maxEntries 时，淘汰最久未访问的 */
  private evictIfNeeded(): void {
    const total = this.textures.size + this.borderAtlases.size;
    if (total <= this.maxEntries) return;

    const toEvict = total - this.maxEntries;
    // 按访问序号升序排序，取最久未用的
    const sorted = Array.from(this.accessOrder.entries()).sort((a, b) => a[0] === b[0] ? 0 : a[1] - b[1]);

    for (let i = 0; i < toEvict && i < sorted.length; i += 1) {
      const key = sorted[i][0];
      this.evictKey(key);
    }
  }

  private evictKey(key: string): void {
    this.accessOrder.delete(key);

    const texPromise = this.textures.get(key);
    if (texPromise) {
      this.textures.delete(key);
      void texPromise.then((tex) => {
        if (this.ownedTextures.has(tex)) {
          this.ownedTextures.delete(tex);
          tex.dispose();
        }
      }).catch(() => {});
      return;
    }

    const atlasPromise = this.borderAtlases.get(key);
    if (atlasPromise) {
      this.borderAtlases.delete(key);
      void atlasPromise.then((atlas) => {
        for (const tex of atlas.values()) {
          if (this.ownedTextures.has(tex)) {
            this.ownedTextures.delete(tex);
            tex.dispose();
          }
        }
      }).catch(() => {});
    }
  }

  private normalizeKey(path: string): string {
    return isAbsolutePath(path) || isDataOrHttpPath(path) ? path : path.replace(/\//g, '\\');
  }

  private async loadTextureInternal(path: string): Promise<THREE.Texture> {
    const imageData = await this.readImageData(path);
    const texture = createTextureFromPixels(imageData.data, imageData.width, imageData.height);
    this.ownedTextures.add(texture);
    return texture;
  }

  private async loadBorderAtlasInternal(path: string): Promise<BorderTextureMap> {
    const imageData = await this.readImageData(path);
    const { layout, subSize } = detectBorderLayout(imageData.width, imageData.height);
    const textures: BorderTextureMap = new Map();

    for (const [flag, [gridX, gridY]] of Object.entries(layout) as [EdgeFlag, [number, number]][]) {
      const rotate90 = flag === 'T' || flag === 'B';
      const pixels = this.extractSubTexture(imageData, gridX * subSize, gridY * subSize, subSize, rotate90);
      const texture = createTextureFromPixels(pixels, subSize, subSize);
      this.ownedTextures.add(texture);
      textures.set(flag, texture);
    }

    return textures;
  }

  private extractSubTexture(
    imageData: ImageData,
    sourceX: number,
    sourceY: number,
    size: number,
    rotate90: boolean,
  ): Uint8ClampedArray {
    const output = new Uint8ClampedArray(size * size * 4);
    const source = imageData.data;
    const width = imageData.width;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const srcX = sourceX + x;
        const srcY = sourceY + y;
        const srcIndex = (srcY * width + srcX) * 4;

        let dstX = x;
        let dstY = y;
        if (rotate90) {
          dstX = size - 1 - y;
          dstY = x;
        }

        const dstIndex = (dstY * size + dstX) * 4;
        output[dstIndex] = source[srcIndex];
        output[dstIndex + 1] = source[srcIndex + 1];
        output[dstIndex + 2] = source[srcIndex + 2];
        output[dstIndex + 3] = source[srcIndex + 3];
      }
    }

    return output;
  }

  private async readImageData(path: string): Promise<ImageData> {
    const extension = getExtension(path);

    if (extension === 'blp') {
      const buffer = await this.readArrayBuffer(path);
      return decodeBLP(buffer);
    }

    const blob = await this.readBlob(path);
    return this.blobToImageData(blob);
  }

  private async readArrayBuffer(path: string): Promise<ArrayBuffer> {
    if (path.startsWith('data:') || path.startsWith('http://') || path.startsWith('https://')) {
      const response = await fetch(path);
      if (!response.ok) {
        throw new Error(`读取纹理失败: ${path}`);
      }
      return response.arrayBuffer();
    }

    if (isAbsolutePath(path)) {
      const file = await readFile(path);
      return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
    }

    const normalizedPath = path.replace(/\//g, '\\');
    const buffer = await mpqManager.readFile(normalizedPath);
    if (!buffer) {
      throw new Error(`WC3 纹理未找到: ${path}`);
    }
    return buffer;
  }

  private async readBlob(path: string): Promise<Blob> {
    const buffer = await this.readArrayBuffer(path);
    const extension = getExtension(path);

    let type = 'application/octet-stream';
    switch (extension) {
      case 'png':
        type = 'image/png';
        break;
      case 'jpg':
      case 'jpeg':
        type = 'image/jpeg';
        break;
      case 'gif':
        type = 'image/gif';
        break;
      case 'bmp':
        type = 'image/bmp';
        break;
      case 'webp':
        type = 'image/webp';
        break;
      case 'tga':
        type = 'image/tga';
        break;
      default:
        break;
    }

    return new Blob([buffer], { type });
  }

  private async blobToImageData(blob: Blob): Promise<ImageData> {
    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('无法创建 Canvas 上下文');
        }
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      } finally {
        bitmap.close();
      }
    }

    const url = URL.createObjectURL(blob);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('图像加载失败'));
        img.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('无法创建 Canvas 上下文');
      }
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, image.width, image.height);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
