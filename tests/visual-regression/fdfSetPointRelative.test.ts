import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

/**
 * 回归：SetPoint 5-参形式 (point, relativeTo, relativePoint, x, y) 解析
 *
 * 此前 fdfParser 的属性值循环使用「首字母大写 = 新属性名」启发式，
 * 会将 SetPoint 的第二个参数 relativePoint（如 TOPLEFT、CENTER 等）
 * 误判为新属性，导致只读取前两个值 (point, relativeTo)。applyAnchor
 * 在 values.length >= 3 检查下直接丢弃，整条 SetPoint 不产生任何锚点。
 *
 * 现已改为「PascalCase = 新属性；全大写 = 枚举值」，TOPLEFT/CENTER/SHADE
 * 等枚举值将作为值继续读入，保留完整 SetPoint 参数。
 *
 * vendor/UI/FrameDef/UI/MultiBoard.fdf 等大量依赖 sibling 相对 SetPoint 的
 * 官方 FDF 因此不再丢失子节点布局。
 */
function transform(src: string) {
  const tokens = new FDFLexer(src).tokenize();
  const ast = new FDFParser(tokens).parse();
  return new FDFTransformer().transform(ast);
}

describe('SetPoint parser: 5-arg relative SetPoint is preserved', () => {
  it('parses SetPoint with TOPRIGHT→sibling.TOPLEFT into anchor', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.1,
        Height 0.05,
        Frame "BACKDROP" "A" {
          Width 0.02, Height 0.02,
        }
        Frame "BACKDROP" "B" {
          SetPoint TOPRIGHT, "A", TOPLEFT, 0.005, 0.0,
          SetPoint BOTTOMRIGHT, "A", BOTTOMLEFT, 0.005, 0.0,
        }
      }
    `);
    const b = frames.find(f => f.name === 'B')!;
    expect(b).toBeTruthy();
    // 两个 SetPoint 都应产生锚点，且保留 relativePoint
    expect(b.anchors).toHaveLength(2);
    const topRight = b.anchors.find(a => a.point === 2)!;
    const bottomRight = b.anchors.find(a => a.point === 8)!;
    expect(topRight.relativePoint).toBe(0); // TOPLEFT
    expect(bottomRight.relativePoint).toBe(6); // BOTTOMLEFT
    // 相对偏移 x=0.005 (以像素/相对单位保存，不精确比较 toPixels 换算)
    expect(topRight.x).toBeGreaterThan(0);
    expect(bottomRight.x).toBeGreaterThan(0);
  });

  it('does not default to CENTER when sibling SetPoint is present', () => {
    const frames = transform(`
      Frame "FRAME" "Root" {
        Width 0.1, Height 0.05,
        Frame "BACKDROP" "A" { Width 0.02, Height 0.02, }
        Frame "TEXT" "Title" {
          SetPoint TOPLEFT,     "A", TOPLEFT,     0.0, 0.0,
          SetPoint BOTTOMRIGHT, "A", BOTTOMRIGHT, 0.0, 0.0,
        }
      }
    `);
    const title = frames.find(f => f.name === 'Title')!;
    // 不应退化为 1 个 CENTER 默认锚点
    expect(title.anchors).toHaveLength(2);
    expect(title.anchors.some(a => a.point === 4)).toBe(false);
    expect(title.anchors.some(a => a.point === 0)).toBe(true);
    expect(title.anchors.some(a => a.point === 8)).toBe(true);
  });

  it('still recognizes PascalCase property names as new properties', () => {
    // 保证 BackdropBackground / SetPoint 等大小写混合属性不会被当作值吞掉
    const frames = transform(`
      Frame "BACKDROP" "A" {
        BackdropBackground "tex1",
        BackdropCornerFlags "UL|UR",
      }
    `);
    const a = frames.find(f => f.name === 'A')!;
    expect(a.backdropBackground).toBe('tex1');
    expect(a.backdropCornerFlags).toBe('UL|UR');
  });
});
