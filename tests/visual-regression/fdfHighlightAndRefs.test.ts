/**
 * FDF HighlightColor / MenuTextHighlightColor + 子 frame 引用守护测试
 *
 * vendor 命中:
 *   ButtonText 182, ControlShortcutKey 153, TabFocusNext 145, MenuItem 68,
 *   PopupMenuFrame 38, EditTextFrame 30, PopupArrowFrame 21, PopupTitleFrame 21,
 *   DialogBackdrop 20, HighlightColor 10, MenuBorder 5, MenuTextHighlightColor 4,
 *   NormalText / HighlightText / DisabledText 各 4
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  return new FDFTransformer().transform(new FDFParser(new FDFLexer(src).tokenize()).parse());
}

describe('FDF HighlightColor / MenuTextHighlightColor', () => {
  it('HighlightColor 1.0 0.0 0.0 0.2 → [255,0,0,51] (vendor 典型半透明红)', () => {
    const src = `Frame "HIGHLIGHT" "H" {
      Width 0.1, Height 0.05,
      HighlightColor 1.0 0.0 0.0 0.2,
    }`;
    expect(parse(src)[0].highlightColor).toEqual([255, 0, 0, 51]);
  });

  it('MenuTextHighlightColor 0 0 1 0.5 → [0,0,255,128]', () => {
    const src = `Frame "POPUPMENU" "M" {
      Width 0.1, Height 0.05,
      MenuTextHighlightColor 0.0 0.0 1.0 0.5,
    }`;
    expect(parse(src)[0].menuTextHighlightColor).toEqual([0, 0, 255, 128]);
  });
});

describe('FDF 子 frame 引用 string passthrough', () => {
  it('ButtonText / NormalText / HighlightText / DisabledText → *Ref 字段', () => {
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ButtonText "BText",
      NormalText "NT",
      HighlightText "HT",
      DisabledText "DT",
    }`;
    const f = parse(src)[0];
    expect(f.buttonTextRef).toBe('BText');
    expect(f.normalTextRef).toBe('NT');
    expect(f.highlightTextRef).toBe('HT');
    expect(f.disabledTextRef).toBe('DT');
  });

  it('Popup* / EditTextFrame / DialogBackdrop / MenuBorder', () => {
    const src = `Frame "POPUPMENU" "M" {
      Width 0.1, Height 0.05,
      PopupMenuFrame "PMF",
      PopupArrowFrame "PAF",
      PopupTitleFrame "PTF",
      EditTextFrame "ETF",
      DialogBackdrop "DBD",
      MenuBorder "MB",
    }`;
    const f = parse(src)[0];
    expect(f.popupMenuFrameRef).toBe('PMF');
    expect(f.popupArrowFrameRef).toBe('PAF');
    expect(f.popupTitleFrameRef).toBe('PTF');
    expect(f.editTextFrameRef).toBe('ETF');
    expect(f.dialogBackdropRef).toBe('DBD');
    expect(f.menuBorderRef).toBe('MB');
  });

  it('numeric MenuBorder → frame.menuBorder (vendor form)', () => {
    const src = `Frame "MENU" "M" {
      Width 0.1, Height 0.05,
      MenuBorder 0.009,
    }`;
    const f = parse(src)[0];
    expect(f.menuBorder).toBeCloseTo(0.009);
    expect(f.menuBorderRef).toBeUndefined();
  });

  it('ControlShortcutKey / TabFocusNext (无视觉影响, 仍持久化)', () => {
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ControlShortcutKey "ESCAPE",
      TabFocusNext "NextFrame",
    }`;
    const f = parse(src)[0];
    expect(f.controlShortcutKey).toBe('ESCAPE');
    expect(f.tabFocusNext).toBe('NextFrame');
  });

  it('MenuItem 重复声明 → menuItemRefs 数组累加 (vendor: AdvancedOptionsPane.fdf 形式)', () => {
    // 取自 vendor: 多个 MenuItem "KEY", -2,  在同一个 POPUPMENU 内
    const src = `Frame "POPUPMENU" "M" {
      Width 0.1, Height 0.05,
      MenuItem "FULL_OBSERVERS", -2,
      MenuItem "OBSERVERS_ON_DEFEAT", -2,
      MenuItem "REFEREES", -2,
      MenuItem "NO_OBSERVERS", -2,
    }`;
    const f = parse(src)[0];
    expect(f.menuItemRefs).toEqual([
      'FULL_OBSERVERS',
      'OBSERVERS_ON_DEFEAT',
      'REFEREES',
      'NO_OBSERVERS',
    ]);
  });
});
