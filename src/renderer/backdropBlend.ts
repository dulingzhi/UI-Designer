// ============================================================
// backdropBlend — BACKDROP 背景层 alpha 混合模式解析
// ============================================================
// WC3 规则：
//   • 默认：ALPHAKEY（颜色键透明，discard alpha < ~6%）
//   • BackdropBlendAll 标志存在时：BLEND（真实 alpha 混合，保留软边缘）
//   • 若帧已显式设置 alphaMode（来自 Texture { AlphaMode ... }），保留原值优先。
//
// 视觉影响：
//   ALPHAKEY → 背景纹理边缘锐利（典型 WC3 风格 BACKDROP 无透明渐变）
//   BLEND    → 背景纹理支持半透明软边缘（BattleNet / HUD 带渐变背景）
// ============================================================

import type { FrameData } from '../types';

/**
 * 解析 BACKDROP 背景层应使用的 alpha 混合模式。
 *
 * @param frame - 当前帧数据
 * @returns 'BLEND' | 'ALPHAKEY'
 */
export function resolveBackdropBgAlphaMode(frame: FrameData): 'BLEND' | 'ALPHAKEY' {
  // 若帧显式设置了 alphaMode（来自 Texture 子块），尊重它
  if (frame.alphaMode === 'BLEND' || frame.alphaMode === 'ALPHAKEY' || frame.alphaMode === 'ADD') {
    // ADD 不常见于 BACKDROP 背景，但若显式写出则遵守
    return frame.alphaMode === 'ADD' ? 'BLEND' : frame.alphaMode;
  }
  // BackdropBlendAll → 真实 alpha 混合；否则 WC3 默认颜色键
  return frame.backdropBlendAll ? 'BLEND' : 'ALPHAKEY';
}
