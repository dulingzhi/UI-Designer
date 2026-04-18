/**
 * FDF Slider / EditCursor 守护测试
 *
 * 仍是同一类系统性遗漏 (types/index.ts 已声明字段, transformer 没 case).
 *   SliderInitialValue   14 vendor 处
 *   SliderMinValue       14
 *   SliderMaxValue       14
 *   SliderStepSize       14
 *   EditCursorColor       4
 */
import { describe, it, expect } from 'vitest';
import { FDFLexer } from '../../src/utils/fdfLexer';
import { FDFParser } from '../../src/utils/fdfParser';
import { FDFTransformer } from '../../src/utils/fdfTransformer';

function parse(src: string) {
  return new FDFTransformer().transform(new FDFParser(new FDFLexer(src).tokenize()).parse());
}

describe('FDF Slider 4-tuple', () => {
  it('SliderInitialValue / Min / Max / StepSize → 数值字段', () => {
    const src = `Frame "SLIDER" "S" {
      Width 0.1, Height 0.02,
      SliderInitialValue 0.5,
      SliderMinValue 0.0,
      SliderMaxValue 1.0,
      SliderStepSize 0.05,
    }`;
    const f = parse(src)[0];
    expect(f.sliderInitialValue).toBeCloseTo(0.5);
    expect(f.minValue).toBeCloseTo(0.0);
    expect(f.maxValue).toBeCloseTo(1.0);
    expect(f.stepSize).toBeCloseTo(0.05);
  });

  it('整数也接受 (常见: SliderMaxValue 100)', () => {
    const src = `Frame "SLIDER" "S" {
      Width 0.1, Height 0.02,
      SliderMinValue 0,
      SliderMaxValue 100,
      SliderStepSize 1,
    }`;
    const f = parse(src)[0];
    expect(f.minValue).toBe(0);
    expect(f.maxValue).toBe(100);
    expect(f.stepSize).toBe(1);
  });
});

describe('FDF EditCursorColor', () => {
  it('EditCursorColor 1.0 1.0 1.0 1.0 → [255,255,255,255] (与 FontColor 同协议)', () => {
    const src = `Frame "EDITBOX" "E" {
      Width 0.1, Height 0.02,
      EditCursorColor 1.0 1.0 1.0 1.0,
    }`;
    expect(parse(src)[0].editCursorColor).toEqual([255, 255, 255, 255]);
  });

  it('半透明蓝色: 0 0 1 0.5 → [0,0,255,128]', () => {
    const src = `Frame "EDITBOX" "E" {
      Width 0.1, Height 0.02,
      EditCursorColor 0.0 0.0 1.0 0.5,
    }`;
    expect(parse(src)[0].editCursorColor).toEqual([0, 0, 255, 128]);
  });
});
