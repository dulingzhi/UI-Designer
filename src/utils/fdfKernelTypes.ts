/**
 * FDF 声明式核心 —— 共享类型（阶段 A）。
 *
 * 对标 openwar3 `src/ui/fdf/parser.ts` 的 `Arg / FdfProp / FdfFrame / FdfFile`，
 * 语义 1:1 对齐（见 `FDF_REFACTOR_PLAN.md` §A）。这些是"解析后、未做任何
 * 推导"的声明式中间表示，供内核（parser/library/layout）与业务层（transformer/
 * renderer）共用，替代原来分散在 fdfAst.ts / fdfTransformer.ts 里的临时结构。
 *
 * 与 openwar3 的一致性说明：
 * - `Arg.n` 仅在 token 为数字时非 null；`Arg.str` 表示"引号字符串"。
 * - `FdfProp.key` 可重复（如多个 SetPoint）；顺序保留。
 * - `FdfFrame.name` 对匿名 Texture/String block 为 ""。
 * - `FdfFile` 是"单个 .fdf 文件"的解析结果（尚未合并 include）。
 */

/** 参数值：引号字符串 / 数字 / 裸词枚举。 */
export interface Arg {
  /** 原始文本：字符串为去引号文本，枚举为标识符，数字为数字字面量。 */
  readonly s: string;
  /** token 为数字时的数值，否则 null。 */
  readonly n: number | null;
  /** token 是否为引号字符串。 */
  readonly str: boolean;
}

/** 一条属性：关键字 + 参数（关键字可重复，如 SetPoint）。 */
export interface FdfProp {
  readonly key: string;
  readonly args: readonly Arg[];
}

/** 一个 Frame 定义（Texture/String/Layer 由 `type` 区分）。 */
export interface FdfFrame {
  /** Frame 类型：FRAME / BACKDROP / TEXT / GLUETEXTBUTTON / TEXTURE / STRING / LAYER …（大写）。 */
  type: string;
  /** Frame 名；匿名 Texture/Layer block 为 ""。 */
  name: string;
  /** 继承的模板名，无则为 null。 */
  inherits: string | null;
  /** INHERITS WITHCHILDREN —— 是否克隆模板的子控件。 */
  withChildren: boolean;
  props: FdfProp[];
  children: FdfFrame[];
  /**
   * 布局时对 SetPoint X 偏移的像素级修正。由业务层在看像素视觉后写入
   * （`dxScale` 拉伸下保持其所在像素值，见 fdfKernelLayout.ts）。
   */
  nudgedX?: number;
}

/** 解析单个 .fdf 文件的结果（include 未合并）。 */
export interface FdfFile {
  frames: FdfFrame[];
  strings: Map<string, string>;
  includes: string[];
}