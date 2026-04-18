/**
 * FDF TexCoord 守护测试
 *
 * 历史 bug: transformer 的 case 'texcoord' 是 stub (注释 "WC3 使用不同的系统"),
 * 直接 break — 但 SceneGraphManager.computeTexCoordOptions 是从 frame.texCoord
 * 读的, 所以官方 FDF 中 ConsoleUI / UpperButtonBar 等大量 Texture 子图采样
 * 全部无效, 表现为整张 BLP 大图被拉伸到 frame 上。
 *
 * 该测试覆盖:
 *   1) 顶层 `TexCoord l, r, t, b`
 *   2) 嵌套 `Texture { TexCoord ... }` 提升到父 frame
 *   3) 配合 SceneGraphManager 的 UV 公式 — repeatX/Y, offsetX/Y
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  return new FDFTransformer().transform(new FDFParser(new FDFLexer(src).tokenize()).parse());
}

describe('FDF TexCoord — 4-float UV sub-rect', () => {
  it('顶层 TexCoord 0, 1, 0, 0.125 (取自 ConsoleUI.fdf)', () => {
    const src = `Frame "BACKDROP" "B" {
      Width 0.1, Height 0.05,
      BackdropBackground "UI\\\\Console\\\\Human\\\\HumanUITile-InventoryCover.blp",
      TexCoord 0, 1, 0, 0.125,
    }`;
    const frame = parse(src)[0];
    expect(frame.texCoord).toEqual([0, 1, 0, 0.125]);
  });

  it('嵌套 Texture { TexCoord ... } 提升到父 frame', () => {
    // 取自 vendor 实际结构: Texture 子块带 File + AlphaMode + TexCoord
    const src = `Frame "BACKDROP" "B" {
      Width 0.1, Height 0.05,
      Texture "T" {
        File "UI\\\\Foo.blp",
        AlphaMode "ALPHAKEY",
        TexCoord 0.0, 0.6640625, 0.0, 0.171875,
      }
    }`;
    const frame = parse(src)[0];
    expect(frame.texture).toBe('UI\\Foo.blp');
    expect(frame.alphaMode).toBe('ALPHAKEY');
    expect(frame.texCoord).toEqual([0.0, 0.6640625, 0.0, 0.171875]);
  });

  it('UV 公式与 SceneGraphManager.computeTexCoordOptions 一致', () => {
    // 复刻渲染端公式 (避免重复 SceneGraphManager 的 Three.js 依赖):
    //   repeatX = right - left
    //   repeatY = bottom - top
    //   offsetX = left
    //   offsetY = 1 - bottom
    const src = `Frame "BACKDROP" "B" {
      Width 0.1, Height 0.05,
      TexCoord 0.25, 0.75, 0.1, 0.9,
    }`;
    const frame = parse(src)[0];
    const [l, r, t, b] = frame.texCoord!;
    expect(r - l).toBeCloseTo(0.5);
    expect(b - t).toBeCloseTo(0.8);
    expect(l).toBeCloseTo(0.25);
    expect(1 - b).toBeCloseTo(0.1);
  });

  it('退化矩形 (l==r 或 t==b) 仍可被解析, 不抛错', () => {
    const src = `Frame "BACKDROP" "B" {
      Width 0.1, Height 0.05,
      TexCoord 0.5, 0.5, 0, 1,
    }`;
    expect(() => parse(src)).not.toThrow();
    expect(parse(src)[0].texCoord).toEqual([0.5, 0.5, 0, 1]);
  });
});
