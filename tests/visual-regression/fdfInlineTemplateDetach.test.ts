import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

/**
 * 回归：按钮内部内联定义的 BACKDROP 状态模板不应作为可视化子 Frame 渲染。
 *
 * 官方 FDF 中非常常见的写法：
 *
 *   Frame "GLUETEXTBUTTON" "Foo" {
 *     ControlBackdrop "FooBackdropTemplate",
 *     Frame "BACKDROP" "FooBackdropTemplate" { ... }        // inline 模板
 *
 *     ControlPushedBackdrop "FooPushedBackdropTemplate",
 *     Frame "BACKDROP" "FooPushedBackdropTemplate" { ... }  // inline 模板
 *     ...
 *   }
 *
 * 这些嵌套 Frame 是模板定义，由 Control*Backdrop 字段消费，**不应**
 * 作为按钮的可视子控件。此前 collectNestedFrames 一视同仁地把它们
 * 加入 children[]，预览里每个按钮会多出 2~4 个以 0.4×0.4 默认尺寸堆叠
 * 的空 BACKDROP，把 MultiBoard.fdf 的最小化按钮渲染成一片大方块。
 */
function transform(src: string) {
  const tokens = new FDFLexer(src).tokenize();
  const ast = new FDFParser(tokens).parse();
  return new FDFTransformer().transform(ast);
}

describe('Inline Control*Backdrop template children are detached from scene graph', () => {
  it('removes inline BACKDROP templates consumed by ControlBackdrop', () => {
    const frames = transform(`
      Frame "GLUETEXTBUTTON" "Btn" {
        Width 0.05, Height 0.05,
        ControlBackdrop "BtnTpl",
        Frame "BACKDROP" "BtnTpl" {
          BackdropBackground "SomeTex",
        }
      }
    `);
    // inline 模板 Frame 不出现在扁平列表
    expect(frames.find(f => f.name === 'BtnTpl')).toBeUndefined();
    const btn = frames.find(f => f.name === 'Btn')!;
    expect(btn).toBeTruthy();
    expect(btn.children).toHaveLength(0);
  });

  it('removes all four Button*BackdropTemplate inline state templates', () => {
    const frames = transform(`
      Frame "GLUETEXTBUTTON" "Btn" {
        Width 0.05, Height 0.05,
        ControlBackdrop "T1",
        Frame "BACKDROP" "T1" { BackdropBackground "a", }
        ControlPushedBackdrop "T2",
        Frame "BACKDROP" "T2" { BackdropBackground "b", }
        ControlDisabledBackdrop "T3",
        Frame "BACKDROP" "T3" { BackdropBackground "c", }
        ControlDisabledPushedBackdrop "T4",
        Frame "BACKDROP" "T4" { BackdropBackground "d", }
      }
    `);
    for (const n of ['T1', 'T2', 'T3', 'T4']) {
      expect(frames.find(f => f.name === n), `${n} should be detached`).toBeUndefined();
    }
    const btn = frames.find(f => f.name === 'Btn')!;
    expect(btn.children).toHaveLength(0);
    // Control*Backdrop 字段本身仍保留 (可能被 resolveControlTextureRefs 解析为贴图)
    expect(btn.controlBackdrop).toBeDefined();
    expect(btn.controlPushedBackdrop).toBeDefined();
    expect(btn.controlDisabledBackdrop).toBeDefined();
    expect(btn.controlDisabledPushedBackdrop).toBeDefined();
  });

  it('does NOT detach normal visual children with unrelated names', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.1, Height 0.1,
        Frame "BACKDROP" "VisibleChild" {
          Width 0.02, Height 0.02,
        }
      }
    `);
    expect(frames.find(f => f.name === 'VisibleChild')).toBeDefined();
    const root = frames.find(f => f.name === 'Root')!;
    expect(root.children).toHaveLength(1);
  });

  it('Multiboard minimize button has zero visual children (only state templates)', () => {
    // 使用与 MultiBoard.fdf 同构的最小样本
    const frames = transform(`
      Frame "FRAME" "Multiboard" {
        Width 0.024, Height 0.024,
        Frame "GLUETEXTBUTTON" "MultiboardMinimizeButton" {
          SetAllPoints,
          ControlBackdrop "ButtonBackdropTemplate",
          Frame "BACKDROP" "ButtonBackdropTemplate" { BackdropBackground "MBE", }
          ControlPushedBackdrop "ButtonPushedBackdropTemplate",
          Frame "BACKDROP" "ButtonPushedBackdropTemplate" { BackdropBackground "MBP", }
          ControlDisabledBackdrop "ButtonDisabledBackdropTemplate",
          Frame "BACKDROP" "ButtonDisabledBackdropTemplate" { BackdropBackground "MBD", }
          ControlDisabledPushedBackdrop "ButtonDisabledPushedBackdropTemplate",
          Frame "BACKDROP" "ButtonDisabledPushedBackdropTemplate" { BackdropBackground "MBDP", }
        }
      }
    `);
    const btn = frames.find(f => f.name === 'MultiboardMinimizeButton')!;
    expect(btn).toBeTruthy();
    expect(btn.children).toHaveLength(0);
    // 四个模板 Frame 均不在扁平列表中
    const scrubbed = [
      'ButtonBackdropTemplate',
      'ButtonPushedBackdropTemplate',
      'ButtonDisabledBackdropTemplate',
      'ButtonDisabledPushedBackdropTemplate',
    ];
    for (const n of scrubbed) {
      expect(frames.find(f => f.name === n), `${n} should be detached`).toBeUndefined();
    }
  });
});
