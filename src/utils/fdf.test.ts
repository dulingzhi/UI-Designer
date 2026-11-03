import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FrameData } from '../types';

const h = vi.hoisted(() => {
  return {
    lexerMocks: {
      FDFLexer: vi.fn(),
    },
    parserMocks: {
      FDFParser: vi.fn(),
    },
    transformerMocks: {
      FDFTransformer: vi.fn(),
    },
    exporterMocks: {
      FDFExporter: vi.fn(),
    },
    kernelMocks: {
      buildKernelLayoutFrameData: vi.fn(),
    },
  };
});

vi.mock('./fdfLexer', () => ({ FDFLexer: h.lexerMocks.FDFLexer }));
vi.mock('./fdfParser', () => ({ FDFParser: h.parserMocks.FDFParser }));
vi.mock('./fdfTransformer', () => ({
  FDFTransformer: h.transformerMocks.FDFTransformer,
}));
vi.mock('./fdfExporter', () => ({
  FDFExporter: h.exporterMocks.FDFExporter,
}));
vi.mock('./fdfKernelScene', () => ({
  buildKernelLayoutFrameData: h.kernelMocks.buildKernelLayoutFrameData,
}));

const { parseFDF, parseFDFToAST, exportFDF, validateFDF } = await import('./fdf');

const frames: FrameData[] = [
  {
    name: 'Frame1',
    type: 'Frame',
    pos: { x: 0, y: 0 },
    size: { w: 100, h: 50 },
    children: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  h.lexerMocks.FDFLexer.mockImplementation(function () {
    return { tokenize: vi.fn().mockReturnValue('tokens') };
  });
  h.parserMocks.FDFParser.mockImplementation(function () {
    return { parse: vi.fn().mockReturnValue('ast') };
  });
  h.transformerMocks.FDFTransformer.mockImplementation(function () {
    return { transform: vi.fn().mockReturnValue(frames) };
  });
  h.exporterMocks.FDFExporter.mockImplementation(function () {
    return { export: vi.fn().mockReturnValue('fdf text') };
  });
});

describe('parseFDF', () => {
  it('returns frames via the default transformer pipeline', () => {
    const res = parseFDF('SomeFrame');
    expect(res).toBe(frames);
    expect(h.lexerMocks.FDFLexer).toHaveBeenCalledWith('SomeFrame');
    expect(h.parserMocks.FDFParser).toHaveBeenCalledWith('tokens');
    expect(h.transformerMocks.FDFTransformer).toHaveBeenCalledWith(undefined);
    expect(h.kernelMocks.buildKernelLayoutFrameData).not.toHaveBeenCalled();
  });

  it('forwards transform options to the transformer', () => {
    parseFDF('X', { strict: true });
    expect(h.transformerMocks.FDFTransformer).toHaveBeenCalledWith({ strict: true });
  });

  it('uses kernel layout when useKernelLayout is set', () => {
    h.kernelMocks.buildKernelLayoutFrameData.mockReturnValue(frames);
    const res = parseFDF('SomeFrame', { useKernelLayout: true });
    expect(h.kernelMocks.buildKernelLayoutFrameData).toHaveBeenCalledWith('SomeFrame');
    expect(res).toBe(frames);
    expect(h.lexerMocks.FDFLexer).not.toHaveBeenCalled();
  });

  it('logs and rethrows parser errors', () => {
    const errObj = new Error('bad parse');
    h.parserMocks.FDFParser.mockImplementation(function () {
      throw errObj;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => parseFDF('Broken')).toThrow(errObj);
    expect(log).toHaveBeenCalledWith('FDF 解析错误:', errObj);
    log.mockRestore();
  });
});

describe('parseFDFToAST', () => {
  it('returns the parsed AST', () => {
    expect(parseFDFToAST('AstFrame')).toBe('ast');
    expect(h.parserMocks.FDFParser).toHaveBeenCalledWith('tokens');
  });

  it('logs and rethrows errors', () => {
    const errObj = new Error('ast boom');
    h.lexerMocks.FDFLexer.mockImplementation(function () {
      throw errObj;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => parseFDFToAST('X')).toThrow(errObj);
    expect(log).toHaveBeenCalledWith('FDF 解析错误:', errObj);
    log.mockRestore();
  });
});

describe('exportFDF', () => {
  it('returns exported text', () => {
    expect(exportFDF(frames)).toBe('fdf text');
    expect(h.exporterMocks.FDFExporter).toHaveBeenCalledWith(undefined);
  });

  it('forwards export options', () => {
    exportFDF(frames, { includePosition: true });
    expect(h.exporterMocks.FDFExporter).toHaveBeenCalledWith({ includePosition: true });
  });

  it('logs and rethrows export errors', () => {
    const errObj = new Error('export boom');
    h.exporterMocks.FDFExporter.mockImplementation(function () {
      throw errObj;
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => exportFDF(frames)).toThrow(errObj);
    expect(log).toHaveBeenCalledWith('FDF 导出错误:', errObj);
    log.mockRestore();
  });
});

describe('validateFDF', () => {
  it('returns valid when parsing succeeds', () => {
    const res = validateFDF('OKFrame');
    expect(res).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('returns invalid with the parse error message', () => {
    h.parserMocks.FDFParser.mockImplementation(function () {
      throw new Error('syntax at line 3');
    });
    const res = validateFDF('Bad');
    expect(res.valid).toBe(false);
    expect(res.errors).toEqual(['syntax at line 3']);
    expect(res.warnings).toEqual([]);
  });

  it('stringifies non-Error throwables', () => {
    h.parserMocks.FDFParser.mockImplementation(function () {
      // eslint-disable-next-line no-throw-literal
      throw 'a string failure';
    });
    const res = validateFDF('Weird');
    expect(res.valid).toBe(false);
    expect(res.errors).toEqual(['a string failure']);
  });
});


describe('决策项 A2：validateFDF warnings 通道', () => {
  it('引号成对的正常 FDF 无 warning', () => {
    const r = validateFDF('Frame "BUTTON" "B" {\n  Width 0.1,\n}');
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual([]);
  });

  it('奇数引号产生 warning（可能未闭合字符串）', () => {
    const r = validateFDF('Frame "BUTTON "B" {\n}');
    expect(r.warnings.length).toBeGreaterThan(0);
    expect(r.warnings[0]).toContain('奇数');
  });
});
