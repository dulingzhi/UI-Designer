/**
 * FDF 声明式核心 —— 布局求解器（阶段 A）。
 *
 * 对标 openwar3 `src/ui/fdf/layout.ts`：把 SetPoint/Anchor/SetAllPoints + Width/Height
 * 解成世界坐标矩形（y-up、原点左下），再提供像素化转换。语义 1:1 迁移：
 *
 *  - 固定坐标系：屏幕 0.8 宽 × 0.6 高（4:3 作者空间），原点 BOTTOM-LEFT，+y 向上；
 *    SetPoint 偏移 +x 右 / +y 上。
 *  - 迭代不动点：SetPoint 可能引用尚未放置的 sibling（按钮链），每轮放置"尺寸已知且引用
 *    已放置"的节点，直到不再有进展。
 *  - 两个对立 SetPoint 双向钉住，胜过声明/继承的 Width/Height（点是约束、尺寸是默认）。
 *  - TEXT 帧按引擎行为自动缩放：缺少高度时单行 = 字体大小，多行 = 行数 × 字号 × 1.2 行高。
 *  - 引用缺失时回退到父控件的 top-left（保证仍可见，不消失）。
 *
 * 本内核**不含 DOM/渲染依赖**，可在 node/vitest 直接单测；把 LaidOutFrame → CSS 像素
 * 给出 `toPixels`，把视口适配给出 `fitBox`/`stretchBox`。
 */
import { type FdfFrame } from './fdfKernelTypes';
import { firstProp, numProp, allProps, hasFlag } from './fdfKernelLibrary';

export { type FdfFrame };

export const UI_WIDTH = 0.8;
export const UI_HEIGHT = 0.6;

/** 一个 frame 加上其求解后的世界矩形（x,y = 左下角）。 */
export interface LaidOutFrame {
  frame: FdfFrame;
  parent: LaidOutFrame | null;
  x: number;
  y: number;
  w: number;
  h: number;
  children: LaidOutFrame[];
  placed: boolean;
  /** WIDTH 不是文件声明：要么实测自字符串、要么继承自父控件——都代表引擎的 shrink-wrap。 */
  fabricatedWidth?: boolean;
  /** HEIGHT 是引擎的单行 shrink-wrap：恰为字体大小，无行距空间，允许字形外溢。 */
  shrinkWrapped?: boolean;
  /** shrink-wrap 的 TEXT 帧水平对齐：锚点水平分值决定（左/中/右），而非文件字体对齐。 */
  autoJustifyH?: 'JUSTIFYLEFT' | 'JUSTIFYCENTER' | 'JUSTIFYRIGHT';
}

const FRAME_POINTS = new Set([
  'TOPLEFT', 'TOP', 'TOPRIGHT', 'LEFT', 'CENTER', 'RIGHT', 'BOTTOMLEFT', 'BOTTOM', 'BOTTOMRIGHT',
]);

// 具名点在矩形内的水平/垂直分值（左/底为 0，右/顶为 1，中为 0.5）。
function fx(point: string): number {
  if (point === 'LEFT' || point === 'TOPLEFT' || point === 'BOTTOMLEFT') return 0;
  if (point === 'RIGHT' || point === 'TOPRIGHT' || point === 'BOTTOMRIGHT') return 1;
  return 0.5;
}
function fy(point: string): number {
  if (point === 'BOTTOM' || point === 'BOTTOMLEFT' || point === 'BOTTOMRIGHT') return 0;
  if (point === 'TOP' || point === 'TOPLEFT' || point === 'TOPRIGHT') return 1;
  return 0.5;
}

interface PointSpec {
  myPoint: string;
  relName: string | null; // 具名相对 frame，或 null → parent
  relPoint: string;
  dx: number;
  dy: number;
}

function readPoints(frame: FdfFrame): { setAllPoints: boolean; points: PointSpec[] } {
  const points: PointSpec[] = [];
  const setAllPoints = hasFlag(frame, 'SetAllPoints');

  for (const pr of allProps(frame, 'SetPoint')) {
    const a = pr.args;
    if (!a.length || !FRAME_POINTS.has(a[0].s)) continue;
    const myPoint = a[0].s;
    let idx = 1;
    let relName: string | null = null;
    if (a[idx]?.str) { relName = a[idx].s; idx++; }
    const relPoint = a[idx] && FRAME_POINTS.has(a[idx].s) ? a[idx++].s : myPoint;
    const dx = a[idx]?.n ?? 0; const dy = a[idx + 1]?.n ?? 0;
    points.push({ myPoint, relName, relPoint, dx, dy });
  }
  for (const pr of allProps(frame, 'Anchor')) {
    const a = pr.args;
    if (!a.length || !FRAME_POINTS.has(a[0].s)) continue;
    points.push({ myPoint: a[0].s, relName: null, relPoint: a[0].s, dx: a[1]?.n ?? 0, dy: a[2]?.n ?? 0 });
  }
  return { setAllPoints, points };
}

