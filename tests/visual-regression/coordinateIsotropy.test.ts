/**
 * 守护 wc3ToPixelW 与 wc3ToPixelH 的"等比例"不变量。
 *
 * 历史背景：
 *   - SceneGraphManager.syncBackdrop 对 inset L/R 用 wc3ToPixelW、T/B 用 wc3ToPixelH。
 *   - 这只在 px/wc3-unit 在两轴上**相等**时才正确。
 *   - 当前常量：1440/0.8 = 1800、1080/0.6 = 1800 → 等价。
 *
 * 一旦未来 CANVAS_WIDTH/HEIGHT 或 WC3_MAX_X/Y 改动破坏此等价，
 * SceneGraphManager 中所有 inset、cornerSize 计算都会沿 W vs H 轴产生悄无声息的偏差。
 * 此测试在这种情况下立即报警。
 */
import { describe, it, expect } from 'vitest';
import { wc3ToPixelW, wc3ToPixelH } from '../../src/utils/coordinateService';

describe('coordinateService — px/wc3-unit isotropy invariant', () => {
  it('wc3ToPixelW(v) ≡ wc3ToPixelH(v) for all v', () => {
    for (const v of [0.001, 0.004, 0.01, 0.05, 0.1, 0.4]) {
      expect(wc3ToPixelW(v)).toBeCloseTo(wc3ToPixelH(v), 9);
    }
  });

  it('the shared scale is exactly 1800 px / wc3-unit', () => {
    expect(wc3ToPixelW(1)).toBeCloseTo(1800, 9);
    expect(wc3ToPixelH(1)).toBeCloseTo(1800, 9);
  });
});
