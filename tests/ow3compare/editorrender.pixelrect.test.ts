/**
 * 编辑器渲染像素映射一致守卫。
 *
 * 目标（几何一致守卫）：证明「编辑器渲染路径的 世界矩形→像素矩形 映射」与「内核/参考（openwar3）
 * 的同一映射」对**任意世界矩形**完全等价。
 *
 * 背景与实证（见 AGENTS.md 双路径决策）：编辑器渲染消费路径 `src/renderer/SceneGraphManager.ts`
 * 是一套**独立的第三方管线**（WebGPU 优先 / WebGL2 回退），其几何由锚点求解器
 * `calculatePositionFromAnchors`（`src/utils/anchorUtils.ts`）给出世界矩形（y-up、左下原点、[0,0.8]×[0,0.6]），
 * 再经 `SceneGraphManager.computePixelRect` 转成像素矩形：
 *
 *     computePixelRect = snapRectToPixels(
 *         wc3ToPixelX(x), wc3ToPixelYBottom(y), wc3ToPixelW(width), wc3ToPixelH(height));
 *
 * 而内核/参考管线（`src/utils/fdfKernelLayout.ts`）对同一世界矩形用 `toPixels(n, fit)` 转像素矩形
 * （y-down、左上/上边原点）；`tests/ow3compare/pixelrect.real.test.ts` 已在真机 MPQ 的 40 屏上
 * 把 openwar3 的 toPixels 输出转成「我方底原点 + margin + 整像素」约定并与我方像素管线对拍全绿。
 *
 * 本测试把这条已证等价再收口到**编辑器的渲染消费路径**本身：assert 编辑器渲染所用的那一串
 * `coordinateService + snapRectToPixels`（即 SceneGraphManager.computePixelRect）与内核 `toPixels`
 * ——两者真的共享同一映射，而非碰巧在某几个样例上相等。做法是对 1920×1080、margin=240 设计盒，
 * 在世界坐标系内扫一个**穷举网格**的正/负、边界、sub-grid、.5 舍入边界矩形，逐一断言两映射
 * 落到完全相同的**整数像素矩形**。任何一维 >0px 分歧即判失败。
 *
 * 单一实现语义：两个映射在代数上同一（uniform scale 1800 = 1080/0.6；编辑器加 240px X margin，
 * 内核 toPixels 无 margin，转成统一约定后抵消），故本守卫可全量、无 root/子帧特殊化地成立——
 * 与锚点求解器不同，像素映射处不存在编辑器/内核的语义分歧。
 */
import { describe, it, expect } from 'vitest';
import {
  wc3ToPixelX,
  wc3ToPixelYBottom,
  wc3ToPixelW,
  wc3ToPixelH,
} from '../../src/utils/coordinateService';
import { snapRectToPixels } from '../../src/renderer/pixelSnap';
import { fitBox, toPixels, UI_HEIGHT } from '../../src/utils/fdfKernelLayout';
import { CANVAS_MARGIN, CANVAS_WIDTH, CANVAS_HEIGHT } from '../../src/constants';

const VIEW = { W: CANVAS_WIDTH, H: CANVAS_HEIGHT, M: CANVAS_MARGIN };

/** 编辑器渲染路径像素映射 —— 与 SceneGraphManager.computePixelRect 逐字一致。 */
function editorPixelRect(x: number, y: number, w: number, h: number) {
  return snapRectToPixels(
    wc3ToPixelX(x),
    wc3ToPixelYBottom(y),
    wc3ToPixelW(w),
    wc3ToPixelH(h),
  );
}

/** 内核/参考 toPixels → 转成编辑器同约定（margin + 底原点 + 整像素）。 */
function kernelPixelRect(x: number, y: number, w: number, h: number) {
  const fit = fitBox(VIEW.W, VIEW.H);
  const p = toPixels({ x, y, w, h } as any, fit); // {left,top,width,height}
  const yBottomUpBottom = VIEW.H - p.top - p.height; // 下边，底原点
  const yBottomUpTop = VIEW.H - p.top; // 上边，底原点
  const x0 = Math.round(p.left + VIEW.M);
  const x1 = Math.round(p.left + VIEW.M + p.width);
  const yB = Math.round(yBottomUpBottom);
  const yT = Math.round(yBottomUpTop);
  return { x: x0, y: yB, w: Math.max(1, x1 - x0), h: Math.max(1, yT - yB) };
}

describe('编辑器渲染路径 像素映射 == 内核/参考 像素映射', () => {
  const xs = [0, 0.1, 0.2, 0.399999, 0.4, 0.7, 0.8, 0.15, 0.123, 0.0456];
  const ys = [0, 0.1, 0.3, 0.299999, 0.5, 0.6, 0.257, 0.001, 0.5555];
  const ws = [0.05, 0.1, 0.2, 0.55, 0.789, 0.0001, 0.8, 0.321];
  const hs = [0.05, 0.1, 0.3, 0.321, 0.5999, 0.6, 0.01, 0.257];

  it('扫描世界矩形网格：两像素映射逐像素一致', () => {
    let compared = 0;
    for (const x of xs) {
      for (const y of ys) {
        for (const w of ws) {
          for (const h of hs) {
            const e = editorPixelRect(x, y, w, h);
            const k = kernelPixelRect(x, y, w, h);
            compared++;
            expect(e).toEqual(k);
          }
        }
      }
    }
    expect(compared).toBeGreaterThan(200);
  });

  it('示例世界矩形一致性（含全屏与非整尺寸）', () => {
    const samples: Array<[number, number, number, number]> = [
      [0, 0, 0.8, 0.6],
      [0.1, 0.1, 0.2, 0.05],
      [0.4, 0.3, 0.2, 0.2],
      [0.123, 0.0456, 0.789, 0.321],
    ];
    for (const r of samples) {
      expect(editorPixelRect(...r)).toEqual(kernelPixelRect(...r));
    }
  });

  it('相同输入尺寸: 编辑器 wc3ToPixelW/H 的 scale 与内核 fit.scale 一致 (=1800)', () => {
    const fit = fitBox(VIEW.W, VIEW.H);
    expect(fit.scale).toBeCloseTo(VIEW.H / UI_HEIGHT, 9); // 1080/0.6 = 1800
    expect(wc3ToPixelW(0.1)).toBeCloseTo(0.1 * fit.scale, 6);
    expect(Math.round(wc3ToPixelH(1))).toBe(Math.round(fit.scale));
  });
});