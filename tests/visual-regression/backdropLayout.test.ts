import { describe, it, expect } from 'vitest';
import { computeEdgePlacement, computeBackgroundPlacement } from '../../src/renderer/backdropLayout';

describe('backdropLayout — computeEdgePlacement', () => {
  // 200×100 frame, cornerSize 20. cornerInset = round(20*0.95) = 19.
  // innerW = 200 - 38 = 162. innerH = 100 - 38 = 62.
  const W = 200, H = 100, CS = 20;

  it('UL corner — top-left', () => {
    const p = computeEdgePlacement('UL', W, H, CS);
    expect(p.centerX).toBe(10);          // half = 10
    expect(p.centerY).toBe(90);          // H - cs/2
    expect(p.scaleX).toBe(20);
    expect(p.scaleY).toBe(20);
    expect(p.isCorner).toBe(true);
    expect(p.renderOrderOffset).toBe(0.20);
    expect(p.visible).toBe(true);
  });

  it('BR corner — bottom-right, half on both axes', () => {
    const p = computeEdgePlacement('BR', W, H, CS);
    expect(p.centerX).toBe(190);         // W - cs/2
    expect(p.centerY).toBe(10);
    expect(p.isCorner).toBe(true);
  });

  it('T edge — width-spanning, top, edge renderOrder', () => {
    const p = computeEdgePlacement('T', W, H, CS);
    expect(p.centerX).toBe(100);         // midX
    expect(p.centerY).toBe(90);          // top
    expect(p.scaleX).toBe(162);          // innerW = W - 2*round(0.95*cs) = 200-38
    expect(p.scaleY).toBe(20);
    expect(p.isCorner).toBe(false);
    expect(p.renderOrderOffset).toBe(0.21);
  });

  it('L edge — height-spanning, left', () => {
    const p = computeEdgePlacement('L', W, H, CS);
    expect(p.centerX).toBe(10);
    expect(p.centerY).toBe(50);
    expect(p.scaleX).toBe(20);
    expect(p.scaleY).toBe(62);
    expect(p.isCorner).toBe(false);
  });

  it('edges are drawn ABOVE corners (renderOrder)', () => {
    expect(computeEdgePlacement('T', W, H, CS).renderOrderOffset)
      .toBeGreaterThan(computeEdgePlacement('UL', W, H, CS).renderOrderOffset);
  });

  it('5% overlap — edge length is (size − 2 × 0.95 × cs), NOT (size − 2 × cs)', () => {
    // Overlap proof: corner + edge spans must overlap.
    //   corner UL covers X=[0, cs] = [0, 20]
    //   edge T  covers X=[midX - innerW/2, midX + innerW/2] = [19, 181]
    //   overlap = [19, 20] = 1px (= round(0.05 × cs) at cs=20)
    const t = computeEdgePlacement('T', W, H, CS);
    const tLeft = t.centerX - t.scaleX / 2;
    expect(tLeft).toBe(19);              // = round(0.95 × 20)
    // 旧 (无 0.95 inset) 时 tLeft 会 == 20，与 corner 边界精确接但易因 alpha 衰减出接缝
    expect(tLeft).toBeLessThan(CS);
  });

  it('innerWidth 0 ⇒ T edge invisible (cornerSize > width/2)', () => {
    const p = computeEdgePlacement('T', 30, 100, 20);
    // cornerInset = 19, innerW = max(0, 30 - 38) = 0
    expect(p.scaleX).toBe(0);
    expect(p.visible).toBe(false);
  });

  it('all positions are integer pixels (snapToPixel)', () => {
    // 用奇数尺寸触发 .5 以验证 round
    for (const flag of ['UL', 'UR', 'BL', 'BR', 'T', 'B', 'L', 'R'] as const) {
      const p = computeEdgePlacement(flag, 201, 101, 21);
      expect(Number.isInteger(p.centerX)).toBe(true);
      expect(Number.isInteger(p.centerY)).toBe(true);
      expect(Number.isInteger(p.scaleX)).toBe(true);
      expect(Number.isInteger(p.scaleY)).toBe(true);
    }
  });
});

describe('backdropLayout — computeBackgroundPlacement', () => {
  it('no insets — full frame, centered', () => {
    const p = computeBackgroundPlacement(200, 100, null);
    expect(p.centerX).toBe(100);
    expect(p.centerY).toBe(50);
    expect(p.scaleX).toBe(200);
    expect(p.scaleY).toBe(100);
    expect(p.visible).toBe(true);
  });

  it('insets [left, top, right, bottom]', () => {
    // left=10, top=5, right=20, bottom=15
    // innerW = 200 - 10 - 20 = 170; innerH = 100 - 5 - 15 = 80
    // centerX = 10 + 170/2 = 95
    // centerY = 15 + 80/2 = 55  (Y-up: bottom inset is the start)
    const p = computeBackgroundPlacement(200, 100, [10, 5, 20, 15]);
    expect(p.innerWidth).toBe(170);
    expect(p.innerHeight).toBe(80);
    expect(p.centerX).toBe(95);
    expect(p.centerY).toBe(55);
  });

  it('insets larger than size ⇒ invisible', () => {
    const p = computeBackgroundPlacement(20, 20, [30, 0, 30, 0]);
    expect(p.innerWidth).toBe(0);
    expect(p.visible).toBe(false);
  });
});
