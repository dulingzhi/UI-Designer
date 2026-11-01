/**
 * 几何对拍：我们的内核 fdfKernelLayout vs openwar3 layout（纯求解器级）。
 *
 * 两边各自用「自己的 parser → 自己的 layout」解析同一段 FDF 文本，产出
 * LaidOutFrame，然后逐帧对比 x / y / w / h（世界坐标，y-up、左下原点，0.8×0.6)。
 *
 * openwar3 通过已编译的 .sim-build（d:/Projects/openwar3，CJS，package.json 标记
 * type:commonjs）加载，见 tools/fdf-layout-test.cjs 的同一手法。若该产物不存在则跳过。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFdf as kernelParse } from '../../src/utils/fdfKernelParser';
import { layout as kernelLayout, UI_WIDTH as K_W, UI_HEIGHT as K_H } from '../../src/utils/fdfKernelLayout';

const OW3_REPO = 'd:/Projects/openwar3';
const OW3_BUILD = join(OW3_REPO, '.sim-build', 'src', 'ui', 'fdf');

interface Ow3Layout {
  layout: (root: unknown, box: unknown, buttonWidthScale?: number) => { tree: any; byName: Map<string, any> };
  UI_WIDTH: number;
  UI_HEIGHT: number;
}
interface Ow3Parser {
  parseFdf: (src: string) => { frames: any[] };
}

let ow3: Ow3Layout | null = null;
let ow3Parse: Ow3Parser | null = null;
let usable = false;

beforeAll(() => {
  try {
    if (!existsSync(join(OW3_BUILD, 'layout.js'))) return;
    const req = createRequire(import.meta.url);
    ow3 = req(join(OW3_BUILD, 'layout.js')) as Ow3Layout;
    ow3Parse = req(join(OW3_BUILD, 'parser.js')) as Ow3Parser;
    usable = !!ow3 && !!ow3Parse;
  } catch {
    usable = false;
  }
});

/** 取 FDF 里第一个具名 root frame，且两边都能喂进自己的 layout.box。 */
function runBoth(src: string, opts: { w?: number; h?: number; dxScale?: number; buttonWidthScale?: number } = {}) {
  const box = { x: 0, y: 0, w: opts.w ?? K_W, h: opts.h ?? K_H };

  // --- openwar3 ---
  const ow3file = ow3Parse!.parseFdf(src);
  const ow3root = ow3file.frames.find((f: any) => f.name) ?? ow3file.frames[0];
  const ow3res = ow3!.layout(ow3root, box, opts.buttonWidthScale ?? 1, undefined, undefined, opts.dxScale);

  // --- kernel ---
  const kroot = kernelParse(src).frames[0];
  const kres = kernelLayout(kroot, {
    box,
    buttonWidthScale: opts.buttonWidthScale ?? 1,
    dxScale: opts.dxScale,
  });

  return { ow3res, kres };
}

/** 把 openwar3 byName 与 kernel byName 对齐，逐帧 diff。 */
function collectByName(res: { why: Map<string, any> }): Map<string, { x: number; y: number; w: number; h: number; placed: boolean }> {
  const out = new Map();
  for (const [k, v] of res.byName) {
    out.set(k, { x: v.x, y: v.y, w: v.w, h: v.h, placed: v.placed });
  }
  return out;
}

const TOL = 1e-6;

interface FrameWanted { name: string; x?: number; y?: number; w?: number; h?: number }

function expectGeometryClose(
  ow3f: Map<string, any>,
  kf: Map<string, any>,
  names: string[],
  tol = TOL,
) {
  for (const name of names) {
    const o = ow3f.get(name);
    const k = kf.get(name);
    expect(o, `ow3 missing ${name}`).toBeTruthy();
    expect(k, `kernel missing ${name}`).toBeTruthy();
    for (const key of ['x', 'y', 'w', 'h'] as const) {
      expect(Math.abs(o[key] - k[key])).toBeLessThanOrEqual(tol);
    }
  }
}

