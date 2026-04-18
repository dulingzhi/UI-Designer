export interface HighlightTint {
  r: number;
  g: number;
  b: number;
  opacity: number;
}

function normalizeUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value > 1 ? value / 255 : value;
}

function normalizeAlpha(alpha: number | undefined): number {
  if (alpha === undefined || alpha === null || !Number.isFinite(alpha)) {
    return 1;
  }
  return alpha > 1 ? Math.max(0, Math.min(1, alpha / 255)) : Math.max(0, Math.min(1, alpha));
}

/**
 * HIGHLIGHT 帧颜色覆盖：兼容 0..1 / 0..255 两种来源，并与 frame.alpha 叠乘。
 */
export function resolveHighlightTint(
  highlightColor?: [number, number, number, number],
  frameAlpha?: number,
): HighlightTint | null {
  if (!highlightColor) return null;
  const [r, g, b, a] = highlightColor;
  return {
    r: Math.max(0, Math.min(1, normalizeUnit(r))),
    g: Math.max(0, Math.min(1, normalizeUnit(g))),
    b: Math.max(0, Math.min(1, normalizeUnit(b))),
    opacity: Math.max(0, Math.min(1, normalizeUnit(a) * normalizeAlpha(frameAlpha))),
  };
}
