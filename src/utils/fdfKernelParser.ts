/**
 * FDF 声明式核心 —— 解析器（阶段 A）。
 *
 * 对标 openwar3 `src/ui/fdf/parser.ts`。这是"扫过全部 86 个官方 .fdf"验证过、
 * 且唯一能解出逗号歧义的实现，语义 1:1 迁移：
 *
 *   逗号同时充当"参数分隔符"与"语句分隔符"（`SetPoint TOPLEFT, "P", TOPLEFT, 0.1, 0.2,`）。
 *   openwar3 用一条被语料证实的规则化解它：**能出现在参数位置的非引号裸词是一个封闭集合**
 *   （frame 锚点 + 文本对齐 + INHERITS/WITHCHILDREN）。因此一条语句的参数一直读到下一个 `}`
 *   或下一个**不属于该集合**的标识符为止——那个标识符即下一条语句的关键字。
 *
 * 语法（与 openwar3 一致）：
 *   IncludeFile "path",
 *   StringList { KEY "value", ... }
 *   Frame "TYPE" "Name" [INHERITS [WITHCHILDREN] "Template"] { ...body... }
 *   Texture ["Name"] [INHERITS "Template"] { ...body... }   // name 可选
 *   String  "Name"  [INHERITS "Template"] { ...body... }
 *   Layer   "NAME" { ...body... }
 *   <PropertyKeyword> <arg> <arg> ... ,
 */
import { type Arg, type FdfFile, type FdfFrame, type FdfProp } from './fdfKernelTypes';

/** 可出现在参数位置的封闭裸词集合（对官方语料证毕）。在值槽位出现集合外的
 *  标识符即下一条语句的关键字。 */
const ARG_WORDS = new Set([
  'TOPLEFT', 'TOP', 'TOPRIGHT', 'LEFT', 'CENTER', 'RIGHT',
  'BOTTOMLEFT', 'BOTTOM', 'BOTTOMRIGHT',
  'JUSTIFYLEFT', 'JUSTIFYCENTER', 'JUSTIFYRIGHT', 'JUSTIFYTOP', 'JUSTIFYMIDDLE', 'JUSTIFYBOTTOM',
  'INHERITS', 'WITHCHILDREN',
]);

const BLOCK_KEYWORDS = new Set(['Frame', 'Texture', 'String', 'Layer']);

type TokKind = 'str' | 'id' | 'num' | 'punct';
interface Token { kind: TokKind; value: string; num: number }

export function tokenizeFdf(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') { i++; continue; }
    // 行注释 // … 与块注释 /* … */
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    // 引号字符串
    if (c === '"') {
      i++;
      let s = '';
      while (i < n && src[i] !== '"') { s += src[i]; i++; }
      i++; // 收尾引号
      out.push({ kind: 'str', value: s, num: 0 });
      continue;
    }
    // 标点
    if (c === '{' || c === '}' || c === ',') { out.push({ kind: 'punct', value: c, num: 0 }); i++; continue; }
    // 数字：数字开头，或前导 '.', 或 '-' 后跟数字/'.'
    const isNumStart = (ch: string) => ch >= '0' && ch <= '9';
    if (isNumStart(c) || c === '.' || (c === '-' && (isNumStart(src[i + 1]) || src[i + 1] === '.'))) {
      let s = c; i++;
      while (i < n && /[0-9.eE+\-]/.test(src[i])) { s += src[i]; i++; }
      if (src[i] === 'f' || src[i] === 'F') i++; // 0.002f 后缀
      out.push({ kind: 'num', value: s, num: parseFloat(s) });
      continue;
    }
    // 标识符 / 关键字
    if (/[A-Za-z_]/.test(c)) {
      let s = c; i++;
      while (i < n && /[A-Za-z0-9_]/.test(src[i])) { s += src[i]; i++; }
      out.push({ kind: 'id', value: s, num: 0 });
      continue;
    }
    i++; // 跳过任何意外字符
  }
  return out;
}

