/**
 * wasmMpq 单测（浏览器 MPQ 数据源）。
 *
 * 覆盖：档案查找（大小写不敏感）、句柄惰性打开与复用、三个 `MpqFns` 方法的
 * 成功/失败分支、`(listfile)` 缺失降级、运行时选择器。
 *
 * WASM 模块由 `loadWasmModule` 注入点替换为内存实现——真实 wasm 在 vitest
 * 下不可实例化（与 `wasmBridge.test.ts` 同一取舍），但**所有分派/降级逻辑真实执行**。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MpqFns } from './dataSource';

const mocks = vi.hoisted(() => ({
  loadWasmModule: vi.fn(),
  isBrowserRuntime: vi.fn(),
  pickFileBrowser: vi.fn(),
}));

vi.mock('./wasmBridge', () => ({ loadWasmModule: mocks.loadWasmModule }));
vi.mock('./platformBridge', () => ({
  isBrowserRuntime: mocks.isBrowserRuntime,
  pickFileBrowser: mocks.pickFileBrowser,
}));

import {
  __resetBrowserArchives,
  __setBrowserArchive,
  defaultMpqFns,
  listBrowserArchives,
  pickMpqArchives,
  wasmMpqFns,
} from './wasmMpq';

/** 造一个只会返回固定内容的最小 wasm 模块替身。 */
function fakeWasm(overrides: Record<string, unknown> = {}) {
  return {
    mpq_open: vi.fn(() => 7),
    mpq_read_file: vi.fn(() => new Uint8Array([1, 2, 3])),
    mpq_list: vi.fn(() => JSON.stringify(['a.fdf', 'b.blp'])),
    mpq_has_file: vi.fn(() => true),
    mpq_close: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  __resetBrowserArchives();
  mocks.loadWasmModule.mockReset();
  mocks.isBrowserRuntime.mockReset();
  mocks.pickFileBrowser.mockReset();
});

describe('档案登记', () => {
  it('__setBrowserArchive / listBrowserArchives', () => {
    __setBrowserArchive('War3.mpq', new Uint8Array([1]));
    __setBrowserArchive('War3x.mpq', new Uint8Array([2]));
    expect(listBrowserArchives().sort()).toEqual(['War3.mpq', 'War3x.mpq']);
  });

  it('__resetBrowserArchives 清空', () => {
    __setBrowserArchive('War3.mpq', new Uint8Array([1]));
    __resetBrowserArchives();
    expect(listBrowserArchives()).toEqual([]);
  });
});

describe('readFile', () => {
  it('命中档案 → 返回独立 ArrayBuffer（拷贝，不暴露 wasm 内存视图）', async () => {
    const mod = fakeWasm();
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));

    const buf = await wasmMpqFns.readFile('War3.mpq', 'UI\\a.fdf');
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(buf!))).toEqual([1, 2, 3]);
    expect(mod.mpq_read_file).toHaveBeenCalledWith(7, 'UI\\a.fdf');
  });

  it('档案名大小写不敏感', async () => {
    const mod = fakeWasm();
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));

    expect(await wasmMpqFns.readFile('WAR3.MPQ', 'a.fdf')).not.toBeNull();
    expect(mod.mpq_read_file).toHaveBeenCalled();
  });

  it('完整路径（MPQManager 的 join 结果）→ 按 basename 命中', async () => {
    const mod = fakeWasm();
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));

    const buf = await wasmMpqFns.readFile('E:\\GAMES\\WAR3\\War3.mpq', 'a.fdf');
    expect(buf).not.toBeNull();
    expect(mod.mpq_read_file).toHaveBeenCalled();
  });

  it('完整路径但 basename 未载入 → null', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.readFile('E:\\GAMES\\WAR3\\War3x.mpq', 'a.fdf')).toBeNull();
  });

  it('路径以分隔符结尾（basename 为空）→ null，不崩溃', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.readFile('E:\\GAMES\\WAR3\\', 'a.fdf')).toBeNull();
  });

  it('档案未载入 → null', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    expect(await wasmMpqFns.readFile('Nope.mpq', 'a.fdf')).toBeNull();
  });

  it('非浏览器（loadWasmModule 返回 null）→ null', async () => {
    mocks.loadWasmModule.mockResolvedValue(null);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.readFile('War3.mpq', 'a.fdf')).toBeNull();
  });

  it('WASM 读取抛错 → 降级为 null（不冒泡）', async () => {
    const mod = fakeWasm({
      mpq_read_file: vi.fn(() => {
        throw new Error('读取越界');
      }),
    });
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.readFile('War3.mpq', 'bad.fdf')).toBeNull();
  });

  it('句柄惰性打开且复用（多次读取只 open 一次）', async () => {
    const mod = fakeWasm();
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));

    await wasmMpqFns.readFile('War3.mpq', 'a.fdf');
    await wasmMpqFns.readFile('War3.mpq', 'b.fdf');
    expect(mod.mpq_open).toHaveBeenCalledTimes(1);
  });
});

