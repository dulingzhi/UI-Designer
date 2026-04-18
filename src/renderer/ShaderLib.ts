// ============================================================
// ShaderLib — Backend-agnostic NodeMaterial 工厂
// ============================================================
// 使用 MeshBasicNodeMaterial，在 WebGPU / WebGL 上均可运行。
// Material 属性直接映射：map / color / opacity / blending / alphaTest，
// 不再手写 GLSL；repeat/offset 由 THREE.Texture 内置 UV 变换处理。
// 保留 THREE.CustomBlending 6 种 D3D alpha 混合因子。

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import type { FrameData } from '../types';
import { getFrameTypeColor, EGxMatAlphaOp, ALPHA_REF } from './constants';

export interface MaterialTextureOptions {
  texture?: THREE.Texture | null;
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
  wrapX?: THREE.Wrapping;
  wrapY?: THREE.Wrapping;
}

/** 新的 Material 类型 — 统一为 MeshBasicNodeMaterial（WebGPU/WebGL 通用） */
export type FrameMaterial = MeshBasicNodeMaterial;

function normalizeFrameAlpha(alpha: number | undefined): number {
  if (alpha === undefined || alpha === null) return 1;
  if (alpha > 1) return Math.max(0, Math.min(1, alpha / 255));
  return Math.max(0, Math.min(1, alpha));
}

/** 将 FrameData.alphaMode 字符串映射为 EGxMatAlphaOp 枚举值 */
function parseAlphaMode(alphaMode: FrameData['alphaMode']): EGxMatAlphaOp {
  switch (alphaMode) {
    case 'ALPHAKEY': return EGxMatAlphaOp.ALPHAKEY;
    case 'ADD':      return EGxMatAlphaOp.ADD;
    case 'BLEND':    return EGxMatAlphaOp.BLEND;
    default:         return EGxMatAlphaOp.BLEND;
  }
}

/** 在材质上设置精确的 D3D alpha 混合因子（WebGPU/WebGL 等效） */
function applyBlendMode(material: MeshBasicNodeMaterial, mode: EGxMatAlphaOp): void {
  material.transparent = true;
  material.depthWrite = false;
  material.depthTest = false;

  switch (mode) {
    case EGxMatAlphaOp.DISABLE:
      material.blending = THREE.NoBlending;
      material.depthWrite = true;
      break;
    case EGxMatAlphaOp.ALPHAKEY:
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneMinusSrcAlphaFactor;
      break;
    case EGxMatAlphaOp.BLEND:
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneMinusSrcAlphaFactor;
      break;
    case EGxMatAlphaOp.ADD:
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneFactor;
      break;
    case EGxMatAlphaOp.MODULATE:
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.DstColorFactor;
      material.blendDst = THREE.ZeroFactor;
      break;
    case EGxMatAlphaOp.MODULATE2X:
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.DstColorFactor;
      material.blendDst = THREE.SrcColorFactor;
      break;
  }
}

function applyTextureUV(tex: THREE.Texture, opts: MaterialTextureOptions): void {
  tex.wrapS = opts.wrapX ?? THREE.ClampToEdgeWrapping;
  tex.wrapT = opts.wrapY ?? THREE.ClampToEdgeWrapping;
  tex.repeat.set(opts.repeatX ?? 1, opts.repeatY ?? 1);
  tex.offset.set(opts.offsetX ?? 0, opts.offsetY ?? 0);
  tex.needsUpdate = true;
}

/**
 * 为帧创建 NodeMaterial
 */
export function createMaterial(
  frame: FrameData,
  textureOptions?: MaterialTextureOptions,
): MeshBasicNodeMaterial {
  const [r, g, b, a] = getFrameTypeColor(frame.type);
  const hasTexture = Boolean(textureOptions?.texture);
  const alphaMode = parseAlphaMode(frame.alphaMode);

  const material = new MeshBasicNodeMaterial({
    map: textureOptions?.texture ?? null,
    color: new THREE.Color(r, g, b),
    opacity: normalizeFrameAlpha(frame.alpha) * (hasTexture ? 1 : a),
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  // alphaTest 替代原 shader 中的 discard（DISABLE 模式不做裁切）
  if (alphaMode !== EGxMatAlphaOp.DISABLE) {
    material.alphaTest = ALPHA_REF[alphaMode];
  }

  applyBlendMode(material, alphaMode);

  if (textureOptions?.texture) {
    applyTextureUV(textureOptions.texture, textureOptions);
  }

  return material;
}

/**
 * 更新 Material 属性（不重建材质）
 */
export function updateMaterial(
  material: MeshBasicNodeMaterial,
  frame: FrameData,
  textureOptions?: MaterialTextureOptions,
): void {
  const [r, g, b, a] = getFrameTypeColor(frame.type);
  const explicitTexture = textureOptions && 'texture' in textureOptions;
  const hasTexture = explicitTexture
    ? Boolean(textureOptions!.texture)
    : Boolean(material.map);
  const alphaMode = parseAlphaMode(frame.alphaMode);

  material.color.setRGB(r, g, b);
  material.opacity = normalizeFrameAlpha(frame.alpha) * (hasTexture ? 1 : a);

  if (alphaMode !== EGxMatAlphaOp.DISABLE) {
    material.alphaTest = ALPHA_REF[alphaMode];
  } else {
    material.alphaTest = 0;
  }

  applyBlendMode(material, alphaMode);

  if (explicitTexture) {
    const newTex = textureOptions!.texture ?? null;
    // 释放管理的旧纹理
    const oldTex = material.map;
    if (oldTex && material.userData.managedTexture && oldTex !== newTex) {
      oldTex.dispose();
    }

    material.map = newTex;
    if (newTex) {
      applyTextureUV(newTex, textureOptions!);
      material.userData.managedTexture = true;
    } else {
      material.userData.managedTexture = false;
    }
  }

  material.needsUpdate = true;
}
