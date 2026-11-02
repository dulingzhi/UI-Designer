/**
 * canvasViewTransforms 单测：平移/缩放纯逻辑（从 useCanvasPan 抽出）。
 * 语义锁定：与抽取前 hook 内联实现逐值一致（不得反转）。
 */
import { describe, it, expect } from 'vitest';
import { computeWheelScale, startPanAnchor, computePanOffset } from './canvasViewTransforms';

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
