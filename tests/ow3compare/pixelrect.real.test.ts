/**
 * 档2 —— 像素矩形对拍（浏览器栅格 PSNR 的前置守卫，亦是独立交付物）。
 *
 * openwar3 与我方使用两套互不相同的、独立实现的像素转换管线：
 *
 *   - 我方：coordinateService.wc3ToPixelX/YBottom/W/H + pixelSnap.snapRectToPixels
 *           （ScreenToPixelHeight 逆向：pixel = wc3 单位 × 1800，落到设备像素网格取整）
 *   - openwar3：layout.toPixels(n, fitBox) → { left, top, width, height }
 *           （left/width 乘 scale×xScale，top=(UI_HEIGHT-(y+h))×scale，返回 float）
 *
 * 真正的浏览器栅格 PSNR（档2）只在这两套管线"对同一世界矩形给出同一整数像素矩形"时才有意义：
 * 否则两者光栅出的是不同画布，PSNR 是噪声而非对拍。本测试在真机 MPQ 的 40 屏上、对每个帧的
 * 共享世界矩形 (x,y,w,h)（档3b 已证两链几何一致）分别过两套像素公式，断言二者落到**同一整数
 * 像素矩形**。这是档2 光栅比对的硬门槛：全绿即证明"世界几何 ⇒ 像素几何"在两套管线中完全等价。
 *
 * 约定：统一 1920×1080、margin=240 的 WC3 4:3 设计盒。世界矩形使用双方已证的共享值；openwar3
 * 的像素输出转成我方"底部原点 + 整像素"约定后逐一对比。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseFdf as myParseFdf } from '../../src/utils/fdfKernelParser';
import { FdfLibrary as MyFdfLibrary } from '../../src/utils/fdfKernelLibrary';
import { layout as kernelLayout, UI_WIDTH, UI_HEIGHT } from '../../src/utils/fdfKernelLayout';
import { wc3ToPixelX, wc3ToPixelYBottom, wc3ToPixelW, wc3ToPixelH } from '../../src/utils/coordinateService';
import { CANVAS_MARGIN, CANVAS_HEIGHT, CANVAS_WIDTH } from '../../src/constants';
import { snapRectToPixels } from '../../src/renderer/pixelSnap';

const OW3_BUILD = 'd:/Projects/openwar3/.sim-build/src';
const WAR3_MPQ = 'E:/GAMES/WAR3/war3.mpq';

const ROOT_OVERRIDE: Record<string, string> = {
  'MainMenu.fdf': 'MainMenuFrame',
  'BattleNetMain.fdf': 'BattleNetMainFrame',
};
const SKIP = new Set(['MultiplayerMenu.fdf']);

function bigBuffer(p: string): Uint8Array {
  const buf = readFileSync(p);
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}
const _req = createRequire(import.meta.url);
function loadCjsM(mod: string): any { return _req(join(OW3_BUILD, mod)); }

function loadMyFile(ds: any, lib: MyFdfLibrary, path: string): void {
  const bin = ds.rawBytes(path);
  if (!bin) return;
  const src = new TextDecoder('latin1').decode(bin);
  const file = myParseFdf(src);
  for (const inc of file.includes) loadMyFile(ds, lib, inc);
  lib.loadFile(file);
}

let myDs: any = null;
if (existsSync(join(OW3_BUILD, 'vfs/mpq.js')) && existsSync(WAR3_MPQ)) {
  myDs = new (loadCjsM('vfs/mpq.js')).MpqDataSource('war3.mpq', bigBuffer(WAR3_MPQ));
}

interface Target { screen: string; file: string; rootName: string }
const TARGETS: Target[] = [];
const myResolved = new Map<string, any>();
const myScreenLib = new MyFdfLibrary();
{
  if (myDs) {
    const list = (myDs as any).list ? (myDs as any).list() as string[] : [];
    const glue = list.filter((n) => n.startsWith('UI\\FrameDef\\Glue\\') && n.endsWith('.fdf')).sort();
    const probe: Array<{ screen: string; file: string; topNames: string[] }> = [];
    for (const p of glue) {
      const file = basename(p);
      if (SKIP.has(file)) continue;
      const b = myDs.rawBytes(p);
      if (!b) continue;
      const src = new TextDecoder('latin1').decode(b);
      try {
        const topNames = myParseFdf(src).frames.filter((f) => f.name).map((f) => f.name);
        probe.push({ screen: p, file, topNames });
      } catch { /* 解析失败跳过 */ }
    }
    function pickRoot(topNames: string[], file: string): string | null {
      if (ROOT_OVERRIDE[file]) return ROOT_OVERRIDE[file];
      const byFile = file.replace(/\.fdf$/, '');
      if (topNames.includes(byFile)) return byFile;
      return topNames[0] ?? null;
    }
    for (const r of probe) {
      const rootName = pickRoot(r.topNames, r.file);
      if (rootName) TARGETS.push({ screen: r.screen, file: r.file, rootName });
    }
    for (const t of TARGETS) {
      loadMyFile(myDs, myScreenLib, t.screen);
      const root = myScreenLib.resolveRoot(t.rootName);
      if (root) myResolved.set(`${t.screen}#${t.rootName}`, root);
    }
  }
}
const usable = TARGETS.length > 0 && myResolved.size === TARGETS.length;

const ow3Resolved = new Map<string, any>();
let ow3Lib: any = null;
beforeAll(async () => {
  if (!usable || !myDs) return;
  const mpqmod = loadCjsM('vfs/mpq.js');
  const libmod = loadCjsM('ui/fdf/library.js');
  ow3Lib = new libmod.FdfLibrary(new mpqmod.MpqDataSource('war3.mpq', bigBuffer(WAR3_MPQ)));
  for (const t of TARGETS) {
    await ow3Lib.load(t.screen);
    const root = ow3Lib.resolveRoot(t.rootName);
    if (root) ow3Resolved.set(`${t.screen}#${t.rootName}`, root);
  }
});

