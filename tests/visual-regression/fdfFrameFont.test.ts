/**
 * FrameFont / FontFlags / FontHighlightColor / FontDisabledColor 守护测试
 *
 * 历史 bug：transformer 缺少这 4 条 case，使官方 FDF 中
 *   - 105 处 FrameFont
 *   -  50 处 FontFlags
 *   -  33 处 FontHighlightColor
 *   -  30 处 FontDisabledColor
 * 完全被丢弃，渲染器全部回退到默认字体 / 颜色。
 *
 * 单位约定（与 fontShadowColor / fontShadowOffset 同）：
 *   - 颜色：FDF 0..1 floats → 0..255 RGBA tuple
 *   - 字体高度：保持 WC3 单位（由渲染器通过 wc3ToPixelH 换算）
 *   - FontFlags：'|' 分隔的字符串切分为 string[]
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

describe('FDF FrameFont / FontFlags / Font*Color — official Blizzard convention', () => {
  it('FrameFont "MasterFont", 0.011, "" — name + WC3-unit height', () => {
    // 取自 target/vendor/UI/FrameDef 多处官方 FDF 的典型写法。
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FrameFont "MasterFont", 0.011, "",
    }`;
    const frame = parse(src)[0];
    expect(frame.font).toBe('MasterFont');
    expect(frame.fontSize).toBeCloseTo(0.011); // WC3 units, 渲染器负责换算
    expect(frame.fontFlags).toBeUndefined();   // 第三参数为空字符串
  });

  it('FrameFont 第三参数 "BOLD|FIXEDSIZE" 拆为 string[]', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FrameFont "MasterFont", 0.012, "BOLD|FIXEDSIZE",
    }`;
    const frame = parse(src)[0];
    expect(frame.fontFlags).toEqual(['BOLD', 'FIXEDSIZE']);
  });

  it('FontFlags "PASSWORDFIELD" — 单 token 也拆为长度 1 数组', () => {
    const src = `Frame "EDITBOX" "E" {
      Width 0.1, Height 0.05,
      FontFlags "PASSWORDFIELD",
    }`;
    const frame = parse(src)[0];
    expect(frame.fontFlags).toEqual(['PASSWORDFIELD']);
  });

  it('FontHighlightColor 1.0 1.0 1.0 1.0 → [255,255,255,255]', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontHighlightColor 1.0 1.0 1.0 1.0,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontHighlightColor).toEqual([255, 255, 255, 255]);
  });

  it('FontDisabledColor 0.2 0.2 0.2 1.0 → [51,51,51,255]', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontDisabledColor 0.2 0.2 0.2 1.0,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontDisabledColor).toEqual([51, 51, 51, 255]); // round(0.2*255)=51
  });

  it('典型 EDITBOX 完整组合（来自官方 FDF 模式）', () => {
    const src = `Frame "EDITBOX" "E" {
      Width 0.1, Height 0.05,
      FrameFont "MasterFont", 0.011, "",
      FontColor 1.0 1.0 1.0 1.0,
      FontHighlightColor 1.0 1.0 1.0 1.0,
      FontDisabledColor 0.2 0.2 0.2 1.0,
      FontFlags "PASSWORDFIELD",
    }`;
    const frame = parse(src)[0];
    expect(frame.font).toBe('MasterFont');
    expect(frame.fontSize).toBeCloseTo(0.011);
    expect(frame.fontFlags).toEqual(['PASSWORDFIELD']);
    expect(frame.fontHighlightColor).toEqual([255, 255, 255, 255]);
    expect(frame.fontDisabledColor).toEqual([51, 51, 51, 255]);
  });
});
