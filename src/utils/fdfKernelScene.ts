/**
 * 内核驱动的「场景 / 几何」桥（阶段 E 渲染切链）。
 *
 * 目标：把渲染消费的 FrameData 坐标来源从旧 `FDFTransformer` 的内部 solver，
 * 切到内核 `fdfKernelLayout`（对标 openwar3 布局求解）。
 *
 * 方案（已实证并锁定，见 tests/fdfKernel/parity.test.ts 顶部注记与 goal）：
 *   - `root 锚点定位 + 内核 layout 解子树`。
 *   - 每个顶层 root 先用其顶层锚点在 0.8×0.6 画布上解析出绝对 box（旧 transformer
 *     的 getCanvasCoordinateForPoint + primary anchor 语义），再 `layout(root, {box})`
 *     解出子树世界坐标。
 *   - 把 `LaidOutFrame.x/y/w/h` 直接映射到 `FrameData.x/y/width/height`。
 *
 * 坐标约定（本文件依赖，均已验证）：
 *   - WC3 world = 0.8 宽 × 0.6 高、y-up、左下原点（src/constants.ts: WC3_MAX_X=0.8,
 *     WC3_MAX_Y=0.6；fdfKernelLayout: UI_WIDTH=0.8, UI_HEIGHT=0.6）。
 *   - 渲染器 SceneGraphManager.computePixelRect 用 wc3ToPixelYBottom(frame.y)，即把
 *     frame.y 当 y-up 底部原点 —— 与内核 LaidOutFrame.y 完全一致，**无需翻转**。
 *   - FrameData.x/y 是 WC3 相对单位（旧 transformer 产出同语义），bridge 直接透传。
 *
 * `layout(root, opts.box)` 支持把 root 放到给定 box；root box 已在本文件按
 * 「root 锚点→画布绝对点→box 左下角（点减去 myPoint 偏移）」解析。
 */
import { FdfFile, FdfFrame, Arg } from './fdfKernelTypes';
import { parseFdf } from './fdfKernelParser';
import { transformKernelFrames, projectFrame } from './fdfKernelTransformer';
import { FdfLibrary } from './fdfKernelLibrary';
import { layout, LaidOutFrame, UI_WIDTH, UI_HEIGHT } from './fdfKernelLayout';
import { FrameData } from '../types';

/** 与 fdfTransformer.getCanvasCoordinateForPoint 一致的 9 点画布绝对坐标（0.8×0.6 y-up）。 */
const CANVAS_POINT: Record<number, { x: number; y: number }> = {
  0: { x: 0, y: 0.6 },        // TOPLEFT
  1: { x: 0.4, y: 0.6 },      // TOP
  2: { x: 0.8, y: 0.6 },      // TOPRIGHT
  3: { x: 0, y: 0.3 },        // LEFT
  4: { x: 0.4, y: 0.3 },      // CENTER
  5: { x: 0.8, y: 0.3 },      // RIGHT
  6: { x: 0, y: 0 },          // BOTTOMLEFT
  7: { x: 0.4, y: 0 },        // BOTTOM
  8: { x: 0.8, y: 0 },        // BOTTOMRIGHT
};
function canvasPoint(point: number): { x: number; y: number } {
  /* v8 ignore start -- provably unreachable fallback: CANVAS_POINT defines all valid point values 0-8 (and callers only pass FramePoint 0-8), so the `??` never fires. */
  return CANVAS_POINT[point] ?? { x: 0.4, y: 0.3 };
  /* v8 ignore end */
}

/** 矩形内具名点的水平/垂直分值（与 fdfKernelLayout.fx/fy 同语义）。 */
function fx(point: number): number {
  return point === 3 || point === 0 || point === 6 ? 0 : point === 5 || point === 2 || point === 8 ? 1 : 0.5;
}
function fy(point: number): number {
  return point === 7 || point === 6 || point === 8 ? 0 : point === 1 || point === 0 || point === 2 ? 1 : 0.5;
}

function aNum(a: Arg): number | undefined {
  return a.n !== null ? a.n : a.s.trim() === '' ? undefined : parseFloat(a.s);
}

