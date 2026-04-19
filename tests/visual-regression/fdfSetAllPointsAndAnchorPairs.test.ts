import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

/**
 * 回归：
 *   1) SetPoint + SetAllPoints 共存时，SetAllPoints 作为保守后置行为被忽略，
 *      显式 SetPoint 生效。vendor/UI/FrameDef/UI/MultiBoard.fdf
 *      的 MultiboardTitleBackdrop 同时写了两条 SetPoint 与一条 SetAllPoints，
 *      若 SetAllPoints 覆盖会导致 Width 0.2f + sibling 锚点失效、缩退为
 *      父 Frame 0.024×0.024 填充。
 *   2) TR+BR（右侧边）和 BL+BR（下侧边）的锚点对在尺寸计算阶段亦应被识别：
 *      MultiboardTitleBackdrop 用 TOPRIGHT+BOTTOMRIGHT 锁定右边并通过
 *      Width 独立声明宽度；此前尺寸 fallback 到默认 0.1 高度与 0.2 位置偏差。
 */
function transform(src: string) {
  const tokens = new FDFLexer(src).tokenize();
  const ast = new FDFParser(tokens).parse();
  return new FDFTransformer().transform(ast);
}

describe('SetAllPoints does not overwrite explicit SetPoint anchors', () => {
  it('ignores SetAllPoints when the frame already has SetPoints', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.1, Height 0.05,
        Frame "BACKDROP" "Sibling" { Width 0.02, Height 0.02, }
        Frame "BACKDROP" "A" {
          Width 0.2,
          SetPoint TOPRIGHT,    "Sibling", TOPLEFT,    0.01, 0.0,
          SetPoint BOTTOMRIGHT, "Sibling", BOTTOMLEFT, 0.01, 0.0,
          SetAllPoints,
        }
      }
    `);
    const a = frames.find(f => f.name === 'A')!;
    // 只保留 2 个显式 SetPoint 锚点，SetAllPoints 的 TL+BR 未被注入
    expect(a.anchors).toHaveLength(2);
    expect(a.anchors.some(x => x.point === 2)).toBe(true); // TOPRIGHT
    expect(a.anchors.some(x => x.point === 8)).toBe(true); // BOTTOMRIGHT
    // Width 0.2 显式生效而不是被 SetAllPoints 压成 sibling 尺寸
    expect(a.width).toBeCloseTo(0.2, 3);
  });

  it('still injects SetAllPoints anchors when no prior SetPoint', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.1, Height 0.05,
        Frame "BACKDROP" "B" { SetAllPoints, }
      }
    `);
    const b = frames.find(f => f.name === 'B')!;
    expect(b.anchors).toHaveLength(2);
    expect(b.anchors.find(a => a.point === 0)).toBeDefined(); // TOPLEFT
    expect(b.anchors.find(a => a.point === 8)).toBeDefined(); // BOTTOMRIGHT
  });
});

describe('Anchor pair sizing: TR+BR (right-edge height) and BL+BR (bottom-edge width)', () => {
  it('computes height from TOPRIGHT+BOTTOMRIGHT anchors with explicit Width', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.1, Height 0.1,
        Frame "BACKDROP" "Anchor" {
          Width 0.02, Height 0.024,
        }
        Frame "BACKDROP" "Strip" {
          Width 0.2,
          SetPoint TOPRIGHT,    "Anchor", TOPLEFT,    0.006, 0.0,
          SetPoint BOTTOMRIGHT, "Anchor", BOTTOMLEFT, 0.006, 0.0,
        }
      }
    `);
    const strip = frames.find(f => f.name === 'Strip')!;
    expect(strip.width).toBeCloseTo(0.2, 3); // 来自显式 Width
    expect(strip.height).toBeCloseTo(0.024, 3); // 由 TR/BR 两点 y 差推出
    // 不应退化到默认 0.1
    expect(strip.height).not.toBeCloseTo(0.1, 3);
  });

  it('computes width from BOTTOMLEFT+BOTTOMRIGHT anchors with explicit Height', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.3, Height 0.1,
        Frame "BACKDROP" "Left"  { Width 0.02, Height 0.02, }
        Frame "BACKDROP" "Right" { Width 0.02, Height 0.02, }
        Frame "BACKDROP" "Bar" {
          Height 0.01,
          SetPoint BOTTOMLEFT,  "Left",  BOTTOMRIGHT, 0.0, 0.0,
          SetPoint BOTTOMRIGHT, "Right", BOTTOMLEFT,  0.0, 0.0,
        }
      }
    `);
    const bar = frames.find(f => f.name === 'Bar')!;
    expect(bar.height).toBeCloseTo(0.01, 3);
    // 宽度由 BL/BR 两点 x 差推出；非默认 0.1
    expect(bar.width).not.toBeCloseTo(0.1, 3);
    expect(bar.width).toBeGreaterThan(0);
  });
});
