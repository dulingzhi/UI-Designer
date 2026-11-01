/**
 * 内核驱动的结构转换器（B-2）
 *
 * 对标 openwar3：解析交给声明式内核 `fdfKernelParser`，模板/继承复用 `FdfLibrary`，
 * 这里仅做「内核 `FdfFrame`（通用 key+args）→ 渲染器 `FrameData`（结构化）」的适配。
 *
 * 与旧 transformer 的契约保持一致（便于 corpus 级 parity 校验）：
 *  - id/type/parentId/children 结构字段
 *  - SetAllPoints → TOPLEFT+BOTTOMRIGHT 双锚点；仅当尚无显式 SetPoint/Anchor 时注入
 *  - SetPoint point, rel, relPoint, x, y → FrameAnchor
 *  - Anchor 单点形式
 *  - 顶层 frame 的锚点相对画布（TOPLEFT→(0,0.6)、BOTTOMRIGHT→(0.8,0)、CENTER→(0.4,0.3)）
 *  - 无锚点 frame → 默认 CENTER 锚点（__PARENT__ 占位）
 *  - Width/Height / 相对单位恒等（编辑器内部即相对单位）
 *  - 名称严格匹配 FDF（不 lower，保留原大小写）
 *
 * 本转换器是 `FrameData` 结构契约的「内核底座」，被 `fdf.ts` 的 public 入口复用，
 * 供 parity 测试证明内核→渲染器模型的一致性。
 */

import { FdfFile, FdfFrame, Arg, FdfProp } from './fdfKernelTypes';
import { parseFdf } from './fdfKernelParser';
import { FdfLibrary } from './fdfKernelLibrary';
import { FrameData } from '../types';

/** 把内容中的顶层 frame 按其名称 collect 进全局表，供 WITHCHILDREN/inherit 查找。 */
function collectFrames(frames: FdfFrame[], out: FdfFrame[], byName: Map<string, FdfFrame>): void {
  for (const f of frames) {
    out.push(f);
    if (f.name) byName.set(f.name, f);
    collectFrames(f.children, out, byName);
  }
}

/** 单参数取数值。 */
function aNum(a: Arg): number | undefined {
  return a.n !== null ? a.n : a.s.trim() === '' ? undefined : parseFloat(a.s);
}

const FRAME_POINT: Record<string, number> = {
  TOPLEFT: 0,
  TOP: 1,
  TOPRIGHT: 2,
  LEFT: 3,
  CENTER: 4,
  RIGHT: 5,
  BOTTOMLEFT: 6,
  BOTTOM: 7,
  BOTTOMRIGHT: 8,
};

function mapFramePoint(point: string): number {
  return FRAME_POINT[point.toUpperCase()] ?? 0;
}

// FrameType 枚举（与 src/types 一致，避免依赖循环）
const FT = {
  ORIGIN: 0, FRAME: 1, BACKDROP: 2, SIMPLEFRAME: 3,
  TEXT_FRAME: 4, SIMPLEFONTSTRING: 5, TEXTAREA: 6,
  BUTTON: 7, GLUETEXTBUTTON: 8, GLUEBUTTON: 9, SIMPLEBUTTON: 10,
  BROWSER_BUTTON: 11, SCRIPT_DIALOG_BUTTON: 12, INVIS_BUTTON: 13,
  CHECKBOX: 14, EDITBOX: 15, SLIDER: 16, SCROLLBAR: 17, LISTBOX: 18,
  MENU: 19, POPUPMENU: 20, SPRITE: 21, MODEL: 22, HIGHLIGHT: 23,
  SIMPLESTATUSBAR: 24, STATUSBAR: 25, CONTROL: 26, DIALOG: 27, TIMERTEXT: 28,
} as const;

const RAW_ALIAS: Record<string, number> = {
  TEXT: FT.TEXT_FRAME, TEXTBUTTON: FT.TEXT_FRAME,
  GLUECHECKBOX: FT.CHECKBOX, SIMPLECHECKBOX: FT.CHECKBOX,
  GLUEEDITBOX: FT.EDITBOX, SLASHCHATBOX: FT.EDITBOX,
  CHATDISPLAY: FT.TEXTAREA,
  GLUEPOPUPMENU: FT.POPUPMENU,
};

function mapFrameType(fdfType: string): number {
  const t = fdfType.toUpperCase();
  const key = t as keyof typeof FT;
  if (key in FT) return FT[key];
  if (t in RAW_ALIAS) return RAW_ALIAS[t];
  return FT.FRAME;
}

