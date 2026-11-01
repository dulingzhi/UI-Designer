import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FrameData } from '../types';

const fdfMocks = vi.hoisted(() => ({
  parseFDF: vi.fn(),
  exportFDF: vi.fn(),
  validateFDF: vi.fn(),
  formatFDF: vi.fn(),
}));

vi.mock('./fdf', () => fdfMocks);

import { testFDFParser } from './fdfTest';

function makeFrame(name: string, type: string): FrameData {
  return {
    id: name,
    name,
    type: 1,
    x: 0,
    y: 0,
    width: 0.256,
    height: 0.032,
    z: 0,
    children: [],
    tooltip: false,
    isRelative: false,
    anchors: [{ point: 0, x: 0, y: 0 }],
  };
}

describe('testFDFParser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs the full validation/parse/export/format pipeline and logs results', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const frames = [makeFrame('TestBackdrop', 'BACKDROP'), makeFrame('TestText', 'TEXT')];
    fdfMocks.validateFDF.mockReturnValue({ valid: true, errors: [], warnings: [] });
    fdfMocks.parseFDF.mockReturnValue(frames);
    fdfMocks.exportFDF.mockReturnValue('exported...');
    fdfMocks.formatFDF.mockReturnValue('formatted...');

    testFDFParser();

    expect(fdfMocks.validateFDF).toHaveBeenCalled();
    expect(fdfMocks.parseFDF).toHaveBeenCalled();
    expect(fdfMocks.exportFDF).toHaveBeenCalled();
    expect(fdfMocks.formatFDF).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('logs text and texture when present on frames', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const frames = [
      { ...makeFrame('Btn', 'BUTTON'), text: 'Label', texture: 'ui\\btn.blp' },
      { ...makeFrame('Blk', 'BACKDROP'), texture: 'ui\\bg.blp' },
    ] as FrameData[];
    fdfMocks.validateFDF.mockReturnValue({ valid: true, errors: [], warnings: [] });
    fdfMocks.parseFDF.mockReturnValue(frames);
    fdfMocks.exportFDF.mockReturnValue('out');
    fdfMocks.formatFDF.mockReturnValue('fmt');

    testFDFParser();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('logs the error and still finishes when a step throws', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    fdfMocks.validateFDF.mockReturnValue({ valid: true, errors: [], warnings: [] });
    fdfMocks.parseFDF.mockImplementation(() => {
      throw new Error('parse boom');
    });
    testFDFParser();
    expect(err).toHaveBeenCalledWith('  解析失败:', expect.any(Error));
    expect(log).toHaveBeenCalled(); // final completion line still printed
    err.mockRestore();
    log.mockRestore();
  });
});