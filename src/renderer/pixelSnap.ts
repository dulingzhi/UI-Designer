// ============================================================
// pixelSnap — SnapTexelsToPixels 算法
// ============================================================
// 逆向自 WC3 Game.dll CSimpleFrame::SnapTexelsToPixels
// 确保纹理像素与屏幕像素对齐，避免亚像素模糊

/**
 * 将坐标对齐到像素网格
 * WC3 内部使用此函数确保 UI 元素边界在整数像素上
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
