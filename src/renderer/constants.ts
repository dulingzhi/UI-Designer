// ============================================================
// WebGL Renderer 常量
// ============================================================

import { FrameType } from '../types';

// ============================================================
// 逆向工程常量 (from WC3 1.27a Game.dll)
// ============================================================

/** WC3 Alpha Blend Modes (EGxMatAlphaOp) */
export enum EGxMatAlphaOp {
  DISABLE = 0,
  ALPHAKEY = 1,
  BLEND = 2,
  ADD = 3,
  MODULATE = 4,
  MODULATE2X = 5,
}

/** Alpha reference thresholds (normalized 0-1) */
export const ALPHA_REF: Record<EGxMatAlphaOp, number> = {
  [EGxMatAlphaOp.DISABLE]:    1.0,
  [EGxMatAlphaOp.ALPHAKEY]:   192 / 255,  // 0xC0
  [EGxMatAlphaOp.BLEND]:      4 / 255,    // 0x04
  [EGxMatAlphaOp.ADD]:        4 / 255,
  [EGxMatAlphaOp.MODULATE]:   4 / 255,
  [EGxMatAlphaOp.MODULATE2X]: 4 / 255,
};

/** Nine-slice edge UV strips (逆向: CBackdropGenerator::Generate) */
export const EDGE_UV_STRIPS = {
  TL:     [0.000, 0.125],
  TR:     [0.125, 0.250],
  BL:     [0.250, 0.375],
  BR:     [0.375, 0.500],
  TOP:    [0.500, 0.625],
  BOTTOM: [0.625, 0.750],
  LEFT:   [0.750, 0.875],
  RIGHT:  [0.875, 1.000],
} as const;

/**
 * 水平边 (T/B) 沿 X 缩入的角块因子（逆向: 0.94999999 ≈ 0.95）
 *
 * **关键非对称性**（hexrays sub_44D1A0 验证）：
 *   - 此因子**仅**应用于水平边 (bit 0x01/0x02 = T/B)
 *   - 垂直边 (bit 0x04/0x08 = L/R) 不缩入，使用完整 cornerSize
 *   - 详见 hexrays 0x44dd4f / 0x44df0f vs 0x44e029
 *
 * 这是 WC3 引擎本身的非对称设计，匹配以求像素级一致。
 */
export const CORNER_INSET_FACTOR_HORIZONTAL = 0.95;

/**
 * Edge piece bitfield flags.
 *
 * **hexrays 交叉验证** (sub_44D000 — UV-array enumerator called by sub_44D1A0)：
 * 该函数按 `*(BYTE *)(this+432)` 上的位顺序枚举 edge piece：
 *   0x10 → T,  0x20 → B,  0x40 → L,  0x80 → R    （edges 先）
 *   0x01 → TL, 0x02 → TR, 0x04 → BL, 0x08 → BR   （corners 后）
 * 这里的 8 个 bit 与 `EDGE_UV_STRIPS` 的 8 段 UV (1/8 间隔) 一一对应。
 * 注意游戏内 enumeration 顺序是 edges-then-corners（与渲染顺序相反：
 * 我们渲染时是 corners 先、edges 后绘制以正确遮挡）。
 */
export const EDGE_FLAGS = {
  TL: 0x01, TR: 0x02, BL: 0x04, BR: 0x08,
  T:  0x10, B:  0x20, L:  0x40, R:  0x80,
} as const;

/** Texture filter modes (from s_filterModes) */
export const FILTER_MODES = [
  { mag: 'NEAREST',  min: 'NEAREST',                  mip: 'NONE' },     // 0: POINT
  { mag: 'LINEAR',   min: 'LINEAR',                   mip: 'NONE' },     // 1: LINEAR
  { mag: 'LINEAR',   min: 'LINEAR_MIPMAP_NEAREST',    mip: 'NEAREST' },  // 2: Bilinear+NearestMip
  { mag: 'LINEAR',   min: 'LINEAR_MIPMAP_LINEAR',     mip: 'LINEAR' },   // 3: Trilinear
] as const;

// ============================================================
// 调试颜色
// ============================================================
export const FRAME_TYPE_COLORS: Partial<Record<FrameType, [number, number, number, number]>> = {
  // 基础容器 — 灰色系
  [FrameType.ORIGIN]:      [0.3, 0.3, 0.3, 0.15],
  [FrameType.FRAME]:       [0.5, 0.5, 0.5, 0.2],
  [FrameType.SIMPLEFRAME]: [0.4, 0.4, 0.5, 0.2],

  // Backdrop — 蓝色系
  [FrameType.BACKDROP]:    [0.2, 0.4, 0.8, 0.5],

  // 文本 — 绿色系
  [FrameType.TEXT_FRAME]:      [0.2, 0.7, 0.3, 0.4],
  [FrameType.SIMPLEFONTSTRING]:[0.3, 0.8, 0.4, 0.35],
  [FrameType.TEXTAREA]:        [0.2, 0.6, 0.3, 0.4],
  [FrameType.TIMERTEXT]:       [0.3, 0.7, 0.2, 0.4],

  // 按钮 — 橙色系
  [FrameType.BUTTON]:              [0.9, 0.5, 0.1, 0.5],
  [FrameType.GLUETEXTBUTTON]:     [0.8, 0.5, 0.2, 0.5],
  [FrameType.GLUEBUTTON]:         [0.85, 0.45, 0.15, 0.5],
  [FrameType.SIMPLEBUTTON]:       [0.9, 0.55, 0.1, 0.5],
  [FrameType.BROWSER_BUTTON]:     [0.8, 0.4, 0.1, 0.5],
  [FrameType.SCRIPT_DIALOG_BUTTON]:[0.85, 0.5, 0.15, 0.5],
  [FrameType.INVIS_BUTTON]:       [0.7, 0.5, 0.2, 0.15],

  // 交互控件 — 青色系
  [FrameType.CHECKBOX]:  [0.1, 0.7, 0.7, 0.5],
  [FrameType.EDITBOX]:   [0.1, 0.6, 0.8, 0.5],
  [FrameType.SLIDER]:    [0.2, 0.7, 0.8, 0.5],
  [FrameType.SCROLLBAR]: [0.15, 0.65, 0.75, 0.5],
  [FrameType.LISTBOX]:   [0.1, 0.6, 0.7, 0.5],
  [FrameType.MENU]:      [0.2, 0.65, 0.7, 0.5],
  [FrameType.POPUPMENU]: [0.15, 0.6, 0.75, 0.5],

  // 图形 — 紫色/品红系
  [FrameType.SPRITE]:    [0.7, 0.2, 0.8, 0.5],
  [FrameType.MODEL]:     [0.8, 0.2, 0.7, 0.5],
  [FrameType.HIGHLIGHT]: [1.0, 1.0, 0.2, 0.3],

  // 状态栏 — 红色系
  [FrameType.SIMPLESTATUSBAR]: [0.8, 0.2, 0.2, 0.5],
  [FrameType.STATUSBAR]:       [0.9, 0.3, 0.2, 0.5],

  // 其他
  [FrameType.CONTROL]: [0.5, 0.5, 0.5, 0.3],
  [FrameType.DIALOG]:  [0.4, 0.4, 0.6, 0.3],
};

/** 默认调试颜色（品红，易于识别未映射类型） */
export const DEFAULT_FRAME_COLOR: [number, number, number, number] = [1.0, 0.0, 1.0, 0.4];

/**
 * 获取帧类型对应的调试颜色
 */
export function getFrameTypeColor(type: FrameType): [number, number, number, number] {
  return FRAME_TYPE_COLORS[type] ?? DEFAULT_FRAME_COLOR;
}
