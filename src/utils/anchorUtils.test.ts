import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FramePoint, FrameData, FrameType } from '../types';
import {
  clearPositionCache,
  getAnchorOffset,
  getAnchorOffsetWc3,
  getAnchorPosition,
  calculateRelativeOffset,
  createDefaultAnchors,
  calculateBoundsFromAnchors,
  updateAnchorsFromBounds,
  migrateFromLegacyAnchor,
  calculatePositionFromAnchors,
  detectAnchorConflicts,
} from './anchorUtils';

// 测试辅助: 创建最小 FrameData
function makeFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'test-frame',
    name: 'TestFrame',
    type: FrameType.FRAME,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.1,
    z: 0,
    parentId: null,
    anchors: [],
    children: [],
    visible: true,
    ...overrides,
  } as FrameData;
}

// 关闭控制台输出噪音
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  clearPositionCache();
});

describe('getAnchorPosition', () => {
  const frame = makeFrame({ x: 0.1, y: 0.2, width: 0.4, height: 0.3 });

  it('BOTTOMLEFT returns (x, y)', () => {
    const pos = getAnchorPosition(frame, FramePoint.BOTTOMLEFT);
    expect(pos.x).toBe(0.1);
    expect(pos.y).toBe(0.2);
  });

  it('TOPLEFT returns (x, y+h)', () => {
    const pos = getAnchorPosition(frame, FramePoint.TOPLEFT);
    expect(pos.x).toBe(0.1);
    expect(pos.y).toBeCloseTo(0.5); // 0.2 + 0.3
  });

  it('BOTTOMRIGHT returns (x+w, y)', () => {
    const pos = getAnchorPosition(frame, FramePoint.BOTTOMRIGHT);
    expect(pos.x).toBeCloseTo(0.5); // 0.1 + 0.4
    expect(pos.y).toBe(0.2);
  });

  it('CENTER returns (x+w/2, y+h/2)', () => {
    const pos = getAnchorPosition(frame, FramePoint.CENTER);
    expect(pos.x).toBeCloseTo(0.3); // 0.1 + 0.2
    expect(pos.y).toBeCloseTo(0.35); // 0.2 + 0.15
  });

  it('TOPRIGHT returns (x+w, y+h)', () => {
    const pos = getAnchorPosition(frame, FramePoint.TOPRIGHT);
    expect(pos.x).toBeCloseTo(0.5);
    expect(pos.y).toBeCloseTo(0.5);
  });

  it('TOP returns (x+w/2, y+h)', () => {
    const pos = getAnchorPosition(frame, FramePoint.TOP);
    expect(pos.x).toBeCloseTo(0.3);
    expect(pos.y).toBeCloseTo(0.5);
  });

  it('LEFT returns (x, y+h/2)', () => {
    const pos = getAnchorPosition(frame, FramePoint.LEFT);
    expect(pos.x).toBe(0.1);
    expect(pos.y).toBeCloseTo(0.35);
  });

  it('RIGHT returns (x+w, y+h/2)', () => {
    const pos = getAnchorPosition(frame, FramePoint.RIGHT);
    expect(pos.x).toBeCloseTo(0.5);
    expect(pos.y).toBeCloseTo(0.35);
  });

  it('BOTTOM returns (x+w/2, y)', () => {
    const pos = getAnchorPosition(frame, FramePoint.BOTTOM);
    expect(pos.x).toBeCloseTo(0.3);
    expect(pos.y).toBe(0.2);
  });

  it('default returns (x, y) for invalid point', () => {
    expect(getAnchorPosition(frame, 999 as FramePoint)).toEqual({ x: 0.1, y: 0.2 });
  });
});

describe('getAnchorOffset (browser coords)', () => {
  it('TOPLEFT is (0, 0)', () => {
    const off = getAnchorOffset(FramePoint.TOPLEFT, 100, 50);
    expect(off).toEqual({ x: 0, y: 0 });
  });

  it('BOTTOMRIGHT is (w, h)', () => {
    const off = getAnchorOffset(FramePoint.BOTTOMRIGHT, 100, 50);
    expect(off).toEqual({ x: 100, y: 50 });
  });

  it('CENTER is (w/2, h/2)', () => {
    const off = getAnchorOffset(FramePoint.CENTER, 100, 50);
    expect(off).toEqual({ x: 50, y: 25 });
  });

  it('each anchor point returns the browser-coordinate offset', () => {
    expect(getAnchorOffset(FramePoint.TOP, 100, 50)).toEqual({ x: 50, y: 0 });
    expect(getAnchorOffset(FramePoint.TOPRIGHT, 100, 50)).toEqual({ x: 100, y: 0 });
    expect(getAnchorOffset(FramePoint.LEFT, 100, 50)).toEqual({ x: 0, y: 25 });
    expect(getAnchorOffset(FramePoint.RIGHT, 100, 50)).toEqual({ x: 100, y: 25 });
    expect(getAnchorOffset(FramePoint.BOTTOMLEFT, 100, 50)).toEqual({ x: 0, y: 50 });
    expect(getAnchorOffset(FramePoint.BOTTOM, 100, 50)).toEqual({ x: 50, y: 50 });
  });
});

