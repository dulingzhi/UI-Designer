/**
 * 视觉回归比对工具
 * ============================
 * 使用 pixelmatch + pngjs 对比两张同尺寸 PNG，
 * 返回不同像素数、PSNR (峰值信噪比 dB)、最大单像素差。
 *
 * 验收准则 (来自 100% 对齐路线图):
 *   - PSNR ≥ 45 dB        → 视觉上无差异
 *   - diffPixels ≤ totalPixels * 0.001 (0.1%)
 *   - maxPixelDiff ≤ 1    → 单通道误差不超过 1/255
 *
 * 用法:
 *   const result = await compareImages(actualPng, baselinePng);
 *   expect(result.psnr).toBeGreaterThanOrEqual(45);
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface CompareResult {
  /** 不同的像素数 */
  diffPixels: number;
  /** 总像素数 */
  totalPixels: number;
  /** 不同像素占比 (0-1) */
  diffRatio: number;
  /** 峰值信噪比 (dB)，越高越像 */
  psnr: number;
  /** RGBA 通道最大单像素差 (0-255) */
  maxChannelDiff: number;
  /** 差异图 PNG bytes，可写盘人工检查 */
  diffPng: Uint8Array;
}

export interface CompareOptions {
  /** pixelmatch 阈值 0-1，越小越敏感。默认 0.05 */
  threshold?: number;
  /** 是否将抗锯齿差异视作真差异。默认 false (忽略) */
  includeAA?: boolean;
}

/**
 * 比对两张 PNG（必须同尺寸）。
 */
export function compareImages(
  actual: Uint8Array,
  baseline: Uint8Array,
  options: CompareOptions = {},
): CompareResult {
  const a = PNG.sync.read(Buffer.from(actual));
  const b = PNG.sync.read(Buffer.from(baseline));

  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `Image size mismatch: actual=${a.width}x${a.height}, baseline=${b.width}x${b.height}`,
    );
  }

  const { width, height } = a;
  const totalPixels = width * height;
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(a.data, b.data, diff.data, width, height, {
    threshold: options.threshold ?? 0.05,
    includeAA: options.includeAA ?? false,
  });

  // 计算 MSE / PSNR / max-channel-diff
  let sumSq = 0;
  let maxChannelDiff = 0;
  for (let i = 0; i < a.data.length; i += 1) {
    const d = a.data[i] - b.data[i];
    sumSq += d * d;
    const ad = Math.abs(d);
    if (ad > maxChannelDiff) maxChannelDiff = ad;
  }
  const mse = sumSq / a.data.length;
  // 完全相同时返回 Infinity；否则 10*log10(MAX^2 / MSE)
  const psnr = mse === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10((255 * 255) / mse);

  return {
    diffPixels,
    totalPixels,
    diffRatio: diffPixels / totalPixels,
    psnr,
    maxChannelDiff,
    diffPng: PNG.sync.write(diff),
  };
}

/**
 * 验收门：满足任一更严格条件即通过。
 */
export function meetsAcceptance(result: CompareResult, opts: { psnrDb?: number; ratio?: number; maxChannelDiff?: number } = {}): boolean {
  const psnrDb = opts.psnrDb ?? 45;
  const ratio = opts.ratio ?? 0.001;
  const maxCh = opts.maxChannelDiff ?? 1;
  return (
    result.psnr >= psnrDb &&
    result.diffRatio <= ratio &&
    result.maxChannelDiff <= maxCh
  );
}