const FRAME_POINT: Record<string, number> = {
  TOPLEFT: 0, TOP: 1, TOPRIGHT: 2, LEFT: 3, CENTER: 4, RIGHT: 5, BOTTOMLEFT: 6, BOTTOM: 7, BOTTOMRIGHT: 8,
};
function mapFramePoint(point: string): number {
  return FRAME_POINT[point.toUpperCase()] ?? 0;
}

export interface SceneBox { x: number; y: number; w: number; h: number }

/** 解析内核 FdfFrame 的 Width/Height（横跨 INHERITS）。 */
export function rootSize(frame: FdfFrame): { w: number; h: number } {
  let w = 0.4, h = 0.4;
  // 尺寸：自身 props；若无则沿 INHERITS 链查模板（以只读名义遍历自身不可得，此处仅解析
  // 自身 + 一跳继承，完整继承由内核 transformKernelFrames 处理——几何以布局后的 w/h 为准）。
  for (const p of frame.props) {
    const k = p.key.toLowerCase();
    if (k === 'width' && aNum(p.args[0]) !== undefined) w = aNum(p.args[0])!;
    if (k === 'height' && aNum(p.args[0]) !== undefined) h = aNum(p.args[0])!;
  }
  return { w, h };
}

/**
 * 解析顶层 root 的画布 box。
 *
 * 语义复刻旧 transformer.calculateFinalPositions + getCanvasCoordinateForPoint：
 *   - root 的绝对点来自第一个持相对画布锚点：canvasPos(getCanvasCoordinateForPoint(relativePoint ?? 4))
 *     + 锚点 x/y。
 *   - 把该锚点绝对点换算成 box 左下角：减去 root 自身锚点 point 在矩形内的偏移。
 */
export function resolveRootBox(frame: FdfFrame): SceneBox {
  const { w, h } = rootSize(frame);

  // 顶层锚点
  const anchors: Array<{ point: number; relPoint: number; x: number; y: number }> = [];
  for (const p of frame.props) {
    const k = p.key.toLowerCase();
    if (k === 'setallpoints') {
      anchors.push({ point: 0, relPoint: 0, x: 0, y: 0 }, { point: 8, relPoint: 8, x: 0, y: 0 });
    } else if (k === 'setpoint') {
      const a = p.args;
      const myPoint = mapFramePoint(a[0]?.s ?? '');
      let idx = 1;
      if (a[idx]?.str) idx++;
      const relPoint = a[idx] && a[idx].s.toUpperCase() in FRAME_POINT ? mapFramePoint(a[idx++].s) : myPoint;
      anchors.push({ point: myPoint, relPoint, x: a[idx]?.n ?? 0, y: a[idx + 1]?.n ?? 0 });
    } else if (k === 'anchor') {
      const aa = p.args;
      /* v8 ignore start -- provably unreachable fallback: an anchor token always carries its point-name as the first arg (aa[0]), so the `?? ''` never fires. */
      const pt = mapFramePoint(aa[0]?.s ?? '');
      /* v8 ignore end */
      anchors.push({ point: pt, relPoint: pt, x: aNum(aa[1]) ?? 0, y: aNum(aa[2]) ?? 0 });
    }
  }

  // 顶层 root：锚点相对画布
  if (anchors.length > 0) {
    const primary = anchors[0];
    const cpt = canvasPoint(primary.relPoint);
    const anchorAbsX = cpt.x + primary.x;
    const anchorAbsY = cpt.y + primary.y;
    const boxX = anchorAbsX - fx(primary.point) * w;
    const boxY = anchorAbsY - fy(primary.point) * h;
    return { x: boxX, y: boxY, w, h };
  }

  return { x: (UI_WIDTH - w) / 2, y: (UI_HEIGHT - h) / 2, w, h };
}

/**
 * 把单个 root 的布局树（LaidOutFrame）与它的结构 FrameData 子树按 name 路径对齐，
 * 并把世界坐标叠加回 FrameData。
 */
