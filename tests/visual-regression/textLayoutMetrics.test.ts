import { describe, expect, it } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import {
  applyMaxLines,
  getBaseFontSizePx,
  getDefaultTextVerticalMetricsPx,
  getTextInsetPx,
  getTextRightInsetPx,
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

  it('MENU/POPUPMENU 使用 MenuBorder 作为文本 inset', () => {
    expect(getTextInsetPx(mkFrame({ type: FrameType.MENU, menuBorder: 0.009 }))).toBeCloseTo(16.2, 4);
    expect(getTextInsetPx(mkFrame({ type: FrameType.POPUPMENU, menuBorder: 0.01 }))).toBeCloseTo(18, 4);
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

  it('有 frame.fontSize 时优先使用 WC3 单位字号', () => {
    expect(getBaseFontSizePx(mkFrame({ fontSize: 0.01, textScale: 3, fontFlags: ['FIXEDSIZE'] })))
      .toBeCloseTo(18, 4);
  });

  it('无 frame.fontSize 时，FIXEDSIZE 固定回退字号为 14', () => {
    expect(getBaseFontSizePx(mkFrame({ textScale: 2, fontFlags: ['FIXEDSIZE'] }))).toBe(14);
    expect(getBaseFontSizePx(mkFrame({ fontFlags: ['FIXEDSIZE'] }))).toBe(14);
  });

  it('无 frame.fontSize 且非 FIXEDSIZE 时，回退字号跟随 textScale', () => {
    expect(getBaseFontSizePx(mkFrame({ textScale: 2 }))).toBe(28);
  });
});

describe('PopupButtonInset text right inset', () => {
  it('非 POPUPMENU 帧右侧 inset 与左侧对称 (getTextInsetPx)', () => {
    const frame = mkFrame({ type: FrameType.TEXT });
    expect(getTextRightInsetPx(frame)).toBe(getTextInsetPx(frame));
  });

  it('POPUPMENU 有 PopupButtonInset 时右侧 inset = 该值(px)', () => {
    // 典型值 0.01 → 18px (1800 px/WC3-unit)
    const frame = mkFrame({ type: FrameType.POPUPMENU, popupButtonInset: 0.01 });
    expect(getTextRightInsetPx(frame)).toBeCloseTo(18, 4);
  });

  it('POPUPMENU 无 PopupButtonInset 时右侧 inset 回退到 getTextInsetPx', () => {
    const frame = mkFrame({ type: FrameType.POPUPMENU });
    expect(getTextRightInsetPx(frame)).toBe(getTextInsetPx(frame));
  });

  it('POPUPMENU PopupButtonInset 独立于 MenuBorder 左侧 inset', () => {
    const frame = mkFrame({ type: FrameType.POPUPMENU, menuBorder: 0.009, popupButtonInset: 0.01 });
    expect(getTextInsetPx(frame)).toBeCloseTo(16.2, 4);   // 左侧
    expect(getTextRightInsetPx(frame)).toBeCloseTo(18, 4); // 右侧
  });
});