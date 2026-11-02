/**
 * 导入往返守卫（第四组）：字号/字体经 FrameFont 往返。
 *
 * 断链（与 Text/SetText 同款）：exportUtils 导出 `FrameFont "MasterFont", size, ""`
 * （模板属性名），而 fdfImport 只查 `SetFont`/`SetFontSize`（运行时调用风格）——
 * 名字不匹配，textScale 在真实链路上无法往返。
 *
 * FrameFont 参数：[字体名, 字号, flags]。导入从第 2 参还原 textScale。
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
function arrayValue(el: any[]) { return { type: 'ArrayLiteral', elements: el }; }
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

describe('FrameFont 字号 → textScale', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('FrameFont ["MasterFont", 0.02, ""] → textScale=0.02', async () => {
    const frames = await importWithProps([
      prop('FrameFont', arrayValue([stringValue('MasterFont'), numberValue(0.02), stringValue('')])),
    ]);
    expect((frames[0] as any).textScale).toBe(0.02);
  });

  it('无 FrameFont → textScale 不设置', async () => {
    const frames = await importWithProps([prop('Width', numberValue(5))]);
    expect((frames[0] as any).textScale).toBeUndefined();
  });

  it('FrameFont 非数组或参数不足 → textScale 不设置（不臆造）', async () => {
    const frames = await importWithProps([
      prop('FrameFont', stringValue('MasterFont')),
    ]);
    expect((frames[0] as any).textScale).toBeUndefined();
  });

  it('FrameFont 字号非数值 → textScale 不设置', async () => {
    const frames = await importWithProps([
      prop('FrameFont', arrayValue([stringValue('MasterFont'), stringValue('big'), stringValue('')])),
    ]);
    expect((frames[0] as any).textScale).toBeUndefined();
  });

  it('SetFont/SetFontSize（运行时风格）仍然支持', async () => {
    const frames = await importWithProps([
      prop('SetFont', stringValue('Font')),
      prop('SetFontSize', numberValue(3)),
    ]);
    expect((frames[0] as any).textScale).toBe(3);
  });
});