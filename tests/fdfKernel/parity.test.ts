/**
 * parity 实证（阶段 E 前置）：内核 `fdfKernelTransformer` ↔ 旧 `FDFTransformer`
 * 在同一批官方语料上的 FrameData **数值/结构**等价性。
 *
 * 目的：证明把 `fileOperations.parseFDF` 的产出源从旧 transformer 切到内核
 * `fileToFrameData` 后，渲染器（SceneGraphManager/Canvas）接收到的 `project.frames`
 * 在数值上保持等价——这是"WebGL 全链路切到内核"的安全前置。
 *
 * 对比面（共同的投影）：name / type / parentId / children / anchors(p到tRp/xy) /
 * width / height。因两者 genId 不同，按「文件名 + 顶层父 lineage 的 name 路径」对齐，
 * 再逐帧比较。fdfMetadata 为内核专有，不参与共同投影。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { fileToFrameData, projectFrame } from '../../src/utils/fdfKernelTransformer';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

/**
 *  ⚠️ SKIPPED —— 结论归档（见下），不参与回归断言。
 *
 *  Parity 实证结论（已交付用户决策）：
 *  1. 内核 `fdfKernelTransformer` 是**结构契约适配器**（editor FrameData），旧
 *     `FDFTransformer` 是**平铺渲染节点树**（template-instance flattening /
 *     detachInlineTemplateChildren / 尺寸与画布锚点解析）。两者解答不同规模的问题，
 *     **非数值 1:1**。已实证 INHERITS width/height 是内核真实缺陷并已修复（此前默认
 *     0.1 现正确继承），但剩余差异有大量是"内核保留模板节点 / label 高度为引擎 auto
 *     size" 等方向性差别。
 *  2. 用户据此选定（ask_user_question cut_strategy / subgate）：**以 openwar3 布局
 *     语义 + 真机 1.27 FDF/PSNR 为 ground truth，不追求与旧 transformer 数值 1:1**。
 *  3. 渲染切链实际方案：root 锚点定位 + `fdfKernelLayout.layout(root,{box})` 解子树，
 *     LaidOutFrame→FrameData（见 fdfKernelScene.ts）。
 *
 *  故以下两段（顶层 name 集合一致 / 投影数值一致）保持人口供记录，转 skip 不参与断言。
 */

/** 遍历 vendor/UI/FrameDef 下全部 .fdf。 */
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

/** 旧链路：FDF 文本 → FrameData[]。 */
function oldTransformerFrames(src: string): { frames: ReturnType<typeof fileToFrameData>; err?: string } {
  try {
    const lexer = new FDFLexer(src);
    const ast = new FDFParser(lexer.tokenize()).parse();
    const frames = new FDFTransformer().transform(ast);
    return { frames: frames as unknown as ReturnType<typeof fileToFrameData> };
  } catch (e) {
    return { frames: [], err: e instanceof Error ? e.message : String(e) };
  }
}

/** 按 id 走 parentId 链，凑出从顶层起的 name 路径（用于对齐）。 */
function lineagePath(frames: Array<{ id: string; parentId: string | null; name: string }>, id: string): string {
  const byId = new Map(frames.map((f) => [f.id, f]));
  const segs: string[] = [];
  let cur = byId.get(id);
  while (cur) {
    segs.unshift(cur.name || `<anon#${cur.id}>`);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return segs.join('/');
}

describe.skip('内核 ↔ 旧 transformer parity（84 官方语料数值/结构等价）', () => {
  const files = allVendorFdfs();

  it('语料覆盖（≥50 个官方 .fdf）', () => {
    expect(files.length).toBeGreaterThanOrEqual(50);
  });

  it('全部语料两链路均不抛错', () => {
    let oldErr = 0, kernelErr = 0;
    for (const f of files) {
      const src = fs.readFileSync(f, 'latin1');
      const oldR = oldTransformerFrames(src);
      if (oldR.err) { oldErr++; console.warn(`[old][${path.basename(f)}] ${oldR.err}`); }
      try { parseFdf(src); } catch (e) { kernelErr++; console.warn(`[kernel][${path.basename(f)}] ${e}`); }
    }
    expect(oldErr).toBe(0);
    expect(kernelErr).toBe(0);
  });

  it('逐文件：顶层 name 集合一致', () => {
    const diffs: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'latin1');
      const oldR = oldTransformerFrames(src);
      const kernel = fileToFrameData(parseFdf(src));
      const oldTop = oldR.frames.filter((fd) => fd.parentId === null).map((fd) => fd.name).sort();
      const kerTop = kernel.filter((fd) => fd.parentId === null).map((fd) => fd.name).sort();
      if (JSON.stringify(oldTop) !== JSON.stringify(kerTop)) {
        diffs.push(`${path.basename(f)} old=[${oldTop.join(',')}] kernel=[${kerTop.join(',')}]`);
      }
    }
    expect(diffs).toEqual([]);
  });

  it('逐文件：按 name-lineage 对齐后，投影数值一致（width/height/anchors/type）', () => {
    let comparedFrames = 0;
    const mismatches: string[] = [];
    for (const f of files) {
      const src = fs.readFileSync(f, 'latin1');
      const oldR = oldTransformerFrames(src);
      const kernel = fileToFrameData(parseFdf(src));

      const keyOf = (frames: ReturnType<typeof fileToFrameData>) =>
        new Map(frames.map((fd) => [lineagePath(frames, fd.id), fd]));

      const kMap = keyOf(kernel);
      const oMap = keyOf(oldR.frames as any);

      // 对比所有 kernel 帧（以 kernel 为准），若 key 亦存在于旧帧则逐字段比较
      for (const [key, kfd] of kMap) {
        const ofd = oMap.get(key);
        if (!ofd) {
          // 顶层 name 已单独断言一致；内部 lineage 不同即便差异点，记录但不阻断
          continue;
        }
        comparedFrames++;
        const kp = projectFrame(kfd);
        const op = projectFrame(ofd);
        for (const field of ['name', 'type', 'width', 'height'] as const) {
          if (kp[field] !== op[field]) {
            mismatches.push(`${path.basename(f)} ${key} .${field} kernel=${JSON.stringify(kp[field])} old=${JSON.stringify(op[field])}`);
          }
        }
        // anchors 逐条数值比较
        const ka = kp.anchors as Array<{ point: number; relativeTo: string | null; relativePoint: number | null; x: number; y: number }>;
        const oa = op.anchors as typeof ka;
        if (ka.length !== oa.length) {
          mismatches.push(`${path.basename(f)} ${key} .anchors.length kernel=${ka.length} old=${oa.length}`);
        } else {
          for (let i = 0; i < ka.length; i++) {
            // relativeTo 在数图中分别已是 id（里面可能不同），故只比较 point/relativePoint/x/y
            for (const fld of ['point', 'relativePoint', 'x', 'y'] as const) {
              if (ka[i][fld] !== oa[i][fld]) {
                mismatches.push(`${path.basename(f)} ${key} .anchors[${i}].${fld} kernel=${JSON.stringify(ka[i][fld])} old=${JSON.stringify(oa[i][fld])}`);
              }
            }
          }
        }
      }
    }
    expect(comparedFrames).toBeGreaterThan(100);
    expect(mismatches).toEqual([]);
  });
});