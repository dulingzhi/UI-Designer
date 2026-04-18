/**
 * BackdropCornerFlags 解析守护测试
 *
 * 实际官方 FDF 中观察到的变体：
 *   - 完整 8 段:  "UL|UR|BL|BR|T|L|B|R"  (136 次, 主流)
 *   - 仅角:       "UL|UR|BL|BR"          (20 次)
 *   - 部分:       "BL|BR|B" / "UL|UR|T"  (各 1 次, 用于半边 backdrop)
 *
 * 这些变体直接控制 SceneGraphManager 创建几个 edge mesh，
 * 解析错误会导致整片边框丢失或偏移，故加守护。
 */
import { describe, it, expect } from 'vitest';
import { parseCornerFlags } from '../../src/utils/textureAtlas';

describe('parseCornerFlags — official FDF variants', () => {
  it('full 8-piece (most common in Blizzard FDFs)', () => {
    expect(parseCornerFlags('UL|UR|BL|BR|T|L|B|R'))
      .toEqual(['UL', 'UR', 'BL', 'BR', 'T', 'L', 'B', 'R']);
  });

  it('corners only', () => {
    expect(parseCornerFlags('UL|UR|BL|BR'))
      .toEqual(['UL', 'UR', 'BL', 'BR']);
  });

  it('partial bottom — "BL|BR|B"', () => {
    expect(parseCornerFlags('BL|BR|B')).toEqual(['BL', 'BR', 'B']);
  });

  it('partial top — "UL|UR|T"', () => {
    expect(parseCornerFlags('UL|UR|T')).toEqual(['UL', 'UR', 'T']);
  });

  it('empty string → []', () => {
    expect(parseCornerFlags('')).toEqual([]);
  });

  it('whitespace tolerated around segments', () => {
    expect(parseCornerFlags(' UL | T ')).toEqual(['UL', 'T']);
  });

  it('unknown tokens are filtered out (not thrown)', () => {
    expect(parseCornerFlags('UL|FOO|BAR|T')).toEqual(['UL', 'T']);
  });

  it('case-sensitive — lowercase is rejected (matches FDF convention)', () => {
    // FDF 全部使用大写 token，小写应当被丢弃以避免假阳性匹配。
    expect(parseCornerFlags('ul|ur|bl|br')).toEqual([]);
  });

  it('preserves order (renderer relies on iteration order for renderOrder)', () => {
    // 文档中顺序应当被保留以便 SceneGraphManager 的 corner-then-edge 渲染顺序成立
    expect(parseCornerFlags('T|UL|B|UR')).toEqual(['T', 'UL', 'B', 'UR']);
  });
});
