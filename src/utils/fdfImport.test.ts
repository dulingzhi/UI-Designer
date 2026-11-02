import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  readTextFile: vi.fn(),
  readDir: vi.fn(),
  parseFDFToAST: vi.fn(),
  transform: vi.fn(),
  templateManager: { applyTemplate: vi.fn() },
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: mocks.readTextFile, readDir: mocks.readDir }));
vi.mock('./fdf', () => ({ parseFDFToAST: mocks.parseFDFToAST }));
vi.mock('./fdfTransformer', () => ({
  FDFTransformer: class { transform(ast: any) { return mocks.transform(ast); } },
}));
vi.mock('./fdfTemplates', () => ({ templateManager: mocks.templateManager }));

import {
  importFromFDFEnhanced,
  importFDFFolder,
  importFromFDFText,
  applyTemplateInheritance,
  applyTemplateInheritanceToAll,
} from './fdfImport';

function stringValue(v: string) { return { type: 'StringLiteral', value: v }; }
function numberValue(v: number) { return { type: 'NumberLiteral', value: v }; }
function identValue(n: string) { return { type: 'Identifier', name: n }; }
function arrayValue(el: any[]) { return { type: 'ArrayLiteral', elements: el }; }
function prop(name: string, value: any) { return { type: 'Property', name, value }; }

function frameDef(name: string, props: any[] = [], extra: any = {}) {
  return { type: 'FrameDefinition', name, properties: props, ...extra };
}

function makeFrame(id: string, name: string) {
  return { id, name, type: 1, x: 0, y: 0, width: 0, height: 0, z: 0, parentId: null, children: [], anchors: [] };
}

describe('importFromFDFEnhanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns [] when user cancels selection', async () => {
    mocks.open.mockResolvedValue(null);
    const res = await importFromFDFEnhanced();
    expect(res).toEqual([]);
    expect(mocks.open).toHaveBeenCalled();
  });

  it('imports a file and enhances frames with fdf metadata', async () => {
    mocks.open.mockResolvedValue('/some/file.fdf');
    mocks.readTextFile.mockResolvedValue('content');
    const ast = {
      type: 'Program',
      body: [
        frameDef('F', [
          prop('BackdropBackground', stringValue('bg.blp')),
          prop('BackdropEdgeFile', stringValue('edge.blp')),
          prop('BackdropCornerFlags', stringValue('UL')),
          prop('SetTexture', stringValue('tex.blp')),
          prop('SetTexCoord', arrayValue([numberValue(0), numberValue(1), numberValue(0), numberValue(1)])),
          prop('SetAlphaMode', identValue('BLEND')),
          prop('SetText', stringValue('hello')),
          prop('SetFont', stringValue('Font')),
          prop('SetFontSize', numberValue(2)),
          prop('SetFontFlags', arrayValue([identValue('FIXED')])),
          prop('CustomProp', numberValue(42)),
        ],
        ),
      ],
    };
    mocks.parseFDFToAST.mockReturnValue(ast);
    mocks.transform.mockReturnValue([makeFrame('f1', 'F')]);

    const frames = await importFromFDFEnhanced();
    expect(frames).toHaveLength(1);
    const f = frames[0];
    expect(f.fdfMetadata!.inherits).toBeUndefined();
    expect(f.fdfMetadata!.rawProperties.CustomProp).toBe(42);
    expect(f.fdfTexture).toEqual({ file: 'tex.blp', texCoord: [0, 1, 0, 1], alphaMode: 'BLEND' });
    expect(f.fdfString).toEqual({ content: 'hello', font: 'Font', fontSize: 2, fontFlags: ['FIXED'] });
    expect(f.fdfBackdrop).toEqual({ background: 'bg.blp', edgeFile: 'edge.blp', cornerFlags: 'UL' });
  });

  it('maps frame to ast body beyond first element', async () => {
    mocks.open.mockResolvedValue('/f.fdf');
    mocks.readTextFile.mockResolvedValue('c');
    const ast = {
      type: 'Program',
      body: [
        { type: 'TextureDefinition', name: 'Tex', properties: [] },
        frameDef('F', [prop('SetText', stringValue('x'))]),
      ],
    };
    mocks.parseFDFToAST.mockReturnValue(ast);
    mocks.transform.mockReturnValue([makeFrame('f1', 'F'), makeFrame('f2', 'Ignore')]);
    const frames = await importFromFDFEnhanced();
    // 旧实现用 body[index] 对齐：TextureDefinition 占据 body[0]，导致 frames[0] 错位跳过、
    // frames[1] 拿到 'F' 的属性——错位被当成了期望。真实语义：frames[i] 对应第 i 个
    // FrameDefinition（非 Frame 节点不占位），故 frames[0] 增强自 'F'，frames[1] 无对应原样返回。
    expect(frames[0].fdfMetadata!.rawProperties.SetText).toBe('x');
    expect(frames[1].fdfMetadata).toBeUndefined();
  });

  it('rethrows on failure', async () => {
    mocks.open.mockResolvedValue('/f.fdf');
    mocks.readTextFile.mockResolvedValue('c');
    mocks.parseFDFToAST.mockImplementation(() => { throw new Error('boom'); });
    await expect(importFromFDFEnhanced()).rejects.toThrow('boom');
  });
});

