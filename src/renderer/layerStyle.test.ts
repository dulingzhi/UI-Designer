/**
 * round 180：layerStyle 首份行为测试。
 * hasLayerStyleFlag：竖线（本仓约定）+ 逗号（真实 WC3 FDF 变体，防御性兼容）
 * 大小写归一 + trim；resolveMaterialBaseColor：NOSHADING 绕过类型 tint。
 */
import { describe, it, expect } from 'vitest';
import { hasLayerStyleFlag, resolveMaterialBaseColor } from './layerStyle';
import { FrameType } from '../types';

describe('hasLayerStyleFlag', () => {
  it('空/undefined 返回 false', () => {
    expect(hasLayerStyleFlag(undefined, 'NOSHADING')).toBe(false);
    expect(hasLayerStyleFlag('', 'NOSHADING')).toBe(false);
  });

  it('竖线分隔（本仓约定）', () => {
    expect(hasLayerStyleFlag('NOSHADING|IGNORETRACKEVENTS', 'NOSHADING')).toBe(true);
    expect(hasLayerStyleFlag('NOSHADING|IGNORETRACKEVENTS', 'IGNORETRACKEVENTS')).toBe(true);
    expect(hasLayerStyleFlag('NOSHADING|IGNORETRACKEVENTS', 'NOHITTEST')).toBe(false);
  });

  it('逗号分隔兼容（真实 WC3 FDF 变体）', () => {
    expect(hasLayerStyleFlag('NOSHADING,IGNORETRACKEVENTS', 'NOSHADING')).toBe(true);
    expect(hasLayerStyleFlag('NOSHADING, IGNORETRACKEVENTS', 'IGNORETRACKEVENTS')).toBe(true);
  });

  it('大小写归一 + trim', () => {
    expect(hasLayerStyleFlag('noshading', 'NOSHADING')).toBe(true);
    expect(hasLayerStyleFlag(' NOSHADING | IGNORE ', ' noshading ')).toBe(true);
  });

  it('部分匹配不算命中（完整 token 才算）', () => {
    expect(hasLayerStyleFlag('NOSHADINGX', 'NOSHADING')).toBe(false);
  });
});

describe('resolveMaterialBaseColor', () => {
  const baseFrame = { type: FrameType.BACKDROP, layerStyle: undefined } as never;

  it('有纹理 + NOSHADING → 白色（绕过类型 tint）', () => {
    const frame = { ...baseFrame, layerStyle: 'NOSHADING' } as never;
    expect(resolveMaterialBaseColor(frame, true)).toEqual([1, 1, 1, 1]);
  });

  it('无 NOSHADING → 类型 tint 色', () => {
    const c1 = resolveMaterialBaseColor(baseFrame, true);
    const c2 = resolveMaterialBaseColor({ ...baseFrame, layerStyle: 'IGNORETRACKEVENTS' } as never, true);
    expect(c1).not.toEqual([1, 1, 1, 1]);
    expect(c1).toEqual(c2);
  });
});
