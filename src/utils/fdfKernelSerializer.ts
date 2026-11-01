/**
 * FDF 声明式核心 —— 序列化器（阶段 B）。
 *
 * 把内核模型 `FdfFile`（parse 结果）精确重写回 FDF 文本，做到**往返保真**：
 * parse → serialize → parse 两次得到的 `FdfFile` 在结构上全等。这是 UI-Designer
 * 有别于 openwar3 的诉求——openwar3 是单向（声明 → DOM），而编辑器需要把作者改过的
 * 内容原样写回 .fdf。
 *
 * 保真要点：
 *  - `Arg` 精确还原其记号类别：引号字符串（`"..."`）、数字（含 `f` 后缀）、裸词枚举。
 *  - SetPoint/Anchor 等多参属性按 `args` 排列逐项还原，逗号分隔。
 *  - Frame 头：`Frame "TYPE" "Name" [INHERITS [WITHCHILDREN] "Tpl"] {`。
 *  - Texture/String/Layer 的匿名/命名变体与原样兼容（匿名 Texture 无名字符串）。
 *  - 保留 prop 出现顺序与嵌套结构；换行/缩进为规范化风格（不影响语义）。
 *
 * 注：注释在 token 层即被丢弃（与 openwar3 一致），序列化不负责恢复注释；保真指
 * 结构性保真（结构、顺序、数值、字符串、枚举标记），非逐字节保真。
 */
import { type FdfFile, type FdfFrame, type FdfProp, type Arg } from './fdfKernelTypes';

export interface SerializeOptions {
  /** 单层缩进字符串。默认两个空格。 */
  indent?: string;
}

/** 把内核 `FdfFile` 序列化为 FDF 文本。 */
export function serializeFdf(file: FdfFile, opts: SerializeOptions = {}): string {
  const ind = opts.indent ?? '  ';
  const out: string[] = [];

  for (const inc of file.includes) out.push(`IncludeFile "${inc}"`);
  if (file.strings.size) {
    const rows = [...file.strings.entries()].map(([k, v]) => `    ${k} "${v}",`);
    out.push(`StringList {\n${rows.join('\n')}\n}`);
  }

  for (const frame of file.frames) out.push(serializeFrameInner(frame, ind, 0));

  // 规范化分隔：文件内各顶层条目之间空一行。
  return out.join('\n\n') + '\n';
}

/** 序列化单个顶层 frame（也用于直接把一个根 frame 写成文本）。 */
export function serializeFrame(frame: FdfFrame, opts: SerializeOptions = {}): string {
  return serializeFrameInner(frame, opts.indent ?? '  ', 0);
}

function serializeFrameInner(frame: FdfFrame, ind: string, depth: number): string {
  const pad = ind.repeat(depth);
  const padIn = ind.repeat(depth + 1);
  // 一律用 `Frame "TYPE"` 头：parser 对任意类型串都接受，且名字槽可选，
  // 所以匿名 Texture/Layer 也能还原（无需依赖大小写敏感的裸关键字）。
  let head = `${pad}Frame "${frame.type}"`;
  if (frame.name) head += ` "${frame.name}"`;
  if (frame.inherits) {
    head += ' INHERITS';
    if (frame.withChildren) head += ' WITHCHILDREN';
    head += ` "${frame.inherits}"`;
  }
  head += ' {';

  const lines: string[] = [head];
  for (const child of frame.children) {
    lines.push(serializeFrameInner(child, ind, depth + 1));
  }
  for (const prop of frame.props) {
    lines.push(serializeProp(prop, padIn));
  }
  lines.push(`${pad}}`);
  return lines.join('\n');
}

function serializeProp(prop: FdfProp, pad: string): string {
  // 内核把 block 与 prop 分开存放（children 与 props 分列）；序列化时统一展平为属性行。
  const args = prop.args.map(serializeArg).join(', ');
  const body = prop.key + (args ? `, ${args}` : '');
  return `${pad}${body},`;
}

function serializeArg(a: Arg): string {
  if (a.str) return serializeStringArg(a.s);
  if (a.n !== null) return a.s; // 数值原样（保留 1.0/.5/−0.0 等字面）；s 即源码切片
  return a.s; // 裸词枚举
}

function serializeStringArg(s: string): string {
  // 与 parser 一致：真实 .fdf 字符串不含字面双引号（语料中 0 例）；反斜杠按字面保留
  // （如 `UI\Widgets\...blp` 路径）。不做转义 = 往返无损。
  return `"${s}"`;
}