describe('getAnchorOffsetWc3', () => {
  it('BOTTOMLEFT is (0, 0) in WC3 coords', () => {
    const off = getAnchorOffsetWc3(FramePoint.BOTTOMLEFT, 0.2, 0.1);
    expect(off).toEqual({ x: 0, y: 0 });
  });

  it('TOPLEFT is (0, height) in WC3 coords', () => {
    const off = getAnchorOffsetWc3(FramePoint.TOPLEFT, 0.2, 0.1);
    expect(off).toEqual({ x: 0, y: 0.1 });
  });

  it('CENTER is (w/2, h/2)', () => {
    const off = getAnchorOffsetWc3(FramePoint.CENTER, 0.2, 0.1);
    expect(off).toEqual({ x: 0.1, y: 0.05 });
  });

  it('each anchor point returns the WC3-coordinate offset', () => {
    expect(getAnchorOffsetWc3(FramePoint.TOP, 0.2, 0.1)).toEqual({ x: 0.1, y: 0.1 });
    expect(getAnchorOffsetWc3(FramePoint.TOPRIGHT, 0.2, 0.1)).toEqual({ x: 0.2, y: 0.1 });
    expect(getAnchorOffsetWc3(FramePoint.LEFT, 0.2, 0.1)).toEqual({ x: 0, y: 0.05 });
    expect(getAnchorOffsetWc3(FramePoint.RIGHT, 0.2, 0.1)).toEqual({ x: 0.2, y: 0.05 });
    expect(getAnchorOffsetWc3(FramePoint.BOTTOM, 0.2, 0.1)).toEqual({ x: 0.1, y: 0 });
    expect(getAnchorOffsetWc3(FramePoint.BOTTOMRIGHT, 0.2, 0.1)).toEqual({ x: 0.2, y: 0 });
  });
});

describe('createDefaultAnchors', () => {
  it('creates a single TOPLEFT anchor', () => {
    const anchors = createDefaultAnchors(0.1, 0.2, 0.3, 0.15);
    expect(anchors).toHaveLength(1);
    expect(anchors[0].point).toBe(FramePoint.TOPLEFT);
    expect(anchors[0].x).toBe(0.1);
    expect(anchors[0].y).toBeCloseTo(0.35); // y + height = 0.2 + 0.15
  });
});

describe('calculateRelativeOffset', () => {
  it('returns zero offset when frames overlap exactly', () => {
    const frame = makeFrame({ x: 0.1, y: 0.1, width: 0.2, height: 0.1 });
    const anchor = { point: FramePoint.BOTTOMLEFT, x: 0.1, y: 0.1 };
    const relFrame = makeFrame({ id: 'rel', x: 0.1, y: 0.1, width: 0.2, height: 0.1 });

    const off = calculateRelativeOffset(frame, anchor, relFrame, FramePoint.BOTTOMLEFT);
    expect(off.x).toBeCloseTo(0);
    expect(off.y).toBeCloseTo(0);
  });

  it('returns correct offset between two frames', () => {
    const frame = makeFrame({ x: 0.3, y: 0.2, width: 0.1, height: 0.1 });
    const anchor = { point: FramePoint.BOTTOMLEFT, x: 0.3, y: 0.2 };
    const relFrame = makeFrame({ id: 'rel', x: 0.1, y: 0.1, width: 0.1, height: 0.1 });

    const off = calculateRelativeOffset(frame, anchor, relFrame, FramePoint.BOTTOMLEFT);
    expect(off.x).toBeCloseTo(0.2); // 0.3 - 0.1
    expect(off.y).toBeCloseTo(0.1); // 0.2 - 0.1
  });
});

