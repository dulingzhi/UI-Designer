/**
 * Control* / Highlight* / LayerStyle 守护测试
 *
 * 历史 bug：9 个字段同时在 types/index.ts 声明、fdfAst.ts 提示表登记、
 * SceneGraphManager.syncControlTexture 消费（真的参与渲染），但 transformer
 * 完全没有 case。结果：导入的所有官方 FDF 按钮/高亮贴图都是空的，只剩默认色块。
 *
 * 字段频次（来自 target/vendor/UI/FrameDef）：
 *   ControlBackdrop            101
 *   ControlMouseOverHighlight   23
 *   ControlDisabledBackdrop     59
 *   ControlPushedBackdrop       32
 *   ControlStyle                24
 *   HighlightType               48
 *   HighlightAlphaFile          40
 *   HighlightAlphaMode          40
 *   LayerStyle                  42
 *
 * 约定：均为字符串 passthrough（值通常是模板/Frame 名，不是文件路径）。
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

describe('FDF Control* / Highlight* / LayerStyle — string passthrough', () => {
  it('ControlBackdrop / ControlPushedBackdrop / ControlDisabledBackdrop', () => {
    // 取自 target/vendor 官方三态按钮模式。
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ControlBackdrop         "UserGameButtonBackdropTemplate",
      ControlPushedBackdrop   "UserGameButtonPushedBackdropTemplate",
      ControlDisabledBackdrop "UserGameButtonDisabledBackdropTemplate",
    }`;
    const frame = parse(src)[0];
    expect(frame.controlBackdrop).toBe('UserGameButtonBackdropTemplate');
    expect(frame.controlPushedBackdrop).toBe('UserGameButtonPushedBackdropTemplate');
    expect(frame.controlDisabledBackdrop).toBe('UserGameButtonDisabledBackdropTemplate');
  });

  it('ControlMouseOverHighlight + ControlStyle pipe-flags (保持原字符串)', () => {
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ControlStyle "AUTOTRACK|HIGHLIGHTONFOCUS|HIGHLIGHTONMOUSEOVER",
      ControlMouseOverHighlight "IconicButtonMouseOverHighlightTemplate",
    }`;
    const frame = parse(src)[0];
    // controlStyle 不在 transformer 内拆分，消费方 split
    expect(frame.controlStyle).toBe('AUTOTRACK|HIGHLIGHTONFOCUS|HIGHLIGHTONMOUSEOVER');
    expect(frame.controlMouseOverHighlight).toBe('IconicButtonMouseOverHighlightTemplate');
  });

  it('HighlightType / HighlightAlphaFile / HighlightAlphaMode', () => {
    // 官方 SHADE / ADD / BLEND 混合模式。
    const src = `Frame "HIGHLIGHT" "H" {
      Width 0.1, Height 0.05,
      HighlightType "SHADE",
      HighlightAlphaFile "UI\\\\Widgets\\\\EscMenu\\\\Human\\\\blank-background.blp",
      HighlightAlphaMode "ADD",
    }`;
    const frame = parse(src)[0];
    expect(frame.highlightType).toBe('SHADE');
    expect(frame.highlightAlphaFile).toBe('UI\\Widgets\\EscMenu\\Human\\blank-background.blp');
    expect(frame.highlightAlphaMode).toBe('ADD');
  });

  it('LayerStyle "NOSHADING" (单 token) 与 pipe-flags (两种形式都保留原文)', () => {
    const src = `Frame "FRAME" "F1" {
      Width 0.1, Height 0.05,
      LayerStyle "NOSHADING",
    }`;
    const f1 = parse(src)[0];
    expect(f1.layerStyle).toBe('NOSHADING');

    const src2 = `Frame "FRAME" "F2" {
      Width 0.1, Height 0.05,
      LayerStyle "NOSHADING|IGNORETRACKEVENTS",
    }`;
    const f2 = parse(src2)[0];
    expect(f2.layerStyle).toBe('NOSHADING|IGNORETRACKEVENTS');
  });

  it('SceneGraphManager 消费路径冒烟：Button 三态 + highlightAlphaFile 同时存在', () => {
    // 来自 SceneGraphManager.syncControlTexture 的真实消费顺序:
    //   isPushed ? controlPushedBackdrop ?? controlBackdrop : controlBackdrop
    //   highlight frames 用 highlightAlphaFile
    // 本测试只校验 transformer 产物，不运行渲染器。
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ControlBackdrop "BaseBackdrop",
      ControlPushedBackdrop "BasePushed",
      ControlDisabledBackdrop "BaseDisabled",
      HighlightType "FILETEXTURE",
      HighlightAlphaFile "UI\\\\hl.blp",
      HighlightAlphaMode "BLEND",
    }`;
    const frame = parse(src)[0];
    expect(frame.controlBackdrop).toBe('BaseBackdrop');
    expect(frame.controlPushedBackdrop).toBe('BasePushed');
    expect(frame.controlDisabledBackdrop).toBe('BaseDisabled');
    expect(frame.highlightType).toBe('FILETEXTURE');
    expect(frame.highlightAlphaFile).toBe('UI\\hl.blp');
    expect(frame.highlightAlphaMode).toBe('BLEND');
  });
});
