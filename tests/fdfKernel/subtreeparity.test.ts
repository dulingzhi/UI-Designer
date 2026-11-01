/**
 * 子树层 parity 实证（切链方案的前置门）：
 *   方案 = root锚点定位（旧 transformer 给出 root 画布 box）+ 内核 layout(root,{box}) 解子树。
 *
 * 做法：对每个官方 .fdf：
 *   1. 旧链路产 FrameData（root x/y/w/h 已由旧 transformer 从锚点求出）。
 *   2. 内核：parseFdf → 找到同名 FdfFrame root，layout(root, {box: 旧 root 的 x/y/w/h})。
 *   3. 对齐内核 LaidOutFrame 子树 ↔ 旧 FrameData 子树（按 name 路径），
 *      逐节点对比 x/y/w/h（下限原点 y-up；都用世界单位，不经 toPixels）。
 *
 * 目的：验证"root 由锚点定位 + 内核解子树"产出与旧 transformer 完全一致的几何。
 * 这是把 SceneGraphManager 输入切到内核算法的前置凭据；全绿才可动手切。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { layout } from '../../src/utils/fdfKernelLayout';

const EPS = 1e-6;
function allVendorFdfs(): string[] {
  const root = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef');
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.fdf')) out.push(p);
    }
  };
  walk(root);
  return out;
}

interface NodeGeom { name: string; x: number; y: number; w: number; h: number; children: NodeGeom[] }
/** 旧 subtree：从 root FrameData (parentId===null) 展开，按 children id 找帧。 */
function oldSubtreeRoot(oldFrames: any[], root: any): NodeGeom | null {
  const byId = new Map(oldFrames.map((f) => [f.id, f]));
  const build = (fd: any): NodeGeom => ({
    name: fd.name ?? `<anon:${fd.type}>`,
    x: fd.x, y: fd.y, w: fd.width, h: fd.height,
    children: (fd.children ?? []).map((cid: string) => build(byId.get(cid))).filter(Boolean),
  });
  try { return build(root); } catch { return null; }
}
/** 内核 subtree：从 LaidOutFrame（已 layout）展开。 */
function kernelSubtree(lf: { frame: any; x: number; y: number; w: number; h: number; children: any[] }): NodeGeom {
  return {
    name: lf.frame.name ?? `<anon:${lf.frame.type}>`,
    x: lf.x, y: lf.y, w: lf.w, h: lf.h,
    children: lf.children.map(kernelSubtree),
  };
}
/** 按 name 路径对齐两个子树，返回逐节点 diff 记录。 */
interface Diff { file: string; path: string; field: string; old: number; kernel: number }
function compareSubtree(a: NodeGeom, b: NodeGeom, file: string, pfx: string, out: Diff[]): void {
  const pathName = pfx ? `${pfx}/${a.name}` : a.name;
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    if (Math.abs(a[k] as number - b[k] as number) > EPS) {
      out.push({ file, path: pathName, field: k, old: a[k] as number, kernel: b[k] as number });
    }
  }
  const bByN = new Map(b.children.map((c) => [c.name, c]));
  for (const ca of a.children) {
    const cb = bByN.get(ca.name);
    if (!cb) { out.push({ file, path: `${pathName}/${ca.name}`, field: '__missing_kernel__', old: NaN, kernel: NaN }); continue; }
    compareSubtree(ca, cb, file, pathName, out);
  }
}

/**
 *  ⚠️ SKIPPED —— 移植到 fdfKernelScene.ts 方案的实证记录。
 *
 *  子树层对照结论：即使把旧 root 的 box 喂给内核 layout，仍有一大批差异，但大量来自
 *  旧 transformer 的 template 平铺结构（缺 289 root）与"内核更完整(label 高度=引擎
 *  auto size)、旧有缺陷(label 高度=0)"的方向性差别，并非求解错误。用户据此选定：
 *  **不追求与旧 transformer diff 0，以 openwar3 + 真机为 ground truth**。
 *  实际切链桥见 fdfKernelScene.ts（root 锚点定位 + kernel layout(root,{box}) 解子树）。
 *  本文件保留作记录，转 skip 不参与断言。
 */

describe.skip('内核 layout(root,{box=旧root}) 子树 ↔ 旧 transformer 子树几何一致', () => {
  const files = allVendorFdfs();

  it('全部官方 root：子树几何 diff == 0（切链前置门）', () => {
    const allDiffs: Diff[] = [];
    let comparedRoots = 0;

    for (const f of files) {
      const src = fs.readFileSync(f, 'latin1');
      let oldFrames: any[] = [];
      try {
        const lx = new FDFLexer(src);
        const ast = new FDFParser(lx.tokenize()).parse();
        oldFrames = new FDFTransformer().transform(ast) as any[];
      } catch { continue; }

      let file: ReturnType<typeof parseFdf>;
      try { file = parseFdf(src); } catch { continue; }
      const kernelRootByName = new Map(file.frames.map((r) => [r.name, r]));

      for (const oldRoot of oldFrames.filter((fd) => fd.parentId === null)) {
        if (!oldRoot.name) continue;
        const kr = kernelRootByName.get(oldRoot.name);
        if (!kr) { allDiffs.push({ file: path.basename(f), path: oldRoot.name, field: '__missing_kernel_root__', old: 0, kernel: 0 }); continue; }
        comparedRoots++;

        const oldSub = oldSubtreeRoot(oldFrames, oldRoot);
        if (!oldSub) continue;
        // 把旧 root 的 box 交给内核 layout
        const box = { x: oldRoot.x, y: oldRoot.y, w: oldRoot.width, h: oldRoot.height };
        const { tree } = layout(kr, { box });
        const kerSub = kernelSubtree(tree);
        compareSubtree(kerSub, oldSub, path.basename(f), '', allDiffs);
      }
    }

    expect(comparedRoots).toBeGreaterThan(50);
    const missKernel = allDiffs.filter((d) => d.field.startsWith('__missing_kernel'));
    const geomDiffs = allDiffs.filter((d) => !d.field.startsWith('__missing_kernel'));
    console.log(`[gate] comparedRoots=${comparedRoots} 几何diff=${geomDiffs.length} 缺内核root=${missKernel.length} 缺子节点=${allDiffs.filter(d=>d.field==='__missing_kernel__').length}`);

    // 报告按文件聚合的几何差异（前 15）
    const byF = new Map<string, number>();
    for (const d of geomDiffs) byF.set(d.file, (byF.get(d.file) ?? 0) + 1);
    const top = [...byF.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
    for (const [f, n] of top) console.log(`   [gate] ${f}: ${n} 几何diff`);
    if (geomDiffs.length) geomDiffs.slice(0, 10).forEach((d) => console.log(`     ${d.file} ${d.path}.${d.field} old=${d.old} kernel=${d.kernel}`));

    expect(geomDiffs).toEqual([]);
  });
});