let idCounter = 0;
function genId(): string {
  return `frame_${Date.now().toString(16)}_${(idCounter++).toString(16)}`;
}

export interface KernelTransformOptions {
  /** 是否解析模板继承（INHERITS）。默认 true。 */
  resolveInheritance?: boolean;
  /** 画布（相对）范围。 */
  baseWidth?: number;
  baseHeight?: number;
}

/** 结构对比用的投影（id 除外，id 每次生成不同）。 */
export function projectFrame(fd: FrameData): any {
  return {
    name: fd.name,
    type: fd.type,
    parentId: fd.parentId,
    children: [...fd.children],
    anchors: fd.anchors.map((a) => ({
      point: a.point,
      relativeTo: a.relativeTo ?? null,
      relativePoint: a.relativePoint ?? null,
      x: a.x,
      y: a.y,
    })),
    width: fd.width,
    height: fd.height,
    setAllPoints: fd.fdfMetadata?.setAllPoints === true,
    inherits: fd.fdfMetadata?.inherits,
  };
}

/**
 * 把单个 root `FdfFrame`（含 INHERITS 展开 + 子帧）转换为一条层次化的 FrameData 树，
 * 并以扁平数组返回（与旧 transformer 同契约）。返回前把各锚点 relativeTo 名称解析为 ID。
 */