describe('listFiles', () => {
  it('返回 name/size 结构', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    const files = await wasmMpqFns.listFiles('War3.mpq');
    expect(files).toEqual([
      { name: 'a.fdf', size: 0 },
      { name: 'b.blp', size: 0 },
    ]);
  });

  it('档案未载入 → 空列表', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    expect(await wasmMpqFns.listFiles('Nope.mpq')).toEqual([]);
  });

  it('非浏览器 → 空列表', async () => {
    mocks.loadWasmModule.mockResolvedValue(null);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.listFiles('War3.mpq')).toEqual([]);
  });

  it('(listfile) 缺失（JSON 解析失败）→ 空列表降级', async () => {
    const mod = fakeWasm({
      mpq_list: vi.fn(() => {
        throw new Error('文件不存在: (listfile)');
      }),
    });
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.listFiles('War3.mpq')).toEqual([]);
  });
});

describe('hasFile', () => {
  it('命中 → true', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.hasFile!('War3.mpq', 'a.fdf')).toBe(true);
  });

  it('档案未载入 → false', async () => {
    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    expect(await wasmMpqFns.hasFile!('Nope.mpq', 'a.fdf')).toBe(false);
  });

  it('非浏览器 → false', async () => {
    mocks.loadWasmModule.mockResolvedValue(null);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.hasFile!('War3.mpq', 'a.fdf')).toBe(false);
  });

  it('WASM 抛错 → false 降级', async () => {
    const mod = fakeWasm({
      mpq_has_file: vi.fn(() => {
        throw new Error('无效句柄');
      }),
    });
    mocks.loadWasmModule.mockResolvedValue(mod);
    __setBrowserArchive('War3.mpq', new Uint8Array([9]));
    expect(await wasmMpqFns.hasFile!('War3.mpq', 'a.fdf')).toBe(false);
  });
});

describe('pickMpqArchives', () => {
  it('无 document 环境 → 空数组（node）', async () => {
    // vitest 默认环境无 document
    expect(await pickMpqArchives()).toEqual([]);
    expect(mocks.pickFileBrowser).not.toHaveBeenCalled();
  });

  it('有 document 但用户取消 → 空数组', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickFileBrowser.mockResolvedValue(null);
      expect(await pickMpqArchives()).toEqual([]);
      expect(mocks.pickFileBrowser).toHaveBeenCalledWith('.mpq,.MPQ');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('选中文件 → 读入内存并登记，返回档案名', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      const file = { name: 'War3.mpq', arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer };
      mocks.pickFileBrowser.mockResolvedValue(file);
      const picked = await pickMpqArchives();
      expect(picked).toEqual(['War3.mpq']);
      expect(listBrowserArchives()).toEqual(['War3.mpq']);
      // 登记后可直接读取（句柄惰性打开）
      mocks.loadWasmModule.mockResolvedValue(fakeWasm());
      expect(await wasmMpqFns.readFile('War3.mpq', 'a.fdf')).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('defaultMpqFns', () => {
  const tauri: MpqFns = {
    readFile: async () => null,
    listFiles: async () => [],
  };

  it('浏览器运行时 → wasmMpqFns', () => {
    mocks.isBrowserRuntime.mockReturnValue(true);
    expect(defaultMpqFns(tauri)).toBe(wasmMpqFns);
  });

  it('桌面/测试 → 原 Tauri 实现（逐字节不变）', () => {
    mocks.isBrowserRuntime.mockReturnValue(false);
    expect(defaultMpqFns(tauri)).toBe(tauri);
  });
});
