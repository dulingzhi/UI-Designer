import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

const mocks = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  transform: vi.fn(),
  parse: vi.fn(),
  tokenize: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: mocks.existsSync,
  readFileSync: mocks.readFileSync,
}));

vi.mock('./fdfLexer', () => ({
  FDFLexer: class {
    constructor(public content: string) {}
    tokenize() { return mocks.tokenize(this.content); }
  },
}));

vi.mock('./fdfParser', () => ({
  FDFParser: class {
    constructor(public tokens: any) {}
    parse() { return mocks.parse(this.tokens); }
  },
}));

vi.mock('./fdfTransformer', () => ({
  FDFTransformer: class {
    constructor(public options: any) {}
    transform(ast: any) { return mocks.transform(this.options, ast); }
  },
}));

import { FDFIncludeResolver, parseFDFWithIncludes } from './fdfIncludeResolver';
import { FDFNodeType } from './fdfAst';

function makeFrame(name: string) {
  return { id: name, name, type: 1, width: 0, height: 0, fdfMetadata: {} };
}

function includeNode(p: string) {
  return { type: FDFNodeType.INCLUDE, path: p };
}

function endsWithFile(p: string, file: string) {
  const fw = file.replace(/\//g, '\\');
  return p.endsWith('/' + file) || p.endsWith('\\' + fw) || p.endsWith('\\' + file);
}

function setUpFlatLoad(file: string, frameName: string) {
  // existsSync matches the candidate that ends with the file
  mocks.existsSync.mockImplementation((p: string) => endsWithFile(p, file));
  mocks.tokenize.mockReturnValue([{ type: 'ID' }]);
  mocks.parse.mockReturnValue({ type: 'Program', body: [] });
  mocks.readFileSync.mockReturnValue('content');
  mocks.transform.mockReturnValue([makeFrame(frameName)]);
}

describe('FDFIncludeResolver', () => {
  let resolver: FDFIncludeResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new FDFIncludeResolver({ basePath: '/base', maxDepth: 3 });
  });

  it('constructs with defaults when no options', () => {
    const r = new FDFIncludeResolver();
    expect(r.getTemplateRegistry()).toBeInstanceOf(Map);
    expect(r.getTemplateRegistry().size).toBe(0);
  });

  it('resolveIncludes returns when depth >= maxDepth', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.existsSync.mockReturnValue(false);
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('a.fdf')] }, 3);
    expect(warn).toHaveBeenCalled();
    expect(mocks.existsSync).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resolveIncludes loads included files and registers template', () => {
    setUpFlatLoad('a.fdf', 'TemplateA');
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('a.fdf')] }, 0);
    const reg = resolver.getTemplateRegistry().get('TemplateA');
    expect(reg).toBeDefined();
    expect(reg.fdfMetadata.isTemplate).toBe(true);
    expect(reg.fdfMetadata.includeFile).toBe('a.fdf');
    expect(mocks.readFileSync).toHaveBeenCalled();
  });

  it('skips already-loaded files within same resolver (shared loadedFiles)', () => {
    const loaded = new Set<string>();
    loaded.add(path.join('/base', 'a.fdf'));
    resolver = new FDFIncludeResolver({ basePath: '/base', loadedFiles: loaded });
    mocks.existsSync.mockReturnValue(true);
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('a.fdf')] }, 0);
    expect(mocks.readFileSync).not.toHaveBeenCalled();
  });

  it('warns and skips when include file does not exist anywhere', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.existsSync.mockReturnValue(false);
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('ghost.fdf')] }, 0);
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('resolves include via second/vendor path when first missing', () => {
    // first candidate (base/a.fdf) missing, second (base/vendor/a.fdf) exists
    mocks.existsSync.mockImplementation((p: string) => endsWithFile(p, 'vendor/a.fdf'));
    const tokens = [{ type: 'ID' }];
    mocks.tokenize.mockReturnValue(tokens);
    mocks.parse.mockReturnValue({ type: 'Program', body: [] });
    mocks.readFileSync.mockReturnValue('c');
    mocks.transform.mockReturnValue([makeFrame('V')]);
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('a.fdf')] }, 0);
    const reg = resolver.getTemplateRegistry().get('V');
    expect(reg).toBeDefined();
    expect(mocks.readFileSync).toHaveBeenCalledWith(expect.stringContaining('vendor'), 'utf-8');
  });

  it('resolves include via third/target vendor path when first two missing', () => {
    mocks.existsSync.mockImplementation((p: string) => endsWithFile(p, 'target/vendor/a.fdf'));
    mocks.tokenize.mockReturnValue([{ type: 'ID' }]);
    mocks.parse.mockReturnValue({ type: 'Program', body: [] });
    mocks.readFileSync.mockReturnValue('c');
    mocks.transform.mockReturnValue([makeFrame('T')]);
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('a.fdf')] }, 0);
    expect(resolver.getTemplateRegistry().has('T')).toBe(true);
    expect(mocks.readFileSync).toHaveBeenCalledWith(
      expect.stringMatching(/(target[/\\]vendor\/?a\.fdf|a\.fdf)$/),
      'utf-8'
    );
  });

  it('falls back to first path when none exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.existsSync.mockReturnValue(false);
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('none.fdf')] }, 0);
    expect(mocks.readFileSync).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('normalizes backslash include paths to forward slash', () => {
    setUpFlatLoad('UI/FrameDef/a.fdf', 'NS');
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('UI\\FrameDef\\a.fdf')] }, 0);
    expect(resolver.getTemplateRegistry().get('NS').fdfMetadata.includeFile).toBe('UI/FrameDef/a.fdf');
  });

  it('recursively resolves nested includes (depth+1)', () => {
    mocks.existsSync.mockImplementation((p: string) => endsWithFile(p, 'a.fdf') || endsWithFile(p, 'b.fdf'));
    const tokensA = [{ type: 'A' }];
    const tokensB = [{ type: 'B' }];
    mocks.tokenize.mockImplementation((content: string) => (content === 'A' ? tokensA : tokensB));
    mocks.parse.mockImplementation((tokens: any) =>
      tokens === tokensA
        ? { type: 'Program', body: [includeNode('b.fdf')] }
        : { type: 'Program', body: [] }
    );
    mocks.readFileSync.mockImplementation((p: string) => (endsWithFile(p, 'a.fdf') ? 'A' : 'B'));
    mocks.transform.mockImplementation((opts: any, ast: any) =>
      ast.body.length > 0 ? [makeFrame('Frame_outer')] : [makeFrame('Frame_inner')]
    );

    resolver.resolveIncludes({ type: 'Program', body: [includeNode('a.fdf')] }, 0);
    expect(resolver.getTemplateRegistry().has('Frame_outer')).toBe(true);
    expect(resolver.getTemplateRegistry().has('Frame_inner')).toBe(true);
  });

  it('skips non-include nodes in resolveIncludes', () => {
    mocks.existsSync.mockReturnValue(false);
    resolver.resolveIncludes(
      { type: 'Program', body: [{ type: FDFNodeType.FRAME_DEFINITION, name: 'X', properties: [] }] },
      0
    );
    expect(mocks.existsSync).not.toHaveBeenCalled();
    expect(resolver.getTemplateRegistry().size).toBe(0);
  });

  it('catches and logs errors loading an include file', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.existsSync.mockReturnValue(true);
    mocks.tokenize.mockImplementation(() => { throw new Error('lexfail'); });
    resolver.resolveIncludes({ type: 'Program', body: [includeNode('bad.fdf')] }, 0);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('parseFDFWithIncludes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses existing template registry when provided and builds frames', () => {
    const existing = new Map<string, any>([['T', makeFrame('T')]]);
    mocks.tokenize.mockReturnValue([{ type: 'ID' }]);
    mocks.parse.mockReturnValue({ type: 'Program', body: [] });
    mocks.transform.mockReturnValue([makeFrame('Main')]);
    const res = parseFDFWithIncludes('main content', { existingTemplateRegistry: existing });
    expect(res.templateRegistry).toBe(existing);
    expect(res.frames).toHaveLength(1);
    expect(mocks.existsSync).not.toHaveBeenCalled();
    // transformer options: resolveInheritance true with provided registry
    expect(mocks.transform).toHaveBeenCalledWith(
      expect.objectContaining({ resolveInheritance: true, templateRegistry: existing }),
      expect.anything()
    );
  });

  it('parses includes and returns built registry when none provided', () => {
    mocks.existsSync.mockImplementation((p: string) => endsWithFile(p, 'prelude.fdf'));
    const mainTokens = [{ type: 'M' }];
    const incTokens = [{ type: 'I' }];
    mocks.tokenize.mockImplementation((c: string) => (c === 'main' ? mainTokens : incTokens));
    mocks.parse.mockImplementation((tokens: any) =>
      tokens === mainTokens
        ? { type: 'Program', body: [includeNode('prelude.fdf')] }
        : { type: 'Program', body: [] }
    );
    mocks.readFileSync.mockReturnValue('inccontent');
    mocks.transform.mockImplementation((opts: any, ast: any) =>
      ast.body.length > 0 ? [makeFrame('Main2')] : [makeFrame('IncTpl')]
    );
    const res = parseFDFWithIncludes('main', { basePath: '/base' });
    expect(res.templateRegistry.has('IncTpl')).toBe(true);
    expect(res.frames).toHaveLength(1);
  });
});