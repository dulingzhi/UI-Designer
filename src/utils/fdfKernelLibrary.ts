/**
 * FDF 声明式核心 —— 库 / 模板解析（阶段 A）。
 *
 * 对标 openwar3 `src/ui/fdf/library.ts`：把"读 .fdf → 合并 IncludeFile 与 StringList →
 * 解析 INHERITS/模板体系 → 得到具体 Frame"这一步抽成纯声明式核心。
 *
 * 设计要点（与 openwar3/`FdfLibrary` 对齐，但**去掉 VFS/DataSource 依赖**——它只吃
 * 已解析的 `FdfFile` 或源码字符串，因此可在 node/vitest 中直接单测；VFS 接入交给
 * 业务层 adapter）：
 *  - `register`：同名第一次定义胜出（loadFile 语义）；`force`（override）可替换。
 *  - `resolve`：扁平化 INHERITS——模板的 props 在自身 props 之下（同名覆盖），
 *    子控件在 WITHCHILDREN 时克隆、自身同名子控件覆盖继承的同名子控件。
 *  - `resolveRoot`：按名解析屏幕根控件。
 *
 * 另含 openwar3 的一批**纯函数**访问器：firstProp / allProps / hasFlag / numProp /
 * strProp / findChild / mergeProps / propagateDecorate / cloneNamespaced。
 */
import { type FdfFrame, type FdfProp } from './fdfKernelTypes';

export { type FdfFrame, type FdfProp } from './fdfKernelTypes';
import { parseFdf } from './fdfKernelParser';

function cloneFrame(f: FdfFrame): FdfFrame {
  return {
    type: f.type,
    name: f.name,
    inherits: f.inherits,
    withChildren: f.withChildren,
    props: f.props.map((pr) => ({ key: pr.key, args: pr.args.slice() })),
    children: f.children.map(cloneFrame),
  };
}

export class FdfLibrary {
  private templates = new Map<string, FdfFrame>(); // 精确名 → frame
  private lowered = new Map<string, FdfFrame>(); // 小写名 → frame（兜底）
  /** 已加载标记（路径/来源字符串的小写键），用于幂等。 */
  private loaded = new Set<string>();

  /** 注册一个已解析的 FdfFile（并按 include 顺序先行注册其包含文件的模板）。 */
  loadFile(file: { frames: FdfFrame[]; strings: Map<string, string>; includes?: string[] }): void {
    for (const [k, v] of file.strings) if (!this.strings.has(k)) this.strings.set(k, v);
    for (const frame of file.frames) this.register(frame);
  }

  /** 从字符串解析并注册，框架/字符串**强制覆盖**已注册的同名项（override 语义），幂等。 */
  loadOverride(id: string, source: string): void {
    const key = `override:${id}`;
    if (this.loaded.has(key)) return;
    this.loaded.add(key);
    const file = parseFdf(source);
    for (const [k, v] of file.strings) this.strings.set(k, v);
    for (const frame of file.frames) this.register(frame, true);
  }

  /** 注册 frame 及其嵌套具名子控件为可复用模板。普通注册保留第一定义；override 替换。 */
  register(frame: FdfFrame, force = false): void {
    if (frame.name) {
      if (force || !this.templates.has(frame.name)) this.templates.set(frame.name, frame);
      const lc = frame.name.toLowerCase();
      if (force || !this.lowered.has(lc)) this.lowered.set(lc, frame);
    }
    for (const child of frame.children) this.register(child, force);
  }

  /** 按名找到具名 frame/模板（大小写不敏感兜底）。 */
  template(name: string): FdfFrame | undefined {
    return this.templates.get(name) ?? this.lowered.get(name.toLowerCase());
  }

  /** 按名解析屏幕根控件，返回扁平化（继承已展开）的 frame。 */
  resolveRoot(name: string): FdfFrame | undefined {
    const f = this.template(name);
    return f ? this.resolve(f) : undefined;
  }

  /** 扁平化 INHERITS：把模板的 props/children 合并到自身之下。 */
  resolve(frame: FdfFrame, depth = 0): FdfFrame {
    if (depth > 64) return cloneFrame(frame); // 防病态循环
    let base: FdfFrame | null = null;
    if (frame.inherits) {
      const tmpl = this.template(frame.inherits);
      if (tmpl) base = this.resolve(tmpl, depth + 1);
    }
    const out: FdfFrame = {
      type: frame.type || base?.type || 'FRAME',
      // Frame 的名字永远是它自己的。INHERITS 复制 props 与子控件，绝不复制身份——
      // 匿名块回退到模板名会让同名兄弟互相冲突（见 openwar3 注释）。
      name: frame.name,
      inherits: null,
      withChildren: false,
      props: mergeProps(base?.props ?? [], frame.props),
      children: [],
    };
    // 子控件：WITHCHILDREN 克隆模板子树；自身同名子控件覆盖继承的同名子控件，否则追加。
    const children: FdfFrame[] = frame.withChildren && base ? base.children.map(cloneFrame) : [];
    for (const child of frame.children) {
      const resolved = this.resolve(child, depth + 1);
      const idx = resolved.name ? children.findIndex((c) => c.name === resolved.name) : -1;
      if (idx >= 0) children[idx] = resolved;
      else children.push(resolved);
    }
    out.children = children.map((c) => (c.inherits ? this.resolve(c, depth + 1) : c));
    return out;
  }