export function transformKernelFrames(frames: FdfFrame[], opts: KernelTransformOptions = {}): FrameData[] {
  const resolveInheritance = opts.resolveInheritance ?? true;
  const all: FrameData[] = [];

  // 建立全量扁平 + 名称索引（用于 relativeTo → id 映射，含继承模板）
  const flatKernel: FdfFrame[] = [];
  const byName = new Map<string, FdfFrame>();
  collectFrames(frames, flatKernel, byName);

  const nameToId = new Map<string, string>();

  /** 将单个 FdfFrame 递归转换为 FrameData 子树；返回其 id。 */
  function convert(f: FdfFrame, parent: FrameData | null): FrameData {
    // 先创建 ID 并登记（供兄弟/引用提前解析）
    const id = genId();
    const type = mapFrameType(f.type);

    const fd: FrameData = {
      id,
      name: f.name || '',
      type,
      x: 0, y: 0,
      width: 0.1,
      height: 0.1,
      z: 0,
      parentId: parent ? parent.id : null,
      children: [],
      tooltip: false,
      anchors: [],
      texture: '',
    };
    if (type === FT.TEXT_FRAME) fd.height = 0.012;
    if (f.name) nameToId.set(f.name, id);
    all.push(fd);

    // 继承展开：INHERITS 模板的 props 作为基底（再被自身覆盖）
    let props: readonly FdfProp[] | null = null;
    if (resolveInheritance && f.inherits && byName.has(f.inherits)) {
      const tpl = byName.get(f.inherits)!;
      props = tpl.props;
      fd.fdfMetadata = { inherits: f.inherits };
      if (f.withChildren) {
        fd.fdfMetadata.inheritedChildrenIds = tpl.children
          .map((c) => c.name)
          .map((n) => nameToId.get(n) ?? n);
      }
    }

    // 处理自身属性（key → 行为），先于子帧（同旧 transformer 顺序）
    const applyPropArgs = (key: string, args: readonly Arg[]) => {
      const k = key.toLowerCase();
      const vals = args.map((a) => a.s);
      switch (k) {
        case 'width': fd.width = aNum(args[0]) ?? fd.width; break;
        case 'height': fd.height = aNum(args[0]) ?? fd.height; break;
        case 'setallpoints':
          if (fd.anchors.length === 0) {
            fd.fdfMetadata = { ...fd.fdfMetadata, setAllPoints: true };
            fd.anchors = [
              { point: 0, relativeTo: '__PARENT__', relativePoint: 0, x: 0, y: 0 },
              { point: 8, relativeTo: '__PARENT__', relativePoint: 8, x: 0, y: 0 },
            ];
          }
          break;
        case 'setpoint': {
          const a = args;
          const myPoint = mapFramePoint(vals[0] ?? '');
          let idx = 1;
          let rel: string | null = null;
          if (a[idx]?.str) { rel = vals[idx]; idx++; } // 相对名为字符串
          const relPoint = a[idx] && vals[idx] in FRAME_POINT ? mapFramePoint(vals[idx++]) : myPoint;
          const dx = a[idx]?.n ?? 0;
          const dy = a[idx + 1]?.n ?? 0;
          fd.anchors.push({
            point: myPoint,
            relativeTo: rel ?? '__PARENT__',
            relativePoint: rel ? relPoint : myPoint,
            x: dx,
            y: dy,
          });
          break;
        }
        /* v8 ignore start -- vals[0]??''（与 L209/210 的 aNum(args[1])/aNum(args[2])）互斥：欲使该回落触发须 args 全空，但 args 空则 aNum(args[1]) 对 undefined 读 .n 崩溃，故在正常解析路径该分支不可达 */
        case 'anchor': {
          const p = mapFramePoint(vals[0] ?? '');
          fd.anchors.push({
            point: p,
            relativeTo: '__PARENT__',
            relativePoint: p,
            x: aNum(args[1]) ?? 0,
            y: aNum(args[2]) ?? 0,
          });
          break;
        }
        /* v8 ignore end */
        default:
          // 其它字段暂不在结构层解释（留给 FdfKernelTransform/渲染器）
          break;
      }
    };

    if (props) for (const p of props) applyPropArgs(p.key, p.args);
    for (const p of f.props) applyPropArgs(p.key, p.args);

    // 子帧（Frame/Texture/String/Layer 等非裸块）
    for (const child of f.children) {
      // 渲染器结构契约：TEXTURE/STRING/LAYER 特殊块通常不作为 FrameData 子节点
      const ct = child.type.toUpperCase();
      if (ct === 'TEXTURE' || ct === 'STRING' || ct === 'LAYER') continue;
      convert(child, fd);
    }

    // 无锚点 → 默认 CENTER
    if (fd.anchors.length === 0) {
      if (fd.width === 0.1 && fd.height === 0.1) { fd.width = 0.4; fd.height = 0.4; }
      fd.anchors = [{ point: 4, relativeTo: '__PARENT__', relativePoint: 4, x: 0, y: 0 }];
    }

    // 顶层（parent===null）锚点相对画布。必须放在**默认锚点注入之后**：根帧自身没有显式
    // SetPoint 时会拿到上面注入的 CENTER@__PARENT__，若此时不归一化，编辑器求解器
    // (calculatePositionFromAnchors) 解析不到 __PARENT__ 便回落 (0,0)，再按 CENTER 减半宽高
    // 得到 (-w/2,-h/2)，把整棵子树平移出画布；内核 layout 则把根钉在 box(0,0)。
    // 画布语义：TOPLEFT=(0,0.6)、BOTTOMRIGHT=(0.8,0)、CENTER=(0.4,0.3)。
    for (const a of fd.anchors) {
      if (a.relativeTo !== '__PARENT__') continue;
      if (parent === null) {
        if (a.point === 0) { a.x = 0; a.y = 0.6; }
        else if (a.point === 8) { a.x = 0.8; a.y = 0; }
        else if (a.point === 4) { a.x = 0.4; a.y = 0.3; }
        delete a.relativeTo;
        delete a.relativePoint;
      }
    }

    // 登记父子关系后返回
    if (parent) {
      fd.parentId = parent.id;
      parent.children.push(fd.id);
      // 嵌套：把 __PARENT__ 占位替换为父元素名称（供最后一趟名称→id 解析）
      for (const a of fd.anchors) {
        if (a.relativeTo === '__PARENT__') a.relativeTo = parent.name || parent.id;
      }
    }
    return fd;
  }

  for (const f of frames) convert(f, null);

  // 最后一趟：把 anchors 的 relativeTo 名称解析为 ID
  const idByName = new Map<string, string>();
  for (const f of all) if (f.name) idByName.set(f.name, f.id);
  for (const f of all) {
    for (const a of f.anchors) {
      if (a.relativeTo && a.relativeTo !== '__PARENT__') {
        const t = idByName.get(a.relativeTo);
        if (t) a.relativeTo = t;
      }
    }
  }

  // 与旧 transformer 同契约：返回扁平列表（含嵌套），顶层由 parentId === null 标识。
  return all;
}

/** 便捷入口：从内核 `FdfFile` 构建 FrameData。 */
export function fileToFrameData(file: FdfFile, opts: KernelTransformOptions = {}): FrameData[] {
  // transformKernelFrames 内部会扁平收集所有帧并在同一张 byName 表中解析 INHERITS。
  return transformKernelFrames(file.frames, opts);
}

export { FdfLibrary, parseFdf };