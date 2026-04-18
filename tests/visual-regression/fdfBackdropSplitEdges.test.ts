/**
 * FDF Backdrop 5-way split-edge files 守护测试
 *
 * 历史 bug: vendor 中 HeavyBorder / LightBorder 模板把九宫格拆为
 *   BackdropCornerFile / BackdropTopFile / BackdropBottomFile /
 *   BackdropLeftFile  / BackdropRightFile
 * 五张独立 BLP (与 BackdropEdgeFile 单图二选一). transformer 全部丢弃,
 * 表现为这两个常用边框模板渲染为净色或缺纹理.
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  return new FDFTransformer().transform(new FDFParser(new FDFLexer(src).tokenize()).parse());
}

describe('FDF Backdrop split-edge files (5-way)', () => {
  it('HeavyBorder 模板形态 (vendor: TemplatesGlue.fdf)', () => {
    const src = `Frame "BACKDROP" "HeavyBorder" {
      Width 0.1, Height 0.05,
      BackdropCornerFile "UI\\\\Widgets\\\\HeavyBorderCorners.blp",
      BackdropTopFile    "UI\\\\Widgets\\\\HeavyBorderTop.blp",
      BackdropBottomFile "UI\\\\Widgets\\\\HeavyBorderBottom.blp",
      BackdropLeftFile   "UI\\\\Widgets\\\\HeavyBorderLeft.blp",
      BackdropRightFile  "UI\\\\Widgets\\\\HeavyBorderRight.blp",
    }`;
    const f = parse(src)[0];
    expect(f.backdropCornerFile).toBe('UI\\Widgets\\HeavyBorderCorners.blp');
    expect(f.backdropTopFile).toBe('UI\\Widgets\\HeavyBorderTop.blp');
    expect(f.backdropBottomFile).toBe('UI\\Widgets\\HeavyBorderBottom.blp');
    expect(f.backdropLeftFile).toBe('UI\\Widgets\\HeavyBorderLeft.blp');
    expect(f.backdropRightFile).toBe('UI\\Widgets\\HeavyBorderRight.blp');
  });

  it('单 BackdropEdgeFile 与拆分式互不影响', () => {
    // EdgeFile 单图模式仍工作
    const src = `Frame "BACKDROP" "B" {
      Width 0.1, Height 0.05,
      BackdropEdgeFile "UI\\\\Widgets\\\\Edge.blp",
    }`;
    const f = parse(src)[0];
    expect(f.backdropEdgeFile).toBe('UI\\Widgets\\Edge.blp');
    expect(f.backdropCornerFile).toBeUndefined();
  });
});
