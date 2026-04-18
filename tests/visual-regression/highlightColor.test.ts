import { describe, expect, it } from 'vitest';
import { resolveHighlightTint } from '../../src/renderer/highlightColor';

describe('resolveHighlightTint', () => {
  it('兼容 FDF 导入的 0..255 RGBA', () => {
    expect(resolveHighlightTint([255, 128, 64, 128])).toEqual({
      r: 1,
      g: 128 / 255,
      b: 64 / 255,
      opacity: 128 / 255,
    });
  });

  it('兼容编辑器侧 0..1 RGBA，并与 frame.alpha 叠乘', () => {
    expect(resolveHighlightTint([1, 0.5, 0.25, 0.5], 128)).toEqual({
      r: 1,
      g: 0.5,
      b: 0.25,
      opacity: 0.5 * (128 / 255),
    });
  });

  it('未提供 highlightColor 时返回 null', () => {
    expect(resolveHighlightTint(undefined, 200)).toBeNull();
  });
});
