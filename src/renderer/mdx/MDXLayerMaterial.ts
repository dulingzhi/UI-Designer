// ============================================================
// MDXLayerMaterial — MDX Material/Layer → NodeMaterial
// ============================================================
// MDX Material 由若干 Layer 叠加组成；为每一层独立创建一个
// MeshBasicNodeMaterial，上层按 renderOrder 叠加。
//
// 已支持：
//   - FilterMode → D3D alpha blend
//   - 团队色（TextureID === replaceable 1/2）由外层 resolver 处理
//   - TVertexAnim（静态 UV 变换：Translation/Rotation/Scaling 取首帧）
//
// 延后：
//   - 动画 Alpha / EmissiveGain 等 keyframed 属性（Alpha 已被 GeosetAnim 覆盖大部分用例）
//   - 动画 TVertexAnim（需 per-frame uniform 更新）

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
// @ts-ignore war3-model 无类型声明
import type { Material, Layer, Texture, TVertexAnim } from 'war3-model';

/** MDX FilterMode (war3-model enum) */
enum FilterMode {
  None = 0,
  Transparent = 1,
  Blend = 2,
  Additive = 3,
  AddAlpha = 4,
  Modulate = 5,
  Modulate2x = 6,
}

function applyFilterMode(mat: MeshBasicNodeMaterial, mode: FilterMode | undefined): void {
  const m = mode ?? FilterMode.None;
  mat.depthWrite = m === FilterMode.None || m === FilterMode.Transparent;
  mat.depthTest = true;
  mat.transparent = m !== FilterMode.None;

  switch (m) {
    case FilterMode.None:
      mat.blending = THREE.NoBlending;
      mat.transparent = false;
      break;
    case FilterMode.Transparent:
      mat.alphaTest = 0.75;
      mat.blending = THREE.NormalBlending;
      break;
    case FilterMode.Blend:
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.SrcAlphaFactor;
      mat.blendDst = THREE.OneMinusSrcAlphaFactor;
      break;
    case FilterMode.Additive:
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneFactor;
      break;
    case FilterMode.AddAlpha:
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.SrcAlphaFactor;
      mat.blendDst = THREE.OneFactor;
      break;
    case FilterMode.Modulate:
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.DstColorFactor;
      mat.blendDst = THREE.ZeroFactor;
      break;
    case FilterMode.Modulate2x:
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.DstColorFactor;
      mat.blendDst = THREE.SrcColorFactor;
      break;
  }
}

/** 从 AnimVector | number 取首帧数值（向量则取前 n 个分量） */
function firstVector(v: any, fallback: number[]): number[] {
  if (!v) return fallback;
  if (v instanceof Float32Array || v instanceof Int32Array || Array.isArray(v)) {
    return Array.from(v as ArrayLike<number>);
  }
  if (v && Array.isArray(v.Keys) && v.Keys.length > 0) {
    return Array.from(v.Keys[0].Vector as ArrayLike<number>);
  }
  return fallback;
}

/** 将 TVertexAnim 首帧静态值应用到 Three.js Texture 的 UV 变换参数。 */
function applyTVertexAnimStatic(tex: THREE.Texture, anim: TVertexAnim): void {
  if (anim.Translation) {
    const t = firstVector(anim.Translation, [0, 0]);
    // MDX 中 Translation 是 UV 偏移
    tex.offset.set(t[0] ?? 0, t[1] ?? 0);
  }
  if (anim.Rotation) {
    // Rotation 是四元数 (x,y,z,w)，对 UV 平面仅 Z 轴旋转有意义
    const q = firstVector(anim.Rotation, [0, 0, 0, 1]);
    // atan2(2*(w*z + x*y), 1 - 2*(y*y + z*z))
    const x = q[0] ?? 0, y = q[1] ?? 0, z = q[2] ?? 0, w = q[3] ?? 1;
    tex.rotation = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    tex.center.set(0.5, 0.5);
  }
  if (anim.Scaling) {
    const s = firstVector(anim.Scaling, [1, 1]);
    tex.repeat.set(s[0] ?? 1, s[1] ?? 1);
  }
  tex.needsUpdate = true;
}

/**
 * 为一个 MDX Layer 创建独立 NodeMaterial
 * @param textures 模型的 Textures[] 引用
 * @param resolveTexture (texIndex) => THREE.Texture | null
 * @param textureAnims 模型的 TextureAnims[] 引用（可选，用于 TVertexAnimId 查找）
 */
export function buildSingleLayerMaterial(
  layer: Layer,
  textures: Texture[],
  resolveTexture: (texIndex: number) => THREE.Texture | null,
  textureAnims?: TVertexAnim[],
): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial({
    color: 0xffffff,
    side: (layer.Shading ?? 0) & 16 /* TwoSided */ ? THREE.DoubleSide : THREE.FrontSide,
  });

  applyFilterMode(mat, layer.FilterMode);

  // 静态 alpha（AnimVector 取首帧）
  if (typeof layer.Alpha === 'number') {
    mat.opacity = layer.Alpha;
  } else if (layer.Alpha && 'Keys' in (layer.Alpha as any)) {
    const first = (layer.Alpha as any).Keys[0]?.Vector?.[0];
    if (typeof first === 'number') mat.opacity = first;
  }

  // 静态 TextureID（AnimVector 取首帧）
  let texId: number | null = null;
  if (typeof layer.TextureID === 'number') {
    texId = layer.TextureID;
  } else if (layer.TextureID && 'Keys' in (layer.TextureID as any)) {
    texId = (layer.TextureID as any).Keys[0]?.Vector?.[0] ?? null;
  }

  if (texId !== null && textures[texId]) {
    const tex = resolveTexture(texId);
    if (tex) {
      mat.map = tex;
      const flags = textures[texId].Flags ?? 0;
      tex.wrapS = flags & 1 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
      tex.wrapT = flags & 2 ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

      // TVertexAnim（静态 UV 变换）
      if (
        typeof layer.TVertexAnimId === 'number' &&
        layer.TVertexAnimId >= 0 &&
        textureAnims &&
        textureAnims[layer.TVertexAnimId]
      ) {
        applyTVertexAnimStatic(tex, textureAnims[layer.TVertexAnimId]);
      }
    }
  }

  mat.needsUpdate = true;
  return mat;
}

/**
 * 为一个 MDX Material 创建所有 Layer 对应的 NodeMaterial 列表
 * 调用方应为每一层创建独立的 mesh 并按索引递增设置 renderOrder
 */
export function buildLayerMaterials(
  material: Material,
  textures: Texture[],
  resolveTexture: (texIndex: number) => THREE.Texture | null,
  textureAnims?: TVertexAnim[],
): MeshBasicNodeMaterial[] {
  const layers: Layer[] = material.Layers ?? [];
  return layers.map((layer) => buildSingleLayerMaterial(layer, textures, resolveTexture, textureAnims));
}

/**
 * @deprecated 改用 buildLayerMaterials（多层合成）
 * 保留单材质版本以便向后兼容：仅返回第一层
 */
export function buildLayerMaterial(
  material: Material,
  textures: Texture[],
  resolveTexture: (texIndex: number) => THREE.Texture | null,
  textureAnims?: TVertexAnim[],
): MeshBasicNodeMaterial {
  return buildLayerMaterials(material, textures, resolveTexture, textureAnims)[0]
    ?? new MeshBasicNodeMaterial({ color: 0xffffff });
}