/** TEXT 帧的单行行为：一行恰为字体大小，无行距；多行 1.2 行高。 */
const LINE_LEADING = 1.2;
export function textBoxHeight(frame: FdfFrame, lines: number): number {
  const size = fontSizeOf(frame) ?? 0.013;
  return lines <= 1 ? size : lines * size * LINE_LEADING;
}
/** TEXT/String 帧的声明字号：FrameFont/Font 的第二参。 */
export function fontSizeOf(frame: FdfFrame): number | undefined {
  return firstProp(frame, 'FrameFont')?.args[1]?.n ?? firstProp(frame, 'Font')?.args[1]?.n ?? undefined;
}
/** 持有文本、引擎按字符串自动缩放的帧类型。 */
export function isTextFrame(frame: FdfFrame): boolean {
  return frame.type === 'TEXT' || frame.type === 'STRING';
}

function buildTree(frame: FdfFrame, parent: LaidOutFrame | null): LaidOutFrame {
  const node: LaidOutFrame = {
    frame, parent,
    x: 0, y: 0,
    w: numProp(frame, 'Width') ?? NaN,
    h: numProp(frame, 'Height') ?? NaN,
    children: [],
    placed: false,
  };
  node.children = frame.children.map((c) => buildTree(c, node));
  return node;
}

/** 引擎提供、而非文件声明的锚点。POPUPMENU 的下拉箭头（PopupArrowFrame）带尺寸但无
 *  SetPoint：引擎把它贴到控件右缘、内缩 PopupButtonInset。否则未锚点帧回退父 top-left。
 *
 *  注意：本函数**原地改写**传入的 FdfFrame.props（注入 SetPoint）。桥接层需在
 *  `transformKernelFrames` 之前调用一次，使结构层与布局层看到同一份锚点。 */
export function applyWidgetDefaults(root: FdfFrame): void {
  (function walk(f: FdfFrame): void {
    const arrowName = firstProp(f, 'PopupArrowFrame')?.args[0]?.s;
    const arrow = arrowName ? f.children.find((c) => c.name === arrowName) : undefined;
    if (arrow && !hasFlag(arrow, 'SetPoint') && !hasFlag(arrow, 'Anchor') && !hasFlag(arrow, 'SetAllPoints')) {
      const inset = numProp(f, 'PopupButtonInset') ?? 0.01;
      arrow.props.push({
        key: 'SetPoint',
        args: [
          { s: 'RIGHT', n: null, str: false },
          { s: f.name, n: null, str: true },
          { s: 'RIGHT', n: null, str: false },
          { s: String(-inset), n: -inset, str: false },
          { s: '0', n: 0, str: false },
        ],
      });
    }
    f.children.forEach(walk);
  })(root);
}

/** 逐个拉宽按钮控件（按钮帧 + 其 BACKDROP 父），再求解布局；文本不受影响——其尺寸来自
 *  FrameFont 而非帧宽。SLIDER 的 KNOB 豁免：它是圆珠美术，拉宽会画成椭圆。 */
const BUTTON_TYPES = new Set(['GLUETEXTBUTTON', 'GLUEBUTTON', 'TEXTBUTTON', 'BUTTON', 'GLUECHECKBOX']);
function scaleButtonWidths(root: LaidOutFrame, scale: number): void {
  const done = new Set<LaidOutFrame>();
  const widen = (n: LaidOutFrame): void => {
    if (done.has(n) || Number.isNaN(n.w)) return;
    n.w *= scale;
    done.add(n);
  };
  const knobs = new Set<string>();
  (function findKnobs(f: FdfFrame): void {
    const name = firstProp(f, 'SliderThumbButtonFrame')?.args[0]?.s;
    if (name) knobs.add(name);
    f.children.forEach(findKnobs);
  })(root.frame);
  (function walk(n: LaidOutFrame): void {
    if (BUTTON_TYPES.has(n.frame.type) && n.frame.type !== 'GLUEBUTTON' && !(n.frame.name && knobs.has(n.frame.name))) {
      widen(n);
      if (n.parent && n.parent.frame.type === 'BACKDROP') {
        if (done.has(n)) {
          for (const icon of n.parent.children) {
            if (icon.frame.type === 'GLUEBUTTON' && !Number.isNaN(icon.w)) n.w += icon.w * (scale - 1);
          }
        }
        widen(n.parent);
      }
    }
    n.children.forEach(walk);
  })(root);
}