describe('importFDFFolder', () => {
  it('returns 0 when user cancels', async () => {
    mocks.open.mockResolvedValue(null);
    const res = await importFDFFolder();
    expect(res).toBe(0);
  });

  it('loads fdf template files from directory', async () => {
    mocks.open.mockResolvedValue('/dir');
    mocks.readDir.mockResolvedValue([
      { name: 'a.fdf', isFile: true },
      { name: 'b.fdf', isFile: true },
      { name: 'README.txt', isFile: true },
    ]);
    mocks.templateManager.applyTemplate.mockReturnValue({});
    // importFDFFolder calls templateManager.loadTemplatesFromFile for each
    // We need to stub that on the mocked templateManager:
    mocks.templateManager.loadTemplatesFromFile = vi.fn()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2);
    const res = await importFDFFolder();
    expect(res).toBe(5);
    expect(mocks.templateManager.loadTemplatesFromFile).toHaveBeenCalledTimes(2);
  });

  it('continues when an individual file fails to load', async () => {
    mocks.open.mockResolvedValue('/dir');
    mocks.readDir.mockResolvedValue([
      { name: 'a.fdf', isFile: true },
      { name: 'b.fdf', isFile: true },
    ]);
    mocks.templateManager.loadTemplatesFromFile = vi.fn()
      .mockRejectedValueOnce(new Error('bad'))
      .mockResolvedValueOnce(4);
    const res = await importFDFFolder();
    expect(res).toBe(4);
  });

  it('rethrows when readDir fails', async () => {
    mocks.open.mockResolvedValue('/dir');
    mocks.readDir.mockRejectedValue(new Error('nodir'));
    await expect(importFDFFolder()).rejects.toThrow('nodir');
  });
});

describe('importFromFDFText', () => {
  it('parses and enhances frames', () => {
    const ast = {
      type: 'Program',
      body: [frameDef('F', [prop('SetText', stringValue('hi')), prop('BackdropBackground', stringValue('b'))])],
    };
    mocks.parseFDFToAST.mockReturnValue(ast);
    mocks.transform.mockReturnValue([makeFrame('f1', 'F')]);
    const frames = importFromFDFText('whatever');
    expect(frames).toHaveLength(1);
    expect(frames[0].fdfMetadata!.rawProperties.SetText).toBe('hi');
    expect(frames[0].fdfBackdrop).toEqual({ background: 'b', edgeFile: undefined, cornerFlags: undefined });
  });

  it('leaves frame unchanged when ast node is not a frame definition', () => {
    const ast = { type: 'Program', body: [{ type: 'StringDefinition', name: 'S', properties: [] }] };
    mocks.parseFDFToAST.mockReturnValue(ast);
    mocks.transform.mockReturnValue([makeFrame('f1', 'S')]);
    const frames = importFromFDFText('x');
    expect(frames[0].fdfMetadata).toBeUndefined();
  });

  it('rethrows on parse failure', () => {
    mocks.parseFDFToAST.mockImplementation(() => { throw new Error('parse'); });
    expect(() => importFromFDFText('x')).toThrow('parse');
  });
});

describe('applyTemplateInheritance', () => {
  it('returns frame unchanged when no inherits', () => {
    const frame = makeFrame('f1', 'F');
    const out = applyTemplateInheritance(frame);
    expect(out).toBe(frame);
  });

  it('applies template from manager when inherits present', () => {
    const frame = { ...makeFrame('f1', 'F'), fdfMetadata: { inherits: 'Base' } };
    mocks.templateManager.applyTemplate.mockReturnValue({ ...frame, merged: true });
    const out = applyTemplateInheritance(frame);
    expect(mocks.templateManager.applyTemplate).toHaveBeenCalledWith(frame, 'Base');
    expect(out).toMatchObject({ merged: true });
  });
});

describe('applyTemplateInheritanceToAll', () => {
  it('maps all frames through applyTemplateInheritance', () => {
    const f1 = makeFrame('f1', 'F1');
    const f2 = { ...makeFrame('f2', 'F2'), fdfMetadata: { inherits: 'Base' } };
    mocks.templateManager.applyTemplate.mockImplementation((fr) => ({ ...fr, applied: true }));
    const out = applyTemplateInheritanceToAll([f1, f2]);
    expect(out[0]).toBe(f1);
    expect(out[1]).toMatchObject({ applied: true });
  });
});

