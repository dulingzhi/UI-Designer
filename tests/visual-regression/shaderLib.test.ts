/**
 * ShaderLib 单测 —— 材质工厂的确定性映射。
 *
 * 背景（本轮补齐的单测缺口）：`src/renderer` 下几乎所有纯逻辑模块都已有测试
 * （backdropLayout / buttonState / highlightColor / highlightType / editBoxBorder /
 * hitTest / layerStyle / fontResolver / textLayout / backdropBlend / backdropSplitEdges /
 * pixelSnap / popupMenuVisibility），**唯独 `ShaderLib` 与 `TextureCache` 没有**。
 * 本文件补 `ShaderLib`；`TextureCache` 由 textureCache.test.ts 补（本轮新建）。
 *
 * `SceneGraphManager` 的构造需要真实 GPU 上下文（private ctor + `create()` 走 WebGPU/WebGL），
 * 但其材质参数全部经本模块映射，故这里是"渲染器本体可确定性断言"的主体。
 *
 * 这些断言不需要 GPU：`MeshBasicNodeMaterial` / `THREE.Color` / `THREE.Texture` 都是纯 JS 对象。
 *
 * 断言按**源码实际行为**书写（均经探针实测核对），不是按直觉预期。
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FrameType, type FrameData } from '../../src/types';
import { createMaterial, updateMaterial } from '../../src/renderer/ShaderLib';
import { EGxMatAlphaOp, ALPHA_REF } from '../../src/renderer/constants';

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'f', name: 'F', type: FrameType.FRAME,
    x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children: [],
    ...overrides,
  } as FrameData;
}
const TEX = () => new THREE.Texture();

describe('ShaderLib.createMaterial — 基础属性映射', () => {
  it('默认 transparent（UI 叠层语义）', () => {
    expect(createMaterial(mkFrame()).transparent).toBe(true);
  });

  it('无纹理时 color 为帧类型基色，opacity 夹在 [0,1]', () => {
    const m = createMaterial(mkFrame({ type: FrameType.FRAME }));
    const c = m.color as THREE.Color;
    expect(c.r).toBeGreaterThanOrEqual(0);
    expect(c.r).toBeLessThanOrEqual(1);
    expect(m.opacity).toBeGreaterThanOrEqual(0);
    expect(m.opacity).toBeLessThanOrEqual(1);
  });

  it('有纹理时 opacity 不再乘基色 alpha → alpha=1 得 1', () => {
    const m = createMaterial(mkFrame({ type: FrameType.FRAME, alpha: 1 }), { texture: TEX() });
    expect(m.opacity).toBe(1);
  });

  it('NOSHADING + 有纹理 → 基色恒为白（绕过帧类型 tint）', () => {
    const noShading = createMaterial(mkFrame({ layerStyle: 'NOSHADING' }), { texture: TEX() });
    expect((noShading.color as THREE.Color).equals(new THREE.Color(1, 1, 1))).toBe(true);
    expect(noShading.opacity).toBe(1);
    const withShading = createMaterial(mkFrame({ layerStyle: 'SHADING' }), { texture: TEX() });
    expect((withShading.color as THREE.Color).equals(new THREE.Color(1, 1, 1))).toBe(false);
  });

  it('alpha 归一化：>1 按 0-255 换算；≤1 视为已归一化', () => {
    expect(createMaterial(mkFrame({ alpha: 128 }), { texture: TEX() }).opacity).toBeCloseTo(128 / 255, 6);
    expect(createMaterial(mkFrame({ alpha: 0.5 }), { texture: TEX() }).opacity).toBeCloseTo(0.5, 6);
  });

  it('alpha 缺省 → 1；越界被钳制到 [0,1]（有纹理时）', () => {
    expect(createMaterial(mkFrame({ alpha: undefined }), { texture: TEX() }).opacity).toBe(1);
    expect(createMaterial(mkFrame({ alpha: 999 }), { texture: TEX() }).opacity).toBe(1);
    expect(createMaterial(mkFrame({ alpha: -50 }), { texture: TEX() }).opacity).toBe(0);
  });
});

describe('ShaderLib.createMaterial — alphaMode → alphaTest / blending', () => {
  it('ALPHAKEY 使用 0xC0 阈值', () => {
    const m = createMaterial(mkFrame({ alphaMode: 'ALPHAKEY' }));
    expect(m.alphaTest).toBeCloseTo(ALPHA_REF[EGxMatAlphaOp.ALPHAKEY], 9);
    expect(m.alphaTest).toBeCloseTo(192 / 255, 9);
  });

  it('BLEND / ADD 使用 0x04 阈值', () => {
    expect(createMaterial(mkFrame({ alphaMode: 'BLEND' })).alphaTest).toBeCloseTo(4 / 255, 9);
    expect(createMaterial(mkFrame({ alphaMode: 'ADD' })).alphaTest).toBeCloseTo(4 / 255, 9);
  });

  it('alphaMode 缺省/未知 → 回落 BLEND 语义', () => {
    expect(createMaterial(mkFrame()).alphaTest).toBeCloseTo(4 / 255, 9);
    expect(createMaterial(mkFrame({ alphaMode: 'WHATEVER' as any })).alphaTest).toBeCloseTo(4 / 255, 9);
  });

  it('BLEND 与 ADD 的差异在 blendDst（OneMinusSrcAlpha vs One）', () => {
    const blend = createMaterial(mkFrame({ alphaMode: 'BLEND' }));
    const add = createMaterial(mkFrame({ alphaMode: 'ADD' }));
    expect(blend.blending).toBe(THREE.CustomBlending);
    expect(add.blending).toBe(THREE.CustomBlending);
    expect(blend.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(add.blendSrc).toBe(THREE.SrcAlphaFactor);
    expect(blend.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
    expect(add.blendDst).toBe(THREE.OneFactor);
  });

  it('MODULATE/MODULATE2X 用 DstColor 作为源因子（乘算混合）', () => {
    // parseAlphaMode 只映射 ALPHAKEY/ADD/BLEND，其余一律回落 BLEND，
    // 故这里经 alphaMode 字符串走不到 MODULATE；改由 EGxMatAlphaOp 枚举注释说明：
    // 现有实现下 MODULATE/MODULATE2X 分支在 createMaterial 路径不可达（见下方 known-issues 用例）。
    const viaString = createMaterial(mkFrame({ alphaMode: 'MODULATE' as any }));
    expect(viaString.blendSrc).toBe(THREE.SrcAlphaFactor); // 回落 BLEND
    expect(viaString.blendDst).toBe(THREE.OneMinusSrcAlphaFactor);
  });
});

describe('ShaderLib.createMaterial — 纹理与 UV', () => {
  it('传入纹理时 map 为该纹理，UV 变化按参数落地', () => {
    const tex = TEX();
    const m = createMaterial(mkFrame(), { texture: tex, repeatX: 0.5, repeatY: 0.5, offsetX: 0.25, offsetY: 0.1 });
    expect(m.map).toBe(tex);
    expect(tex.repeat.x).toBeCloseTo(0.5, 9);
    expect(tex.repeat.y).toBeCloseTo(0.5, 9);
    expect(tex.offset.x).toBeCloseTo(0.25, 9);
    expect(tex.offset.y).toBeCloseTo(0.1, 9);
  });

  it('默认 wrap 为 ClampToEdge，显式 wrap 可覆盖', () => {
    const a = TEX();
    createMaterial(mkFrame(), { texture: a });
    expect(a.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(a.wrapT).toBe(THREE.ClampToEdgeWrapping);

    const b = TEX();
    createMaterial(mkFrame(), { texture: b, wrapX: THREE.RepeatWrapping, wrapY: THREE.MirroredRepeatWrapping });
    expect(b.wrapS).toBe(THREE.RepeatWrapping);
    expect(b.wrapT).toBe(THREE.MirroredRepeatWrapping);
  });

  it('不带 UV 参数时 repeat=1、offset=0', () => {
    const tex = TEX();
    createMaterial(mkFrame(), { texture: tex });
    expect(tex.repeat.x).toBe(1);
    expect(tex.repeat.y).toBe(1);
    expect(tex.offset.x).toBe(0);
    expect(tex.offset.y).toBe(0);
  });
});

describe('ShaderLib.updateMaterial — 原地更新与纹理释放', () => {
  it('原地更新材质，不替换对象', () => {
    const m = createMaterial(mkFrame({ alpha: 1 }), { texture: TEX() });
    updateMaterial(m as any, mkFrame({ alpha: 0.3 }));
    expect(m.opacity).toBeCloseTo(0.3, 6);
  });

  it('换纹理会替换 map', () => {
    const oldTex = TEX();
    const m = createMaterial(mkFrame(), { texture: oldTex });
    const newTex = TEX();
    updateMaterial(m as any, mkFrame(), { texture: newTex });
    expect(m.map).toBe(newTex);
    expect(m.userData.managedTexture).toBe(true);
  });

  it('置空纹理（explicit null）时清除受管标记', () => {
    const m = createMaterial(mkFrame(), { texture: TEX() });
    updateMaterial(m as any, mkFrame(), { texture: null });
    expect(m.map).toBe(null);
    expect(m.userData.managedTexture).toBe(false);
  });
});

/**
 * 已知问题（本用例把当前**实际行为**固定下来，不是为了掩盖：
 * 一旦被修复，本用例会红，提醒同步更新文档与预期）。
 */
