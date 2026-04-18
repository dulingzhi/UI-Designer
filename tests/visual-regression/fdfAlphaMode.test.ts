/**
 * AlphaMode / DecorateFileNames 守护测试
 *
 * 历史 bug：transformer 对 AlphaMode 仅留了空 case ("暂不处理")，
 * 但 ShaderLib.parseAlphaMode 明确消费 frame.alphaMode 以设置 D3D 混合态
 * (ALPHAKEY → alphaTest, BLEND → Normal, ADD → AdditiveBlending)。
 * 结果所有 FDF (顶层 AlphaMode 与 Texture { AlphaMode } 嵌套块) 全部
 * 静默使用默认 BLEND。
 *
 * 修复：
 *   - 顶层 AlphaMode → frame.alphaMode (仅接受 ALPHAKEY | BLEND | ADD)
 *   - Texture { AlphaMode } 嵌套块同上 (与 File 一并提升到父 frame)
 *   - 顶层 DecorateFileNames → frame.decorateFileNames (布尔)
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

describe('FDF AlphaMode / DecorateFileNames', () => {
  it('顶层 AlphaMode "ALPHAKEY" → frame.alphaMode', () => {
    // 源自 target/vendor/UI/FrameDef 9 处 "AlphaMode \"ALPHAKEY\"" 之一。
    const src = `Frame "FRAME" "F" {
      Width 0.1, Height 0.05,
      AlphaMode "ALPHAKEY",
    }`;
    const frame = parse(src)[0];
    expect(frame.alphaMode).toBe('ALPHAKEY');
  });

  it('顶层 AlphaMode "ADD" 接受', () => {
    const src = `Frame "FRAME" "F" {
      Width 0.1, Height 0.05,
      AlphaMode "ADD",
    }`;
    expect(parse(src)[0].alphaMode).toBe('ADD');
  });

  it('大小写不敏感: AlphaMode "blend" → BLEND', () => {
    const src = `Frame "FRAME" "F" {
      Width 0.1, Height 0.05,
      AlphaMode "blend",
    }`;
    expect(parse(src)[0].alphaMode).toBe('BLEND');
  });

  it('非法 AlphaMode 值被忽略 (保持 undefined 让 ShaderLib 走默认)', () => {
    const src = `Frame "FRAME" "F" {
      Width 0.1, Height 0.05,
      AlphaMode "GARBAGE",
    }`;
    expect(parse(src)[0].alphaMode).toBeUndefined();
  });

  it('Texture { AlphaMode } 嵌套块也被提升到父 frame', () => {
    // 源自 ConsoleUI.fdf 的真实结构。
    const src = `Frame "FRAME" "F" {
      Width 0.1, Height 0.05,
      Texture {
        File "ConsoleTexture01",
        AlphaMode "ALPHAKEY",
      }
    }`;
    const frame = parse(src)[0];
    expect(frame.texture).toBe('ConsoleTexture01');
    expect(frame.alphaMode).toBe('ALPHAKEY');
  });

  it('DecorateFileNames 标志 (布尔) → frame.decorateFileNames', () => {
    const src = `Frame "FRAME" "F" {
      Width 0.1, Height 0.05,
      DecorateFileNames,
    }`;
    expect(parse(src)[0].decorateFileNames).toBe(true);
  });
});
