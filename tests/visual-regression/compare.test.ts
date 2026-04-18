/**
 * compare.ts 自检 — 不依赖任何 renderer。
 * 跑 vitest 即可验证 pixelmatch + pngjs 链路工作正常。
 */
import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { compareImages, meetsAcceptance } from './compare';

function solid(width: number, height: number, r: number, g: number, b: number, a = 255): Uint8Array {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  }
  return new Uint8Array(PNG.sync.write(png));
}

describe('visual regression — compare.ts', () => {
  it('identical images → PSNR Infinity, 0 diff', () => {
    const a = solid(16, 16, 200, 100, 50);
    const r = compareImages(a, a);
    expect(r.diffPixels).toBe(0);
    expect(r.diffRatio).toBe(0);
    expect(r.psnr).toBe(Number.POSITIVE_INFINITY);
    expect(r.maxChannelDiff).toBe(0);
    expect(meetsAcceptance(r)).toBe(true);
  });

  it('1-channel diff of 1/255 → still passes acceptance', () => {
    const a = solid(16, 16, 200, 100, 50);
    const b = solid(16, 16, 201, 100, 50); // diff 1 in R
    const r = compareImages(a, b);
    expect(r.maxChannelDiff).toBe(1);
    // 全图都差 1 → diffRatio 取决于 pixelmatch threshold; PSNR 应 >> 45dB
    expect(r.psnr).toBeGreaterThan(45);
  });

  it('50% pixels off → fails acceptance', () => {
    const a = solid(16, 16, 0, 0, 0);
    const b = solid(16, 16, 255, 255, 255);
    const r = compareImages(a, b);
    expect(r.diffRatio).toBe(1);
    expect(meetsAcceptance(r)).toBe(false);
  });

  it('size mismatch throws', () => {
    const a = solid(16, 16, 0, 0, 0);
    const b = solid(32, 32, 0, 0, 0);
    expect(() => compareImages(a, b)).toThrow(/size mismatch/i);
  });
});
