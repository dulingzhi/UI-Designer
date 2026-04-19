import { describe, expect, it } from 'vitest';
import { resolveHighlightRenderMode } from '../../src/renderer/highlightType';

describe('resolveHighlightRenderMode', () => {
  it('defaults to FILETEXTURE when HighlightType is missing', () => {
    expect(resolveHighlightRenderMode(undefined)).toBe('FILETEXTURE');
  });

  it('resolves SHADE case-insensitively with surrounding spaces', () => {
    expect(resolveHighlightRenderMode('  shade  ')).toBe('SHADE');
  });

  it('keeps FILETEXTURE for explicit FILETEXTURE', () => {
    expect(resolveHighlightRenderMode('FILETEXTURE')).toBe('FILETEXTURE');
  });

  it('falls back to FILETEXTURE for unknown modes', () => {
    expect(resolveHighlightRenderMode('UNKNOWN_MODE')).toBe('FILETEXTURE');
  });
});
