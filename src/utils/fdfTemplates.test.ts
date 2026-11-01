import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  readTextFile: vi.fn(),
  parseFDFToAST: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: mocks.readTextFile,
}));

vi.mock('./fdf', () => ({
  parseFDFToAST: mocks.parseFDFToAST,
}));

import { FDFTemplateManager, templateManager } from './fdfTemplates';
import { FDFNodeType, FDFProperty, FDFFrameDefinition } from './fdfAst';

function prop(name: string, value: any): FDFProperty {
  return { type: FDFNodeType.PROPERTY, name, value };
}
function stringLit(v: string) { return { type: 'StringLiteral', value: v }; }
function numLit(v: number) { return { type: 'NumberLiteral', value: v }; }
function ident(n: string) { return { type: 'Identifier', name: n }; }
function boolLit(v: boolean) { return { type: 'BooleanLiteral', value: v }; }
function arrLit(elements: any[]) { return { type: 'ArrayLiteral', elements }; }
function frameDef(name: string, properties: any[] = [], extra: Partial<FDFFrameDefinition> = {}): FDFFrameDefinition {
  return {
    type: FDFNodeType.FRAME_DEFINITION,
    frameType: 'FRAME',
    name,
    properties,
    ...extra,
  } as FDFFrameDefinition;
}

