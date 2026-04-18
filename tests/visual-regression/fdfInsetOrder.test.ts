/**
 * BackdropBackgroundInsets 字段顺序守护测试
 *
 * 不变量：FDF token 顺序 [a b c d] 必须一致地往返：
 *   parse  → frame.backdropBackgroundInsets = [a, b, c, d]
 *   export → "BackdropBackgroundInsets a b c d"
 *
 * hexrays sub_44D1A0 揭示 CBackdropFrame 内存布局是
 *   this[114]=R, this[115]=L, this[116]=B, this[117]=T
 * 但 parser 与 exporter 必须使用同一逻辑顺序（社区惯例：[L, T, R, B]），
 * 此测试只守护 parse↔export 的顺序一致性，不假设任一具体语义。
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';
import { exportToFDF } from '../../src/utils/fdfExport';

function parse(src: string) {
  const tokens = new FDFLexer(src).tokenize();
  const ast = new FDFParser(tokens).parse();
  return new FDFTransformer().transform(ast);
}

const SAMPLE = `Frame "BACKDROP" "TestBackdrop" {
    Width 0.1,
    Height 0.05,
    BackdropBackgroundInsets 0.001 0.002 0.003 0.004,
}
`;

describe('FDF round-trip — BackdropBackgroundInsets order invariant', () => {
  it('parse + export preserves token order [0.001 0.002 0.003 0.004]', () => {
    const frames = parse(SAMPLE);
    const frame = frames[0];
    expect(frame.backdropBackgroundInsets).toEqual([0.001, 0.002, 0.003, 0.004]);

    const out = exportToFDF([frame]);
    // 任一 0.0NN 都必须按相同顺序出现在同一行
    const m = out.match(/BackdropBackgroundInsets\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBeCloseTo(0.001);
    expect(parseFloat(m![2])).toBeCloseTo(0.002);
    expect(parseFloat(m![3])).toBeCloseTo(0.003);
    expect(parseFloat(m![4])).toBeCloseTo(0.004);
  });

  it('single value expands to all 4 (1, 1, 1, 1)', () => {
    const src = `Frame "BACKDROP" "T" { Width 0.1, Height 0.05, BackdropBackgroundInsets 0.005, }`;
    const frame = parse(src)[0];
    expect(frame.backdropBackgroundInsets).toEqual([0.005, 0.005, 0.005, 0.005]);
  });
});
