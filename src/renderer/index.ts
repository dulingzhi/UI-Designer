// ============================================================
// renderer barrel export
// ============================================================

export { SceneGraphManager } from './SceneGraphManager';
export { TextureCache } from './TextureCache';
export { hitTest } from './hitTest';
export { createMaterial, updateMaterial } from './ShaderLib';
export type { FrameMaterial, MaterialTextureOptions } from './ShaderLib';
export { getFrameTypeColor, FRAME_TYPE_COLORS, DEFAULT_FRAME_COLOR, EGxMatAlphaOp, ALPHA_REF, EDGE_UV_STRIPS, CORNER_INSET_FACTOR_HORIZONTAL, EDGE_FLAGS, FILTER_MODES } from './constants';
export { snapToPixel, snapRectToPixels, snapTexCoordToPixels } from './pixelSnap';
export { renderTextTexture, disposeTextCache } from './textLayout';