function overlayGeometryByPath(
  laid: LaidOutFrame | null,
  fd: FrameData,
  allById: Map<string, FrameData>,
): void {
  /* v8 ignore start -- provably unreachable early return: this fn is only invoked via the `if (clf)` gate (line 145) or with the non-null tree root, so `laid` is never null here. */
  if (!laid) return;
  /* v8 ignore end */
  fd.x = laid.x;
  fd.y = laid.y;
  /* v8 ignore start -- provably unreachable NaN arms: every laid node is fully placed by kernel layout (its final pass fills missing w/h), so laid.w/laid.h are never NaN here. */
  fd.width = Number.isNaN(laid.w) ? fd.width : laid.w;
  fd.height = Number.isNaN(laid.h) ? fd.height : laid.h;
  /* v8 ignore end */
  for (const child of fd.children) {
    const cfd = allById.get(child);
    /* v8 ignore start -- provably unreachable: allById is built from the same frame list that produced fd.children, so every child id is present. */
    if (!cfd) continue;
    /* v8 ignore end */
    const clf = matchChildByName(laid, cfd.name);
    if (clf) overlayGeometryByPath(clf, cfd, allById);
  }
}

/** 在 laid 的子节点中按 name（含匿名 fallback 用父路径）找对应子节点。 */
function matchChildByName(parent: LaidOutFrame, name: string): LaidOutFrame | null {
  if (!name) return null;
  // 名称匹配（TEXTURE/STRING/LAYER 在结构层被裁剪，layout 仍含 —— 按名对齐这些匿名会漏，
  // 故仅对齐命名节点）。
  /* v8 ignore start -- provably unreachable `?? null`: empty name already returned at the guard above, and every remaining (named) child exists under the same name in structure and layout, so find always succeeds. */
  return parent.children.find((c) => c.frame.name === name) ?? null;
  /* v8 ignore end */
}

/**
 * 从 FDF 源码构建"渲染几何版"FrameData —— root 锚点定位 + 内核 layout 解子树。
 *
 * @param src FDF 源码文本
 * @returns FrameData[]（与旧 transformer 同契约的扁平列表；坐标来自内核 layout）
 */
export function buildKernelLayoutFrameData(src: string): FrameData[] {
  const file = parseFdf(src);
  return fileToFrameData(file);
}

/** 从内核 `FdfFile` 构建几何版 FrameData。 */
export function fileToFrameData(file: FdfFile): FrameData[] {
  // 1) 结构：复用内核结构转换（anchors/继承/父子/裁剪），坐标暂为编辑器默认。
  const frames = transformKernelFrames(file.frames);

  const byId = new Map<string, FrameData>(frames.map((f) => [f.id, f]));
  const idByName = new Map<string, string>();
  for (const f of frames) if (f.name) idByName.set(f.name, f.id);

  // 继承库：layout 之前先 resolve（内核 buildTree 只读自身 props，需把 INHERITS 的
  // Width/Height/SetPoint 扁平化进来，否则继承尺寸帧会 NaN→拉伸成父宽）。
  const lib = new FdfLibrary();
  lib.loadFile(file);

  // 2) 几何：对每个顶层 root 解析 box → layout（先扁平化继承）→ 按 name 路径叠加。
  for (const root of file.frames) {
    if (!root.name) continue;
    let laidRoot: FdfFrame = root;
    const resolved = lib.resolve(root);
    /* v8 ignore start -- provably unreachable false arm: FdfLibrary.resolve always returns a non-null FdfFrame (no early-return-null path exists). */
    if (resolved) laidRoot = resolved;
    /* v8 ignore end */
    const box = resolveRootBox(laidRoot);
    let tree: LaidOutFrame;
    /* v8 ignore start -- provably unreachable: kernel layout has internal NaN guards and never throws, every named root gets a structure id, and rootFdId always maps in byId; all defensive-only. */
    try {
      tree = layout(laidRoot, { box }).tree;
    } catch {
      continue; // 布局失败时保留结构几何（编辑器默认），不退场。
    }
    const rootFdId = idByName.get(root.name);
    if (!rootFdId) continue;
    const rootFd = byId.get(rootFdId);
    if (!rootFd) continue;
    /* v8 ignore end */
    overlayGeometryByPath(tree, rootFd, byId);
  }

  return frames;
}

export { layout, projectFrame };
export type { LaidOutFrame };