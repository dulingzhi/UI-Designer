/**
 * 导入往返守卫（第三组）：textColor 经 FDF 的 Text 内嵌颜色编码往返。
 *
 * 断链审计：属性面板可设 `textColor`（TextProperties 有绑定），但
 * FDF 导出（exportUtils）零引用、导入也不读——用户设的颜色在 FDF 链路丢失。
 *
 * WC3 语义：FDF 的 Text 属性用 |cffRRGGBB 前缀内嵌颜色（与 codeExport 的 JASS
 * 侧编码一致），无独立的 SetTextColor 模板属性。故：导出时把 textColor 编进 Text，
 * 导入时剥离还原为 text + textColor。
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
function prop(name: string, value: any) { return { type: 'Property', name, value }; }
function frameDef(name: string, props: any[] = []) {
  return { type: 'FrameDefinition', name, properties: props };
}
function makeFrame(id: string, name: string) {
  return { id, name, type: 4, x: 0, y: 0, width: 0.1, height: 0.1, z: 0, parentId: null, children: [], anchors: [] };
}

async function importWithProps(props: any[]) {
  const ast = { type: 'Program', body: [frameDef('T', props)] };
  mocks.parseFDFToAST.mockReturnValue(ast);
  mocks.transform.mockReturnValue([makeFrame('f1', 'T')]);
  return importFromFDFText('dummy');
}

describe('导入剥离 |cff 内嵌颜色 → text + textColor', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('|cffFF0000hello|r → text=hello, textColor=#FF0000', async () => {
    const frames = await importWithProps([prop('SetText', stringValue('|cffFF0000hello|r'))]);
    expect((frames[0] as any).text).toBe('hello');
    expect((frames[0] as any).textColor).toBe('#FF0000');
  });

  it('小写 |cff 前缀同样剥离', async () => {
    const frames = await importWithProps([prop('SetText', stringValue('|cff00ff00x|r'))]);
    expect((frames[0] as any).text).toBe('x');
    expect((frames[0] as any).textColor).toBe('#00ff00');
  });

  it('无颜色前缀的裸文本 → text 原样，textColor 不设置', async () => {
    const frames = await importWithProps([prop('SetText', stringValue('plain'))]);
    expect((frames[0] as any).text).toBe('plain');
    expect((frames[0] as any).textColor).toBeUndefined();
  });

  it('|cff 后无 |r 结尾（不完整）→ 不剥离，原样保留', async () => {
    const frames = await importWithProps([prop('SetText', stringValue('|cffFF0000hello'))]);
    expect((frames[0] as any).text).toBe('|cffFF0000hello');
    expect((frames[0] as any).textColor).toBeUndefined();
  });
});