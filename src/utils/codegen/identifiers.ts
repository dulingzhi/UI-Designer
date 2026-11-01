/**
 * 代码生成用的标识符 / 字符串字面量工具（纯函数，无副作用）。
 *
 * 背景：`codeExport.ts` 直接把 FDF 帧名当作 JASS 变量名、把文本/纹理原样塞进引号，
 * 导致产物无法编译（详见 `jassExport.parity.test.ts` 的 9 项缺陷）。
 * 本模块把这些"文本 → 合法代码"的转换集中到一处，便于单测与复用（JASS / LUA / TS）。
 */

/** JASS 保留字（作为变量名会与关键字冲突）。LUA 侧另有集合。 */
const JASS_KEYWORDS = new Set([
  'and', 'array', 'boolean', 'call', 'code', 'constant', 'debug', 'else', 'elseif',
  'endfunction', 'endif', 'endglobals', 'endinterface', 'endloop', 'endlibrary',
  'endmethod', 'endmodule', 'endscope', 'endstruct', 'extends', 'exitwhen',
  'function', 'globals', 'handler', 'if', 'initializer', 'integer', 'library',
  'local', 'loop', 'method', 'module', 'native', 'not', 'nothing', 'null', 'or',
  'private', 'public', 'real', 'return', 'returns', 'scope', 'set', 'static',
  'string', 'struct', 'takes', 'then', 'type',
]);

/** 把任意名称净化为合法标识符：非 [A-Za-z0-9_] 字符折成 `_`，数字开头补前缀。 */
function baseIdentifier(raw: string): string {
  const trimmed = (raw ?? '').trim();
  // 非标识符字符一律折成下划线；连续替换合并（避免 a__b 里出现多重下划线观感问题）
  let id = trimmed.replace(/[^A-Za-z0-9_]/g, '_');
  // 折叠连续下划线
  id = id.replace(/_+/g, '_');
  // 去首尾下划线
  id = id.replace(/^_+/, '').replace(/_+$/, '');
  if (id === '') return 'Frame';
  if (/^[0-9]/.test(id)) id = `F_${id}`;
  return id;
}

export interface IdentifierOptions {
  /** 是否检查并规避保留字（默认 true）。 */
  avoidKeywords?: boolean;
  /** 为空时的兜底名。 */
  fallback?: string;
  /** JASS 关键字集合覆盖（测试用）。 */
  keywords?: Set<string>;
}

/**
 * 生成唯一标识符。`used` 为已占用名称集合，函数会写入并避免撞名。
 *
 * 规则：净化 → 规避保留字（加 `_` 后缀）→ 重名加 `_2`/`_3`… 后缀。
 */
export function toIdentifier(raw: string, used: Set<string>, opts: IdentifierOptions = {}): string {
  const avoid = opts.avoidKeywords ?? true;
  const keywords = opts.keywords ?? JASS_KEYWORDS;
  let id = baseIdentifier(raw);
  if (id === 'Frame' && (raw ?? '').trim() === '') id = opts.fallback ?? 'Frame';

  if (avoid && keywords.has(id.toLowerCase())) id = `${id}_`;

  let candidate = id;
  let n = 2;
  while (used.has(candidate)) {
    candidate = `${id}_${n}`;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

/**
 * JASS 字符串字面量转义。
 *
 * - `"` → `""`（JASS/WC3 用双写引号表示字面引号）
 * - `\` → `\\`（避免 `\W`、`\n` 被当转义序列；纹理路径全是反斜杠）
 * - 真实换行 → `\n`（不能把裸换行塞进单行字符串）
 */
export function escapeJassString(raw: string | undefined | null): string {
  const s = raw ?? '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '""')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/** LUA 字符串字面量转义：`\`、`"`、换行。 */
export function escapeLuaString(raw: string | undefined | null): string {
  const s = raw ?? '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/** library / 模块名净化（沿用标识符规则，但不做重名规避）。 */
export function sanitizeLibraryName(raw: string | undefined | null): string {
  const id = baseIdentifier(raw ?? '');
  if (JASS_KEYWORDS.has(id.toLowerCase())) return `${id}_`;
  return id;
}

/** 暴露底层净化，供测试与需要"仅净化不避重名"的调用点使用。 */
export function sanitizeIdentifier(raw: string): string {
  return baseIdentifier(raw);
}

export { JASS_KEYWORDS };
