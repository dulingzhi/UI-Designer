import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MdxModel } from './testMdxParser';

const coreMocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: coreMocks.invoke }));

import { testMdxParsing, testMdxBinaryParsing } from './testMdxParser';

function makeModel(): MdxModel {
  return {
    version: 800,
    name: 'Peasant',
    vertices: [{ x: 1, y: 2, z: 3 }],
    normals: [{ x: 0, y: 0, z: 1 }],
    uvs: [{ u: 0, v: 0 }],
    faces: [{ indices: [0, 1, 2] }],
    bounds: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 10, y: 10, z: 10 },
    },
  };
}

describe('testMdxParsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('performance', { now: () => 100 });
  });

  it('parses all three test cases and logs model details', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    coreMocks.invoke.mockResolvedValue(JSON.stringify(makeModel()));
    await testMdxParsing();
    expect(coreMocks.invoke).toHaveBeenCalledTimes(3);
    expect(coreMocks.invoke).toHaveBeenCalledWith('parse_mdx_from_mpq', {
      archivePath: 'war3.mpq',
      fileName: 'Units/Human/Peasant/Peasant.mdx',
    });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('顶点数: 1'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('面数: 1'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('- 第一个顶点:'));
    expect(log).toHaveBeenCalledWith(expect.stringContaining('- 第一个面:'));
    log.mockRestore();
  });

  it('skips first-vertex/first-face sampling when arrays are empty and logs parse errors', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const empty = { ...makeModel(), vertices: [], faces: [] };
    coreMocks.invoke.mockResolvedValue(JSON.stringify(empty));
    await testMdxParsing();
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('- 第一个顶点:'));
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('- 第一个面:'));
    log.mockRestore();
    err.mockRestore();
  });

  it('logs errors thrown by invoke and continues', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    coreMocks.invoke.mockRejectedValue(new Error('parse boom'));
    await testMdxParsing();
    expect(err).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('\n========== 测试完成 ==========');
    err.mockRestore();
    log.mockRestore();
  });
});

describe('testMdxBinaryParsing', () => {
  it('invokes parse_mdx_file with flattened bytes and returns model', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    coreMocks.invoke.mockResolvedValue(JSON.stringify(makeModel()));
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const model = await testMdxBinaryParsing(bytes);
    expect(model).toEqual(makeModel());
    expect(coreMocks.invoke).toHaveBeenCalledWith('parse_mdx_file', {
      mdxData: [1, 2, 3, 4],
    });
    expect(log).toHaveBeenCalledWith(`数据大小: 4 bytes`);
    log.mockRestore();
  });

  it('logs and rethrows parse errors', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    coreMocks.invoke.mockRejectedValue(new Error('bad bytes'));
    await expect(testMdxBinaryParsing(new Uint8Array([0]))).rejects.toThrow('bad bytes');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('window exposure block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('assigns test functions onto global window and logs when a browser-like env exists', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exposed: Record<string, unknown> = {};
    vi.stubGlobal('window', exposed);
    vi.resetModules();
    // Re-import the module now that `window` is defined so the
    // `if (typeof window !== 'undefined')` exposure block runs again.
    await import('./testMdxParser');
    expect(exposed.testMdxParsing).toBeTypeOf('function');
    expect(exposed.testMdxBinaryParsing).toBeTypeOf('function');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('MDX 测试函数已加载'));
    vi.unstubAllGlobals();
    log.mockRestore();
  });
});