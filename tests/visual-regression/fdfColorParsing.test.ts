/**
 * 3-component RGB color parsing regression tests
 *
 * Bug: FontColor / FontShadowColor / FontHighlightColor / FontDisabledColor
 * required value.length >= 4, silently dropping any 3-component (RGB, no alpha)
 * values like `FontColor 1.0 0.0 0.0,` found in vendor FDF files.
 *
 * Fix: accept length >= 3, defaulting alpha to 1.0 (fully opaque).
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  const tokens = new FDFLexer(src).tokenize();
  const ast = new FDFParser(tokens).parse();
  return new FDFTransformer().transform(ast);
}

describe('FDF 3-component RGB color parsing', () => {
  // ---- FontColor ----
  it('FontColor 4-component RGBA still works', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontColor 1.0 0.0 0.0 1.0,
    }`;
    const frame = parse(src)[0];
    // textColor should be a non-empty hex string
    expect(typeof frame.textColor).toBe('string');
    expect(frame.textColor).toBeTruthy();
  });

  it('FontColor 3-component RGB defaults alpha to 1.0 (was silently dropped)', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontColor 1.0 0.0 0.0,
    }`;
    const frame = parse(src)[0];
    // Previously frame.textColor would be undefined; now it should be set
    expect(frame.textColor).toBeTruthy();
  });

  it('FontColor 3-component and 4-component produce the same result when alpha=1', () => {
    const src3 = `Frame "TEXT" "T" { Width 0.1, Height 0.05, FontColor 0.5 0.8 0.2, }`;
    const src4 = `Frame "TEXT" "T" { Width 0.1, Height 0.05, FontColor 0.5 0.8 0.2 1.0, }`;
    const frame3 = parse(src3)[0];
    const frame4 = parse(src4)[0];
    expect(frame3.textColor).toBe(frame4.textColor);
  });

  // ---- FontShadowColor ----
  it('FontShadowColor 3-component RGB defaults alpha to 255 (fully opaque)', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontShadowColor 0.0 0.0 0.0,
    }`;
    const frame = parse(src)[0];
    // Was silently dropped; now should be [0, 0, 0, 255]
    expect(frame.fontShadowColor).toEqual([0, 0, 0, 255]);
  });

  it('FontShadowColor 4-component RGBA unchanged', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontShadowColor 0.0 0.0 0.0 0.9,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontShadowColor).toEqual([0, 0, 0, 230]); // round(0.9*255)=230
  });

  // ---- FontHighlightColor ----
  it('FontHighlightColor 3-component RGB defaults alpha to 255', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontHighlightColor 1.0 0.827 0.0,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontHighlightColor).toEqual([255, 211, 0, 255]); // round(0.827*255)=211
  });

  // ---- FontDisabledColor ----
  it('FontDisabledColor 3-component RGB defaults alpha to 255', () => {
    const src = `Frame "TEXT" "T" {
      Width 0.1, Height 0.05,
      FontDisabledColor 0.5 0.5 0.5,
    }`;
    const frame = parse(src)[0];
    expect(frame.fontDisabledColor).toEqual([128, 128, 128, 255]); // round(0.5*255)=128
  });
});
