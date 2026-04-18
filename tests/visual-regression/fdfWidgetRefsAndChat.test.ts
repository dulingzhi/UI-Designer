/**
 * FDF widget 子 frame 引用 + ChatDisplay/BackgroundArt/FontJustificationOffset
 *
 * vendor 命中:
 *   TextAreaScrollBar         8
 *   SliderThumbButtonFrame    9
 *   ScrollBarIncButtonFrame   3   ScrollBarDecButtonFrame  3
 *   CheckBoxCheckHighlight    7   CheckBoxDisabledCheckHighlight 4
 *   BackgroundArt             9
 *   FontJustificationOffset   4
 *   ChatDisplay*              1 each
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  return new FDFTransformer().transform(new FDFParser(new FDFLexer(src).tokenize()).parse());
}

describe('FDF widget 子 frame 引用 (Slider/ScrollBar/CheckBox/TextArea)', () => {
  it('TextAreaScrollBar / SliderThumbButtonFrame / ScrollBar*ButtonFrame', () => {
    const src = `Frame "TEXTAREA" "TA" {
      Width 0.1, Height 0.05,
      TextAreaScrollBar "TASB",
      SliderThumbButtonFrame "STBF",
      ScrollBarIncButtonFrame "SBI",
      ScrollBarDecButtonFrame "SBD",
    }`;
    const f = parse(src)[0];
    expect(f.textAreaScrollBarRef).toBe('TASB');
    expect(f.sliderThumbButtonFrameRef).toBe('STBF');
    expect(f.scrollBarIncButtonFrameRef).toBe('SBI');
    expect(f.scrollBarDecButtonFrameRef).toBe('SBD');
  });

  it('CheckBoxCheckHighlight / CheckBoxDisabledCheckHighlight', () => {
    const src = `Frame "CHECKBOX" "CB" {
      Width 0.05, Height 0.05,
      CheckBoxCheckHighlight "CCH",
      CheckBoxDisabledCheckHighlight "CDCH",
    }`;
    const f = parse(src)[0];
    expect(f.checkBoxCheckHighlightRef).toBe('CCH');
    expect(f.checkBoxDisabledCheckHighlightRef).toBe('CDCH');
  });
});

describe('FDF ChatDisplay 子字段', () => {
  it('BorderSize / LineHeight 数值, EditBox / ScrollBar 引用', () => {
    const src = `Frame "CHATDISPLAY" "CD" {
      Width 0.3, Height 0.1,
      ChatDisplayBorderSize 0.005,
      ChatDisplayLineHeight 0.012,
      ChatDisplayEditBox "CDEB",
      ChatDisplayScrollBar "CDSB",
    }`;
    const f = parse(src)[0];
    expect(f.chatDisplayBorderSize).toBeCloseTo(0.005);
    expect(f.chatDisplayLineHeight).toBeCloseTo(0.012);
    expect(f.chatDisplayEditBoxRef).toBe('CDEB');
    expect(f.chatDisplayScrollBarRef).toBe('CDSB');
  });
});

describe('FDF BackgroundArt + FontJustificationOffset', () => {
  it('BackgroundArt "UI\\\\Foo.blp" → frame.backgroundArt (MODEL / 装饰)', () => {
    const src = `Frame "MODEL" "M" {
      Width 0.1, Height 0.1,
      BackgroundArt "UI\\\\Glues\\\\BattleNet\\\\Foo.blp",
    }`;
    expect(parse(src)[0].backgroundArt).toBe('UI\\Glues\\BattleNet\\Foo.blp');
  });

  it('FontJustificationOffset 0.0 -0.001 → [0, -0.001] (vendor 真实值)', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.02,
      FontJustificationOffset 0.0 -0.001,
    }`;
    expect(parse(src)[0].fontJustificationOffset).toEqual([0, -0.001]);
  });

  it('FontJustificationOffset 零向量保留', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.02,
      FontJustificationOffset 0.0 0.0,
    }`;
    expect(parse(src)[0].fontJustificationOffset).toEqual([0, 0]);
  });
});