/** 将一个 .fdf 源码解析为 frames + StringList 表 + IncludeFile 路径。 */
export function parseFdf(src: string): FdfFile {
  const toks = tokenizeFdf(src);
  let p = 0;
  const peek = (): Token | undefined => toks[p];

  const toArg = (t: Token): Arg =>
    t.kind === 'str' ? { s: t.value, n: null, str: true }
      : t.kind === 'num' ? { s: t.value, n: t.num, str: false }
        : { s: t.value, n: null, str: false };

  // 收集参数，直到下一个 `}`/EOF 或一个非参数标识符（下一条语句关键字）。
  function readArgs(): Arg[] {
    const args: Arg[] = [];
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.kind === 'punct') {
        if (t.value === ',') { p++; continue; } // 逗号在此仅为分隔符
        break; // '{' 或 '}'
      }
      if (t.kind === 'id' && !ARG_WORDS.has(t.value)) break; // 下一条语句关键字
      args.push(toArg(t));
      p++;
    }
    return args;
  }

  const file: FdfFile = { frames: [], strings: new Map(), includes: [] };

  // 解析 `{ ... }` 体为 props + 子 frame。
  function parseBody(into: FdfFrame): void {
    if (peek()?.value !== '{') return;
    p++; // 消费 '{'
    for (;;) {
      const t = peek();
      if (!t) break;
      if (t.kind === 'punct' && t.value === '}') { p++; break; }
      if (t.kind === 'punct' && t.value === ',') { p++; continue; }
      if (t.kind === 'id' && BLOCK_KEYWORDS.has(t.value)) {
        into.children.push(parseBlock());
        continue;
      }
      // 属性语句
      if (t.kind === 'id') {
        const key = t.value; p++;
        const args = readArgs();
        into.props.push({ key, args } as FdfProp);
        continue;
      }
      p++; // 游离 token —— 跳过
    }
  }

  // 解析 `Frame "TYPE" "Name" [INHERITS [WITHCHILDREN] "Tmpl"] { }` 以及
  // Texture/String/Layer 变体（Texture 可匿名；Layer 无模板）。
  function parseBlock(): FdfFrame {
    const kw = peek()!.value; p++; // Frame / Texture / String / Layer
    const frame: FdfFrame = { type: '', name: '', inherits: null, withChildren: false, props: [], children: [] };
    if (kw === 'Frame') {
      frame.type = (peek()?.kind === 'str' ? peek()!.value : '').toUpperCase(); p++;
      frame.name = peek()?.kind === 'str' ? peek()!.value : ''; if (peek()?.kind === 'str') p++;
    } else {
      frame.type = kw.toUpperCase(); // TEXTURE / STRING / LAYER
      if (peek()?.kind === 'str') { frame.name = peek()!.value; p++; }
    }
    if (peek()?.kind === 'id' && peek()!.value === 'INHERITS') {
      p++;
      if (peek()?.kind === 'id' && peek()!.value === 'WITHCHILDREN') { frame.withChildren = true; p++; }
      if (peek()?.kind === 'str') { frame.inherits = peek()!.value; p++; }
    }
    parseBody(frame);
    return frame;
  }

  // 顶层。
  for (;;) {
    const t = peek();
    if (!t) break;
    if (t.kind === 'punct') { p++; continue; }
    if (t.kind === 'id' && t.value === 'IncludeFile') {
      p++;
      if (peek()?.kind === 'str') { file.includes.push(peek()!.value); p++; }
      continue;
    }
    if (t.kind === 'id' && t.value === 'StringList') {
      p++;
      if (peek()?.value === '{') {
        p++;
        for (;;) {
          const k = peek();
          if (!k || (k.kind === 'punct' && k.value === '}')) { if (k) p++; break; }
          if (k.kind === 'punct') { p++; continue; }
          if (k.kind === 'id') {
            const key = k.value; p++;
            const args = readArgs();
            if (args.length) file.strings.set(key, args[0].s);
          } else p++;
        }
      }
      continue;
    }
    if (t.kind === 'id' && BLOCK_KEYWORDS.has(t.value)) { file.frames.push(parseBlock()); continue; }
    p++; // 未知顶层 token
  }

  return file;
}