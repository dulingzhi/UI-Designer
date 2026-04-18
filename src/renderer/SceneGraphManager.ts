// ============================================================
// SceneGraphManager �?Three.js 场景管理器（WebGPU / WebGL2 双后端）
// ============================================================
// 职责�?
//   1. 管理 Renderer (WebGPU 优先 / WebGL2 降级) + Scene + Camera
//   2. 维护 FrameData �?渲染节点 (基础面片 / Backdrop 背景 / 九宫格边�?
//   3. 按需渲染 (dirty flag + rAF)
//
// 异步创建：`await SceneGraphManager.create(canvas, options)`
//   �?WebGPURenderer 需�?`await renderer.init()` 才能开始渲�?
//   �?navigator.gpu 不可用或 init 失败时自动回落到 WebGLRenderer

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import type { FrameData } from '../types';
import { FrameType } from '../types';
import { calculatePositionFromAnchors } from '../utils/anchorUtils';
import {
  wc3ToPixelX,
  wc3ToPixelYBottom,
  wc3ToPixelW,
  wc3ToPixelH,
} from '../utils/coordinateService';
import { parseCornerFlags, type EdgeFlag } from '../utils/textureAtlas';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants';
import { createMaterial, updateMaterial, type FrameMaterial } from './ShaderLib';
import { TextureCache } from './TextureCache';
import { snapRectToPixels, snapToPixel } from './pixelSnap';
import { computeEdgePlacement, computeBackgroundPlacement } from './backdropLayout';
import { renderTextTexture, disposeTextCache } from './textLayout';
import { resolveButtonState, type ButtonState } from './buttonState';

export type RenderBackend = 'webgpu' | 'webgl2';

interface SceneGraphManagerOptions {
  resolveTexturePath?: (path: string | undefined) => string | undefined;
}

interface FrameRenderNode {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  backgroundMesh: THREE.Mesh | null;
  textMesh: THREE.Mesh | null;
  /** 控件状态纹�?mesh (Button controlBackdrop / Highlight / Sprite) */
  controlMesh: THREE.Mesh | null;
  /** StatusBar 填充 mesh */
  fillMesh: THREE.Mesh | null;
  /** Slider 滑块 mesh */
  thumbMesh: THREE.Mesh | null;
  /** EditBox 边框 mesh (LineSegments) */
  borderMesh: THREE.LineSegments | null;
  edgeMeshes: Map<EdgeFlag, THREE.Mesh>;
  revision: number;
}

export class SceneGraphManager {
  readonly renderer: WebGPURenderer | THREE.WebGLRenderer;
  readonly backend: RenderBackend;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly textureCache: TextureCache;