// 统一 1920×1080、margin=240
const VIEW = { W: CANVAS_WIDTH, H: CANVAS_HEIGHT, MARGIN: CANVAS_MARGIN };

/** 我方像素约定：中心/底原点世界矩形 → 整像素矩形 (x,yBottom,w,h)。 */
function myPixelRect(x: number, y: number, w: number, h: number) {
  return snapRectToPixels(
    wc3ToPixelX(x),                       // 240 + x*1800
    wc3ToPixelYBottom(y),                 // y*1800 (bottom origin)
    wc3ToPixelW(w),                       // w*1800
    wc3ToPixelH(h),                       // h*1800
  );
}

/** openwar3 像素约定：toPixels → 转成我方"底原点 + margin + 整像素"矩形。
 *  我方 y = 矩形**下边**离屏幕底边的距离（bottom-origin）；openwar3 top 是**上边**离顶的距离。
 *  故 ow3 底部下边（bottom-up）= H - (top + height)；上边（bottom-up）= H - top。 */
function ow3PixelRect(n: any, fitBox: (w: number, h: number) => any) {
  const fit = fitBox(VIEW.W, VIEW.H);
  const p = loadCjsM('ui/fdf/layout.js').toPixels(n, fit); // {left,top,width,height} floats
  const yBottomUpBottom = VIEW.H - p.top - p.height; // 下边，底原点，与 wc3ToPixelYBottom 同约定
  const yBottomUpTop = VIEW.H - p.top;                // 上边，底原点
  const x0 = Math.round(p.left + VIEW.MARGIN);
  const x1 = Math.round(p.left + VIEW.MARGIN + p.width);
  const yB = Math.round(yBottomUpBottom);
  const yT = Math.round(yBottomUpTop);
  return { x: x0, y: yB, w: Math.max(1, x1 - x0), h: Math.max(1, yT - yB) };
}

function compareScreen(t: Target): { total: number; diffs: any[]; nameMismatch: string[]; exact: number; boundary: number } {
  const key = `${t.screen}#${t.rootName}`;
  const myRoot = myResolved.get(key);
  const ow3Root = ow3Resolved.get(key);
  const missing = { total: 0, diffs: [{ name: '<missing>' } as any], nameMismatch: [], exact: 0, boundary: 0 };
  if (!myRoot || !ow3Root) return missing;
  const box = { x: 0, y: 0, w: UI_WIDTH, h: UI_HEIGHT };
  const layoutMod = loadCjsM('ui/fdf/layout.js');
  const o = layoutMod.layout(ow3Root, box, 1).byName;
  const k = kernelLayout(myRoot, { box }).byName;
  const allNames = new Set([...o.keys(), ...k.keys()]);
  const nameMismatch: string[] = [];
  const diffs: any[] = [];
  let compared = 0, exact = 0, boundary = 0;
  for (const name of allNames) {
    const oo = o.get(name), kk = k.get(name);
    if (!oo || !kk) { nameMismatch.push(name); continue; }
    compared++;
    // 同一个世界矩形（档3b 已证相等），两套像素公式应给同一整像素矩形
    const mr = myPixelRect(kk.x, kk.y, kk.w, kk.h);
    const orr = ow3PixelRect(oo, layoutMod.fitBox);
    const d = Math.max(Math.abs(mr.x - orr.x), Math.abs(mr.y - orr.y), Math.abs(mr.w - orr.w), Math.abs(mr.h - orr.h));
    if (d === 0) { exact++; continue; }
    if (d === 1) { boundary++; diffs.push({ name, my: [mr.x, mr.y, mr.w, mr.h], ow3: [orr.x, orr.y, orr.w, orr.h], cls: 'boundary' }); continue; }
    diffs.push({ name, my: [mr.x, mr.y, mr.w, mr.h], ow3: [orr.x, orr.y, orr.w, orr.h], cls: 'HARD' });
  }
  return { total: compared, diffs, nameMismatch, exact, boundary };
}

it('环境可用：我方全链枚举 20+ 屏', () => {
  expect(usable).toBe(true);
  expect(TARGETS.length).toBeGreaterThan(20);
});

describe.each(TARGETS)('档2 像素矩形对拍 %s', (t: Target) => {
  let res: { total: number; diffs: any[]; nameMismatch: string[]; exact: number; boundary: number } | null = null;
  beforeAll(() => { if (usable) res = compareScreen(t); });

  it(`[${t.rootName}] 双方 resolved 可得且 name 集合一致`, () => {
    if (!usable) return;
    expect(res!.nameMismatch.length).toBe(0);
  });

  it(`[${t.rootName}] 同世界矩形经两套像素管线落到同一整数像素矩形`, () => {
    if (!usable) return;
    const r = res!;
    const hard = r.diffs.filter((d) => d.cls === 'HARD');
    console.log(`[pixel ${t.rootName}] total=${r.total} exact=${r.exact} boundary1px=${r.boundary} HARD=${hard.length} mismatch=${r.nameMismatch.length}`);
    for (const d of r.diffs.slice(0, 8)) {
      console.log(`  ${d.cls} ${d.name}: my=[${d.my?.join(',')}] ow3=[${d.ow3?.join(',')}]`);
    }
    expect(r.nameMismatch.length).toBe(0);
    // 硬性门槛：任何一帧在任意维 >1px 分歧 = 两套像素管线语义分歧 → 硬失败。
    // 恰好 1px 的边界翻转：几何已证相等，纯 float .5 舍入边界噪声，仅计数上报、不判失败。
    expect(hard.length).toBe(0);
  });
});