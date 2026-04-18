import { describe, expect, it } from 'vitest';
import {
  buildEditBoxBorderPositions,
  getEditBoxBorderInsetPx,
  normalizeEditBoxBorderColor,
} from '../../src/renderer/editBoxBorder';

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

  it('边框颜色兼容 0..255 输入', () => {
    expect(normalizeEditBoxBorderColor([51, 102, 153, 128])).toEqual({
      r: 0.2,
      g: 0.4,
      b: 0.6,
      a: 128 / 255,
    });
  });

  it('边框颜色兼容 0..1 输入与默认值', () => {
    expect(normalizeEditBoxBorderColor([0.2, 0.4, 0.6, 0.5])).toEqual({
      r: 0.2,
      g: 0.4,
      b: 0.6,
      a: 0.5,
    });
    expect(normalizeEditBoxBorderColor()).toEqual({ r: 0.6, g: 0.6, b: 0.6, a: 0.8 });
  });
});