  private nodes = new Map<string, FrameRenderNode>();
  private unitPlane: THREE.PlaneGeometry;
  private dirty = false;
  private rafId: number | null = null;
  private resolveTexturePath: (path: string | undefined) => string | undefined;
  private canvas: HTMLCanvasElement;
  private contextLost = false;
  private lastFrames: Record<string, FrameData> = {};
  private lastRootIds: string[] = [];
  /** ????/?????? ? ??? UI ???? pushed/disabled/mouseover ??. */
  private buttonPreviewState: ButtonState = 'normal';
  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    console.warn('[SGM] WebGL context lost');
  };
  private onContextRestored = () => {
    console.info('[SGM] WebGL context restored �?rebuilding scene');
    this.contextLost = false;
    this.textureCache.dispose();
    for (const [, node] of this.nodes) {
      this.disposeNodeResources(node);
      this.scene.remove(node.group);
    }
    this.nodes.clear();
    this.sync(this.lastFrames, this.lastRootIds);
  };

  /**
   * 异步创建 SceneGraphManager。优�?WebGPU，失败时降级�?WebGL2�?
   */
  static async create(
    canvas: HTMLCanvasElement,
    options: SceneGraphManagerOptions = {},
  ): Promise<SceneGraphManager> {
    let renderer: WebGPURenderer | THREE.WebGLRenderer;
    let backend: RenderBackend;

    const tryWebGPU = typeof navigator !== 'undefined' && !!(navigator as any).gpu;

    if (tryWebGPU) {
      try {
        const gpu = new WebGPURenderer({
          canvas,
          alpha: true,
          antialias: false,
        } as any);
        await gpu.init();
        renderer = gpu;
        backend = 'webgpu';
        console.info('[SGM] Using WebGPU backend');
      } catch (err) {
        console.warn('[SGM] WebGPU init failed, falling back to WebGL2:', err);
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false,
          premultipliedAlpha: false,
        });
        backend = 'webgl2';
      }
    } else {
      console.info('[SGM] navigator.gpu unavailable, using WebGL2');
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
      });
      backend = 'webgl2';
    }

    return new SceneGraphManager(canvas, renderer, backend, options);
  }

  private constructor(
    canvas: HTMLCanvasElement,
    renderer: WebGPURenderer | THREE.WebGLRenderer,
    backend: RenderBackend,
    options: SceneGraphManagerOptions = {},
  ) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.backend = backend;

    this.renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT, false);
    this.renderer.setClearColor(0x000000, 0);

    this.camera = new THREE.OrthographicCamera(
      0,
      CANVAS_WIDTH,
      CANVAS_HEIGHT,
      0,
      -10000,
      10000,
    );
    this.camera.position.z = 1000;

    this.scene = new THREE.Scene();
    this.unitPlane = new THREE.PlaneGeometry(1, 1);
    this.textureCache = new TextureCache();
    this.resolveTexturePath = options.resolveTexturePath ?? ((path) => path);

    // 上下文丢失：�?WebGL 后端触发；WebGPU 使用 device.lost Promise（此处暂记录�?
    if (backend === 'webgl2') {
      canvas.addEventListener('webglcontextlost', this.onContextLost, false);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    } else {
      const device = (renderer as any).backend?.device as GPUDevice | undefined;
      device?.lost?.then((info) => {
        console.warn('[SGM] WebGPU device lost:', info.message);
        this.contextLost = true;
      });
    }
  }

  setResolveTexturePath(resolveTexturePath: (path: string | undefined) => string | undefined): void {
    this.resolveTexturePath = resolveTexturePath;
  }

  /**
   * ????????? ('normal' | 'pushed' | 'disabled' | 'mouseover').
   * ????? sync ????, ? Button/Checkbox ?????? backdrop ??.
   */
  setButtonPreviewState(state: ButtonState): void {
    if (this.buttonPreviewState === state) return;
    this.buttonPreviewState = state;
    // ?? sync ???, ?? Button/Checkbox syncControlTexture ????.
    this.sync(this.lastFrames, this.lastRootIds);
  }

  getButtonPreviewState(): ButtonState {
    return this.buttonPreviewState;
  }

  sync(frames: Record<string, FrameData>, rootFrameIds: string[]): void {
    this.lastFrames = frames;
    this.lastRootIds = rootFrameIds;
    if (this.contextLost) return;
    const activeIds = new Set<string>();

    const collectIds = (ids: string[], hiddenByParent: boolean = false) => {
      for (const id of ids) {
        const frame = frames[id];
        if (!frame) continue;

        const hidden = hiddenByParent || frame.visible === false;
        if (!hidden) {
          activeIds.add(id);
        }

        if (frame.children && frame.children.length > 0) {
          collectIds(frame.children, hidden);
        }
      }
    };
    collectIds(rootFrameIds);

    for (const id of activeIds) {
      const rawFrame = frames[id]!;
      const calculatedPos = calculatePositionFromAnchors(rawFrame, frames);
      const frame = calculatedPos ? { ...rawFrame, ...calculatedPos } : rawFrame;

      if (this.nodes.has(id)) {
        this.updateNode(id, frame);
      } else {
        this.addNode(id, frame);
      }
    }

    for (const [id, node] of this.nodes) {
      if (!activeIds.has(id)) {
        this.removeNode(id, node);
      }
    }

    this.markDirty();
  }

  markDirty(): void {
    if (this.dirty || this.contextLost) return;
    this.dirty = true;
    this.rafId = requestAnimationFrame(() => {
      if (!this.contextLost) {
        this.renderer.render(this.scene, this.camera);
      }
      this.dirty = false;
      this.rafId = null;
    });
  }

  /**
   * ???????????? PNG Uint8Array?
   * ?????????pixelmatch ??????
   *
   * ???WebGPURenderer.render() ??????? await?
   */
  async snapshotPNG(): Promise<Uint8Array> {
    if (this.contextLost) throw new Error('Renderer context lost');
    // ????? rAF???????
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.dirty = false;
    }
    const result = this.renderer.render(this.scene, this.camera) as unknown;
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      await result;
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      this.canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!blob) throw new Error('canvas.toBlob returned null');
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  dispose(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    if (this.backend === 'webgl2') {
      this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
      this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    }

    for (const [id, node] of this.nodes) {
      this.removeNode(id, node);
    }
    this.nodes.clear();
    this.textureCache.dispose();
    disposeTextCache();
    this.unitPlane.dispose();
    this.renderer.dispose();
  }

  private computePixelRect(frame: FrameData) {
    return snapRectToPixels(
      wc3ToPixelX(frame.x),
      wc3ToPixelYBottom(frame.y),
      wc3ToPixelW(frame.width),
      wc3ToPixelH(frame.height),
    );
  }

  private addNode(id: string, frame: FrameData): void {
    const group = new THREE.Group();
    const baseMesh = new THREE.Mesh(this.unitPlane, createMaterial(frame));
    baseMesh.userData.frameId = id;
    group.add(baseMesh);

    const node: FrameRenderNode = {
      group,
      baseMesh,
      backgroundMesh: null,
      textMesh: null,
      controlMesh: null,
      fillMesh: null,
      thumbMesh: null,
      borderMesh: null,
      edgeMeshes: new Map(),
      revision: 0,
    };

    group.userData.frameId = id;
    this.scene.add(group);
    this.nodes.set(id, node);
    this.updateNode(id, frame);
  }

  private updateNode(id: string, frame: FrameData): void {
    const node = this.nodes.get(id);
    if (!node) return;

    node.revision += 1;
    const revision = node.revision;
    const { x, y, w, h } = this.computePixelRect(frame);
    const renderOrderBase = frame.z || 0;

    node.group.position.set(x, y, frame.z || 0);

    const baseTexturePath = this.resolveTexturePath(frame.texture ?? frame.textureFile);
    const hasBackdropVisuals = Boolean(frame.backdropBackground || frame.backdropEdgeFile);

    node.baseMesh.position.set(w / 2, h / 2, 0);
    node.baseMesh.scale.set(w, h, 1);
    node.baseMesh.renderOrder = renderOrderBase;
    node.baseMesh.visible = !hasBackdropVisuals || Boolean(baseTexturePath);
    updateMaterial(node.baseMesh.material as FrameMaterial, frame);

    if (baseTexturePath) {
      const texOpts = this.computeTexCoordOptions(frame);
      void this.textureCache.loadTexture(baseTexturePath)
        .then((texture) => {
          if (!this.isNodeCurrent(id, revision)) return;
          updateMaterial(node.baseMesh.material as FrameMaterial, frame, {
            texture,
            ...texOpts,
          });
          node.baseMesh.visible = true;
          this.markDirty();
        })
        .catch(() => {
          if (!this.isNodeCurrent(id, revision)) return;
          updateMaterial(node.baseMesh.material as FrameMaterial, frame, {
            texture: this.textureCache.getFallback(),
          });
          node.baseMesh.visible = true;
          this.markDirty();
        });
    }

    this.syncBackdropBackground(id, node, frame, revision, w, h, renderOrderBase);
    this.syncBackdropEdges(id, node, frame, revision, w, h, renderOrderBase);
    this.syncControlTexture(id, node, frame, revision, w, h, renderOrderBase);
    this.syncStatusBarFill(id, node, frame, w, h, renderOrderBase);
    this.syncSliderThumb(id, node, frame, revision, w, h, renderOrderBase);
    this.syncEditBoxBorder(id, node, frame, w, h, renderOrderBase);
    this.syncText(id, node, frame, w, h, renderOrderBase);
  }

  private syncBackdropBackground(
    id: string,
    node: FrameRenderNode,
    frame: FrameData,
    revision: number,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    const backgroundPath = this.resolveTexturePath(frame.backdropBackground);
    if (!backgroundPath) {
      if (node.backgroundMesh) {
        node.group.remove(node.backgroundMesh);
        (node.backgroundMesh.material as THREE.Material).dispose();
        node.backgroundMesh = null;
      }
      return;
    }

    const leftInset = frame.backdropBackgroundInsets ? wc3ToPixelW(frame.backdropBackgroundInsets[0]) : 0;
    const topInset = frame.backdropBackgroundInsets ? wc3ToPixelH(frame.backdropBackgroundInsets[1]) : 0;
    const rightInset = frame.backdropBackgroundInsets ? wc3ToPixelW(frame.backdropBackgroundInsets[2]) : 0;
    const bottomInset = frame.backdropBackgroundInsets ? wc3ToPixelH(frame.backdropBackgroundInsets[3]) : 0;
    const placement = computeBackgroundPlacement(
      width,
      height,
      frame.backdropBackgroundInsets ? [leftInset, topInset, rightInset, bottomInset] : null,
    );
    const innerWidth = placement.innerWidth;
    const innerHeight = placement.innerHeight;

    if (!node.backgroundMesh) {
      node.backgroundMesh = new THREE.Mesh(this.unitPlane, createMaterial(frame));
      node.backgroundMesh.userData.frameId = id;
      node.group.add(node.backgroundMesh);
    }

    const mesh = node.backgroundMesh;
    mesh.visible = placement.visible;
    mesh.position.set(placement.centerX, placement.centerY, 0.1);
    mesh.scale.set(placement.scaleX, placement.scaleY, 1);
    mesh.renderOrder = renderOrderBase + 0.1;
    updateMaterial(mesh.material as FrameMaterial, frame);

    void this.textureCache.loadTexture(backgroundPath)
      .then((texture) => {
        if (!this.isNodeCurrent(id, revision)) return;

        const intrinsicTextureWidth = texture.image
          && typeof texture.image === 'object'
          && 'width' in texture.image
          ? Number(texture.image.width)
          : 1;

        const tileSizePx = frame.backdropTileBackground
          ? (frame.backdropBackgroundSize ? wc3ToPixelW(frame.backdropBackgroundSize) : intrinsicTextureWidth)
          : undefined;
        const repeatX = tileSizePx ? innerWidth / tileSizePx : 1;
        const repeatY = tileSizePx ? innerHeight / tileSizePx : 1;

        updateMaterial(mesh.material as FrameMaterial, frame, {
          texture,
          repeatX,
          repeatY,
          wrapX: frame.backdropTileBackground ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
          wrapY: frame.backdropTileBackground ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
        });
        mesh.visible = true;
        this.markDirty();
      })
      .catch(() => {
        if (!this.isNodeCurrent(id, revision)) return;
        updateMaterial(mesh.material as FrameMaterial, frame, {
          texture: this.textureCache.getFallback(),
        });
        mesh.visible = true;
        this.markDirty();
      });
  }

  private syncBackdropEdges(
    id: string,
    node: FrameRenderNode,
    frame: FrameData,
    revision: number,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    const edgePath = this.resolveTexturePath(frame.backdropEdgeFile);
    const flags = frame.backdropCornerFlags ? parseCornerFlags(frame.backdropCornerFlags) : [];
    // cornerSize ????????????????????
    const cornerSizePx = frame.backdropCornerSize ? snapToPixel(wc3ToPixelW(frame.backdropCornerSize)) : 0;

    if (!edgePath || flags.length === 0 || cornerSizePx <= 0) {
      this.clearEdgeMeshes(node);
      return;
    }

    const expectedFlags = new Set(flags);
    for (const [flag, mesh] of node.edgeMeshes) {
      if (!expectedFlags.has(flag)) {
        node.group.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        node.edgeMeshes.delete(flag);
      }
    }

    for (const flag of flags) {
      if (!node.edgeMeshes.has(flag)) {
        const mesh = new THREE.Mesh(this.unitPlane, createMaterial(frame));
        mesh.userData.frameId = id;
        node.edgeMeshes.set(flag, mesh);
        node.group.add(mesh);
      }
      this.layoutEdgeMesh(node.edgeMeshes.get(flag)!, flag, width, height, cornerSizePx, renderOrderBase);
      updateMaterial(node.edgeMeshes.get(flag)!.material as FrameMaterial, frame);
    }

    void this.textureCache.loadBorderAtlas(edgePath)
      .then((atlas) => {
        if (!this.isNodeCurrent(id, revision)) return;

        for (const flag of flags) {
          const mesh = node.edgeMeshes.get(flag);
          if (!mesh) continue;
          const texture = atlas.get(flag) ?? this.textureCache.getFallback();
          const repeatX = flag === 'T' || flag === 'B'
            ? Math.max(1, (width - cornerSizePx * 2) / cornerSizePx)
            : 1;
          const repeatY = flag === 'L' || flag === 'R'
            ? Math.max(1, (height - cornerSizePx * 2) / cornerSizePx)
            : 1;

          updateMaterial(mesh.material as FrameMaterial, frame, {
            texture,
            repeatX,
            repeatY,
            wrapX: flag === 'T' || flag === 'B' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
            wrapY: flag === 'L' || flag === 'R' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping,
          });
          mesh.visible = true;
        }

        this.markDirty();
      })
      .catch((err) => {
        if (!this.isNodeCurrent(id, revision)) return;
        console.warn(`[SGM] loadBorderAtlas FAILED "${frame.name}" path=${edgePath}`, err);

        for (const flag of flags) {
          const mesh = node.edgeMeshes.get(flag);
          if (!mesh) continue;
          updateMaterial(mesh.material as FrameMaterial, frame, {
            texture: this.textureCache.getFallback(),
          });
          mesh.visible = true;
        }

        this.markDirty();
      });
  }

  private layoutEdgeMesh(
    mesh: THREE.Mesh,
    flag: EdgeFlag,
    width: number,
    height: number,
    cornerSizePx: number,
    renderOrderBase: number,
  ): void {
    const p = computeEdgePlacement(flag, width, height, cornerSizePx);
    mesh.renderOrder = renderOrderBase + p.renderOrderOffset;
    mesh.visible = p.visible;
    mesh.position.set(p.centerX, p.centerY, 0.2);
    mesh.scale.set(p.scaleX, p.scaleY, 1);
  }

  private syncText(
    id: string,
    node: FrameRenderNode,
    frame: FrameData,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    const texture = renderTextTexture(frame, width, height, this.buttonPreviewState);
    if (!texture) {
      if (node.textMesh) {
        node.group.remove(node.textMesh);
        (node.textMesh.material as THREE.Material).dispose();
        node.textMesh = null;
      }
      return;
    }

    if (!node.textMesh) {
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      node.textMesh = new THREE.Mesh(this.unitPlane, mat);
      node.textMesh.userData.frameId = id;
      node.group.add(node.textMesh);
    } else {
      const mat = node.textMesh.material as THREE.MeshBasicMaterial;
      mat.map = texture;
      mat.needsUpdate = true;
    }

    node.textMesh.position.set(width / 2, height / 2, 0.5);
    node.textMesh.scale.set(width, height, 1);
    node.textMesh.renderOrder = renderOrderBase + 0.5;
    node.textMesh.visible = true;
  }

  // ---- Phase 4: 控件渲染 ----

  /** 计算 texCoord �?u_offset / u_repeat */
  private computeTexCoordOptions(frame: FrameData): { repeatX?: number; repeatY?: number; offsetX?: number; offsetY?: number } {
    if (!frame.texCoord) return {};
    const [left, right, top, bottom] = frame.texCoord;
    return {
      repeatX: right - left,
      repeatY: bottom - top,
      offsetX: left,
      offsetY: 1 - bottom,
    };
  }

  /**
   * 控件纹理 �?Button controlBackdrop / Highlight / Sprite
   * 设计器仅展示默认状态纹�?
   */
  private syncControlTexture(
    id: string,
    node: FrameRenderNode,
    frame: FrameData,
    revision: number,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    const isButton = frame.type === FrameType.BUTTON
      || frame.type === FrameType.GLUETEXTBUTTON
      || frame.type === FrameType.GLUEBUTTON
      || frame.type === FrameType.SIMPLEBUTTON
      || frame.type === FrameType.BROWSER_BUTTON
      || frame.type === FrameType.SCRIPT_DIALOG_BUTTON;
    const isCheckbox = frame.type === FrameType.CHECKBOX;
    const isHighlight = frame.type === FrameType.HIGHLIGHT;
    const isSprite = frame.type === FrameType.SPRITE;

    let textureProp: string | undefined;
    if (isCheckbox || isButton) {
      // ????? resolveButtonState ???????? + Checkbox.checked ??.
      const resolved = resolveButtonState(frame, this.buttonPreviewState);
      textureProp = resolved.backdropPath;
    } else if (isHighlight) {
      textureProp = frame.highlightAlphaFile;
    } else if (isSprite) {
      textureProp = frame.backgroundArt;
    }

    const texturePath = this.resolveTexturePath(textureProp);
    if (!texturePath) {
      this.disposeControlMesh(node);
      return;
    }

    if (!node.controlMesh) {
      node.controlMesh = new THREE.Mesh(this.unitPlane, createMaterial(frame));
      node.controlMesh.userData.frameId = id;
      node.group.add(node.controlMesh);
    }

    node.controlMesh.position.set(width / 2, height / 2, 0.15);
    node.controlMesh.scale.set(width, height, 1);
    node.controlMesh.renderOrder = renderOrderBase + 0.15;
    node.controlMesh.visible = false;
    updateMaterial(node.controlMesh.material as FrameMaterial, frame);

    void this.textureCache.loadTexture(texturePath)
      .then((texture) => {
        if (!this.isNodeCurrent(id, revision)) return;
        if (!node.controlMesh) return;
        updateMaterial(node.controlMesh.material as FrameMaterial, frame, { texture });
        node.controlMesh.visible = true;
        this.markDirty();
      })
      .catch(() => {
        if (!this.isNodeCurrent(id, revision)) return;
        if (!node.controlMesh) return;
        updateMaterial(node.controlMesh.material as FrameMaterial, frame, {
          texture: this.textureCache.getFallback(),
        });
        node.controlMesh.visible = true;
        this.markDirty();
      });
  }

  /**
   * StatusBar 填充条渲�?
   * 在设计器中显�?50% 填充预览
   */
  private syncStatusBarFill(
    _id: string,
    node: FrameRenderNode,
    frame: FrameData,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    const isStatusBar = frame.type === FrameType.SIMPLESTATUSBAR
      || frame.type === FrameType.STATUSBAR;

    if (!isStatusBar) {
      this.disposeFillMesh(node);
      return;
    }

    const fillFraction = 0.5; // 设计器预�?50%

    if (!node.fillMesh) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x00cc44,
        transparent: true,
        opacity: 0.35,
        depthTest: false,
        depthWrite: false,
      });
      node.fillMesh = new THREE.Mesh(this.unitPlane, mat);
      node.group.add(node.fillMesh);
    }

    const fillW = width * fillFraction;
    node.fillMesh.position.set(fillW / 2, height / 2, 0.3);
    node.fillMesh.scale.set(fillW, height, 1);
    node.fillMesh.renderOrder = renderOrderBase + 0.3;
    node.fillMesh.visible = true;
  }

  /**
   * Slider 滑块渲染
   * 简单的滑块指示器，居中显示
   */
  private syncSliderThumb(
    _id: string,
    node: FrameRenderNode,
    frame: FrameData,
    _revision: number,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    const isSlider = frame.type === FrameType.SLIDER || frame.type === FrameType.SCROLLBAR;

    if (!isSlider) {
      this.disposeThumbMesh(node);
      return;
    }

    if (!node.thumbMesh) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.6,
        depthTest: false,
        depthWrite: false,
      });
      node.thumbMesh = new THREE.Mesh(this.unitPlane, mat);
      node.group.add(node.thumbMesh);
    }

    const isHorizontal = frame.sliderLayoutHorizontal || !frame.sliderLayoutVertical;
    // 根据 minValue/maxValue/sliderInitialValue 计算滑块位置，无数据时居�?
    const minV = frame.minValue ?? 0;
    const maxV = frame.maxValue ?? 100;
    const curV = frame.sliderInitialValue ?? (minV + maxV) / 2;
    const range = maxV - minV;
    const thumbFraction = range > 0 ? Math.max(0, Math.min(1, (curV - minV) / range)) : 0.5;

    if (isHorizontal) {
      const thumbW = Math.max(8, width * 0.08);
      const thumbPos = thumbFraction * (width - thumbW) + thumbW / 2;
      node.thumbMesh.position.set(thumbPos, height / 2, 0.3);
      node.thumbMesh.scale.set(thumbW, height * 0.8, 1);
    } else {
      const thumbH = Math.max(8, height * 0.08);
      const thumbPos = thumbFraction * (height - thumbH) + thumbH / 2;
      node.thumbMesh.position.set(width / 2, thumbPos, 0.3);
      node.thumbMesh.scale.set(width * 0.8, thumbH, 1);
    }

    node.thumbMesh.renderOrder = renderOrderBase + 0.3;
    node.thumbMesh.visible = true;
  }

  /**
   * EditBox 边框渲染
   */
  private syncEditBoxBorder(
    _id: string,
    node: FrameRenderNode,
    frame: FrameData,
    width: number,
    height: number,
    renderOrderBase: number,
  ): void {
    if (frame.type !== FrameType.EDITBOX) {
      this.disposeBorderMesh(node);
      return;
    }

    const borderColor = frame.editBorderColor
      ? new THREE.Color(frame.editBorderColor[0], frame.editBorderColor[1], frame.editBorderColor[2])
      : new THREE.Color(0.6, 0.6, 0.6);
    const borderAlpha = frame.editBorderColor ? frame.editBorderColor[3] : 0.8;

    if (!node.borderMesh) {
      const positions = new Float32Array(8 * 3); // 4 lines × 2 points × 3 components
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.LineBasicMaterial({
        color: borderColor,
        transparent: true,
        opacity: borderAlpha,
        depthTest: false,
        depthWrite: false,
      });
      node.borderMesh = new THREE.LineSegments(geometry, mat);
      node.group.add(node.borderMesh);
    }

    // 更新边框顶点
    const geo = node.borderMesh.geometry;
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    // Bottom edge
    pos.setXYZ(0, 0, 0, 0.25); pos.setXYZ(1, width, 0, 0.25);
    // Right edge
    pos.setXYZ(2, width, 0, 0.25); pos.setXYZ(3, width, height, 0.25);
    // Top edge
    pos.setXYZ(4, width, height, 0.25); pos.setXYZ(5, 0, height, 0.25);
    // Left edge
    pos.setXYZ(6, 0, height, 0.25); pos.setXYZ(7, 0, 0, 0.25);
    pos.needsUpdate = true;

    const mat = node.borderMesh.material as THREE.LineBasicMaterial;
    mat.color.copy(borderColor);
    mat.opacity = borderAlpha;

    node.borderMesh.renderOrder = renderOrderBase + 0.25;
    node.borderMesh.visible = true;
  }

  // ---- �?mesh 释放辅助方法 ----

  private disposeControlMesh(node: FrameRenderNode): void {
    if (node.controlMesh) {
      node.group.remove(node.controlMesh);
      (node.controlMesh.material as THREE.Material).dispose();
      node.controlMesh = null;
    }
  }

  private disposeFillMesh(node: FrameRenderNode): void {
    if (node.fillMesh) {
      node.group.remove(node.fillMesh);
      (node.fillMesh.material as THREE.Material).dispose();
      node.fillMesh = null;
    }
  }

  private disposeThumbMesh(node: FrameRenderNode): void {
    if (node.thumbMesh) {
      node.group.remove(node.thumbMesh);
      (node.thumbMesh.material as THREE.Material).dispose();
      node.thumbMesh = null;
    }
  }

  private disposeBorderMesh(node: FrameRenderNode): void {
    if (node.borderMesh) {
      node.group.remove(node.borderMesh);
      (node.borderMesh.material as THREE.Material).dispose();
      node.borderMesh.geometry.dispose();
      node.borderMesh = null;
    }
  }

  private clearEdgeMeshes(node: FrameRenderNode): void {
    for (const mesh of node.edgeMeshes.values()) {
      node.group.remove(mesh);
      (mesh.material as THREE.Material).dispose();
    }
    node.edgeMeshes.clear();
  }

  private isNodeCurrent(id: string, revision: number): boolean {
    const node = this.nodes.get(id);
    return Boolean(node && node.revision === revision);
  }

  private disposeNodeResources(node: FrameRenderNode): void {
    (node.baseMesh.material as THREE.Material).dispose();
    if (node.backgroundMesh) (node.backgroundMesh.material as THREE.Material).dispose();
    if (node.textMesh) (node.textMesh.material as THREE.Material).dispose();
    this.disposeControlMesh(node);
    this.disposeFillMesh(node);
    this.disposeThumbMesh(node);
    this.disposeBorderMesh(node);
    for (const mesh of node.edgeMeshes.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    node.edgeMeshes.clear();
  }

  private removeNode(id: string, node: FrameRenderNode): void {
    this.scene.remove(node.group);
    this.disposeNodeResources(node);
    this.nodes.delete(id);
  }
}
