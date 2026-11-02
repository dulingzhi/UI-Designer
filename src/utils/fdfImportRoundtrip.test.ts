/**
 * 导入→导出往返（round-trip）守卫：backdrop 九宫格与对齐字段。
 *
 * 背景：`fdfImport` 导入 FDF 时，backdrop 属性只进 `fdfMetadata.fdfBackdrop`（元数据），
 * **从不写入 `frame.backdrop*` 可编辑字段**。后果：
 *   导入带背景的 FDF → 属性面板显示空（用户以为丢了）→ 再导出 → 背景丢失。
 * 导出链路（exportUtils/codeExport）已支持全部字段，但导入读不回来，往返不闭合。
 *
 * 本文件锁定：导入时以下属性必须**同时**落到 FrameData 的可编辑字段：
 *   BackdropBackground / BackdropEdgeFile / BackdropCornerFile / BackdropTopFile /
 *   BackdropBottomFile / BackdropLeftFile / BackdropRightFile / BackdropCornerFlags /
 *   BackdropCornerSize / BackdropBackgroundSize / BackdropBackgroundInsets /
 *   BackdropTileBackground / BackdropBlendAll
 *   以及 FontJustificationH / FontJustificationV（导出侧刚加的对齐属性）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  readTextFile: vi.fn(),
  parseFDFToAST: vi.fn(),
  transform: vi.fn(),
  templateManager: { applyTemplate: vi.fn() },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: mocks.readTextFile }));
vi.mock('./fdf', () => ({ parseFDFToAST: mocks.parseFDFToAST }));
vi.mock('./fdfTransformer', () => ({
  FDFTransformer: class { transform(ast: any) { return mocks.transform(ast); } },
}));
vi.mock('./fdfTemplates', () => ({ templateManager: mocks.templateManager }));

import { importFromFDFText } from './fdfImport';

function stringValue(v: string) { return { type: 'StringLiteral', value: v }; }
function numberValue(v: number) { return { type: 'NumberLiteral', value: v }; }
function identValue(n: string) { return { type: 'Identifier', name: n }; }
function arrayValue(el: any[]) { return { type: 'ArrayLiteral', elements: el }; }
function prop(name: string, value: any) { return { type: 'Property', name, value }; }
function frameDef(name: string, props: any[] = []) {
  return { type: 'FrameDefinition', name, properties: props };
}
function makeFrame(id: string, name: string) {
  return { id, name, type: 2, x: 0, y: 0, width: 0.1, height: 0.1, z: 0, parentId: null, children: [], anchors: [] };
}

async function importWithProps(props: any[]) {
  const ast = { type: 'Program', body: [frameDef('Bd', props)] };
  mocks.parseFDFToAST.mockReturnValue(ast);
  mocks.transform.mockReturnValue([makeFrame('f1', 'Bd')]);
  return importFromFDFText('dummy fdf content', 'test.fdf');
}

describe('导入必须写回可编辑字段：九宫格纹理', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const textureCases: Array<[string, string, string]> = [
    ['BackdropBackground', 'backdropBackground', 'bg.blp'],
    ['BackdropEdgeFile', 'backdropEdgeFile', 'edge.blp'],
    ['BackdropCornerFile', 'backdropCornerFile', 'corner.blp'],
    ['BackdropTopFile', 'backdropTopFile', 'top.blp'],
    ['BackdropBottomFile', 'backdropBottomFile', 'bottom.blp'],
    ['BackdropLeftFile', 'backdropLeftFile', 'left.blp'],
    ['BackdropRightFile', 'backdropRightFile', 'right.blp'],
  ];
  for (const [fdfProp, frameField, val] of textureCases) {
    it(`${fdfProp} → frame.${frameField}`, async () => {
      const frames = await importWithProps([prop(fdfProp, stringValue(val))]);
      expect((frames[0] as any)[frameField], `${frameField} 未写回`).toBe(val);
    });
  }
});

describe('导入必须写回可编辑字段：尺寸/标志/混合', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('BackdropCornerFlags → backdropCornerFlags', async () => {
    const frames = await importWithProps([prop('BackdropCornerFlags', stringValue('UL|BR'))]);
    expect((frames[0] as any).backdropCornerFlags).toBe('UL|BR');
  });

  it('BackdropCornerSize → backdropCornerSize', async () => {
    const frames = await importWithProps([prop('BackdropCornerSize', numberValue(0.015))]);
    expect((frames[0] as any).backdropCornerSize).toBe(0.015);
  });

  it('BackdropBackgroundSize → backdropBackgroundSize', async () => {
    const frames = await importWithProps([prop('BackdropBackgroundSize', numberValue(0.05))]);
    expect((frames[0] as any).backdropBackgroundSize).toBe(0.05);
  });

  it('BackdropBackgroundInsets 四元组 → backdropBackgroundInsets', async () => {
    const frames = await importWithProps([
      prop('BackdropBackgroundInsets', arrayValue([
        numberValue(0.01), numberValue(0.02), numberValue(0.03), numberValue(0.04),
      ])),
    ]);
    expect((frames[0] as any).backdropBackgroundInsets).toEqual([0.01, 0.02, 0.03, 0.04]);
  });

  it('BackdropTileBackground TRUE → backdropTileBackground=true', async () => {
    const frames = await importWithProps([prop('BackdropTileBackground', identValue('TRUE'))]);
    expect((frames[0] as any).backdropTileBackground).toBe(true);
  });

  it('BackdropBlendAll TRUE → backdropBlendAll=true', async () => {
    const frames = await importWithProps([prop('BackdropBlendAll', identValue('TRUE'))]);
    expect((frames[0] as any).backdropBlendAll).toBe(true);
  });
});

describe('导入必须写回可编辑字段：文本对齐', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('FontJustificationH JUSTIFYRIGHT → horAlign=right', async () => {
    const frames = await importWithProps([prop('FontJustificationH', identValue('JUSTIFYRIGHT'))]);
    expect((frames[0] as any).horAlign).toBe('right');
  });

  it('FontJustificationV JUSTIFYMIDDLE → verAlign=center', async () => {
    const frames = await importWithProps([prop('FontJustificationV', identValue('JUSTIFYMIDDLE'))]);
    expect((frames[0] as any).verAlign).toBe('center');
  });
});

describe('导入写回可编辑字段：Control/Font 系', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const stringCases: Array<[string, string]> = [
    ['ControlBackdrop', 'controlBackdrop'],
    ['ControlPushedBackdrop', 'controlPushedBackdrop'],
    ['ControlDisabledBackdrop', 'controlDisabledBackdrop'],
    ['ControlMouseOverHighlight', 'controlMouseOverHighlight'],
    ['ControlStyle', 'controlStyle'],
    ['HighlightType', 'highlightType'],
    ['HighlightAlphaFile', 'highlightAlphaFile'],
    ['HighlightAlphaMode', 'highlightAlphaMode'],
  ];
  for (const [fdfProp, frameField] of stringCases) {
    it(`${fdfProp} → frame.${frameField}`, async () => {
      const frames = await importWithProps([prop(fdfProp, stringValue('X'))]);
      expect((frames[0] as any)[frameField], `${frameField} 未写回`).toBe('X');
    });
  }

  it('FontShadowColor 四数值 → fontShadowColor', async () => {
    const frames = await importWithProps([
      prop('FontShadowColor', arrayValue([numberValue(0), numberValue(0), numberValue(0), numberValue(0.9)])),
    ]);
    expect((frames[0] as any).fontShadowColor).toEqual([0, 0, 0, 0.9]);
  });

  it('FontShadowOffset 双数值 → fontShadowOffset', async () => {
    const frames = await importWithProps([
      prop('FontShadowOffset', arrayValue([numberValue(0.001), numberValue(-0.001)])),
    ]);
    expect((frames[0] as any).fontShadowOffset).toEqual([0.001, -0.001]);
  });

  it('ButtonPushedTextOffset 双数值 → buttonPushedTextOffset', async () => {
    const frames = await importWithProps([
      prop('ButtonPushedTextOffset', arrayValue([numberValue(-0.002), numberValue(-0.003)])),
    ]);
    expect((frames[0] as any).buttonPushedTextOffset).toEqual([-0.002, -0.003]);
  });

  it('EditCursorColor 三数值 → editCursorColor', async () => {
    const frames = await importWithProps([
      prop('EditCursorColor', arrayValue([numberValue(1), numberValue(0.5), numberValue(0)])),
    ]);
    expect((frames[0] as any).editCursorColor).toEqual([1, 0.5, 0]);
  });

  it('SliderMinValue/MaxValue → minValue/maxValue（0 值也如实写回）', async () => {
    const frames = await importWithProps([
      prop('SliderMinValue', numberValue(0)),
      prop('SliderMaxValue', numberValue(2)),
    ]);
    expect((frames[0] as any).minValue).toBe(0);
    expect((frames[0] as any).maxValue).toBe(2);
  });

  it('SliderInitialValue → sliderInitialValue', async () => {
    const frames = await importWithProps([prop('SliderInitialValue', numberValue(2))]);
    expect((frames[0] as any).sliderInitialValue).toBe(2);
  });

  it('SliderStepSize → stepSize', async () => {
    const frames = await importWithProps([prop('SliderStepSize', numberValue(1))]);
    expect((frames[0] as any).stepSize).toBe(1);
  });

  it('数值属性非法输入 → 不设置（不臆造）', async () => {
    const frames = await importWithProps([
      prop('FontShadowColor', stringValue('not an array')),
      prop('FontShadowOffset', arrayValue([numberValue(1)])), // 长度不足
    ]);
    expect((frames[0] as any).fontShadowColor).toBeUndefined();
    expect((frames[0] as any).fontShadowOffset).toBeUndefined();
  });

  it('元数据仍保留（rawProperties 不受影响）', async () => {
    const frames = await importWithProps([prop('ControlBackdrop', stringValue('Tpl'))]);
    expect((frames[0] as any).fdfMetadata.rawProperties.ControlBackdrop).toBe('Tpl');
  });
});

describe('不破坏既有元数据行为', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fdfBackdrop 元数据仍保留（既有测试依赖）', async () => {
    const frames = await importWithProps([
      prop('BackdropBackground', stringValue('bg.blp')),
      prop('BackdropEdgeFile', stringValue('edge.blp')),
      prop('BackdropCornerFlags', stringValue('UL')),
    ]);
    expect((frames[0] as any).fdfBackdrop).toEqual({
      background: 'bg.blp', edgeFile: 'edge.blp', cornerFlags: 'UL',
    });
  });
});
describe('防御分支：非法输入如实丢弃', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('BackdropTileBackground 非布尔值 → undefined（不臆造）', async () => {
    const frames = await importWithProps([prop('BackdropTileBackground', numberValue(5))]);
    expect((frames[0] as any).backdropTileBackground).toBeUndefined();
  });

  it('BackdropTileBackground 小写 false → false', async () => {
    const frames = await importWithProps([prop('BackdropTileBackground', identValue('false'))]);
    expect((frames[0] as any).backdropTileBackground).toBe(false);
  });

  it('BackdropBackgroundInsets 三元组 → undefined', async () => {
    const frames = await importWithProps([
      prop('BackdropBackgroundInsets', arrayValue([numberValue(1), numberValue(2), numberValue(3)])),
    ]);
    expect((frames[0] as any).backdropBackgroundInsets).toBeUndefined();
  });

  it('BackdropBackgroundInsets 含非数值 → undefined', async () => {
    const frames = await importWithProps([
      prop('BackdropBackgroundInsets', arrayValue([
        numberValue(1), numberValue(2), numberValue(3), stringValue('x'),
      ])),
    ]);
    expect((frames[0] as any).backdropBackgroundInsets).toBeUndefined();
  });

  it('BackdropBackgroundInsets 非数组 → undefined', async () => {
    const frames = await importWithProps([
      prop('BackdropBackgroundInsets', stringValue('not an array')),
    ]);
    expect((frames[0] as any).backdropBackgroundInsets).toBeUndefined();
  });
});
describe('parseFdfBool 大小写变体', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('小写 true → true', async () => {
    const frames = await importWithProps([prop('BackdropTileBackground', identValue('true'))]);
    expect((frames[0] as any).backdropTileBackground).toBe(true);
  });

  it('大写 FALSE → false', async () => {
    const frames = await importWithProps([prop('BackdropTileBackground', identValue('FALSE'))]);
    expect((frames[0] as any).backdropTileBackground).toBe(false);
  });
});
describe('对齐常量防御分支：未知 JUSTIFY 值不写回', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('未知 FontJustificationH → horAlign 不设置', async () => {
    const frames = await importWithProps([prop('FontJustificationH', identValue('JUSTIFYBOGUS'))]);
    expect((frames[0] as any).horAlign).toBeUndefined();
  });

  it('未知 FontJustificationV → verAlign 不设置', async () => {
    const frames = await importWithProps([prop('FontJustificationV', identValue('JUSTIFYBOGUS'))]);
    expect((frames[0] as any).verAlign).toBeUndefined();
  });
});