  /** 解析 Text 值：字符串表命中优先，否则返回字面文本。 */
  string(keyOrLiteral: string): string {
    return this.strings.get(keyOrLiteral) ?? keyOrLiteral;
  }

  /** FrameDef 字符串表。 */
  readonly strings: Map<string, string> = new Map();
}

/** 基础 props 被自身 props 覆盖：自身同名项整体替换所有基础同名项。 */
export function mergeProps(base: FdfProp[], own: FdfProp[]): FdfProp[] {
  if (!base.length) return own.map((pr) => ({ key: pr.key, args: pr.args.slice() }));
  const ownKeys = new Set(own.map((pr) => pr.key));
  const out = base.filter((pr) => !ownKeys.has(pr.key)).map((pr) => ({ key: pr.key, args: pr.args.slice() }));
  for (const pr of own) out.push({ key: pr.key, args: pr.args.slice() });
  return out;
}

// --- 对扁平化 frame 的一组小型类型化访问器 ---

export function firstProp(frame: FdfFrame, key: string): FdfProp | undefined {
  return frame.props.find((p) => p.key === key);
}
export function allProps(frame: FdfFrame, key: string): FdfProp[] {
  return frame.props.filter((p) => p.key === key);
}
export function hasFlag(frame: FdfFrame, key: string): boolean {
  return frame.props.some((p) => p.key === key);
}
export function numProp(frame: FdfFrame, key: string): number | undefined {
  const pr = firstProp(frame, key);
  return pr && pr.args[0]?.n != null ? pr.args[0].n : undefined;
}
export function strProp(frame: FdfFrame, key: string): string | undefined {
  return firstProp(frame, key)?.args[0]?.s;
}
export function findChild(frame: FdfFrame, name: string): FdfFrame | undefined {
  return frame.children.find((c) => c.name === name);
}

/**
 * `DecorateFileNames` 被其声明者之下的所有元素继承——在 INHERITS 展开后、
 * 绘制前沿树下行一遍，让下游不必携带祖先标志。
 */
export function propagateDecorate(frame: FdfFrame, inherited = false): void {
  const own = inherited || frame.props.some((p) => p.key === 'DecorateFileNames');
  if (own && !inherited) {
    // 已在自身声明；无需添加
  } else if (own) {
    frame.props.push({ key: 'DecorateFileNames', args: [] });
  }
  for (const child of frame.children) propagateDecorate(child, own);
}

/** 首参为"另一 frame 名字"、须随重命名而改的 props。 */
export const NAME_REFS = new Set([
  'ButtonText', 'ControlBackdrop', 'ControlPushedBackdrop', 'ControlDisabledBackdrop',
  'ControlDisabledPushedBackdrop', 'ControlMouseOverHighlight', 'ControlFocusHighlight',
  'CheckBoxCheckHighlight', 'CheckBoxDisabledCheckHighlight',
  'PopupTitleFrame', 'PopupArrowFrame', 'PopupMenuFrame',
  'TextAreaScrollBar', 'SliderThumbButtonFrame',
  'ScrollBarIncButtonFrame', 'ScrollBarDecButtonFrame', 'DialogBackdrop',
]);

/**
 * 在一棵模板子树下按实例后缀克隆——引擎每次从同一定义冲压重复行时做的事
 * （每个玩家的 AllianceSlot、每个 DialogAddButton 的按钮、每个任务一条 QuestListItem）。
 * 只重写**子树内部定义**的名字；向外引用的 SetPoint/Control* 保持原样，故能锚到外围。
 */
export function cloneNamespaced(frame: FdfFrame, suffix: string): FdfFrame {
  const owned = new Set<string>();
  (function collect(f: FdfFrame): void {
    if (f.name) owned.add(f.name);
    f.children.forEach(collect);
  })(frame);

  const rename = (name: string): string => (owned.has(name) ? `${name}${suffix}` : name);
  const walk = (src: FdfFrame): FdfFrame => ({
    type: src.type,
    name: src.name ? `${src.name}${suffix}` : '',
    inherits: null,
    withChildren: false,
    props: src.props.map((pr) => {
      const args = pr.args.slice();
      if (NAME_REFS.has(pr.key) && args[0]?.str) args[0] = { ...args[0], s: rename(args[0].s) };
      else if (pr.key === 'SetPoint' && args[1]?.str) args[1] = { ...args[1], s: rename(args[1].s) };
      return { key: pr.key, args };
    }),
    children: src.children.map(walk),
  });
  return walk(frame);
}