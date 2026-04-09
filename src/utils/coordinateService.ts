import {
  WC3_MAX_X,
  WC3_MAX_Y,
  CANVAS_HEIGHT,
  CANVAS_MARGIN,
  CANVAS_EFFECTIVE_WIDTH,
} from '../constants';

// ============================================================
// WC3 ↔ Canvas 像素坐标转换
// ============================================================

/** WC3 X → Canvas 像素 X */
export function wc3ToPixelX(wc3X: number): number {
  return (wc3X / WC3_MAX_X) * CANVAS_EFFECTIVE_WIDTH + CANVAS_MARGIN;
}

/** WC3 Y → Canvas 像素 Y (从底部翻转为从顶部) */
export function wc3ToPixelY(wc3Y: number): number {
  return CANVAS_HEIGHT - (wc3Y / WC3_MAX_Y) * CANVAS_HEIGHT;
}

/** WC3 Y → Canvas 像素 Y (不翻转, 从底部向上的像素偏移) */
export function wc3ToPixelYBottom(wc3Y: number): number {
  return (wc3Y / WC3_MAX_Y) * CANVAS_HEIGHT;
}

/** WC3 宽度 → Canvas 像素宽度 */
export function wc3ToPixelW(wc3W: number): number {
  return (wc3W / WC3_MAX_X) * CANVAS_EFFECTIVE_WIDTH;
}

/** WC3 高度 → Canvas 像素高度 */
export function wc3ToPixelH(wc3H: number): number {
  return (wc3H / WC3_MAX_Y) * CANVAS_HEIGHT;
}

/** Canvas 像素 X → WC3 X */
export function pixelToWc3X(pixelX: number): number {
  return ((pixelX - CANVAS_MARGIN) / CANVAS_EFFECTIVE_WIDTH) * WC3_MAX_X;
}

/** Canvas 像素 Y (从底部向上的偏移) → WC3 Y */
export function pixelToWc3Y(pixelY: number): number {
  return (pixelY / CANVAS_HEIGHT) * WC3_MAX_Y;
}

/** Canvas 像素增量 X → WC3 增量 X */
export function pixelDeltaToWc3X(deltaPixel: number): number {
  return (deltaPixel / CANVAS_EFFECTIVE_WIDTH) * WC3_MAX_X;
}

/** Canvas 像素增量 Y → WC3 增量 Y */
export function pixelDeltaToWc3Y(deltaPixel: number): number {
  return (deltaPixel / CANVAS_HEIGHT) * WC3_MAX_Y;
}

/** 将 WC3 坐标限制在画布范围内 */
export function clampWc3(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(WC3_MAX_X - w, x)),
    y: Math.max(0, Math.min(WC3_MAX_Y - h, y)),
  };
}

/** 将 WC3 尺寸限制在画布范围内 */
export function clampWc3Size(x: number, y: number, w: number, h: number): { w: number; h: number } {
  return {
    w: Math.max(0.01, Math.min(WC3_MAX_X - x, w)),
    h: Math.max(0.01, Math.min(WC3_MAX_Y - y, h)),
  };
}
