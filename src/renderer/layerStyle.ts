import type { FrameData } from '../types';
import { getFrameTypeColor } from './constants';

export function hasLayerStyleFlag(layerStyle: string | undefined, flag: string): boolean {
  if (!layerStyle) return false;
  const expected = flag.trim().toUpperCase();
  return layerStyle
    .split('|')
    .map(part => part.trim().toUpperCase())
    .includes(expected);
}

export function resolveMaterialBaseColor(
  frame: FrameData,
  hasTexture: boolean,
): [number, number, number, number] {
  const baseColor = getFrameTypeColor(frame.type);

  // WC3 LayerStyle "NOSHADING" means the textured layer should render unshaded.
  // In our renderer that maps to bypassing frame-type tint multiplication.
  if (hasTexture && hasLayerStyleFlag(frame.layerStyle, 'NOSHADING')) {
    return [1, 1, 1, 1];
  }

  return baseColor;
}