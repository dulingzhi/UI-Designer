import { describe, expect, it } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import {
  applyMaxLines,
  getDefaultTextVerticalMetricsPx,
  getTextInsetPx,
  getTextLineHeightPx,
  getTextOutlineWidthPx,
} from '../../src/renderer/textLayout';

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'ta1',
    name: 'TA',
    type: FrameType.TEXTAREA,
    x: 0,
    y: 0,
    width: 0.2,
    height: 0.1,
    z: 0,
    parentId: null,
    children: [],
    anchors: [],
    ...overrides,
  } as FrameData;
}

describe('textLayout metrics helpers', () => {
  it('默认 inset = 2px', () => {
    expect(getTextInsetPx(mkFrame())).toBe(2);
  });

  it('TextAreaInset 使用 WC3→px 换算', () => {
    expect(getTextInsetPx(mkFrame({ textAreaInset: 0.005 }))).toBeCloseTo(9, 4);
  });

  it('默认 lineHeight = baseFontSize * 1.2', () => {
    expect(getTextLineHeightPx(mkFrame(), 18)).toBeCloseTo(21.6, 4);
  });

  it('默认垂直度量优先用 Canvas 实测 ascent/descent', () => {
    expect(getDefaultTextVerticalMetricsPx(18, { actualBoundingBoxAscent: 13, actualBoundingBoxDescent: 4 }))
      .toEqual({ ascentPx: 13, descentPx: 4, lineHeightPx: 18 });
  });

  it('缺失实测 metrics 时回退到 0.8 / 0.2 比例', () => {
    expect(getDefaultTextVerticalMetricsPx(20)).toEqual({ ascentPx: 16, descentPx: 4, lineHeightPx: 21 });
  });

  it('TextAreaLineHeight + TextAreaLineGap 覆盖默认行高', () => {
    expect(getTextLineHeightPx(mkFrame({ textAreaLineHeight: 0.01, textAreaLineGap: 0.0015 }), 18))
      .toBeCloseTo(20.7, 4);
  });

  it('ChatDisplayLineHeight 优先于 TextAreaLineHeight', () => {
    expect(getTextLineHeightPx(mkFrame({ chatDisplayLineHeight: 0.01, textAreaLineHeight: 0.02, textAreaLineGap: 0.0015 }), 18))
      .toBeCloseTo(20.7, 4);
  });

  it('TextAreaMaxLines 裁剪行数', () => {
    expect(applyMaxLines(['a', 'b', 'c'], mkFrame({ textAreaMaxLines: 2 }))).toEqual(['a', 'b']);
  });

  it('未设置 TextAreaMaxLines 时保留所有行', () => {
    expect(applyMaxLines(['a', 'b', 'c'], mkFrame())).toEqual(['a', 'b', 'c']);
  });

  it('TextAreaMaxLines=0 返回空行集', () => {
    expect(applyMaxLines(['a', 'b'], mkFrame({ textAreaMaxLines: 0 }))).toEqual([]);
  });

  it('THICKOUTLINE 未设置时不描边', () => {
    expect(getTextOutlineWidthPx(mkFrame(), 20)).toBe(0);
  });

  it('THICKOUTLINE 使用字号比例并保底 1px', () => {
    expect(getTextOutlineWidthPx(mkFrame({ fontFlags: ['THICKOUTLINE'] }), 20)).toBe(2);
    expect(getTextOutlineWidthPx(mkFrame({ fontFlags: ['THICKOUTLINE'] }), 6)).toBe(1);
  });
});