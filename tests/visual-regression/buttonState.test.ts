/**
 * buttonState — 状态解析器守护测试 (纯函数, 不依赖 Three.js)
 */
import { describe, it, expect } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import { resolveButtonState } from '../../src/renderer/buttonState';

function mkButton(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'b1',
    name: 'B',
    type: FrameType.BUTTON,
    x: 0, y: 0, width: 0.1, height: 0.05,
    controlBackdrop: 'normal.blp',
    controlPushedBackdrop: 'pushed.blp',
    controlDisabledBackdrop: 'disabled.blp',
    controlMouseOverHighlight: 'hover.blp',
    buttonPushedTextOffset: [-0.0015, -0.0015],
    fontHighlightColor: [255, 200, 0, 255],
    fontDisabledColor: [100, 100, 100, 255],
    menuTextHighlightColor: [0, 255, 255, 255],
    ...overrides,
  } as FrameData;
}

describe('resolveButtonState — 4 状态映射', () => {
  it('normal: 用 controlBackdrop, 无偏移, 无颜色覆盖', () => {
    const r = resolveButtonState(mkButton(), 'normal');
    expect(r.backdropPath).toBe('normal.blp');
    expect(r.textOffset).toEqual([0, 0]);
    expect(r.textColor).toBeUndefined();
    expect(r.highlightPath).toBeUndefined();
  });

  it('pushed: 切 PushedBackdrop + 应用 ButtonPushedTextOffset', () => {
    const r = resolveButtonState(mkButton(), 'pushed');
    expect(r.backdropPath).toBe('pushed.blp');
    expect(r.textOffset).toEqual([-0.0015, -0.0015]);
  });

  it('disabled: 切 DisabledBackdrop + fontDisabledColor, 无偏移', () => {
    const r = resolveButtonState(mkButton(), 'disabled');
    expect(r.backdropPath).toBe('disabled.blp');
    expect(r.textColor).toEqual([100, 100, 100, 255]);
    expect(r.textOffset).toEqual([0, 0]);
  });

  it('mouseover: 叠加 highlight 层 + 用 menuTextHighlightColor', () => {
    const r = resolveButtonState(mkButton(), 'mouseover');
    expect(r.backdropPath).toBe('normal.blp');
    expect(r.highlightPath).toBe('hover.blp');
    expect(r.textColor).toEqual([0, 255, 255, 255]);
  });

  it('mouseover: 缺 menuTextHighlightColor 时回退到 fontHighlightColor', () => {
    const r = resolveButtonState(mkButton({ menuTextHighlightColor: undefined }), 'mouseover');
    expect(r.textColor).toEqual([255, 200, 0, 255]);
  });
});

describe('resolveButtonState — 健壮回退', () => {
  it('pushed 但缺 PushedBackdrop 时保留 normal backdrop', () => {
    const r = resolveButtonState(mkButton({ controlPushedBackdrop: undefined }), 'pushed');
    expect(r.backdropPath).toBe('normal.blp');
    expect(r.textOffset).toEqual([-0.0015, -0.0015]); // textOffset 仍生效
  });

  it('disabled 但缺 DisabledBackdrop 时保留 normal', () => {
    const r = resolveButtonState(mkButton({ controlDisabledBackdrop: undefined }), 'disabled');
    expect(r.backdropPath).toBe('normal.blp');
  });

  it('缺 controlBackdrop 时回退到 backdropBackground', () => {
    const f = mkButton({ controlBackdrop: undefined, backdropBackground: 'bg.blp' });
    expect(resolveButtonState(f, 'normal').backdropPath).toBe('bg.blp');
  });

  it('完全缺失: backdropPath undefined, textOffset [0,0]', () => {
    const f = mkButton({
      controlBackdrop: undefined,
      controlPushedBackdrop: undefined,
      backdropBackground: undefined,
      buttonPushedTextOffset: undefined,
    });
    const r = resolveButtonState(f, 'pushed');
    expect(r.backdropPath).toBeUndefined();
    expect(r.textOffset).toEqual([0, 0]);
  });
});

describe('resolveButtonState — Checkbox 勾选态', () => {
  it('checked=true + state=normal → 强制视为 pushed', () => {
    const cb: FrameData = {
      ...mkButton(),
      type: FrameType.CHECKBOX,
      checked: true,
    };
    const r = resolveButtonState(cb, 'normal');
    expect(r.backdropPath).toBe('pushed.blp');
  });

  it('checked=false + state=normal → 保持 normal', () => {
    const cb: FrameData = {
      ...mkButton(),
      type: FrameType.CHECKBOX,
      checked: false,
    };
    const r = resolveButtonState(cb, 'normal');
    expect(r.backdropPath).toBe('normal.blp');
  });

  it('checked=true + state=disabled → disabled 优先级最高', () => {
    const cb: FrameData = {
      ...mkButton(),
      type: FrameType.CHECKBOX,
      checked: true,
    };
    expect(resolveButtonState(cb, 'disabled').backdropPath).toBe('disabled.blp');
  });
});