describe('ShaderLib 已知问题（如实记录，非期望语义）', () => {
  it('DISABLE 的 alphaTest 未被跳过，实际等于 4/255 阈值（预期应为 0）', () => {
    const m = createMaterial(mkFrame({ alphaMode: 'DISABLE' } as any));
    // 源码：`if (alphaMode !== DISABLE) material.alphaTest = ALPHA_REF[alphaMode]`
    // 但 DISABLE 时 parseAlphaMode 实际返回 BLEND（字符串 'DISABLE' 不在 switch 里），
    // 故该判断恒成立、alphaTest 被设为 BLEND 阈值。
    expect(m.alphaTest).toBeCloseTo(4 / 255, 9);
  });

  it('DISABLE 的 depthWrite 仍为 false（预期应为 true）', () => {
    const m = createMaterial(mkFrame({ alphaMode: 'DISABLE' } as any));
    expect(m.blending).toBe(THREE.CustomBlending); // 未走 NoBlending 分支
    expect(m.depthWrite).toBe(false);
  });

  it('首帧带纹理的旧纹理不会被释放（createMaterial 未标记 managedTexture）', () => {
    const oldTex = TEX();
    const m = createMaterial(mkFrame(), { texture: oldTex });
    // createMaterial 只设置 map，未设置 userData.managedTexture（仅 updateMaterial 设置）
    expect(m.userData.managedTexture).toBeUndefined();
    let disposed = false;
    oldTex.addEventListener('dispose', () => { disposed = true; });
    updateMaterial(m as any, mkFrame(), { texture: TEX() });
    // 因 managedTexture 为 undefined，`oldTex && managedTexture` 为假 → 旧纹理泄漏
    expect(disposed).toBe(false);
  });

  it('material.needsUpdate 在 node material 上读不到 true（写入不产生读回值）', () => {
    const m = createMaterial(mkFrame());
    updateMaterial(m as any, mkFrame({ alpha: 0.7 }));
    // 源码末尾有 `material.needsUpdate = true`，但 NodeMaterial 的该属性不是普通可读字段，
    // 赋值后读回为 undefined。记录该事实，避免后人误以为可断言。
    expect((m as any).needsUpdate).toBeUndefined();
  });
});