describe('ow3 几何对拍 — 基础与核心语法', () => {
  it('环境：openwar3 .sim-build 已编译可用', () => {
    expect(usable).toBe(true);
  });

  it('单点 SetPoint：TOP 锚到 Screen 顶部', () => {
    const src =
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "GLUETEXTBUTTON" "BtnA" { Width 0.2, Height 0.05, SetPoint TOP, "Screen", TOP, 0, 0, }' +
      '}';
    const { ow3res, kres } = runBoth(src);
    const names = ['Screen', 'BtnA'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names);
    // 额外断言几何语义正确
    expect(kres.byName.get('BtnA')!.y + kres.byName.get('BtnA')!.h).toBeCloseTo(0.6);
  });

  it('SetAllPoints 填充父', () => {
    const src =
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "BACKDROP" "Bg" { SetAllPoints, }' +
      '}';
    const { ow3res, kres } = runBoth(src);
    const names = ['Screen', 'Bg'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names);
    expect(kres.byName.get('Bg')!.w).toBeCloseTo(0.8);
    expect(kres.byName.get('Bg')!.h).toBeCloseTo(0.6);
  });

  it('兄弟链不动点收敛（BtnA / BtnB 依次）', () => {
    const src =
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "GLUETEXTBUTTON" "BtnA" { Width 0.2, Height 0.05, SetPoint TOP, "Screen", TOP, 0, 0, }' +
      'Frame "GLUETEXTBUTTON" "BtnB" { Width 0.2, Height 0.05, SetPoint BOTTOM, "BtnA", BOTTOM, 0, -0.01, }' +
      '}';
    const { ow3res, kres } = runBoth(src);
    const names = ['Screen', 'BtnA', 'BtnB'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names);
  });

  it('双锚点钉住（两点决定 size）胜过声明尺寸', () => {
    const src =
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "FRAME" "Pinned" { SetPoint TOPLEFT, "Screen", TOPLEFT, 0.1, -0.1, SetPoint BOTTOMRIGHT, "Screen", BOTTOMRIGHT, -0.1, 0.1, }' +
      '}';
    const { ow3res, kres } = runBoth(src);
    const names = ['Screen', 'Pinned'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names);
    // 无声明尺寸 → 两点算出的 w（x 向 0.6）/ h（y 向 0.4）
    const p = kres.byName.get('Pinned')!;
    expect(p.w).toBeCloseTo(0.6);
    expect(p.h).toBeCloseTo(0.4);
  });

  it('无锚点帧回退父 top-left', () => {
    const src =
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "FRAME" "Plain" { Width 0.1, Height 0.1, }' +
      '}';
    const { ow3res, kres } = runBoth(src);
    const names = ['Screen', 'Plain'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names);
  });
});

describe('ow3 几何对拍 — 宽屏 dxScale 与 shrink-wrap', () => {
  it('16:9 dxScale=worldW/0.8 拉伸 x 偏移、尺寸不变', () => {
    const w169 = (16 / 9) * K_H; // 1.0667
    const dxScale = w169 / K_W; // worldW / 0.8
    const src =
      'Frame "FRAME" "Root" { Width 0.8, Height 0.6,' +
      'Frame "BACKDROP" "Btn" { Width 0.16, Height 0.05, SetPoint TOPRIGHT, "Root", TOPRIGHT, -0.015, 0, }' +
      '}';
    const { ow3res, kres } = runBoth(src, { w: w169, dxScale });
    const names = ['Root', 'Btn'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names, 1e-4);
  });

  it('TEXT 帧 shrink-wrap 高度（单行=字号）', () => {
    const src =
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "TEXT" "Label" { SetPoint TOP, "Screen", TOP, 0, 0, FrameFont "TextFont", 0.02, }' +
      '}';
    const { ow3res, kres } = runBoth(src);
    const names = ['Screen', 'Label'];
    expectGeometryClose(collectByName(ow3res), collectByName(kres), names, 1e-4);
  });
});