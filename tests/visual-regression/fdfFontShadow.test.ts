/**
 * FontShadowColor / FontShadowOffset 守护测试
 *
 * 历史 bug：transformer 完全未实现这两个 case，导致
 * 72 处官方 FDF 中的字体阴影从未被应用。修复后由本测试守护。
 *
 * 单位约定（与 frame.width 一致）：
 *   - FontShadowColor: FDF 0..1 floats → 存储为 0..255 RGBA tuple
 *   - FontShadowOffset: 保持 WC3 单位（由渲染器在使用时换算）
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  const tokens = new FDFLexer(src).tokenize();
  const ast = new FDFParser(tokens).parse();
  return new FDFTransformer().transform(ast);
}

describe('FDF FontShadow* — official Blizzard convention', () => {
  it('FontShadowColor 0..1 floats → 0..255 RGBA tuple', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontShadowColor 0.0 0.0 0.0 0.9,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontShadowColor).toEqual([0, 0, 0, 230]); // round(0.9*255) = 230
  });

  it('FontShadowColor white opaque', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontShadowColor 1.0 1.0 1.0 1.0,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontShadowColor).toEqual([255, 255, 255, 255]);
  });

  it('FontShadowOffset preserves WC3 units (positive x, negative y)', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontShadowOffset 0.001 -0.001,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontShadowOffset).toEqual([0.001, -0.001]);
  });

  it('combined FontShadowColor + FontShadowOffset (typical Blizzard pattern)', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontShadowColor 0.0 0.0 0.0 0.9,
      FontShadowOffset 0.001 -0.001,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontShadowColor).toEqual([0, 0, 0, 230]);
    expect(frame.fontShadowOffset).toEqual([0.001, -0.001]);
  });
});
