export type HighlightRenderMode = 'FILETEXTURE' | 'SHADE';

export function resolveHighlightRenderMode(highlightType?: string): HighlightRenderMode {
  if (!highlightType) return 'FILETEXTURE';
  const normalized = highlightType.trim().toUpperCase();
  if (normalized === 'SHADE') return 'SHADE';
  return 'FILETEXTURE';
}
