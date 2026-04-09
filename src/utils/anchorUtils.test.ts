import { describe, it, expect, beforeEach } from 'vitest';
import { FramePoint, FrameData, FrameType } from '../types';
import {
  clearPositionCache,
  getAnchorOffset,
  getAnchorOffsetWc3,
  getAnchorPosition,
  calculateRelativeOffset,
  createDefaultAnchors,
  updateAnchorsFromBounds,
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
    anchors: [],
    children: [],
    visible: true,
    ...overrides,
  } as FrameData;
}

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
});