describe('FDFTemplateManager', () => {
  let manager: FDFTemplateManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new FDFTemplateManager();
  });

  it('is instantiable and exports singleton', () => {
    expect(manager).toBeInstanceOf(FDFTemplateManager);
    expect(templateManager).toBeInstanceOf(FDFTemplateManager);
  });

  it('registers single/simple templates', () => {
    manager.registerTemplate('A', frameDef('A'));
    manager.registerTemplate('B', frameDef('B'));
    expect(manager.hasTemplate('A')).toBe(true);
    expect(manager.hasTemplate('Missing')).toBe(false);
    expect(manager.getTemplate('A')).toBeDefined();
    expect(manager.getTemplate('Missing')).toBeUndefined();
    expect(manager.getTemplateNames()).toEqual(['A', 'B']);
    expect(manager.getStats()).toEqual({ total: 2, names: ['A', 'B'] });
  });

  it('registers templates in batch', () => {
    const batch = new Map<string, FDFFrameDefinition>([
      ['X', frameDef('X')],
      ['Y', frameDef('Y')],
    ]);
    manager.registerTemplates(batch);
    expect(manager.hasTemplate('X')).toBe(true);
    expect(manager.hasTemplate('Y')).toBe(true);
  });

  it('clears all templates', () => {
    manager.registerTemplate('A', frameDef('A'));
    manager.clear();
    expect(manager.hasTemplate('A')).toBe(false);
    expect(manager.getStats().total).toBe(0);
  });

  describe('loadTemplatesFromText', () => {
    it('registers FrameDefinition nodes and returns count', () => {
      mocks.parseFDFToAST.mockReturnValue({
        type: 'Program',
        body: [
          frameDef('A', [prop('Width', numLit(1))]),
          { type: FDFNodeType.TEXTURE_DEFINITION, name: 'Tex', properties: [] },
          frameDef('B', []),
        ],
      });
      const count = manager.loadTemplatesFromText('ignored');
      expect(count).toBe(2);
      expect(manager.hasTemplate('A')).toBe(true);
      expect(manager.hasTemplate('B')).toBe(true);
      expect(manager.hasTemplate('Tex')).toBe(false);
    });

    it('rethrows parse errors', () => {
      mocks.parseFDFToAST.mockImplementation(() => { throw new Error('bad'); });
      expect(() => manager.loadTemplatesFromText('bad')).toThrow('bad');
    });
  });

  describe('loadTemplatesFromFile', () => {
    it('reads file and loads templates', async () => {
      mocks.readTextFile.mockResolvedValue('content');
      mocks.parseFDFToAST.mockReturnValue({ type: 'Program', body: [frameDef('A')] });
      const count = await manager.loadTemplatesFromFile('/tmp/x.fdf');
      expect(count).toBe(1);
      expect(mocks.readTextFile).toHaveBeenCalledWith('/tmp/x.fdf');
    });

    it('rethrows when file read fails', async () => {
      mocks.readTextFile.mockRejectedValue(new Error('nope'));
      await expect(manager.loadTemplatesFromFile('/nope.fdf')).rejects.toThrow('nope');
    });
  });

  describe('resolveInheritance', () => {
    it('returns null for unknown template', () => {
      expect(manager.resolveInheritance('Missing')).toBeNull();
    });

    it('returns null on inheritance cycle', () => {
      manager.registerTemplate('A', frameDef('A', [], { inherits: 'B' }));
      manager.registerTemplate('B', frameDef('B', [], { inherits: 'A' }));
      expect(manager.resolveInheritance('A')).toBeNull();
    });

    it('breaks chain when an ancestor template is missing but still returns merged chain', () => {
      manager.registerTemplate('A', frameDef('A', [prop('Width', numLit(10))], { inherits: 'Ghost' }));
      // 'A' resolves (inherits->Ghost missing), Ghost's getTemplate undefined -> break
      const res = manager.resolveInheritance('A');
      expect(res).not.toBeNull();
      expect(res!.name).toBe('A');
    });

    it('merges single template (no inherits)', () => {
      manager.registerTemplate('A', frameDef('A', [prop('Width', numLit(1))]));
      const res = manager.resolveInheritance('A');
      expect(res!.name).toBe('A');
      expect(res!.properties).toHaveLength(1);
    });

    it('merges multi-level inheritance with child overriding parent', () => {
      manager.registerTemplate('Base', frameDef('Base', [prop('Width', numLit(1))]));
      manager.registerTemplate('Child', frameDef('Child', [prop('Height', numLit(2))], { inherits: 'Base' }));
      const res = manager.resolveInheritance('Child');
      // order: Base's props first, then Child's
      expect(res!.properties.map(p => (p as FDFProperty).name)).toEqual(['Width', 'Height']);
    });
  });

  describe('applyTemplate', () => {
    it('returns frame unchanged if template cannot be resolved', () => {
      const frame = { id: 'f1', name: 'N' } as any;
      const out = manager.applyTemplate(frame, 'Missing');
      expect(out).toBe(frame);
    });

    it('merges raw properties, texture, string, backdrop when present', () => {
      const templateProps = [
        prop('SetTexture', stringLit('tex.blp')),
        prop('SetTexCoord', arrLit([numLit(0), numLit(1), numLit(0), numLit(1)])),
        prop('SetAlphaMode', ident('BLEND')),
        prop('SetText', stringLit('hello')),
        prop('SetFont', stringLit('Font')),
        prop('SetFontSize', numLit(2)),
        prop('SetFontFlags', arrLit([ident('FIXED'), stringLit('OUTLINE')])),
        prop('BackdropBackground', stringLit('bg.blp')),
        prop('BackdropEdgeFile', stringLit('edge.blp')),
        prop('BackdropCornerFlags', stringLit('UL|UR')),
        prop('BackdropCornerSize', numLit(3)),
        prop('BackdropTileBackground', ident('true')),
        prop('BackdropBackgroundSize', numLit(4)),
        prop('BackdropBackgroundInsets', arrLit([numLit(1), numLit(2), numLit(3), numLit(4)])),
        prop('BackdropBlendAll', ident('true')),
        prop('Unknown', numLit(9)),
      ];
      manager.registerTemplate('Tpl', frameDef('Tpl', templateProps));

      const baseFrame = { id: 'f1', name: 'N', fdfMetadata: { rawProperties: { existing: 1 } } } as any;
      const out = manager.applyTemplate(baseFrame, 'Tpl');

      expect(out.fdfMetadata.inherits).toBe('Tpl');
      expect(out.fdfMetadata.rawProperties.Unknown).toBe(9);
      // rawProperties is rebuilt from the template properties (existing keys dropped)
      expect(out.fdfMetadata.rawProperties.existing).toBeUndefined();
      expect(out.fdfTexture).toEqual({
        file: 'tex.blp',
        texCoord: [0, 1, 0, 1],
        alphaMode: 'BLEND',
      });
      expect(out.fdfString).toEqual({
        content: 'hello',
        font: 'Font',
        fontSize: 2,
        fontFlags: ['FIXED', 'OUTLINE'],
      });
      expect(out.fdfBackdrop).toEqual({
        background: 'bg.blp',
        edgeFile: 'edge.blp',
        cornerFlags: 'UL|UR',
        cornerSize: 3,
        tileBackground: true,
        backgroundSize: 4,
        backgroundInsets: [1, 2, 3, 4],
        blendAll: true,
      });
    });

    it('omits texture/string/backdrop when no matching properties exist', () => {
      manager.registerTemplate('Tpl', frameDef('Tpl', [prop('Width', numLit(1))]));
      const frame = { id: 'f1', name: 'N' } as any;
      const out = manager.applyTemplate(frame, 'Tpl');
      expect(out.fdfTexture).toBeUndefined();
      expect(out.fdfString).toBeUndefined();
      expect(out.fdfBackdrop).toBeUndefined();
      expect(out.fdfMetadata.rawProperties.Width).toBe(1);
    });

    it('handles invalid alpha mode, non-4 texCoord, implicit string/backdrop fallbacks', () => {
      const templateProps = [
        prop('SetTexture', stringLit('t2')),
        prop('SetTexCoord', arrLit([numLit(1), numLit(2)])),
        prop('SetAlphaMode', ident('NOPE')),
        // string all-empty -> still defined because content missing? no content/misc
        // backdrop partial
        prop('BackdropCornerFlags', stringLit('UL')),
        prop('SetFontFlags', ident('SINGLE')),
      ];
      manager.registerTemplate('Tpl', frameDef('Tpl', templateProps));
      const out = manager.applyTemplate({ id: 'f1', name: 'N' } as any, 'Tpl');
      expect(out.fdfTexture).toEqual({ file: 't2', texCoord: undefined, alphaMode: undefined });
      expect(out.fdfString).toEqual({
        content: '',
        font: undefined,
        fontSize: undefined,
        fontFlags: ['SINGLE'],
      });
      expect(out.fdfBackdrop).toEqual({
        background: undefined,
        edgeFile: undefined,
        cornerFlags: 'UL',
      });
    });

    it('covers remaining alpha modes, unknown value types, and non-4 backdrop insets', () => {
      const templateProps = [
        // alphaMode ALPHAKEY
        prop('SetTexture', stringLit('t3')),
        prop('SetAlphaMode', stringLit('ALPHAKEY')),
        // unknown value type hits module-level extractPropValue default branch
        prop('BackdropCornerFlags', { type: 'BooleanLiteral', value: true }),
        // backdrop corner/background present with number-typed insets not of length 4
        prop('BackdropBackground', stringLit('bg2')),
        prop('BackdropCornerSize', numLit(2)),
        prop('BackdropBackgroundInsets', arrLit([numLit(1), numLit(2)])),
        prop('BackdropEdgeFile', stringLit('e2')),
      ];
      manager.registerTemplate('Tpl', frameDef('Tpl', templateProps));
      const out = manager.applyTemplate({ id: 'f1', name: 'N' } as any, 'Tpl');
      expect(out.fdfTexture).toEqual({ file: 't3', alphaMode: 'ALPHAKEY' });
      expect(out.fdfTexture!.texCoord).toBeUndefined();
      // unknown value type -> extractPropValue returns null
      expect(out.fdfMetadata.rawProperties.BackdropCornerFlags).toBeNull();
      expect(out.fdfBackdrop).toEqual({
        background: 'bg2',
        edgeFile: 'e2',
        cornerFlags: undefined,
        cornerSize: 2,
        backgroundSize: undefined,
        backgroundInsets: undefined,
        tileBackground: undefined,
        blendAll: undefined,
      });
    });

    it('covers ADD alpha mode and empty-value string extraction', () => {
      const t: any = frameDef(
        'Tpl',
        [
          prop('SetAlphaMode', stringLit('ADD')),
          // SetText present but with empty string -> content becomes '' but string extracted
          prop('SetText', stringLit('')),
          prop('SetFont', stringLit('F')),
          prop('SetFontSize', numLit(0)),
        ],
      );
      manager.registerTemplate('Tpl', t);
      const out = manager.applyTemplate({ id: 'f1', name: 'N' } as any, 'Tpl');
      expect(out.fdfTexture).toEqual({ file: '', alphaMode: 'ADD' });
      expect(out.fdfString).toEqual({
        content: '',
        font: 'F',
        fontSize: undefined,
        fontFlags: undefined,
      });
    });

    it('covers array-with-null element and falsy alphaMode texture-only template', () => {
      const t: any = frameDef(
        'Tpl',
        [
          // SetTexture present, no SetAlphaMode -> line 267 falsy alphaMode branch
          prop('SetTexture', stringLit('onlytex')),
          // array containing null element -> extractPropValue(null) hits !value branch
          prop('SetFontFlags', arrLit([null, stringLit('X')])),
        ],
      );
      manager.registerTemplate('Tpl', t);
      const out = manager.applyTemplate({ id: 'f1', name: 'N' } as any, 'Tpl');
      expect(out.fdfTexture).toEqual({ file: 'onlytex', texCoord: undefined, alphaMode: undefined });
      expect(out.fdfString).toEqual({
        content: '',
        font: undefined,
        fontSize: undefined,
        fontFlags: ['null', 'X'],
      });
    });
  });

  describe('exportTemplates', () => {
    it('exports serialized templates preserving property categories', () => {
      const properties: any[] = [
        prop('Str', stringLit('v')),
        prop('Num', numLit(5)),
        prop('Id', ident('name')),
        prop('Arr', arrLit([stringLit('a'), numLit(1)])),
        prop('Bool', boolLit(true)),
        prop('NullVal', null),
        // non-Property entries ignored by serializeProperties
        { type: FDFNodeType.NESTED_FRAME, frameType: 'FRAME', properties: [] },
        prop('EmptyVal', undefined),
      ];
      manager.registerTemplate('Tpl', frameDef('Tpl', properties, { frameType: 'BACKDROP', inherits: 'Base' }));
      const exported = manager.exportTemplates();
      expect(exported['Tpl']).toMatchObject({
        name: 'Tpl',
        frameType: 'BACKDROP',
        inherits: 'Base',
      });
      expect(exported['Tpl'].properties).toEqual({
        Str: 'v',
        Num: 5,
        Id: 'name',
        Arr: ['a', 1],
        Bool: null,
        NullVal: null,
        EmptyVal: null,
      });
    });
  });
});