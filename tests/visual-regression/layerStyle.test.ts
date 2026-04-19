import { describe, expect, it } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import { getFrameTypeColor } from '../../src/renderer/constants';
import { hasLayerStyleFlag, resolveMaterialBaseColor } from '../../src/renderer/layerStyle';

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'layer-style-test',
    name: 'LayerStyleTest',
    type: FrameType.MODEL,
    x: 0,
    y: 0,
    width: 0.1,
    height: 0.1,
    anchors: [],
    ...overrides,
  } as FrameData;
}

describe('layerStyle NOSHADING', () => {
  it('parses pipe-separated flags case-insensitively', () => {
    expect(hasLayerStyleFlag('noshading|IGNORETRACKEVENTS', 'NOSHADING')).toBe(true);
  });

  it('textured NOSHADING frames bypass frame-type tinting', () => {
    const frame = mkFrame({ layerStyle: 'NOSHADING' });
    expect(resolveMaterialBaseColor(frame, true)).toEqual([1, 1, 1, 1]);
  });

  it('textured frames without NOSHADING keep frame-type tinting', () => {
    const frame = mkFrame();
    expect(resolveMaterialBaseColor(frame, true)).toEqual(getFrameTypeColor(FrameType.MODEL));
  });

  it('non-textured NOSHADING frames keep debug frame-type color', () => {
    const frame = mkFrame({ layerStyle: 'NOSHADING' });
    expect(resolveMaterialBaseColor(frame, false)).toEqual(getFrameTypeColor(FrameType.MODEL));
  });
});