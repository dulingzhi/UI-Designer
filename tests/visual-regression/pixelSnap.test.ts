import { describe, it, expect } from 'vitest';
import { snapToPixel, snapRectToPixels, snapTexCoordToPixels } from '../../src/renderer/pixelSnap';

describe('pixelSnap.snapToPixel — equivalent to game ScreenToPixelHeight (sub_692DF0)', () => {
  it('round half away from zero (positive)', () => {
    expect(snapToPixel(0.4)).toBe(0);
    expect(snapToPixel(0.5)).toBe(1);   // half-up
    expect(snapToPixel(0.6)).toBe(1);
    expect(snapToPixel(99.5)).toBe(100);
  });

  it('integer pass-through', () => {
    expect(snapToPixel(0)).toBe(0);
    expect(snapToPixel(42)).toBe(42);
    expect(snapToPixel(-7)).toBe(-7);
  });

  it('matches hexrays formula: trunc(SignOf(x)*0.5 + x) for positive x', () => {
    // (int)(0.5 + x) == Math.round for x >= 0
    for (const x of [0.0, 0.49, 0.5, 1.5, 2.49999, 17.7, 100.5]) {
      expect(snapToPixel(x)).toBe(Math.trunc(0.5 + x));
    }
  });
});

describe('pixelSnap.snapRectToPixels — accumulator-safe rect snap', () => {
  it('width is computed from snapped right edge to avoid drift', () => {
    // x=0.4 (rounds to 0), w=10.4 (right=10.8, rounds to 11) → snapped w = 11
    // 朴素实现 round(x)+round(w) 会得到 0+10=10，丢失 1px
    const r = snapRectToPixels(0.4, 0, 10.4, 10);
    expect(r.x).toBe(0);
    expect(r.w).toBe(11);
  });

  it('clamps minimum dimension to 1px', () => {
    const r = snapRectToPixels(10, 10, 0.1, 0.1);
    expect(r.w).toBeGreaterThanOrEqual(1);
    expect(r.h).toBeGreaterThanOrEqual(1);
  });

  it('integer rect is identity', () => {
    const r = snapRectToPixels(5, 7, 100, 50);
    expect(r).toEqual({ x: 5, y: 7, w: 100, h: 50 });
  });
});

describe('pixelSnap.snapTexCoordToPixels — texel-center alignment', () => {
  it('snaps UV to nearest texel center (texel + 0.5)', () => {
    // 256-tex, target=256: uv 0.0 → texel 0 → snapped texel 0.5 → uv 0.5/256
    const uv = snapTexCoordToPixels(0.0, 256, 256);
    expect(uv).toBeCloseTo(0.5 / 256);
  });

  it('zero size guards return original uv', () => {
    expect(snapTexCoordToPixels(0.3, 0, 100)).toBe(0.3);
    expect(snapTexCoordToPixels(0.3, 100, 0)).toBe(0.3);
  });
});
