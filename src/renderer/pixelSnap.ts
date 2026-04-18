// ============================================================
// pixelSnap — ScreenToPixel 算法
// ============================================================
// 逆向自 WC3 game.dll ?ScreenToPixelHeight@@YIMHM@Z (sub_692DF0):
//
//   double ScreenToPixelHeight(bool billboarded, float height) {
//     if (billboarded) return height;             // 3D 世界 UI 不 snap
//     v4 = screenHeightPx * height;               // 归一化坐标 → 像素
//     return (int)(SignOf(v4) * 0.5 + v4);        // round half away from 0
//   }
//
// `SignOf(x)*0.5 + x` 截断为 int 等价于：
//   x>=0 → floor(x + 0.5)   (== Math.round)
//   x<0  → ceil(x − 0.5)
//
// UI 坐标永远为正，因此 `Math.round` 完全等价。
// 注意：游戏只导出 *Height* 函数（无 Width 版）— 因为 WC3 X/Y 同用屏幕高度
// 作为 snap 分母（0.6 固定纵横比）。我们的 wc3ToPixelW/H 已处理纵横比，
// 所以这里直接对 pixel 量 round 即可。

/**
 * 将像素坐标对齐到设备像素网格 (= 游戏 ScreenToPixelHeight, 非 billboarded 模式)
 */
export function snapToPixel(value: number): number {
  return Math.round(value);
}

/**
 * 将矩形区域对齐到像素网格
 * 确保 x, y, width, height 都是整数像素值
 */
export function snapRectToPixels(
  x: number,
  y: number,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } {
  const snappedX = Math.round(x);
  const snappedY = Math.round(y);
  // width/height 基于 snapped 起点计算，避免累积误差
  const snappedW = Math.round(x + w) - snappedX;
  const snappedH = Math.round(y + h) - snappedY;
  return {
    x: snappedX,
    y: snappedY,
    w: Math.max(1, snappedW),
    h: Math.max(1, snappedH),
  };
}

/**
 * 对齐纹理坐标，使纹素中心对应像素中心
 * 避免在整数像素边界上出现线性插值产生的半透明边缘
 */
export function snapTexCoordToPixels(
  uv: number,
  textureSize: number,
  targetSize: number,
): number {
  if (textureSize <= 0 || targetSize <= 0) return uv;
  const texel = uv * textureSize;
  const snapped = Math.round(texel - 0.5) + 0.5;
  return snapped / textureSize;
}
