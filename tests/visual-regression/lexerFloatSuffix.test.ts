/**
 * Lexer 守护测试: C 风格 float 后缀 'f' / 'F'
 *
 * 历史 bug: 官方 FDF 中
 *   ButtonPushedTextOffset -0.0015f -0.0015f,
 * 被错误 lex 成
 *   ID(ButtonPushedTextOffset) NUM(-0.0015) ID(f) NUM(-0.0015) ID(f) ,
 * 导致 parser 把孤立的 'f' 当成新属性，污染 frame 数据。
 *
 * 修复后: 'f'/'F' 紧跟数字且后面不是 [A-Za-z0-9_] 时被吞掉 (不改值)。
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer, TokenType } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function tokenize(src: string) {
  return new FDFLexer(src).tokenize().filter(t => t.type !== TokenType.EOF);
}

describe('FDF Lexer — C-style float "f" suffix', () => {
  it('-0.0015f → 单 NUMBER 令牌, 值 -0.0015 (无 trailing identifier)', () => {
    const toks = tokenize('-0.0015f');
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe(TokenType.NUMBER);
    expect(parseFloat(toks[0].value)).toBeCloseTo(-0.0015);
  });

  it('大写 F 同样被吞', () => {
    const toks = tokenize('1.5F');
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe(TokenType.NUMBER);
  });

  it('整数 + f (e.g. 0f) 也接受', () => {
    const toks = tokenize('0f');
    expect(toks).toHaveLength(1);
    expect(toks[0].type).toBe(TokenType.NUMBER);
  });

  it('"final" 标识符不被误吃 (后缀 f 后接字母不消费)', () => {
    // 数字应停在 1, 后跟独立标识符 'final' 而不是被切成 1f + inal
    const toks = tokenize('1 final');
    expect(toks).toHaveLength(2);
    expect(toks[0].type).toBe(TokenType.NUMBER);
    expect(toks[1].type).toBe(TokenType.IDENTIFIER);
    expect(toks[1].value).toBe('final');
  });

  it('修复 bug 复现: ButtonPushedTextOffset -0.0015f -0.0015f,', () => {
    const src = `Frame "BUTTON" "B" {
      Width 0.1, Height 0.05,
      ButtonPushedTextOffset -0.0015f -0.0015f,
    }`;
    const ast = new FDFParser(new FDFLexer(src).tokenize()).parse();
    // 确认没有伪造的 'f' 属性
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const propNames = (ast.body[0] as any).properties.map((p: any) => p.name);
    expect(propNames).not.toContain('f');
    expect(propNames).toContain('ButtonPushedTextOffset');
    // transformer 也能正常吞下
    const frame = new FDFTransformer().transform(ast)[0];
    expect(frame.name).toBe('B');
  });
});
