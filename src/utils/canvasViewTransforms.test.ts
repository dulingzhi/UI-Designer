/**
 * canvasViewTransforms 单测：平移/缩放纯逻辑（从 useCanvasPan 抽出）。
 * 语义锁定：与抽取前 hook 内联实现逐值一致（不得反转）。
 */
import { describe, it, expect } from 'vitest';
import { computeWheelScale, startPanAnchor, computePanOffset, computeWheelZoomAt } from './canvasViewTransforms';

describe('computeWheelScale（滚轮缩放）', () => {
  it('deltaY > 0 缩小 ×0.9', () => {
    expect(computeWheelScale(1, 100)).toBeCloseTo(0.9);
  });

  it('deltaY < 0 放大 ×1.1', () => {
    expect(computeWheelScale(1, -100)).toBeCloseTo(1.1);
  });

  it('钳制下限 0.1：连续缩小不低于 0.1', () => {
    // 0.1 × 0.9 = 0.09 → max(0.1, 0.09) = 0.1
    expect(computeWheelScale(0.1, 100)).toBeCloseTo(0.1);
  });

  it('钳制上限 5：连续放大不超过 5', () => {
    // 4.8 × 1.1 = 5.28 → min(5, 5.28) = 5
    expect(computeWheelScale(4.8, -100)).toBeCloseTo(5);
  });
});

describe('startPanAnchor / computePanOffset（平移锚点）', () => {
  it('锚点 = 指针位置 - 当前 offset', () => {
    const anchor = startPanAnchor(500, 300, { x: 120, y: 40 });
    expect(anchor).toEqual({ x: 380, y: 260 });
  });

  it('平移中 offset = 指针 - 锚点（拖动跟随位移）', () => {
    const anchor = startPanAnchor(500, 300, { x: 120, y: 40 });
    const offset = computePanOffset(560, 280, anchor);
    expect(offset).toEqual({ x: 180, y: 20 });
  });

  it('指针回到起点时 offset 恢复原值（往返一致性）', () => {
    const original = { x: 120, y: 40 };
    const anchor = startPanAnchor(500, 300, original);
    const moved = computePanOffset(650, 350, anchor);
    const restored = computePanOffset(500, 300, anchor);
    expect(restored).toEqual(original);
    expect(moved.x).toBeGreaterThan(original.x);
  });
});


describe('computeWheelZoomAt 锚定缩放（round 159）', () => {
  it('数学锚定：缩放前后鼠标下世界点的屏幕位置不变', () => {
    const current = 1;
    const pointer = { x: 500, y: 300 };
    const offset = { x: 100, y: 50 };
    const { scale, offset: newOffset } = computeWheelZoomAt(current, -100, pointer, offset);
    // 缩放前：s = w*1 + offset → w = (500-100, 300-50)
    // 缩放后：s' = w*scale + newOffset 应等于原 s
    const wx = (pointer.x - offset.x) / current;
    const wy = (pointer.y - offset.y) / current;
    expect(wx * scale + newOffset.x).toBeCloseTo(pointer.x, 6);
    expect(wy * scale + newOffset.y).toBeCloseTo(pointer.y, 6);
  });

  it('deltaY>0 缩小、钳制 0.1..5 继承 computeWheelScale', () => {
    const up = computeWheelZoomAt(1, 100, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(up.scale).toBeCloseTo(0.9, 6);
    const down = computeWheelZoomAt(1, -100, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(down.scale).toBeCloseTo(1.1, 6);
    const clamped = computeWheelZoomAt(4.9, -100, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(clamped.scale).toBe(5);
  });

  it('指针在原点+offset=0 时 offset 不变（退化等价原 computeWheelScale）', () => {
    const { scale, offset } = computeWheelZoomAt(1, -100, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(scale).toBeCloseTo(1.1, 6);
    expect(offset).toEqual({ x: 0, y: 0 });
  });
});