/** 测量 TEXT 帧字符串的世界宽度（引擎自动尺寸）；不可测则 undefined → 回退父控件宽。 */
export type MeasureText = (frame: FdfFrame) => number | undefined;
/** 测量 TEXT 帧按 widthWorld 换行后的行数。 */
export type MeasureTextLines = (frame: FdfFrame, widthWorld: number) => number | undefined;

export interface LayoutOptions {
  box?: { x: number; y: number; w: number; h: number };
  buttonWidthScale?: number;
  measure?: MeasureText;
  measureLines?: MeasureTextLines;
  /**
   * SetPoint 的 X 偏移被拉伸的倍数。FDF 的 x 空间是屏幕宽度（0.8 = 整窗），本求解器以
   * 高度单位工作，宽屏需传 `worldW / 0.8`。**尺寸不**被拉伸。`nudgeX` 修正保留其像素值。
   */
  dxScale?: number;
}

/**
 * 求解一棵 frame 子树成世界矩形。root 填充给定 box（默认整 0.8×0.6 UI 空间）。
 * 返回 `{ tree, byName }`：byName 用于 handler 绑定与 sibling 查找。
 */
export function layout(
  root: FdfFrame,
  opts: LayoutOptions = {},
): { tree: LaidOutFrame; byName: Map<string, LaidOutFrame> } {
  const box = opts.box ?? { x: 0, y: 0, w: UI_WIDTH, h: UI_HEIGHT };
  const buttonWidthScale = opts.buttonWidthScale ?? 1;
  const measure = opts.measure;
  const measureLines = opts.measureLines;
  const dxScale = opts.dxScale ?? 1;

  applyWidgetDefaults(root);
  const tree = buildTree(root, null);
  // Root 填充其 box。
  tree.x = box.x; tree.y = box.y;
  if (Number.isNaN(tree.w)) tree.w = box.w;
  if (Number.isNaN(tree.h)) tree.h = box.h;
  tree.placed = true;

  if (buttonWidthScale !== 1) scaleButtonWidths(tree, buttonWidthScale);

  const byName = new Map<string, LaidOutFrame>();
  const all: LaidOutFrame[] = [];
  (function walk(n: LaidOutFrame) { all.push(n); if (n.frame.name) byName.set(n.frame.name, n); n.children.forEach(walk); })(tree);

  const relOf = (n: LaidOutFrame, name: string | null): LaidOutFrame | null =>
    (name && byName.get(name)) || n.parent;

  for (let pass = 0; pass < all.length + 4; pass++) {
    let progressed = false;
    for (const n of all) {
      if (n.placed) continue;
      const { setAllPoints, points } = readPoints(n.frame);
      if (dxScale !== 1 && points.length) {
        const mark = n.frame.nudgedX ?? 0;
        points[0].dx = (points[0].dx - mark) * dxScale + mark;
      }

      if (setAllPoints && n.parent?.placed) {
        n.x = n.parent.x; n.y = n.parent.y; n.w = n.parent.w; n.h = n.parent.h;
        n.placed = true; progressed = true; continue;
      }

      // 两个对立 SetPoint 双向钉住，胜过声明/继承的尺寸。
      if (points.length >= 2 && points.every((pt) => relOf(n, pt.relName)?.placed)) {
        const opposedX = new Set(points.map((p) => fx(p.myPoint))).size > 1;
        const opposedY = new Set(points.map((p) => fy(p.myPoint))).size > 1;
        // 跨宽锚定但无 Height → TEXT 按引擎 shrink-wrap：先记下（须在 placeByTwoPoints 赋值 n.h
        // 之前读 NaN），再解一遍定高。多行=行数×字号×1.2；单行=恰字号。
        const wrapHeight = isTextFrame(n.frame) && Number.isNaN(n.h) && opposedX && !opposedY;
        placeByTwoPoints(n, points, relOf);
        if (wrapHeight) {
          const lines = measureLines?.(n.frame, n.w) ?? 1;
          n.h = textBoxHeight(n.frame, lines);
          n.shrinkWrapped = lines <= 1;
          placeByTwoPoints(n, points, relOf); // 高度已知后再解一遍
        }
        progressed = true;
        continue;
      }

      if (Number.isNaN(n.w) || Number.isNaN(n.h)) {
        if (isTextFrame(n.frame) && points.length) {
          const measured = measure?.(n.frame);
          if (Number.isNaN(n.w) && measured !== undefined) { n.w = measured; n.fabricatedWidth = true; }
          if (Number.isNaN(n.h)) {
            const lines = measureLines?.(n.frame, n.w)
              ?? (measured !== undefined && n.w > 0 ? Math.max(1, Math.ceil(measured / n.w - 0.01)) : 1);
            n.h = textBoxHeight(n.frame, lines);
            n.shrinkWrapped = lines <= 1;
          }
        }
        if (n.parent?.placed) {
          if (Number.isNaN(n.w)) { n.w = n.parent.w; n.fabricatedWidth = true; }
          if (Number.isNaN(n.h)) n.h = n.parent.h;
        } else continue;
      }

      if (!points.length) {
        if (n.parent?.placed) {
          n.x = n.parent.x; n.y = n.parent.y + n.parent.h - n.h;
          n.placed = true; progressed = true;
        }
        continue;
      }

      const pt = points[0];
      const rel = relOf(n, pt.relName);
      if (!rel?.placed) continue;
      const lx = rel.x + fx(pt.relPoint) * rel.w + pt.dx;
      const ly = rel.y + fy(pt.relPoint) * rel.h + pt.dy;
      n.x = lx - fx(pt.myPoint) * n.w;
      n.y = ly - fy(pt.myPoint) * n.h;
      if (n.fabricatedWidth && isTextFrame(n.frame)) {
        const f = fx(pt.myPoint);
        n.autoJustifyH = f === 0 ? 'JUSTIFYLEFT' : f === 1 ? 'JUSTIFYRIGHT' : 'JUSTIFYCENTER';
      }
      n.placed = true; progressed = true;
    }
    if (!progressed) break;
  }

  // 仍未放置（悬空引用）：钉到父控件 top-left，使其可见而非消失。
  // v8 ignore start -- provably unreachable parentless arms (`?? 0`, `: UI_HEIGHT`):
  //   the tree root is always placed (line 211), so every node still in this loop has a
  //   non-null parent; only the n.parent truthy arms can execute at 299-302.
  for (const n of all) {
    if (n.placed) continue;
    if (Number.isNaN(n.w)) n.w = n.parent?.w ?? 0;
    if (Number.isNaN(n.h)) n.h = n.parent?.h ?? 0;
    n.x = n.parent?.x ?? 0;
    n.y = (n.parent ? n.parent.y + n.parent.h : UI_HEIGHT) - n.h;
    n.placed = true;
  }
  /* v8 ignore end */

  return { tree, byName };
}

