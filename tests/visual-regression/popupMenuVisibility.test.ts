import { describe, expect, it } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import { isCollapsedPopupMenuChild } from '../../src/renderer/popupMenuVisibility';

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'frame',
    name: 'Frame',
    type: FrameType.FRAME,
    x: 0,
    y: 0,
    width: 0.1,
    height: 0.1,
    anchors: [],
    children: [],
    ...overrides,
  } as FrameData;
}

describe('popup menu collapsed child visibility', () => {
  it('PopupMenuFrame child is hidden by default under POPUPMENU parent', () => {
    const parent = mkFrame({ type: FrameType.POPUPMENU, popupMenuFrameRef: 'PopupMenuMenu' });
    const child = mkFrame({ type: FrameType.MENU, name: 'PopupMenuMenu' });
    expect(isCollapsedPopupMenuChild(parent, child)).toBe(true);
  });

  it('PopupTitleFrame child remains visible', () => {
    const parent = mkFrame({ type: FrameType.POPUPMENU, popupMenuFrameRef: 'PopupMenuMenu' });
    const child = mkFrame({ type: FrameType.TEXTBUTTON, name: 'PopupMenuTitle' });
    expect(isCollapsedPopupMenuChild(parent, child)).toBe(false);
  });

  it('PopupArrowFrame child remains visible', () => {
    const parent = mkFrame({ type: FrameType.POPUPMENU, popupMenuFrameRef: 'PopupMenuMenu' });
    const child = mkFrame({ type: FrameType.BUTTON, name: 'PopupMenuArrow' });
    expect(isCollapsedPopupMenuChild(parent, child)).toBe(false);
  });

  it('non-POPUPMENU parents do not collapse matching child names', () => {
    const parent = mkFrame({ type: FrameType.MENU, popupMenuFrameRef: 'PopupMenuMenu' });
    const child = mkFrame({ type: FrameType.MENU, name: 'PopupMenuMenu' });
    expect(isCollapsedPopupMenuChild(parent, child)).toBe(false);
  });
});