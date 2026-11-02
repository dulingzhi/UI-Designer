/**
 * FDF 导出守卫：Control/Highlight/Font 系属性（真实语法实证）。
 *
 * 审计：属性面板可编辑的 25 个字段在 FDF/JASS 导出中零引用。本轮按**真实 FDF 实证**
 * （war3.mpq 全量属性名扫描）接入把握明确的 13 个：
 *   ControlBackdrop / ControlPushedBackdrop / ControlDisabledBackdrop /
 *   ControlMouseOverHighlight / ControlStyle（引用模板名，竖线分隔标志）
 *   HighlightType / HighlightAlphaFile / HighlightAlphaMode
 *   FontHighlightColor / FontDisabledColor / FontShadowColor（四数值 0..1）
 *   FontShadowOffset / ButtonPushedTextOffset（双数值）
 * 真实语法样例：ControlBackdrop "模板名"、FontShadowColor 0.0 0.0 0.0 0.9。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameType, type ProjectData, type FrameData } from '../types';

const dialogMocks = vi.hoisted(() => ({ save: vi.fn() }));
const fsMocks = vi.hoisted(() => ({ writeTextFile: vi.fn(), writeFile: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: dialogMocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: fsMocks.writeTextFile, writeFile: fsMocks.writeFile }));
vi.mock('./fdfExporter', () => ({
  FDFExporterEnhanced: function FDFExporterEnhanced() {
    this.exportEnhanced = () => '';
  },
}));

import { exportToFDF } from './exportUtils';

function mkFrame(o: Partial<FrameData> & { id: string; name: string }): FrameData {
  return {
    type: FrameType.BUTTON, x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children: [], ...o,
  } as FrameData;
}
function proj(frames: FrameData[]): ProjectData {
  const rec: Record<string, FrameData> = {};
  for (const f of frames) rec[f.id] = f;
  return {
    version: 2, libraryName: 'Lib', originMode: 'gameui', exportVersion: 'reforged',
    hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
    hideButtonBar: false, hidePortrait: false, hideChat: false,
    appInterface: '', frames: rec,
    rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
  } as unknown as ProjectData;
}
async function content(frames: FrameData[]): Promise<string> {
  dialogMocks.save.mockResolvedValue('/out/x.fdf');
  fsMocks.writeTextFile.mockResolvedValue(undefined as never);
  await exportToFDF(proj(frames), false, () => {});
  return fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;
}

describe('Control 系（模板引用，真实语法）', () => {
  beforeEach(() => { fsMocks.writeTextFile.mockClear(); dialogMocks.save.mockClear(); });

  it('controlBackdrop → ControlBackdrop "模板名"', async () => {
    const f = mkFrame({ id: 'a', name: 'A', controlBackdrop: 'MyBackdropTemplate' });
    expect(await content([f])).toContain('ControlBackdrop "MyBackdropTemplate",');
  });

  it('controlPushedBackdrop → ControlPushedBackdrop', async () => {
    const f = mkFrame({ id: 'b', name: 'B', controlPushedBackdrop: 'PushedTpl' });
    expect(await content([f])).toContain('ControlPushedBackdrop "PushedTpl",');
  });

  it('controlDisabledBackdrop → ControlDisabledBackdrop', async () => {
    const f = mkFrame({ id: 'c', name: 'C', controlDisabledBackdrop: 'DisabledTpl' });
    expect(await content([f])).toContain('ControlDisabledBackdrop "DisabledTpl",');
  });

  it('controlMouseOverHighlight → ControlMouseOverHighlight', async () => {
    const f = mkFrame({ id: 'd', name: 'D', controlMouseOverHighlight: 'HoverTpl' });
    expect(await content([f])).toContain('ControlMouseOverHighlight "HoverTpl",');
  });

  it('controlStyle 竖线标志原样输出', async () => {
    const f = mkFrame({ id: 'e', name: 'E', controlStyle: 'AUTOTRACK|HIGHLIGHTONFOCUS' });
    expect(await content([f])).toContain('ControlStyle "AUTOTRACK|HIGHLIGHTONFOCUS",');
  });
});

describe('Highlight 系', () => {
  it('highlightType / highlightAlphaFile / highlightAlphaMode', async () => {
    const f = mkFrame({ id: 'h', name: 'H',
      highlightType: 'SHADE', highlightAlphaFile: 'UI\\X.blp', highlightAlphaMode: 'ADD' });
    const c = await content([f]);
    expect(c).toContain('HighlightType "SHADE",');
    expect(c).toContain('HighlightAlphaFile "UI\\X.blp",');
    expect(c).toContain('HighlightAlphaMode "ADD",');
  });
});

describe('Font 系（四数值 0..1，真实语法）', () => {
  it('fontShadowColor 四数值', async () => {
    const f = mkFrame({ id: 's', name: 'S', fontShadowColor: [0, 0, 0, 0.9] });
    expect(await content([f])).toContain('FontShadowColor 0 0 0 0.9,');
  });

  it('fontShadowOffset 双数值', async () => {
    const f = mkFrame({ id: 'o', name: 'O', fontShadowOffset: [0.001, -0.001] });
    expect(await content([f])).toContain('FontShadowOffset 0.001 -0.001,');
  });

  it('fontHighlightColor / fontDisabledColor 四数值', async () => {
    const f = mkFrame({ id: 'g', name: 'G',
      fontHighlightColor: [1, 1, 1, 1], fontDisabledColor: [0.2, 0.2, 0.2, 1] });
    const c = await content([f]);
    expect(c).toContain('FontHighlightColor 1 1 1 1,');
    expect(c).toContain('FontDisabledColor 0.2 0.2 0.2 1,');
  });
});

describe('按钮文本偏移', () => {
  it('buttonPushedTextOffset 双数值', async () => {
    const f = mkFrame({ id: 'p', name: 'P', buttonPushedTextOffset: [-0.002, -0.003] });
    expect(await content([f])).toContain('ButtonPushedTextOffset -0.002 -0.003,');
  });
});

describe('EditBox 系（真实语法实证）', () => {
  it('editCursorColor → EditCursorColor 三数值（真实语法无 alpha）', async () => {
    const f = mkFrame({ id: 'ec', name: 'EC', type: FrameType.EDITBOX, editCursorColor: [1, 0.5, 0, 1] });
    expect(await content([f])).toContain('EditCursorColor 1 0.5 0,');
  });

  it('editTextColor / editBorderColor：真实 FDF 无对应模板属性，不输出（不臆造）', async () => {
    const f = mkFrame({ id: 'et', name: 'ET', type: FrameType.EDITBOX,
      editTextColor: [1, 1, 1, 1], editBorderColor: [0, 0, 0, 1] });
    const c = await content([f]);
    expect(c).not.toContain('EditTextColor');
    expect(c).not.toContain('EditBorderColor');
  });
});

describe('SLIDER 系（真实语法实证：SliderMin/Max/InitialValue、SliderStepSize）', () => {
  it('slider 四字段全部导出', async () => {
    const f = mkFrame({ id: 'sl', name: 'Sl', type: FrameType.SLIDER,
      minValue: 0, maxValue: 2, sliderInitialValue: 2, stepSize: 1 });
    const c = await content([f]);
    expect(c).toContain('SliderMinValue 0,');
    expect(c).toContain('SliderMaxValue 2,');
    expect(c).toContain('SliderInitialValue 2,');
    expect(c).toContain('SliderStepSize 1,');
  });

  it('未设置时不输出 Slider 属性', async () => {
    const f = mkFrame({ id: 'sl2', name: 'Sl2', type: FrameType.SLIDER });
    const c = await content([f]);
    expect(c).not.toContain('SliderMinValue');
    expect(c).not.toContain('SliderStepSize');
  });
});

describe('模板引用型（与 ControlBackdrop 同款照实输出）', () => {
  it('sliderThumbButtonFrameRef → SliderThumbButtonFrame', async () => {
    const f = mkFrame({ id: 'r1', name: 'R1', type: FrameType.SLIDER,
      sliderThumbButtonFrameRef: 'MyThumbButton' });
    expect(await content([f])).toContain('SliderThumbButtonFrame "MyThumbButton",');
  });

  it('scrollBar 系 Inc/Dec 按钮', async () => {
    const f = mkFrame({ id: 'r2', name: 'R2', type: FrameType.SCROLLBAR,
      scrollBarIncButtonFrameRef: 'MyIncBtn', scrollBarDecButtonFrameRef: 'MyDecBtn' });
    const c = await content([f]);
    expect(c).toContain('ScrollBarIncButtonFrame "MyIncBtn",');
    expect(c).toContain('ScrollBarDecButtonFrame "MyDecBtn",');
  });

  it('未设置时不输出 Ref 属性', async () => {
    const f = mkFrame({ id: 'r3', name: 'R3', type: FrameType.SLIDER });
    const c = await content([f]);
    expect(c).not.toContain('SliderThumbButtonFrame');
  });
});

describe('未设置时不输出（不产生空属性）', () => {
  it('无 control/highlight/font 字段的帧不输出这些属性', async () => {
    const f = mkFrame({ id: 'n', name: 'N' });
    const c = await content([f]);
    expect(c).not.toContain('ControlBackdrop');
    expect(c).not.toContain('HighlightType');
    expect(c).not.toContain('FontShadowColor');
  });
});