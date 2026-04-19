import { describe, it, expect } from 'vitest';
import { resolveBackdropBgAlphaMode } from '../../src/renderer/backdropBlend';
import type { FrameData } from '../../src/types';
import { FrameType } from '../../src/types';

// ============================================================
// resolveBackdropBgAlphaMode — 单元测试
// ============================================================

function mkBackdrop(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'test-backdrop',
    name: 'TestBackdrop',
    type: FrameType.BACKDROP,
    x: 0,
    y: 0,
    width: 0.4,
    height: 0.3,
    anchors: [],
    ...overrides,
  } as FrameData;
}

describe('resolveBackdropBgAlphaMode', () => {
  it('没有 BackdropBlendAll 时默认返回 ALPHAKEY（WC3 颜色键透明）', () => {
    const frame = mkBackdrop();
    expect(resolveBackdropBgAlphaMode(frame)).toBe('ALPHAKEY');
  });

  it('BackdropBlendAll = true 时返回 BLEND（真实 alpha 混合）', () => {
    const frame = mkBackdrop({ backdropBlendAll: true });
    expect(resolveBackdropBgAlphaMode(frame)).toBe('BLEND');
  });

  it('显式 alphaMode ALPHAKEY 时优先，忽略 backdropBlendAll', () => {
    const frame = mkBackdrop({ alphaMode: 'ALPHAKEY', backdropBlendAll: true });
    expect(resolveBackdropBgAlphaMode(frame)).toBe('ALPHAKEY');
  });

  it('显式 alphaMode BLEND 时优先，即使没有 backdropBlendAll', () => {
    const frame = mkBackdrop({ alphaMode: 'BLEND' });
    expect(resolveBackdropBgAlphaMode(frame)).toBe('BLEND');
  });

  it('显式 alphaMode ADD 时映射为 BLEND（ADD 不常用于背景层）', () => {
    const frame = mkBackdrop({ alphaMode: 'ADD' });
    expect(resolveBackdropBgAlphaMode(frame)).toBe('BLEND');
  });

  it('backdropBlendAll = false 等同未设置，返回 ALPHAKEY', () => {
    const frame = mkBackdrop({ backdropBlendAll: false });
    expect(resolveBackdropBgAlphaMode(frame)).toBe('ALPHAKEY');
  });
});