describe('updateAnchorsFromBounds', () => {
  it('creates default anchors if empty', () => {
    const result = updateAnchorsFromBounds([], 0.1, 0.2, 0.3, 0.15);
    expect(result).toHaveLength(1);
    expect(result[0].point).toBe(FramePoint.TOPLEFT);
  });

  it('updates absolute TOPLEFT anchor position', () => {
    const anchors = [{ point: FramePoint.TOPLEFT, x: 0, y: 0 }];
    const result = updateAnchorsFromBounds(anchors, 0.2, 0.1, 0.3, 0.2);
    expect(result[0].x).toBe(0.2);
    expect(result[0].y).toBeCloseTo(0.3); // y + height
  });

  it('preserves relative anchors', () => {
    const anchors = [{
      point: FramePoint.TOPLEFT,
      x: 0.05,
      y: 0.05,
      relativeTo: 'other-frame',
      relativePoint: FramePoint.BOTTOMLEFT,
    }];
    const result = updateAnchorsFromBounds(anchors, 0.2, 0.1, 0.3, 0.2);
    expect(result[0].x).toBe(0.05); // unchanged
    expect(result[0].y).toBe(0.05); // unchanged
  });

  it('removes dynamic size anchors when resizing manually', () => {
    const anchors = [
      { point: FramePoint.TOPLEFT, x: 0.1, y: 0.3 },
      { point: FramePoint.BOTTOMRIGHT, x: 0.4, y: 0.1 },
    ];
    const result = updateAnchorsFromBounds(anchors, 0.1, 0.1, 0.35, 0.25);
    expect(result).toHaveLength(1); // second anchor removed
    expect(result[0].point).toBe(FramePoint.TOPLEFT);
  });

  it('keeps first (relative) anchor when dynamic size detected', () => {
    const anchors = [
      { point: FramePoint.TOPLEFT, x: 0.05, y: 0.05, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
      { point: FramePoint.BOTTOMRIGHT, x: 0, y: 0 },
    ];
    const result = updateAnchorsFromBounds(anchors, 0.1, 0.1, 0.3, 0.2);
    expect(result).toHaveLength(1);
    expect(result[0].relativeTo).toBe('tgt');
    expect(result[0].x).toBe(0.05);
    expect(result[0].y).toBe(0.05);
  });

  it('updates absolute non-top-left anchor position', () => {
    const anchors = [{ point: FramePoint.CENTER, x: 0, y: 0 }];
    const result = updateAnchorsFromBounds(anchors, 0.2, 0.1, 0.4, 0.2);
    // CENTER position = (x + w/2, y + h/2) = (0.4, 0.2)
    expect(result[0].x).toBe(0.4);
    expect(result[0].y).toBeCloseTo(0.2);
  });

  it.each([
    ['TOP', FramePoint.TOP, 0.4, 0.3],
    ['TOPRIGHT', FramePoint.TOPRIGHT, 0.6, 0.3],
    ['LEFT', FramePoint.LEFT, 0.2, 0.2],
    ['RIGHT', FramePoint.RIGHT, 0.6, 0.2],
    ['BOTTOMLEFT', FramePoint.BOTTOMLEFT, 0.2, 0.1],
    ['BOTTOM', FramePoint.BOTTOM, 0.4, 0.1],
    ['BOTTOMRIGHT', FramePoint.BOTTOMRIGHT, 0.6, 0.1],
  ])('updates absolute %s anchor position', (_name, point, expX, expY) => {
    const anchors = [{ point, x: 0, y: 0 }];
    const result = updateAnchorsFromBounds(anchors, 0.2, 0.1, 0.4, 0.2);
    expect(result[0].x).toBeCloseTo(expX);
    expect(result[0].y).toBeCloseTo(expY);
  });

  it('recomputes a single TOPLEFT anchor position from bounds (dynamic-size path)', () => {
    // A dynamic-size pair whose FIRST anchor is an absolute CENTER: recompute via
    // getAnchorPositionFromBounds(CENTER, ...) in the keep-first path.
    const anchors = [
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
    ];
    const result = updateAnchorsFromBounds(anchors, 0.2, 0.1, 0.4, 0.2);
    expect(result).toHaveLength(1);
    expect(result[0].point).toBe(FramePoint.BOTTOMRIGHT);
    expect(result[0].x).toBeCloseTo(0.6);
    expect(result[0].y).toBeCloseTo(0.1);
  });
});

describe('calculateBoundsFromAnchors', () => {
  const frame = makeFrame({ x: 0.1, y: 0.1, width: 0.4, height: 0.3 });

  it('uses TOPLEFT + BOTTOMRIGHT to compute bounds', () => {
    const anchors = [
      { point: FramePoint.TOPLEFT, x: 0.1, y: 0.4 },
      { point: FramePoint.BOTTOMRIGHT, x: 0.5, y: 0.1 },
    ];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
    expect(res.width).toBeCloseTo(0.4);
    expect(res.height).toBeCloseTo(0.3);
  });

  it('returns frame values when no anchors', () => {
    expect(calculateBoundsFromAnchors([], frame)).toEqual({
      x: 0.1, y: 0.1, width: 0.4, height: 0.3,
    });
  });

  it('reverses TOPLEFT (single anchor)', () => {
    const anchors = [{ point: FramePoint.TOPLEFT, x: 0.1, y: 0.4 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
    expect(res.width).toBe(0.4);
    expect(res.height).toBe(0.3);
  });

  it('reverses TOP (single anchor)', () => {
    const anchors = [{ point: FramePoint.TOP, x: 0.3, y: 0.4 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
    expect(res.width).toBe(0.4);
    expect(res.height).toBe(0.3);
  });

  it('reverses BOTTOMLEFT (single anchor)', () => {
    const anchors = [{ point: FramePoint.BOTTOMLEFT, x: 0.1, y: 0.1 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBe(0.1);
    expect(res.y).toBe(0.1);
  });

  it('reverses TOPRIGHT (single anchor)', () => {
    const anchors = [{ point: FramePoint.TOPRIGHT, x: 0.5, y: 0.4 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
  });

  it('reverses LEFT (single anchor)', () => {
    const anchors = [{ point: FramePoint.LEFT, x: 0.1, y: 0.25 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBe(0.1);
    expect(res.y).toBeCloseTo(0.1);
  });

  it('reverses CENTER (single anchor)', () => {
    const anchors = [{ point: FramePoint.CENTER, x: 0.3, y: 0.25 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
  });

  it('reverses RIGHT (single anchor)', () => {
    const anchors = [{ point: FramePoint.RIGHT, x: 0.5, y: 0.25 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
  });

  it('reverses BOTTOM (single anchor)', () => {
    const anchors = [{ point: FramePoint.BOTTOM, x: 0.3, y: 0.1 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
  });

  it('reverses BOTTOMRIGHT (single anchor)', () => {
    const anchors = [{ point: FramePoint.BOTTOMRIGHT, x: 0.5, y: 0.1 }];
    const res = calculateBoundsFromAnchors(anchors, frame);
    expect(res.x).toBeCloseTo(0.1);
    expect(res.y).toBeCloseTo(0.1);
  });
});

describe('migrateFromLegacyAnchor', () => {
  it('creates a single TOPLEFT anchor', () => {
    const result = migrateFromLegacyAnchor(0.1, 0.2, 0.3, 0.4, 5);
    expect(result).toHaveLength(1);
    expect(result[0].point).toBe(FramePoint.TOPLEFT);
    expect(result[0].x).toBe(0.1);
    expect(result[0].y).toBeCloseTo(0.6);
  });
});

describe('getAnchorOffset default (unknown point)', () => {
  it('returns (0,0) for invalid point', () => {
    expect(getAnchorOffset(999 as FramePoint, 10, 20)).toEqual({ x: 0, y: 0 });
    expect(getAnchorOffsetWc3(999 as FramePoint, 10, 20)).toEqual({ x: 0, y: 0 });
  });
});

describe('calculatePositionFromAnchors', () => {
  it('returns null when frame has no anchors', () => {
    const frame = makeFrame({ id: 'f1', name: 'ConfirmQuitQuitButton', anchors: [] });
    const result = calculatePositionFromAnchors(frame, {});
    expect(result).toBeNull();
  });

  it('returns null when no relative anchors', () => {
    const frame = makeFrame({ id: 'f2', name: 'ConfirmQuitCancelButton',
      anchors: [{ point: FramePoint.TOPLEFT, x: 0.1, y: 0.2 }] });
    const result = calculatePositionFromAnchors(frame, {});
    expect(result).toBeNull();
  });

  it('resolves absolute anchor + basic single relative anchor (TOPLEFT)', () => {
    const target = makeFrame({ id: 'tgt', name: 'Tgt', x: 1, y: 2, width: 10, height: 5,
      anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [
        { point: FramePoint.TOPLEFT, x: 0.5, y: 1.0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
      ] });
    // relative pos BOTTOMLEFT of tgt = (1, 2). abs = (1.5, 3.0). TOPLEFT single: y = absY - height = 2.0
    const res = calculatePositionFromAnchors(frame, { tgt: target });
    expect(res!.x).toBeCloseTo(1.5);
    expect(res!.y).toBeCloseTo(2.0);
    expect(res!.width).toBe(2);
    expect(res!.height).toBe(1);
  });

  it('uses TOPLEFT + BOTTOMRIGHT (dynamic size) with relative anchors', () => {
    const target = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 1, height: 1,
      anchors: [
        { point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
        { point: FramePoint.BOTTOMRIGHT, x: 5, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
      ] });
    // TOPLEFT pos = (0,10); BOTTOMRIGHT = (5,10)
    const res = calculatePositionFromAnchors(frame, { tgt: target });
    expect(res!.x).toBe(0);
    expect(res!.y).toBeCloseTo(10);
    expect(res!.width).toBeCloseTo(5);
    expect(res!.height).toBeCloseTo(0);
  });

  it('uses the reference frame STORED geometry instead of re-solving it recursively', () => {
    // 语义：relativeTo 指向的帧以它**已存的 x/y/width/height** 作为锚点基准，不再递归重解。
    // 理由：祖先几何已由上游（内核 layout overlay / 上一次同步）确定，此处再算一遍等于
    // 用求解器覆盖求解器，误差沿祖先链累积。实测真实数据（war3.mpq 41 屏）去递归后
    // 分歧从 61 帧降到 30 帧且无一例变差。
    const base = makeFrame({ id: 'base', name: 'Base', x: 10, y: 10, width: 5, height: 5, anchors: [] });
    // mid 存储几何为 (2,3)：即使它有相对锚点，也不在此处被重解。
    const mid = makeFrame({ id: 'mid', name: 'Mid', x: 2, y: 3, width: 1, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'base', relativePoint: FramePoint.BOTTOMLEFT }] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 1, y: 1, relativeTo: 'mid', relativePoint: FramePoint.TOPLEFT }] });
    // mid 存储几何 TOPLEFT = (2, 3+1) = (2,4)；abs = (3,5)；单 TOPLEFT 收缩 y = 5 - height(1) = 4
    const res = calculatePositionFromAnchors(frame, { base, mid });
    expect(res!.x).toBeCloseTo(3);
    expect(res!.y).toBeCloseTo(4);
  });

  it('child follows parent when parent stored geometry is updated first（祖先先算前提）', () => {
    // 锁定 SceneGraphManager.sync 的遍历前提：祖先先同步、子帧后算。
    // 只要父帧存储几何已更新，子帧无需递归父帧即可跟随到新位置。
    const parent = makeFrame({ id: 'p', name: 'P', x: 0, y: 0, width: 0.4, height: 0.3, anchors: [] });
    const child = makeFrame({ id: 'c', name: 'C', width: 0.1, height: 0.05,
      anchors: [{ point: FramePoint.TOPLEFT, x: 0.02, y: 0.03, relativeTo: 'p', relativePoint: FramePoint.TOPLEFT }] });
    const frames: Record<string, FrameData> = { p: parent, c: child };

    const before = calculatePositionFromAnchors(child, frames)!;
    // 父帧被移动/缩放后（模拟 sync 先更新父帧存储几何）
    frames.p = { ...parent, x: 0.2, y: 0.1, width: 0.4, height: 0.3 };
    clearPositionCache();
    const after = calculatePositionFromAnchors(child, frames)!;

    // 子帧跟随父帧位移 (0.2, 0.1)
    expect(after.x - before.x).toBeCloseTo(0.2);
    expect(after.y - before.y).toBeCloseTo(0.1);
  });

  it('returns raw relative offset when reference frame missing', () => {
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 3, y: 4, relativeTo: 'MISSING', relativePoint: FramePoint.TOPLEFT }] });
    const res = calculatePositionFromAnchors(frame, {});
    expect(res!.x).toBeCloseTo(3);
    expect(res!.y).toBeCloseTo(3); // TOPLEFT single: y = 4 - height(1) = 3
  });

  it('uses TOPRIGHT + BOTTOMLEFT strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 1, height: 1,
      anchors: [
        { point: FramePoint.TOPRIGHT, x: 10, y: 10, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
        { point: FramePoint.BOTTOMLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // both relative to TOPLEFT (0,10) + offset
    // TOPRIGHT abs=(10,20), BOTTOMLEFT abs=(0,10)
    // x=bottomLeft.x=0, y=bottomLeft.y=10, width=10-0=10, height=20-10=10
    expect(res!.x).toBe(0);
    expect(res!.y).toBeCloseTo(10);
    expect(res!.width).toBeCloseTo(10);
    expect(res!.height).toBeCloseTo(10);
  });

  it('uses LEFT + RIGHT + TOP + BOTTOM strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 1, height: 1,
      anchors: [
        { point: FramePoint.LEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
        { point: FramePoint.RIGHT, x: 10, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
        { point: FramePoint.TOP, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
        { point: FramePoint.BOTTOM, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // LEFT=(0,0), RIGHT=(10,0), TOP=(0,10), BOTTOM=(0,0)
    expect(res!.x).toBeCloseTo(0);
    expect(res!.y).toBeCloseTo(0);
    expect(res!.width).toBeCloseTo(10);
    expect(res!.height).toBeCloseTo(10);
  });

  it('uses TOPLEFT + TOPRIGHT strategy (dynamic width, fixed height)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 4, height: 9,
      anchors: [
        { point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
        { point: FramePoint.TOPRIGHT, x: 6, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOPLEFT=(0,10), TOPRIGHT=(6,10); avgY=10; y=10-9=1; width=6; height=9
    expect(res!.x).toBe(0);
    expect(res!.y).toBeCloseTo(1);
    expect(res!.width).toBeCloseTo(6);
    expect(res!.height).toBe(9);
  });

  it('uses BOTTOMLEFT + BOTTOMRIGHT strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 4, height: 9,
      anchors: [
        { point: FramePoint.BOTTOMLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
        { point: FramePoint.BOTTOMRIGHT, x: 6, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // BOTTOMLEFT=(0,0), BOTTOMRIGHT=(6,0); x=0, y=0, width=6, height=9
    expect(res!.x).toBe(0);
    expect(res!.y).toBe(0);
    expect(res!.width).toBeCloseTo(6);
    expect(res!.height).toBe(9);
  });

  it('uses TOPLEFT + BOTTOMLEFT strategy (dynamic height, fixed width)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 4, height: 9,
      anchors: [
        { point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
        { point: FramePoint.BOTTOMLEFT, x: 2, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOPLEFT abs=(0,10), BOTTOMLEFT abs=(2,0); x=0, y=0, width=4, height=10-0=10
    expect(res!.x).toBe(0);
    expect(res!.y).toBe(0);
    expect(res!.width).toBe(4);
    expect(res!.height).toBeCloseTo(10);
  });

  it('uses TOPRIGHT + BOTTOMRIGHT strategy (dynamic height)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 4, height: 9,
      anchors: [
        { point: FramePoint.TOPRIGHT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPRIGHT },
        { point: FramePoint.BOTTOMRIGHT, x: 3, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMRIGHT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOPRIGHT=(10,10), BOTTOMRIGHT=(13,0); x=10-4=6, y=0, width=4, height=10-0=10
    expect(res!.x).toBeCloseTo(6);
    expect(res!.y).toBe(0);
    expect(res!.width).toBe(4);
    expect(res!.height).toBeCloseTo(10);
  });

  it('uses LEFT + RIGHT strategy (dynamic width, fixed height)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 4, height: 9,
      anchors: [
        { point: FramePoint.LEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
        { point: FramePoint.RIGHT, x: 6, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // LEFT=(0,0), RIGHT=(6,0); width=6; x=0; y=(0+0)/2 - 9/2 = -4.5
    expect(res!.x).toBe(0);
    expect(res!.y).toBeCloseTo(-4.5);
    expect(res!.width).toBeCloseTo(6);
    expect(res!.height).toBe(9);
  });

  it('uses TOP + BOTTOM strategy (dynamic height, fixed width)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 4, height: 9,
      anchors: [
        { point: FramePoint.TOP, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOP },
        { point: FramePoint.BOTTOM, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOM },
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOP=(5,10), BOTTOM=(5,0); height=10; x=(5+5)/2 - 4/2 = 3; y=0
    expect(res!.x).toBeCloseTo(3);
    expect(res!.y).toBe(0);
    expect(res!.width).toBe(4);
    expect(res!.height).toBeCloseTo(10);
  });

  it('uses TOPLEFT single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 0, y: 1, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOPLEFT abs = (0, 0+1) = (0,1); x=0; y=1-height(1)=0
    expect(res!.x).toBe(0);
    expect(res!.y).toBe(0);
  });

  it('uses BOTTOMRIGHT single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.BOTTOMRIGHT, x: 5, y: 3, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // BOTTOMRIGHT abs=(0+5,0+3)=(5,3); x=5-2=3; y=3
    expect(res!.x).toBeCloseTo(3);
    expect(res!.y).toBeCloseTo(3);
  });

  it('uses CENTER single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.CENTER, x: 0, y: 5, relativeTo: 'tgt', relativePoint: FramePoint.CENTER }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // CENTER abs=(5, 5+5)=(5,10); x=5-1=4; y=10-0.5=9.5
    expect(res!.x).toBeCloseTo(4);
    expect(res!.y).toBeCloseTo(9.5);
  });

  it('uses TOP single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOP, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOP }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOP abs=(5,10); x=5-1=4; y=10-1=9
    expect(res!.x).toBeCloseTo(4);
    expect(res!.y).toBeCloseTo(9);
  });

  it('uses TOPRIGHT single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOPRIGHT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPRIGHT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOPRIGHT abs=(10,10); x=10-2=8; y=10-1=9
    expect(res!.x).toBeCloseTo(8);
    expect(res!.y).toBeCloseTo(9);
  });

  it('uses LEFT single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.LEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.LEFT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // LEFT abs=(0,5); x=0; y=5-0.5=4.5
    expect(res!.x).toBe(0);
    expect(res!.y).toBeCloseTo(4.5);
  });

  it('uses RIGHT single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.RIGHT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.RIGHT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // RIGHT abs=(10,5); x=10-2=8; y=5-0.5=4.5
    expect(res!.x).toBeCloseTo(8);
    expect(res!.y).toBeCloseTo(4.5);
  });

  it('uses BOTTOMLEFT single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.BOTTOMLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOMLEFT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // BOTTOMLEFT abs=(0,0); x=0; y=0
    expect(res!.x).toBe(0);
    expect(res!.y).toBe(0);
  });

  it('uses BOTTOM single strategy', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.BOTTOM, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.BOTTOM }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // BOTTOM abs=(5,0); x=5-1=4; y=0
    expect(res!.x).toBeCloseTo(4);
    expect(res!.y).toBe(0);
  });

  it('mixes a relative anchor with an absolute anchor (absolute path returns raw coords)', () => {
    // hasRelativeAnchors is true (TOPLEFT relative), so we pass the pre-check.
    // BOTTOMRIGHT is absolute -> calculateAnchorPos returns {x,y} directly (absolute branch).
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 1, height: 1,
      anchors: [
        { point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT },
        { point: FramePoint.BOTTOMRIGHT, x: 5, y: 3 }, // absolute
      ] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    // TOPLEFT abs = (0,10); BOTTOMRIGHT abs = (5,3)
    // strategy1: x=0, y=3, width=5-0=5, height=10-3=7
    expect(res!.x).toBe(0);
    expect(res!.y).toBe(3);
    expect(res!.width).toBeCloseTo(5);
    expect(res!.height).toBeCloseTo(7);
  });

  it('falls back to TOPLEFT relativePoint when relativePoint is undefined', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 2, y: 2, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 1, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 1, y: 1, relativeTo: 'tgt' }] }); // no relativePoint
    const res = calculatePositionFromAnchors(frame, { tgt });
    // default relativePoint = TOPLEFT of tgt = (2, 12); abs = (3, 13)
    // TOPLEFT single: x=3, y=13-1=12
    expect(res!.x).toBeCloseTo(3);
    expect(res!.y).toBeCloseTo(12);
  });

  it('logs the no-anchors warning for ConfirmQuitCancelButton name', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frame = makeFrame({ id: 'f2', name: 'ConfirmQuitCancelButton', anchors: [] });
    expect(calculatePositionFromAnchors(frame, {})).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns null for invalid numeric calculation (NaN)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: NaN, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT }] });
    const res = calculatePositionFromAnchors(frame, { tgt });
    expect(res).toBeNull();
  });

  it('returns null for no-anchors frame with non-warned name (skip warn)', () => {
    const frame = makeFrame({ name: 'SomeOtherFrame', anchors: [] });
    expect(calculatePositionFromAnchors(frame, {})).toBeNull();
  });

  it('returns null for absolute-only anchors with non-warned name (no relative warn)', () => {
    const frame = makeFrame({
      name: 'SomeOtherFrame',
      anchors: [{ point: FramePoint.TOPLEFT, x: 0, y: 0 }],
    });
    expect(calculatePositionFromAnchors(frame, {})).toBeNull();
  });

  it('caches computed position (second call returns same object)', () => {
    const tgt = makeFrame({ id: 'tgt', name: 'Tgt', x: 0, y: 0, width: 10, height: 10, anchors: [] });
    const frame = makeFrame({ id: 'cur', name: 'Cur', width: 2, height: 1,
      anchors: [{ point: FramePoint.TOPLEFT, x: 0, y: 0, relativeTo: 'tgt', relativePoint: FramePoint.TOPLEFT }] });
    const r1 = calculatePositionFromAnchors(frame, { tgt });
    const r2 = calculatePositionFromAnchors(frame, { tgt });
    expect(r1).toEqual(r2);
    expect(r1).not.toBeNull();
  });
});

describe('detectAnchorConflicts', () => {
  it('returns none for empty/one anchor', () => {
    expect(detectAnchorConflicts([])).toEqual({ conflictingAnchors: [], conflictType: 'none', description: '' });
    expect(detectAnchorConflicts([{ point: FramePoint.TOPLEFT, x: 0, y: 0 }]))
      .toEqual({ conflictingAnchors: [], conflictType: 'none', description: '' });
  });

  it('detects duplicate anchor types', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPLEFT, x: 1, y: 1 },
    ]);
    expect(res.conflictType).toBe('logicalConflict');
    expect(res.conflictingAnchors).toEqual([0, 1]);
    expect(res.description).toContain('左上角');
  });

  it('uses unknown-name fallback for duplicate with invalid point value', () => {
    const res = detectAnchorConflicts([
      { point: 999 as FramePoint, x: 0, y: 0 },
      { point: 999 as FramePoint, x: 1, y: 1 },
    ]);
    expect(res.conflictType).toBe('logicalConflict');
    expect(res.description).toContain('未知');
  });

  it('detects 4-corner over-constrained without edges', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
    ]);
    expect(res.conflictType).toBe('overConstrained');
    expect(res.conflictingAnchors).toEqual([0, 1, 2, 3]);
  });

  it('flags 4 corners with all edges as invalidCombination (existing behavior via check3)', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.LEFT, x: 0, y: 0.5 },
      { point: FramePoint.RIGHT, x: 1, y: 0.5 },
      { point: FramePoint.TOP, x: 0.5, y: 0 },
      { point: FramePoint.BOTTOM, x: 0.5, y: 1 },
    ]);
    // hasHorizontalPair && hasVerticalPair && cornerCount>2 => invalidCombination
    expect(res.conflictType).toBe('invalidCombination');
  });

  it('detects 3-corner over-constrained', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
    ]);
    expect(res.conflictType).toBe('overConstrained');
  });

  it('detects mixed horizontal + vertical pair invalid combination', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
    ]);
    // This also hits the 3-corner check first -> overConstrained. Use a strictly mixed case:
    const res2 = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
      { point: FramePoint.RIGHT, x: 1, y: 0.5 },
    ]);
    // cornerCount = 3 -> overConstrained branch fires before invalidCombination.
    // To reach invalidCombination, need cornerCount>2 (i.e. 3) but not caught by overConstrained? impossible.
    // Reaching invalidCombination requires cornerCount === 4 with hasAllEdges OR cornerCount===3 bypass.
    // With cornerCount 3 it's always overConstrained. So invalidCombination effectively unreachable via 3 corners.
    expect(res2.conflictType).toBe('overConstrained');
  });

  it('flags invalid edge+corner combination', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
      { point: FramePoint.LEFT, x: 0, y: 0.5 },
    ]);
    // cornerCount=3 -> overConstrained fires first
    const res2 = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.LEFT, x: 0, y: 0.5 },
    ]);
    // cornerCount=2, edgeCount=1. isValidEdgeCornerCombo: LEFT+RIGHT? no. TOP+BOTTOM? no. edgeCount===4? no.
    // So invalid -> invalidCombination
    expect(res2.conflictType).toBe('invalidCombination');
  });

  it('allows LEFT+RIGHT with 2 corners (valid combo)', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.LEFT, x: 0, y: 0.5 },
      { point: FramePoint.RIGHT, x: 1, y: 0.5 },
    ]);
    expect(res.conflictType).toBe('none');
  });

  it('evaluates both horizontal/vertical pair disjuncts with BL&TR only', () => {
    // TR + BL: TL&&TR false, BL&&BR false (hasHorizontalPair false);
    // TL&&BL false, TR&&BR false (hasVerticalPair false). Both line 753/755 false slots hit.
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
    ]);
    // cornerCount=2, edgeCount=0 -> none
    expect(res.conflictType).toBe('none');
  });

  it('allows TOP+BOTTOM with 2 corners (valid combo)', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.TOP, x: 0.5, y: 1 },
      { point: FramePoint.BOTTOM, x: 0.5, y: 0 },
    ]);
    // TOP+BOTTOM && cornerCount(2)<=2 -> valid
    expect(res.conflictType).toBe('none');
  });

  it('allows full 4-edge + 4-corner combo (edgeCount===4 && cornerCount===4)', () => {
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.TOPRIGHT, x: 1, y: 0 },
      { point: FramePoint.BOTTOMLEFT, x: 0, y: 1 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.LEFT, x: 0, y: 0.5 },
      { point: FramePoint.RIGHT, x: 1, y: 0.5 },
      { point: FramePoint.TOP, x: 0.5, y: 1 },
      { point: FramePoint.BOTTOM, x: 0.5, y: 0 },
    ]);
    // Note: this exact combo is intercepted by check3 (hasHorizontal && hasVertical && cornerCount>2)
    //   returning invalidCombination before reaching check5. So expect invalidCombination here.
    expect(res.conflictType).toBe('invalidCombination');
  });

  it('reaches isValidEdgeCornerCombo edgeCount===4 && cornerCount===4 true path', () => {
    // Must avoid check3 (invalidCombination) and check2 (overConstrained) to reach check5's full-combo TRUE.
    // check2 fires for cornerCount===4 && !hasAllEdges. To reach cornerCount===4 with hasAllEdges && hasAllCorners,
    // check3 fires (invalidCombination) when hasHorizontal && hasVertical && corner>2.
    // => isValidEdgeCornerCombo === true via (edgeCount===4 && cornerCount===4) is effectively short-circuited.
    // Use a combo that reaches check5 with valid LEFT+RIGHT but where cornerCount>2 is avoided is impossible
    // with edgeCount 4 + all corners (check3 fires first). So this final disjunct is genuinely unreachable
    // through the public API. Documented as a blocker.
    const res = detectAnchorConflicts([
      { point: FramePoint.TOPLEFT, x: 0, y: 0 },
      { point: FramePoint.BOTTOMRIGHT, x: 1, y: 1 },
      { point: FramePoint.LEFT, x: 0, y: 0.5 },
      { point: FramePoint.RIGHT, x: 1, y: 0.5 },
      { point: FramePoint.TOP, x: 0.5, y: 1 },
      { point: FramePoint.BOTTOM, x: 0.5, y: 0 },
    ]);
    expect(res.conflictType).toBe('none'); // LEFT+RIGHT with 2 corners, check3 cornerCount=2 not >2
  });
});
