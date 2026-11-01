/**
 * 阶段 C — 多分辨率（4:3 / 16:9 / 21:9）拉伸一致性回归。
 *
 * 验证内核 fitBox/stretchBox/toPixels 在三种视口下保持 WC3 拉伸不变量：
 *   - fitBox（按高度缩放、铺满全宽）：居中框架水平居中不随分辨率漂移；
 *   - stretchBox（作者 4:3 box 拉伸）：全宽 backdrop 在任意分辨率下恰好铺满 [0, viewportW]；
 *   - 顶部锚定的 backdrop 顶部、底部不随 xScale 拉伸而位移（纯水平拉伸，垂直轴不变）。
 */
import { describe, it, expect } from 'vitest';
import {
  fitBox,
  stretchBox,
  toPixels,
  UI_WIDTH,
  UI_HEIGHT,
  type LaidOutFrame,
} from '../../src/utils/fdfKernelLayout';

const RESOLUTIONS = [
  { name: '4:3', w: 800, h: 600 },
  { name: '16:9', w: 1280, h: 720 },
  { name: '21:9', w: 1720, h: 720 },
];

/** 一个未缩放的基础内核对齐帧。 */
function frame(x: number, y: number, w: number, h: number): LaidOutFrame {
  return { id: 1, name: 'f', x, y, w, h, placed: true } as LaidOutFrame;
}

describe('Phase C — fitBox/stretchBox/toPixels 多分辨率拉伸一致性', () => {
  it('fitBox 在三种分辨率下世界宽随视口拉伸，xScale 恒为 1', () => {
    for (const r of RESOLUTIONS) {
      const fit = fitBox(r.w, r.h);
      expect(fit.scale).toBeCloseTo(r.h / UI_HEIGHT, 9);
      expect(fit.xScale).toBe(1);
      expect(fit.worldW).toBeCloseTo(r.w / fit.scale, 9);
    }
  });

  it('stretchBox 在三种分辨率下均铺满作者 4:3 世界宽，xScale 反映水平拉伸', () => {
    for (const r of RESOLUTIONS) {
      const s = stretchBox(r.w, r.h);
      expect(s.scale).toBeCloseTo(r.h / UI_HEIGHT, 9);
      expect(s.worldW).toBeCloseTo(UI_WIDTH, 9);
      expect(s.xScale).toBeCloseTo(r.w / (UI_WIDTH * s.scale), 9);
    }
  });

  it('fitBox 下框架宽度仅随 scale 缩放（xScale=1），世界宽随视口加宽', () => {
    const world = frame(0, 0.1, UI_WIDTH * 0.4, UI_HEIGHT / 2);
    for (const r of RESOLUTIONS) {
      const fit = fitBox(r.w, r.h);
      const px = toPixels(world, fit);
      // 无水平拉伸：宽度 = 世界宽 * scale。
      expect(px.width).toBeCloseTo((UI_WIDTH * 0.4) * fit.scale, 6);
      expect(px.width).toBeCloseTo(r.w * 0.4 * (UI_WIDTH / fit.worldW), 6);
    }
  });

  it('stretchBox 下全宽 backdrop 在三种分辨率下恰好铺满水平 [0, viewportW]', () => {
    // 全宽（世界宽 = UI_WIDTH）的 backdrop 框架。
    const backdrop = frame(0, 0, UI_WIDTH, UI_HEIGHT);
    for (const r of RESOLUTIONS) {
      const s = stretchBox(r.w, r.h);
      const px = toPixels(backdrop, s);
      expect(px.left).toBeCloseTo(0, 6);
      // left + width 由 xScale 拉伸到恰好视口宽。
      expect(px.left + px.width).toBeCloseTo(r.w, 6);
      // 垂直方向未被 xScale 影响：高 = UI_HEIGHT * scale。
      expect(px.height).toBeCloseTo(UI_HEIGHT * s.scale, 6);
    }
  });

  it('顶部锚定 backdrop：纯水平拉伸不改变垂直顶部位置', () => {
    // 顶部锚定、贴世界顶的框架。
    const top = frame(0, UI_HEIGHT - 0.1, UI_WIDTH, 0.1);
    for (const r of RESOLUTIONS) {
      const s = stretchBox(r.w, r.h);
      const px = toPixels(top, s);
      // 世界 y-up：贴近顶部的框架，CSS top（左上原点）应恒为 0。
      expect(px.top).toBeCloseTo(0, 6);
      expect(px.height).toBeCloseTo(0.1 * s.scale, 6);
    }
  });
});