/**
 * 剩余标量字段守护测试: Font / TextLength / ButtonPushedTextOffset
 *
 * 历史 bug: 即使在补完 FrameFont/FontFlags 之后, 仍有少量字段未连线:
 *   Font                       9 处 (FrameFont 旧别名)
 *   TextLength                 1 处 (EditBox 字数上限)
 *   ButtonPushedTextOffset    11 处 (按下文字偏移, 与 lexer 'f' 后缀联动)
 *
 * 这些 case 与上批 (FrameFont/FontFlags/FontHighlight/FontDisabled/
 * FontShadow/Control 与 AlphaMode) 是同一类系统性遗漏: types/index.ts +
 * fdfAst.ts 已声明, 但 transformer 没有 case。
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

describe('FDF Font alias / TextLength / ButtonPushedTextOffset', () => {
  it('Font "MasterFont", 0.011, "" 与 FrameFont 同效', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      Font "MasterFont", 0.011, "",
    }`;
    const frame = parse(src)[0];
    expect(frame.font).toBe('MasterFont');
    expect(frame.fontSize).toBeCloseTo(0.011);
  });

  it('Font 第三参数带 flags 也被拆分', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      Font "MasterFont", 0.012, "BOLD|FIXEDSIZE",
    }`;
    expect(parse(src)[0].fontFlags).toEqual(['BOLD', 'FIXEDSIZE']);
  });

  it('TextLength 32 → frame.textLength', () => {
    const src = `Frame "EDITBOX" "E" {
      Width 0.1, Height 0.05,
      TextLength 32,
    }`;
    expect(parse(src)[0].textLength).toBe(32);
  });

  it('ButtonPushedTextOffset 与 lexer "f" 后缀联动 (官方典型值)', () => {
    // 取自 target/vendor 11 处之一: ButtonPushedTextOffset -0.0015f -0.0015f
    // 该测试隐式覆盖 9dc8274 的 lexer 修复 — 若 'f' 后缀未被吞,
    // 此处会因为 buttonPushedTextOffset 仅有第一个分量或为 undefined 而失败。
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ButtonPushedTextOffset -0.0015f -0.0015f,
    }`;
    const frame = parse(src)[0];
    expect(frame.buttonPushedTextOffset).toEqual([-0.0015, -0.0015]);
  });

  it('ButtonPushedTextOffset 不带 f 后缀也 OK', () => {
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ButtonPushedTextOffset 0.002 -0.003,
    }`;
    const frame = parse(src)[0];
    expect(frame.buttonPushedTextOffset![0]).toBeCloseTo(0.002);
    expect(frame.buttonPushedTextOffset![1]).toBeCloseTo(-0.003);
  });
});
