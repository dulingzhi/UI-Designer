/**
 * FDF TextArea / EditBox / Menu 标量字段守护测试
 *
 * 系统性遗漏的下一批 (vendor 命中):
 *   TextAreaLineHeight  8     TextAreaLineGap  8
 *   TextAreaInset       8     TextAreaMaxLines 6
 *   MenuItemHeight      5     PopupButtonInset 2
 *   EditBorderSize      4
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  return new FDFTransformer().transform(new FDFParser(new FDFLexer(src).tokenize()).parse());
}

describe('FDF TextArea 4-tuple', () => {
  it('TextAreaLineHeight / LineGap / Inset / MaxLines 全部连线', () => {
    // 取自 vendor: TextAreaLineHeight 0.01, LineGap 0.0015, Inset 0.005, MaxLines 128
    const src = `Frame "TEXTAREA" "TA" {
      Width 0.2, Height 0.1,
      TextAreaLineHeight 0.01,
      TextAreaLineGap 0.0015,
      TextAreaInset 0.005,
      TextAreaMaxLines 128,
    }`;
    const f = parse(src)[0];
    expect(f.textAreaLineHeight).toBeCloseTo(0.01);
    expect(f.textAreaLineGap).toBeCloseTo(0.0015);
    expect(f.textAreaInset).toBeCloseTo(0.005);
    expect(f.textAreaMaxLines).toBe(128);
  });

  it('Inset 0.0 (零值) 也被记录, 不被当作未设置', () => {
    const src = `Frame "TEXTAREA" "TA" {
      Width 0.2, Height 0.1,
      TextAreaInset 0.0,
    }`;
    expect(parse(src)[0].textAreaInset).toBe(0);
  });
});

describe('FDF Menu / Popup / EditBox 标量', () => {
  it('MenuItemHeight 0.014 → frame.menuItemHeight', () => {
    const src = `Frame "POPUPMENU" "M" {
      Width 0.1, Height 0.05,
      MenuItemHeight 0.014,
    }`;
    expect(parse(src)[0].menuItemHeight).toBeCloseTo(0.014);
  });

  it('PopupButtonInset 0.01 → frame.popupButtonInset', () => {
    const src = `Frame "POPUPMENU" "M" {
      Width 0.1, Height 0.05,
      PopupButtonInset 0.01,
    }`;
    expect(parse(src)[0].popupButtonInset).toBeCloseTo(0.01);
  });

  it('EditBorderSize 0.009 → frame.editBorderSize', () => {
    const src = `Frame "EDITBOX" "E" {
      Width 0.1, Height 0.02,
      EditBorderSize 0.009,
    }`;
    expect(parse(src)[0].editBorderSize).toBeCloseTo(0.009);
  });
});
