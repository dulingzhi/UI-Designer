/**
 * 导入往返守卫（第二组）：文本与纹理必须写回可编辑字段。
 *
 * 与 backdrop 同款断裂：`fdfImport` 把 SetText/SetTexture/SetTexCoord/SetAlphaMode
 * 只存进 `fdfMetadata`（rawProperties + fdfTexture/fdfString 元数据），
 * **从不写 `frame.text` / `frame.texture` / `frame.texCoord` / `frame.alphaMode`**。
 * 后果：导入带文本/纹理的 FDF → 属性面板显示空 → 再导出 → 内容丢失。
 *
 * 注：FDF 导出侧（exportUtils）的 Text 是裸文本（无 |cff 颜色前缀），直接映射即可；
 * textColor 的 FDF 属性名在导出侧不存在，故此处不加戏。
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
  const ast = { type: 'Program', body: [frameDef('F', props)] };
  mocks.parseFDFToAST.mockReturnValue(ast);
  mocks.transform.mockReturnValue([makeFrame('f1', 'F')]);
  return importFromFDFText('dummy fdf content');
}

describe('导入写回可编辑字段：文本', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('SetText → frame.text', async () => {
    const frames = await importWithProps([prop('SetText', stringValue('hello world'))]);
    expect((frames[0] as any).text).toBe('hello world');
  });

  it('SetText 空串 → 保留空串不臆造默认', async () => {
    const frames = await importWithProps([prop('SetText', stringValue(''))]);
    expect((frames[0] as any).text).toBe('');
  });
});

describe('导入写回可编辑字段：纹理', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('SetTexture → frame.texture', async () => {
    const frames = await importWithProps([prop('SetTexture', stringValue('UI\\X.blp'))]);
    expect((frames[0] as any).texture).toBe('UI\\X.blp');
  });

  it('SetTexCoord → frame.texCoord 四元组', async () => {
    const frames = await importWithProps([
      prop('SetTexCoord', arrayValue([numberValue(0.25), numberValue(0.5), numberValue(0.1), numberValue(0.9)])),
    ]);
    expect((frames[0] as any).texCoord).toEqual([0.25, 0.5, 0.1, 0.9]);
  });

  it('SetAlphaMode 合法值 → frame.alphaMode', async () => {
    const frames = await importWithProps([prop('SetAlphaMode', identValue('ALPHAKEY'))]);
    expect((frames[0] as any).alphaMode).toBe('ALPHAKEY');
  });

  it('SetAlphaMode 非法值 → alphaMode 不设置（不臆造）', async () => {
    const frames = await importWithProps([prop('SetAlphaMode', identValue('BOGUS'))]);
    expect((frames[0] as any).alphaMode).toBeUndefined();
  });

  it('SetTexCoord 非四元组 → texCoord 不设置', async () => {
    const frames = await importWithProps([
      prop('SetTexCoord', arrayValue([numberValue(1), numberValue(2)])),
    ]);
    expect((frames[0] as any).texCoord).toBeUndefined();
  });
});

describe('导入写回可编辑字段：按钮文本别名', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('ButtonText → frame.text（按钮帧无 SetText，文本以 ButtonText 承载）', async () => {
    const frames = await importWithProps([prop('ButtonText', stringValue('Click me'))]);
    expect((frames[0] as any).text).toBe('Click me');
  });

  it('ButtonText 含 |cff 颜色 → 剥离还原', async () => {
    const frames = await importWithProps([prop('ButtonText', stringValue('|cff00FF00OK|r'))]);
    expect((frames[0] as any).text).toBe('OK');
    expect((frames[0] as any).textColor).toBe('#00FF00');
  });

  it('EditTextFrame → frame.text（编辑框文本）', async () => {
    const frames = await importWithProps([prop('EditTextFrame', stringValue('input'))]);
    expect((frames[0] as any).text).toBe('input');
  });
});

describe('不破坏既有元数据行为', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('fdfTexture / fdfString 元数据仍保留（既有测试依赖）', async () => {
    const frames = await importWithProps([
      prop('SetTexture', stringValue('tex.blp')),
      prop('SetTexCoord', arrayValue([numberValue(0), numberValue(1), numberValue(0), numberValue(1)])),
      prop('SetAlphaMode', identValue('BLEND')),
      prop('SetText', stringValue('hi')),
      prop('SetFont', stringValue('Font')),
      prop('SetFontSize', numberValue(2)),
    ]);
    expect((frames[0] as any).fdfTexture).toEqual({
      file: 'tex.blp',
      texCoord: [0, 1, 0, 1],
      alphaMode: 'BLEND',
    });
    expect((frames[0] as any).fdfString).toBeDefined();
  });
});