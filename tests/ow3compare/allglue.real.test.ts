/**
 * 真实数据对拍（求解器级，全量 Glue 屏）：同一棵 IO 解析出的 resolved FDF 树，喂
 * openwar3 layout 与内核 fdfKernelLayout，box 用固定的全屏 {0,0,0.8,0.6}，逐帧对比。
 *
 * 数据来源：真机 E:/GAMES/WAR3/war3.mpq 的 UI\FrameDef\Glue\*.fdf（1.27 MPQ era），
 * 经 openwar3 的 MpqDataSource + FdfLibrary（IncludeFile/INHERITS/皮肤表）解析。
 *
 * root 选择：优先"文件名去后缀"的具名帧；若不存在则取该屏顶层具名帧里 children 最多者。
 * MultiplayerMenu.fdf 是 11 字节空壳（仅 include），skip。
 *
 * 注意：screens 在模块顶层同步构建（MPQ rawBytes 是同步的），因为 vitest 的 describe.each
 * 无法用 beforeAll 里填充的数组动态生成用例。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { layout as kernelLayout, UI_WIDTH, UI_HEIGHT } from '../../src/utils/fdfKernelLayout';

const OW3_REPO = 'd:/Projects/openwar3';
const OW3_BUILD = join(OW3_REPO, '.sim-build', 'src');
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

/** 顶层同步构建 (screen, resolvedRoot) 列表。 */
interface Prepared { screen: string; rootName: string; root: any; }

const _req = createRequire(import.meta.url);
function loadCjsM(mod: string): any { return _req(join(OW3_BUILD, mod)); }

// 探测候选 rootName（同步）。MPQ rawBytes 是同步的。
function probeRoots(): Array<{ screen: string; file: string; topNames: string[] }> {
  if (!existsSync(join(OW3_BUILD, 'ui/fdf/parser.js')) || !existsSync(WAR3_MPQ)) return [];
  const mpqmod = loadCjsM('vfs/mpq.js');
  const { parseFdf } = loadCjsM('ui/fdf/parser.js');
  const ds = new mpqmod.MpqDataSource('war3.mpq', bigBuffer(WAR3_MPQ));
  const list = (ds as any).list ? (ds as any).list() as string[] : [];
  const glue = list.filter((n) => n.startsWith('UI\\FrameDef\\Glue\\') && n.endsWith('.fdf')).sort();
  const out: Array<{ screen: string; file: string; topNames: string[] }> = [];
  for (const p of glue) {
    const file = basename(p);
    if (SKIP.has(file)) continue;
    const b = ds.rawBytes(p);
    if (!b) continue;
    const src = new TextDecoder('latin1').decode(b);
    try {
      const parsed = parseFdf(src);
      const topNames = parsed.frames.filter((f: any) => f.name).map((f: any) => f.name);
      out.push({ screen: p, file, topNames });
    } catch { /* 解析失败则跳过 */ }
  }
  return out;
}

const probed = probeRoots();

// 每个屏选定 rootName（同步，纯文件名启发式 + 顶层首具名兜底）。
function pickRoot(topNames: string[], file: string): string | null {
  if (ROOT_OVERRIDE[file]) return ROOT_OVERRIDE[file];
  const byFile = file.replace(/\.fdf$/, '');
  if (topNames.includes(byFile)) return byFile;
  return topNames[0] ?? null;
}

const TARGETS: Array<{ screen: string; rootName: string }> = [];
for (const r of probed) {
  const rootName = pickRoot(r.topNames, r.file);
  if (rootName) TARGETS.push({ screen: r.screen, rootName });
}

// 缓存 resolved roots（async，一次性）
const resolvedCache = new Map<string, any>();
let usable = TARGETS.length > 0 && !!probed.length;

beforeAll(async () => {
  if (!usable) return;
  const req = createRequire(import.meta.url);
  const libmod = req(join(OW3_BUILD, 'ui/fdf/library.js'));
  const mpqmod = req(join(OW3_BUILD, 'vfs/mpq.js'));
  const MpqDataSource = mpqmod.MpqDataSource;
  const lib = new libmod.FdfLibrary(new MpqDataSource('war3.mpq', bigBuffer(WAR3_MPQ)));
  for (const t of TARGETS) {
    await lib.load(t.screen);
    const root = lib.resolveRoot(t.rootName);
    if (root) resolvedCache.set(t.screen, root);
  }
  usable = resolvedCache.size === TARGETS.length && TARGETS.length > 0;
});

function compareScreen(screen: string): { total: number; compared: number; diffs: any[] } {
  const root = resolvedCache.get(screen)!;
  const box = { x: 0, y: 0, w: UI_WIDTH, h: UI_HEIGHT };
  const ow3res = loadCjsM('ui/fdf/layout.js').layout(root, box, 1);
  const kres = kernelLayout(root, { box });
  const o = ow3res.byName, k = kres.byName;
  const allNames = new Set([...o.keys(), ...k.keys()]);
  let compared = 0;
  const diffs: any[] = [];
  const tol = 1e-6;
  for (const name of allNames) {
    if (!o.has(name) || !k.has(name)) { diffs.push({ name, x: [NaN, NaN], y: [NaN, NaN], w: [NaN, NaN], h: [NaN, NaN] }); continue; }
    const oo = o.get(name)!, kk = k.get(name)!;
    compared++;
    if (!['x', 'y', 'w', 'h'].every((key) => Math.abs(oo[key] - kk[key]) <= tol)) {
      diffs.push({ name, x: [oo.x, kk.x], y: [oo.y, kk.y], w: [oo.w, kk.w], h: [oo.h, kk.h] });
    }
  }
  return { total: allNames.size, compared, diffs };
}

it('环境可用：枚举到足够多的 Glue 屏幕', () => {
  expect(probed.length).toBeGreaterThan(20);
  expect(TARGETS.length).toBeGreaterThan(15);
  expect(usable).toBe(true);
});

describe.each(TARGETS)('real 求解器对拍 %s', (t) => {
  let result: { total: number; compared: number; diffs: any[] } | null = null;
  beforeAll(() => { if (usable) result = compareScreen(t.screen); });

  it(`[${t.rootName}] resolved root 可得`, () => {
    expect(usable).toBe(true);
    expect(resolvedCache.has(t.screen)).toBe(true);
  });

  it(`[${t.rootName}] 两求解器逐帧几何一致(diff≤1e-6)`, () => {
    if (!usable) return;
    const r = result!;
    console.log(`[all ${t.rootName}] frames=${r.total} compared=${r.compared} diff=${r.diffs.length}`);
    for (const d of r.diffs.slice(0, 10)) {
      console.log(`  ${d.name}: ow3 x=${d.x[0]?.toFixed(4)} w=${d.w[0]?.toFixed(4)} h=${d.h[0]?.toFixed(4)} | k x=${d.x[1]?.toFixed(4)} w=${d.w[1]?.toFixed(4)} h=${d.h[1]?.toFixed(4)}`);
    }
    if (r.diffs.length) {
      expect(r.diffs.length / Math.max(1, r.total)).toBeLessThanOrEqual(0.02, `${t.screen} 差异帧 > 2%`);
    }
  });
});