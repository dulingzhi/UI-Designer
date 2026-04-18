// ============================================================
// buttonState — Button/Checkbox 状态解析器 (纯函数)
// ============================================================
// 把 FrameData 的多状态字段 (controlBackdrop / controlPushedBackdrop /
// controlDisabledBackdrop / controlMouseOverHighlight /
// buttonPushedTextOffset / menuTextHighlightColor /
// fontHighlightColor / fontDisabledColor) 按 state 映射成
// 渲染端真实使用的 { backdropPath, textOffset, textColor, highlightPath }.
//
// 不依赖 Three.js，便于单元测试。

import type { FrameData } from '../types';

/** Button / Checkbox 预览态. 默认 'normal'. */
export type ButtonState = 'normal' | 'pushed' | 'disabled' | 'mouseover';

export interface ResolvedButtonRender {
  /** 主 Backdrop 纹理路径; undefined 表示保持 frame.backdropBackground */
  backdropPath?: string;
  /** 文字整体像素偏移 (WC3 单位, Y-up); [0,0] 表示不偏移 */
  textOffset: [number, number];
  /** 文字颜色覆盖 (RGBA 0..255); undefined 表示用 frame.fontColor */
  textColor?: [number, number, number, number];
  /** Mouseover 态叠加的高亮层; undefined 表示无 */
  highlightPath?: string;
}

function hasControlStyleFlag(controlStyle: string | undefined, flag: string): boolean {
  if (!controlStyle) return false;
  return controlStyle
    .split('|')
    .map((token) => token.trim().toUpperCase())
    .includes(flag.toUpperCase());
}

/**
 * 解析 Button / Checkbox 的渲染状态.
 *
 * 状态优先级 (官方 UI 行为):
 *   disabled    — 永远接管所有其他状态
 *   pushed      — 按下时用 PushedBackdrop; 文字按 ButtonPushedTextOffset 偏移
 *   mouseover   — 叠加 ControlMouseOverHighlight 层; 文字用
 *                  menuTextHighlightColor ?? fontHighlightColor
 *   normal      — frame.controlBackdrop 或 frame.backdropBackground
 *
 * Checkbox: 'normal' + checked 时强制视作 'pushed' (显示勾选态).
 *
 * 所有字段缺失时做健壮回退 — 例如 pushed 但没有 PushedBackdrop,
 * 则保持 normal 的 backdrop, 只应用 textOffset.
 */
export function resolveButtonState(
  frame: FrameData,
  state: ButtonState,
): ResolvedButtonRender {
  const isCheckbox = frame.checked !== undefined;
  // Checkbox 的勾选态映射为 pushed (除非明确 disabled)
  if (isCheckbox && state === 'normal' && frame.checked) {
    state = 'pushed';
  }

  const normalBackdrop = frame.controlBackdrop ?? frame.backdropBackground;
  const canMouseoverHighlight = hasControlStyleFlag(frame.controlStyle, 'HIGHLIGHTONMOUSEOVER');

  switch (state) {
    case 'disabled':
      return {
        backdropPath: frame.controlDisabledBackdrop ?? normalBackdrop,
        textOffset: [0, 0],
        textColor: frame.fontDisabledColor,
      };

    case 'pushed':
      return {
        backdropPath: frame.controlPushedBackdrop ?? normalBackdrop,
        textOffset: frame.buttonPushedTextOffset ?? [0, 0],
      };

    case 'mouseover':
      return {
        backdropPath: normalBackdrop,
        textOffset: [0, 0],
        textColor: canMouseoverHighlight
          ? (frame.menuTextHighlightColor ?? frame.fontHighlightColor)
          : undefined,
        highlightPath: canMouseoverHighlight ? frame.controlMouseOverHighlight : undefined,
      };

    case 'normal':
    default:
      return {
        backdropPath: normalBackdrop,
        textOffset: [0, 0],
      };
  }
}
