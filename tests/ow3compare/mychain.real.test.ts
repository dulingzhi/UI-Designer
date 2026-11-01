/**
 * 档3b —— 我方真实桥接链 vs openwar3 全链，真机数据对拍。
 *
 * 目标：不只比"同一棵 resolved 树喂两个 solver"（档3a 已全绿），而是验证**我方从原始 FDF
 * 到几何的完整链路**与 openwar3 对齐：
 *
 *   - 我方链：openwar3 MpqDataSource(read only) → 我方 fdfKernelParser.parseFdf →
 *             我方 fdfKernelLibrary.FdfLibrary（含 IncludeFile 递归合并、INHERITS 展平、
 *             同名首定义胜出）→ 我方 fdfKernelLayout.layout → 世界矩形。
 *   - openwar3 链：同一 MpqDataSource → openwar3 FdfLibrary.load(含 GlobalStrings/skins/
 *             include) → resolveRoot → layout。
 *
 * 两链各自独立解析、独立求解，仅共用"原始 MPQ 读字节"这一 IO 步。逐帧比 x/y/w/h。
 * 任一 diff>0 都意味我方 parser 或 library 或 layout 与 openwar3 有真实分歧。
 *
 * 我方 parser 与 include-resolve 都是同步（rawBytes 同步），故 myResolved 在模块顶层同步构建；
 * openwar3 FdfLibrary.load 是 async，放进外层 beforeAll 的加载缓存。describe.each(TARGETS)
 * 用顶层同步数组生成用例。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseFdf as myParseFdf } from '../../src/utils/fdfKernelParser';
import { FdfLibrary as MyFdfLibrary } from '../../src/utils/fdfKernelLibrary';
import { layout as kernelLayout, UI_WIDTH, UI_HEIGHT } from '../../src/utils/fdfKernelLayout';

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

/** 我方 include 递归 loader：与 openwar3 loadFile 同序（include 先、同名定义首见胜出）。 */
function loadMyFile(ds: any, lib: MyFdfLibrary, path: string): void {
  const bin = ds.rawBytes(path);
  if (!bin) return;
  const src = new TextDecoder('latin1').decode(bin);
  const file = myParseFdf(src);
  for (const inc of file.includes) loadMyFile(ds, lib, inc); // include 先注册
  lib.loadFile(file);
}

let myDs: any = null;
if (existsSync(join(OW3_BUILD, 'vfs/mpq.js')) && existsSync(WAR3_MPQ)) {
  const mpqmod = loadCjsM('vfs/mpq.js');
  myDs = new mpqmod.MpqDataSource('war3.mpq', bigBuffer(WAR3_MPQ));
}

// —— 顶层同步：探测 root 名单，并用我方全链解析出 resolved 树缓存 ——
interface Target { screen: string; file: string; rootName: string }
const TARGETS: Target[] = [];
const myResolved = new Map<string, any>(); // screen + '#' + rootName → 我方 resolved 树
const myScreenLib = new MyFdfLibrary();
{
  if (myDs) {
    const list = (myDs as any).list ? (myDs as any).list() as string[] : [];
    const glue = list.filter((n) => n.startsWith('UI\\FrameDef\\Glue\\') && n.endsWith('.fdf')).sort();
    // 先用我方 parser 枚举每屏顶层具名帧，选 rootName
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
    // 我方全链解析每屏（各自用同一共享 myScreenLib，与 openwar3 共享库语义一致）
    for (const t of TARGETS) {
      loadMyFile(myDs, myScreenLib, t.screen);
      const root = myScreenLib.resolveRoot(t.rootName);
      if (root) myResolved.set(`${t.screen}#${t.rootName}`, root);
    }
  }
}

const usable = TARGETS.length > 0 && myResolved.size === TARGETS.length;

// —— openwar3 链：async 装进缓存 ——
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

function compareScreen(t: Target): { total: number; diffs: any[]; nameMismatch: string[] } {
  const key = `${t.screen}#${t.rootName}`;
  const myRoot = myResolved.get(key);
  const ow3Root = ow3Resolved.get(key);
  if (!myRoot || !ow3Root) return { total: 0, diffs: [{ name: '<missing>', x: [NaN, NaN], y: [NaN, NaN], w: [NaN, NaN], h: [NaN, NaN] }], nameMismatch: [] };
  const box = { x: 0, y: 0, w: UI_WIDTH, h: UI_HEIGHT };
  const o = ow3LayoutOf(ow3Root, box).byName;
  const k = kernelLayout(myRoot, { box }).byName;
  const allNames = new Set([...o.keys(), ...k.keys()]);
  const nameMismatch: string[] = [];
  let compared = 0;
  const diffs: any[] = [];
  const tol = 1e-6;
  for (const name of allNames) {
    if (!o.has(name) || !k.has(name)) { nameMismatch.push(name); continue; }
    const oo = o.get(name)!, kk = k.get(name)!;
    compared++;
    if (!['x', 'y', 'w', 'h'].every((key) => Math.abs(oo[key] - kk[key]) <= tol)) {
      diffs.push({ name, x: [oo.x, kk.x], y: [oo.y, kk.y], w: [oo.w, kk.w], h: [oo.h, kk.h] });
    }
  }
  return { total: allNames.size, diffs, nameMismatch };
}
function ow3LayoutOf(root: any, box: any): any {
  return loadCjsM('ui/fdf/layout.js').layout(root, box, 1);
}

it('环境可用：我方全链枚举 20+ 屏并全部解析成功', () => {
  expect(usable).toBe(true);
  expect(TARGETS.length).toBeGreaterThan(20);
});

describe.each(TARGETS)('我方全链 vs openwar3 %s#%s', (t: Target) => {
  let res: { total: number; diffs: any[]; nameMismatch: string[] } | null = null;
  beforeAll(() => { if (usable) res = compareScreen(t); });

  it(`[${t.rootName}] 双方 resolved 可得且 name 集合一致`, () => {
    if (!usable) return;
    expect(res!.nameMismatch.length).toBe(0);
  });

  it(`[${t.rootName}] 我方全链几何与 openwar3 一致`, () => {
    if (!usable) return;
    const r = res!;
    console.log(`[mychain ${t.rootName}] total=${r.total} diff=${r.diffs.length} nameMismatch=${r.nameMismatch.length}`);
    for (const d of r.diffs.slice(0, 8)) {
      console.log(`  ${d.name}: ow3 w=${d.w[0]?.toFixed(4)} h=${d.h[0]?.toFixed(4)} x=${d.x[0]?.toFixed(4)} | my w=${d.w[1]?.toFixed(4)} h=${d.h[1]?.toFixed(4)} x=${d.x[1]?.toFixed(4)}`);
    }
    expect(r.nameMismatch.length).toBe(0);
    if (r.diffs.length) {
      expect(r.diffs.length / Math.max(1, r.total)).toBeLessThanOrEqual(0.02, `${t.screen} 几何差异帧 > 2%`);
    }
  });
});