describe('branch coverage for property extraction helpers', () => {
  function runText(props: any[]) {
    const ast = { type: 'Program', body: [frameDef('F', props)] };
    mocks.parseFDFToAST.mockReturnValue(ast);
    mocks.transform.mockReturnValue([makeFrame('f1', 'F')]);
    return importFromFDFText('x')[0];
  }

  it('extractPropertyValue: falsy value, unknown type, and null array element', () => {
    const f = runText([
      prop('NullVal', null),                        // !value -> null (line 159)
      prop('BoolProp', { type: 'BooleanLiteral', value: true }), // default branch line 171
      prop('ArrProp', arrayValue([null, numberValue(3)])),      // null element -> 159
    ]);
    expect(f.fdfMetadata!.rawProperties.NullVal).toBeNull();
    expect(f.fdfMetadata!.rawProperties.BoolProp).toBeNull();
    expect(f.fdfMetadata!.rawProperties.ArrProp).toEqual([null, 3]);
  });

  it('extractTextureData: invalid alpha mode and falsy file fields', () => {
    const f = runText([
      prop('SetAlphaMode', identValue('NOPE')),  // invalid -> undefined
      prop('SetTexture', numberValue(0)),        // falsy file -> ''
    ]);
    expect(f.fdfTexture).toEqual({ file: '', texCoord: undefined, alphaMode: undefined });
  });

  it('extractTextureData: texCoord invalid length and non-numeric', () => {
    const f = runText([
      prop('SetTexture', stringValue('t')),
      prop('SetTexCoord', arrayValue([numberValue(1), numberValue(2)])), // length != 4
      prop('SetAlphaMode', identValue('BLEND')),
    ]);
    expect(f.fdfTexture!.texCoord).toBeUndefined();
    expect(f.fdfTexture!.alphaMode).toBe('BLEND');

    const g = runText([
      prop('SetTexture', stringValue('t')),
      prop('SetTexCoord', arrayValue([stringValue('a'), numberValue(2), numberValue(3), numberValue(4)])),
    ]);
    expect(g.fdfTexture!.texCoord).toBeUndefined();
  });

  it('extractTextureData: no alphaMode, valid texCoord numeric passthrough', () => {
    const f = runText([
      prop('SetTexture', stringValue('t')),
      prop('SetTexCoord', arrayValue([stringValue('0.5'), numberValue(1), numberValue(0), numberValue(1)])),
    ]);
    expect(f.fdfTexture!.texCoord).toEqual([0.5, 1, 0, 1]);
    expect(f.fdfTexture!.alphaMode).toBeUndefined();
  });

  it('extractStringData: fontFlags as non-array string and absent fontFlags', () => {
    const f = runText([
      prop('SetText', stringValue('hi')),
      prop('SetFontFlags', stringValue('OUTLINED')), // string -> single-element array
    ]);
    expect(f.fdfString!.fontFlags).toEqual(['OUTLINED']);

    const g = runText([
      prop('SetText', stringValue('hi')),
      // fontFlags absent -> falsy branch
    ]);
    expect(g.fdfString!.fontFlags).toBeUndefined();
    expect(g.fdfString!.font).toBeUndefined();
    expect(g.fdfString!.fontSize).toBeUndefined();
  });

  it('extractStringData: falsy content and absent string -> undefined', () => {
    const f = runText([
      prop('SetText', numberValue(0)), // falsy content -> ''
      prop('SetFont', stringValue('F')),
      prop('SetFontSize', numberValue(0)), // falsy fontSize -> undefined
    ]);
    expect(f.fdfString).toEqual({ content: '', font: 'F', fontSize: undefined, fontFlags: undefined });

    // none of the string props present -> extractStringData returns undefined
    const g = runText([prop('OnlyOther', numberValue(1))]);
    expect(g.fdfString).toBeUndefined();
  });

  it('extractBackdropData: falsy cornerFlags and absent backdrop -> undefined', () => {
    const f = runText([
      prop('BackdropBackground', stringValue('b')),
      prop('BackdropCornerFlags', numberValue(0)), // falsy
    ]);
    expect(f.fdfBackdrop).toEqual({ background: 'b', edgeFile: undefined, cornerFlags: undefined });

    const g = runText([
      prop('Width', numberValue(5)),
    ]);
    expect(g.fdfBackdrop).toBeUndefined();

    // falsy background but edgeFile present -> covers false branch of background?
      const h = runText([
        prop('BackdropBackground', numberValue(0)), // falsy background
        prop('BackdropEdgeFile', stringValue('edge')),
      ]);
      expect(h.fdfBackdrop).toEqual({ background: undefined, edgeFile: 'edge', cornerFlags: undefined });
  });

  it('extractTextureData: absent texture -> undefined', () => {
    const f = runText([prop('Width', numberValue(5))]);
    expect(f.fdfTexture).toBeUndefined();
  });
});