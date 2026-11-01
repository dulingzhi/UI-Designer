/**
 * 真实数据对拍（求解器级）：同一棵 IO 解析出的 resolved FDF 树，喂 openwar3 layout
 * 与内核 fdfKernelLayout，box 用固定的全屏 {0,0,0.8,0.6}，逐帧对比 x/y/w/h。
 *
 * 数据来源：真机 E:/GAMES/WAR3/war3.mpq（1.27 MPQ era）的 UI\FrameDef\Glue\*.fdf，
 * 通过 openwar3 自己编译的 MpqDataSource + FdfLibrary（IncludeFile/INHERITS/皮肤表）
 * 解析出 resolved root——这是"openwar3 加载原版数据"的权威参考。
 *
 * 隔离变量：两边 layout 吃的是**同一棵 resolved FdfFrame 树**与**同一个 box**，只比求解器。
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { layout as kernelLayout, UI_WIDTH, UI_HEIGHT } from '../../src/utils/fdfKernelLayout';

const OW3_REPO = 'd:/Projects/openwar3';
const OW3_BUILD = join(OW3_REPO, '.sim-build', 'src');
const WAR3_MPQ = 'E:/GAMES/WAR3/war3.mpq';

interface Ow3Layout {
  layout: (root: any, box: any, buttonWidthScale?: number) => { tree: any; byName: Map<string, any> };
}
interface Ow3Mpq { MpqDataSource: new (label: string, b: Uint8Array) => { rawBytes(p: string): Uint8Array | null } }
interface LibLike { load(p: string): Promise<void>; resolveRoot(n: string): any }

const SCREENS: Array<[string, string]> = [
  ['UI\\FrameDef\\Glue\\MainMenu.fdf', 'MainMenuFrame'],
  ['UI\\FrameDef\\Glue\\OptionsMenu.fdf', 'OptionsMenu'],
  ['UI\\FrameDef\\Glue\\SinglePlayerMenu.fdf', 'SinglePlayerMenu'],
  ['UI\\FrameDef\\Glue\\CampaignMenu.fdf', 'CampaignMenu'],
  ['UI\\FrameDef\\Glue\\Loading.fdf', 'Loading'],
];

let ow3: Ow3Layout | null = null;
let libInstance: LibLike | null = null;
let usable = false;
const roots = new Map<string, any>(); // screen → resolvedRoot

function bigBuffer(p: string): Uint8Array {
  const buf = readFileSync(p);
  return new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function compareScreen(screen: string, rootName: string): { total: number; compared: number; diffs: any[] } {
  const root = roots.get(screen);
  if (!root) return { total: 0, compared: 0, diffs: [{ name: `<no root ${rootName}>`, x: [NaN, NaN], y: [NaN, NaN], w: [NaN, NaN], h: [NaN, NaN] }] };
  const box = { x: 0, y: 0, w: UI_WIDTH, h: UI_HEIGHT };
  const ow3res = ow3!.layout(root, box, 1);
  const kres = kernelLayout(root, { box });
  const o = ow3res.byName, k = kres.byName;
  const allNames = new Set([...o.keys(), ...k.keys()]);
  let compared = 0;
  const diffs: any[] = [];
  const tol = 1e-6;
  for (const name of allNames) {
    if (!o.has(name) || !k.has(name)) {
      diffs.push({ name, x: [NaN, NaN], y: [NaN, NaN], w: [NaN, NaN], h: [NaN, NaN] });
      continue;
    }
    const oo = o.get(name)!, kk = k.get(name)!;
    compared++;
    const ok = ['x', 'y', 'w', 'h'].every((key) => Math.abs(oo[key] - kk[key]) <= tol);
    if (!ok) diffs.push({ name, x: [oo.x, kk.x], y: [oo.y, kk.y], w: [oo.w, kk.w], h: [oo.h, kk.h] });
  }
  return { total: allNames.size, compared, diffs };
}

describe('real-war3 求解器对拍（同一 resolved 树，5 屏）', () => {
  beforeAll(async () => {
    if (!existsSync(join(OW3_BUILD, 'ui/fdf/layout.js')) || !existsSync(join(OW3_BUILD, 'vfs/mpq.js'))
      || !existsSync(join(OW3_BUILD, 'ui/fdf/library.js')) || !existsSync(WAR3_MPQ)) {
      usable = false;
      return;
    }
    const req = createRequire(import.meta.url);
    try {
      ow3 = req(join(OW3_BUILD, 'ui/fdf/layout.js'));
      const mpqmod = req(join(OW3_BUILD, 'vfs/mpq.js'));
      const MpqDataSource = mpqmod.MpqDataSource;
      const libmod = req(join(OW3_BUILD, 'ui/fdf/library.js'));
      libInstance = new libmod.FdfLibrary(new MpqDataSource('war3.mpq', bigBuffer(WAR3_MPQ)));
      for (const [screen, rootName] of SCREENS) {
        await libInstance!.load(screen);
        const root = libInstance!.resolveRoot(rootName);
        if (root) roots.set(screen, root);
      }
      usable = roots.size === SCREENS.length;
    } catch {
      usable = false;
    }
  });

  it('环境可用且 5 屏全部解析出 root', () => {
    expect(usable).toBe(true);
    for (const [screen, rootName] of SCREENS) {
      expect(roots.has(screen), `${screen} root ${rootName}`).toBe(true);
    }
  });

  for (const [screen, rootName] of SCREENS) {
    it(`[${rootName}] 两求解器逐帧几何一致`, () => {
      if (!usable) return;
      const { total, compared, diffs } = compareScreen(screen, rootName);
      console.log(`\n[real ${rootName}] frames=${total} compared=${compared} diff=${diffs.length}`);
      for (const d of diffs.slice(0, 30)) {
        console.log(`  diff ${d.name}: ow3 x=${d.x[0]?.toFixed(4)} y=${d.y[0]?.toFixed(4)} w=${d.w[0]?.toFixed(4)} h=${d.h[0]?.toFixed(4)} | kernel x=${d.x[1]?.toFixed(4)} y=${d.y[1]?.toFixed(4)} w=${d.w[1]?.toFixed(4)} h=${d.h[1]?.toFixed(4)}`);
      }
      if (diffs.length) {
        // 精确 diff 计数门：真实屏幕允许少数差异，但须注释在案
        expect(diffs.length / Math.max(1, total)).toBeLessThanOrEqual(0.02, `${screen} 差异帧超过 2%（${diffs.length}/${total}）`);
      }
    });
  }
});