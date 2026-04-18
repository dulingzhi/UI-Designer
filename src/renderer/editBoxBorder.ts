import { wc3ToPixelH } from '../utils/coordinateService';

function clampInset(width: number, height: number, insetPx: number): number {
  // 至少保留 1px 内部区域，避免边框线重合退化。
  const maxInset = Math.max(0, Math.min(width, height) / 2 - 0.5);
  return Math.max(0, Math.min(insetPx, maxInset));
}

/**
 * EditBorderSize (WC3 单位) -> 画布像素内缩。
 */
export function getEditBoxBorderInsetPx(editBorderSize?: number): number {
  if (typeof editBorderSize !== 'number' || !Number.isFinite(editBorderSize) || editBorderSize <= 0) {
    return 0;
  }
  return Math.max(0, wc3ToPixelH(editBorderSize));
}

/**
 * 返回 LineSegments 需要的 8 个点 (24 个数值)。
 */
export function buildEditBoxBorderPositions(
  width: number,
  height: number,
  editBorderSize?: number,
  z = 0.25,
): number[] {
  const inset = clampInset(width, height, getEditBoxBorderInsetPx(editBorderSize));
  const left = inset;
  const right = Math.max(left, width - inset);
  const bottom = inset;
  const top = Math.max(bottom, height - inset);

  return [
    // Bottom edge
    left, bottom, z, right, bottom, z,
    // Right edge
    right, bottom, z, right, top, z,
    // Top edge
    right, top, z, left, top, z,
    // Left edge
    left, top, z, left, bottom, z,
  ];
}