function placeByTwoPoints(
  n: LaidOutFrame,
  points: PointSpec[],
  relOf: (n: LaidOutFrame, name: string | null) => LaidOutFrame | null,
): void {
  const loc = points.map((pt) => {
    const rel = relOf(n, pt.relName)!;
    return { p: pt.myPoint, x: rel.x + fx(pt.relPoint) * rel.w + pt.dx, y: rel.y + fy(pt.relPoint) * rel.h + pt.dy };
  });
  const xs = loc.map((l) => ({ f: fx(l.p), v: l.x }));
  const ys = loc.map((l) => ({ f: fy(l.p), v: l.y }));
  const solve1D = (pts: { f: number; v: number }[], fallbackSize: number): [number, number] => {
    const a = pts[0];
    const b = pts.find((p) => p.f !== a.f);
    if (!b) return [a.v - a.f * fallbackSize, fallbackSize];
    const size = (b.v - a.v) / (b.f - a.f);
    return [a.v - a.f * size, size];
  };
  [n.x, n.w] = solve1D(xs, Number.isNaN(n.w) ? 0 : n.w);
  [n.y, n.h] = solve1D(ys, Number.isNaN(n.h) ? 0 : n.h);
  n.placed = true;
}

/** 视口适配：按高度缩放、铺满全宽（worldW = 视口宽 / scale）。 */
export interface FitBox { scale: number; worldW: number; xScale: number }
export function fitBox(viewportW: number, viewportH: number): FitBox {
  const scale = viewportH / UI_HEIGHT;
  return { scale, worldW: viewportW / scale, xScale: 1 };
}
/** 视口适配：拉伸作者 4:3 box（loading 屏规则）。 */
export function stretchBox(viewportW: number, viewportH: number): FitBox {
  const scale = viewportH / UI_HEIGHT;
  return { scale, worldW: UI_WIDTH, xScale: viewportW / (UI_WIDTH * scale) };
}

/** 世界矩形（y-up、左下原点）→ CSS 像素矩形（y-down、左上原点）。 */
export function toPixels(
  n: LaidOutFrame,
  fit: { scale: number; xScale?: number },
): { left: number; top: number; width: number; height: number } {
  const sx = fit.scale * (fit.xScale ?? 1);
  return {
    left: n.x * sx,
    top: (UI_HEIGHT - (n.y + n.h)) * fit.scale,
    width: n.w * sx,
    height: n.h * fit.scale,
  };
}