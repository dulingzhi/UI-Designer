/**
 * ControlBackdrop 模板名引用 → 贴图解析守护测试
 *
 * 官方 FDF 惯例：`ControlBackdrop "UserGameButtonBackdropTemplate"` 的值是
 * 一个 **BACKDROP 模板的 Frame 名**，而不是贴图路径。
 * Transformer 在所有 Frame 变换完成后必须把这些名引用替换为模板的
 * backdropBackground（或其它贴图字段），否则 SceneGraphManager 会把
 * 模板名当成贴图 key 喂给 resolveTexturePath，必然命中 fallback。
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

describe('Control* template-name resolution', () => {
  it('controlBackdrop 引用 BACKDROP 模板 → 替换为模板的 backdropBackground', () => {
    // 两个顶层 Frame 在同一 FDF 中：BUTTON 通过名字引用前面的 BACKDROP。
    const src = `
      Frame "BACKDROP" "MyButtonBackdropTemplate" {
        BackdropBackground "UI\\\\buttons\\\\my-button.blp",
      }
      Frame "BUTTON" "MyButton" {
        Width 0.04, Height 0.04,
        ControlBackdrop "MyButtonBackdropTemplate",
      }
    `;
    const frames = parse(src);
    const button = frames.find((f) => f.name === 'MyButton')!;
    expect(button.controlBackdrop).toBe('UI\\buttons\\my-button.blp');
  });

  it('三态按钮：push/disabled 都解析 (典型官方模式)', () => {
    const src = `
      Frame "BACKDROP" "BaseBd"      { BackdropBackground "UI\\\\a.blp", }
      Frame "BACKDROP" "PushedBd"    { BackdropBackground "UI\\\\b.blp", }
      Frame "BACKDROP" "DisabledBd"  { BackdropBackground "UI\\\\c.blp", }
      Frame "BUTTON" "B" {
        Width 0.04, Height 0.04,
        ControlBackdrop         "BaseBd",
        ControlPushedBackdrop   "PushedBd",
        ControlDisabledBackdrop "DisabledBd",
      }
    `;
    const button = parse(src).find((f) => f.name === 'B')!;
    expect(button.controlBackdrop).toBe('UI\\a.blp');
    expect(button.controlPushedBackdrop).toBe('UI\\b.blp');
    expect(button.controlDisabledBackdrop).toBe('UI\\c.blp');
  });

  it('已经是贴图路径（含斜杠）的值原样保留，不做查找', () => {
    const src = `
      Frame "BUTTON" "B" {
        Width 0.04, Height 0.04,
        ControlBackdrop "UI\\\\explicit\\\\already-a-path.blp",
      }
    `;
    const button = parse(src).find((f) => f.name === 'B')!;
    expect(button.controlBackdrop).toBe('UI\\explicit\\already-a-path.blp');
  });

  it('查找不到的模板名保留原值，不引入 undefined', () => {
    // SceneGraphManager 依赖 resolveTexturePath 做最终 fallback;
    // 保留原值让下游决定，而不是把字段清空。
    const src = `
      Frame "BUTTON" "B" {
        Width 0.04, Height 0.04,
        ControlBackdrop "UnknownNotRegisteredTemplate",
      }
    `;
    const button = parse(src).find((f) => f.name === 'B')!;
    expect(button.controlBackdrop).toBe('UnknownNotRegisteredTemplate');
  });

  it('模板无 backdropBackground → 保留引用（不清空，让下游有信息可用）', () => {
    const src = `
      Frame "BACKDROP" "EmptyTemplate" { }
      Frame "BUTTON" "B" {
        Width 0.04, Height 0.04,
        ControlBackdrop "EmptyTemplate",
      }
    `;
    const button = parse(src).find((f) => f.name === 'B')!;
    expect(button.controlBackdrop).toBe('EmptyTemplate');
  });

  it('controlMouseOverHighlight 也做同样解析', () => {
    const src = `
      Frame "HIGHLIGHT" "HlTemplate" {
        HighlightAlphaFile "UI\\\\hl.blp",
        BackdropBackground "UI\\\\hl-backdrop.blp",
      }
      Frame "BUTTON" "B" {
        Width 0.04, Height 0.04,
        ControlMouseOverHighlight "HlTemplate",
      }
    `;
    const button = parse(src).find((f) => f.name === 'B')!;
    expect(button.controlMouseOverHighlight).toBe('UI\\hl-backdrop.blp');
  });
});
