import { describe, it, expect } from 'vitest';
import {
  clampRectToCanvas,
  computeDragRect,
  computeResizeRect,
  snapRect,
  MIN_FRAME_SIZE,
} from './frameTransforms';
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

const noSnap = { snapToGrid: false, gridSize: 0.01, snapValue: (v: number) => v };

describe('clampRectToCanvas — 钳制到画布 + 最小尺寸', () => {  it('正常矩形原样返回', () => {
    const r = clampRectToCanvas({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 });
    expect(r).toEqual({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 });
  });

  it('负起点被钳到 0', () => {
    const r = clampRectToCanvas({ x: -0.1, y: -0.1, width: 0.2, height: 0.2 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('超出右/上边界被钳回', () => {
    const r = clampRectToCanvas({ x: WC3_MAX_X + 0.1, y: WC3_MAX_Y + 0.1, width: 0.2, height: 0.2 });
    expect(r.x).toBeCloseTo(WC3_MAX_X - 0.2, 9);
    expect(r.y).toBeCloseTo(WC3_MAX_Y - 0.2, 9);
  });

  it('尺寸不小于最小值', () => {
    const r = clampRectToCanvas({ x: 0.1, y: 0.1, width: 0, height: 0 });
    expect(r.width).toBeGreaterThanOrEqual(MIN_FRAME_SIZE);
    expect(r.height).toBeGreaterThanOrEqual(MIN_FRAME_SIZE);
  });

  it('尺寸被抬到最小值后起点不越界', () => {
    const r = clampRectToCanvas({ x: WC3_MAX_X - 0.001, y: WC3_MAX_Y - 0.001, width: 0.001, height: 0.001 });
    expect(r.x).toBeLessThanOrEqual(WC3_MAX_X - MIN_FRAME_SIZE + 1e-9);
    expect(r.y).toBeLessThanOrEqual(WC3_MAX_Y - MIN_FRAME_SIZE + 1e-9);
  });
});

describe('snapRect — 栅格吸附', () => {
  it('关闭吸附时原样返回', () => {
    const r = { x: 0.123, y: 0.456, width: 0.3, height: 0.2 };
    expect(snapRect(r, noSnap)).toBe(r);
  });

  it('开启吸附时四字段都吸附', () => {
    const snap = (v: number, s: number) => Math.round(v / s) * s;
    const r = snapRect({ x: 0.123, y: 0.456, width: 0.3, height: 0.2 },
      { snapToGrid: true, gridSize: 0.05, snapValue: snap });
    expect(r.x).toBeCloseTo(0.1, 9);
    expect(r.y).toBeCloseTo(0.45, 9);
    expect(r.width).toBeCloseTo(0.3, 9);
    expect(r.height).toBeCloseTo(0.2, 9);
  });
});

describe('computeDragRect — 拖拽', () => {
  it('鼠标位置减去抓取偏移即为新左下角', () => {
    const r = computeDragRect({ x: 0.3, y: 0.2 }, { x: 0.05, y: 0.02 }, { width: 0.1, height: 0.1 }, noSnap);
    expect(r.x).toBeCloseTo(0.25, 9);
    expect(r.y).toBeCloseTo(0.18, 9);
    expect(r.width).toBe(0.1);
    expect(r.height).toBe(0.1);
  });

  it('拖出左下/右上边界会被钳住', () => {
    const a = computeDragRect({ x: -1, y: -1 }, { x: 0, y: 0 }, { width: 0.1, height: 0.1 }, noSnap);
    expect(a.x).toBe(0);
    const b = computeDragRect({ x: 1, y: 1 }, { x: 0, y: 0 }, { width: 0.1, height: 0.1 }, noSnap);
    expect(b.x).toBeCloseTo(WC3_MAX_X - 0.1, 9);
    expect(b.y).toBeCloseTo(WC3_MAX_Y - 0.1, 9);
  });

  it('拖拽不改尺寸', () => {
    const r = computeDragRect({ x: 0.5, y: 0.4 }, { x: 0, y: 0 }, { width: 0.2, height: 0.15 }, noSnap);
    expect(r.width).toBe(0.2);
    expect(r.height).toBe(0.15);
  });
});

describe('computeResizeRect — 缩放', () => {
  const start = { x: 0.1, y: 0.1, width: 0.2, height: 0.2 };

  it('e 方向向右扩宽，起点不变', () => {
    const r = computeResizeRect(start, 'e', { x: 0.1, y: 0 }, false, noSnap);
    expect(r.x).toBeCloseTo(0.1, 9);
    expect(r.width).toBeCloseTo(0.3, 9);
  });

  it('w 方向改变起点、右边不动', () => {
    const r = computeResizeRect(start, 'w', { x: 0.1, y: 0 }, false, noSnap);
    expect(r.x).toBeCloseTo(0.2, 9);
    expect(r.x + r.width).toBeCloseTo(0.3, 9);
  });

  it('n 方向只改高度，起点 y 不变（对齐 useCanvasResize 语义）', () => {
    const r = computeResizeRect(start, 'n', { x: 0, y: 0.1 }, false, noSnap);
    expect(r.y).toBeCloseTo(0.1, 9);
    expect(r.height).toBeCloseTo(0.3, 9);
  });

  it('s 方向改 y 且高度，保持上边不动', () => {
    const r = computeResizeRect(start, 's', { x: 0, y: 0.05 }, false, noSnap);
    expect(r.y).toBeCloseTo(0.15, 9);
    expect(r.y + r.height).toBeCloseTo(0.3, 9);
  });

  it('Shift 对角拖动保持纵横比', () => {
    const r = computeResizeRect(start, 'se', { x: 0.2, y: 0 }, true, noSnap);
    // start 宽高比 1:1，故高度应跟随宽度
    expect(r.width).toBeCloseTo(r.height, 9);
  });

  it('非对角方向 Shift 不影响尺寸', () => {
    const r = computeResizeRect(start, 'e', { x: 0.1, y: 0 }, true, noSnap);
    expect(r.height).toBeCloseTo(0.2, 9);
  });

  it('缩到极小时不小于最小尺寸', () => {
    const r = computeResizeRect(start, 'e', { x: -1, y: 0 }, false, noSnap);
    expect(r.width).toBeGreaterThanOrEqual(MIN_FRAME_SIZE);
  });

  it('缩放结果始终在画布内', () => {
    const r = computeResizeRect(start, 'ne', { x: 1, y: 1 }, false, noSnap);
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(WC3_MAX_X + 1e-9);
    expect(r.y + r.height).toBeLessThanOrEqual(WC3_MAX_Y + 1e-9);
  });
});

describe('吸附在各计算路径上同样生效', () => {
  const snap = (v: number, s: number) => Math.round(v / s) * s;
  const withSnap = { snapToGrid: true, gridSize: 0.05, snapValue: snap };

  it('computeDragRect 开启吸附后吸附到栅格', () => {
    const r = computeDragRect({ x: 0.123, y: 0.456 }, { x: 0, y: 0 }, { width: 0.1, height: 0.1 }, withSnap);
    expect(r.x).toBeCloseTo(0.1, 9);
    expect(r.y).toBeCloseTo(0.45, 9);
  });

  it('computeResizeRect 开启吸附后宽高也被吸附', () => {
    const r = computeResizeRect(
      { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      'e',
      { x: 0.123, y: 0 },
      false,
      withSnap,
    );
    expect(r.width).toBeCloseTo(0.3, 9);
  });
});

describe('Shift 保比例的防御分支：纵横比非法时不改尺寸', () => {
  it('高度为 0 时 aspect 非有限，宽高保持各自计算值', () => {
    const r = computeResizeRect(
      { x: 0.1, y: 0.1, width: 0.2, height: 0 },
      'se',
      { x: 0.1, y: 0.1 },
      true,
      noSnap,
    );
    // aspect=Infinity → 不进入保比例分支，结果仍被钳到最小尺寸
    expect(r.width).toBeGreaterThanOrEqual(MIN_FRAME_SIZE);
    expect(r.height).toBeGreaterThanOrEqual(MIN_FRAME_SIZE);
  });
});
describe('Shift 保比例的两条推导路径', () => {
  it('高度变化更大时由高度反推宽度', () => {
    const r = computeResizeRect(
      { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      'se',
      { x: 0.01, y: 0.2 },   // 高度变化远大于宽度
      true,
      noSnap,
    );
    expect(r.width).toBeCloseTo(r.height, 9);
  });
});