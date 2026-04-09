// ============================================================
// WC3 UI Designer — 坐标系统常量
// ============================================================
// WC3 使用标准化坐标系: X 轴 0→0.8, Y 轴 0→0.6 (4:3)
// Canvas 使用像素坐标系: 1920×1080, 左右各留 240px 边距
// ============================================================

/** WC3 坐标系最大 X 值 */
export const WC3_MAX_X = 0.8;

/** WC3 坐标系最大 Y 值 */
export const WC3_MAX_Y = 0.6;

/** Canvas 像素宽度 */
export const CANVAS_WIDTH = 1920;

/** Canvas 像素高度 */
export const CANVAS_HEIGHT = 1080;

/** Canvas 4:3 区域边距 (px) */
export const CANVAS_MARGIN = 240;

/** Canvas 有效宽度 (去掉左右边距, px) */
export const CANVAS_EFFECTIVE_WIDTH = CANVAS_WIDTH - 2 * CANVAS_MARGIN;
