import { describe, expect, it } from 'vitest';
import { buildEditBoxBorderPositions, getEditBoxBorderInsetPx } from '../../src/renderer/editBoxBorder';

describe('editBoxBorder helper', () => {
  it('无 EditBorderSize 时边框贴合外框', () => {
    const pos = buildEditBoxBorderPositions(100, 40);
    expect(pos).toEqual([
      0, 0, 0.25, 100, 0, 0.25,
      100, 0, 0.25, 100, 40, 0.25,
      100, 40, 0.25, 0, 40, 0.25,
      0, 40, 0.25, 0, 0, 0.25,
    ]);
  });

  it('EditBorderSize 按 WC3 高度单位换算为像素内缩', () => {
    expect(getEditBoxBorderInsetPx(0.001)).toBeCloseTo(1.8, 4);
    const pos = buildEditBoxBorderPositions(100, 40, 0.001);
    expect(pos[0]).toBeCloseTo(1.8, 4);  // left
    expect(pos[1]).toBeCloseTo(1.8, 4);  // bottom
    expect(pos[3]).toBeCloseTo(98.2, 4); // right
    expect(pos[10]).toBeCloseTo(38.2, 4); // top
  });

  it('过大的 EditBorderSize 会被钳制，保留至少 1px 内部空间', () => {
    const pos = buildEditBoxBorderPositions(10, 6, 0.01);
    expect(pos[0]).toBeCloseTo(2.5, 4);
    expect(pos[1]).toBeCloseTo(2.5, 4);
    expect(pos[3]).toBeCloseTo(7.5, 4);
    expect(pos[10]).toBeCloseTo(3.5, 4);
  });
});
