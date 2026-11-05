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
  pickDirectoryBrowser: vi.fn(),
}));

vi.mock('./wasmBridge', () => ({ loadWasmModule: mocks.loadWasmModule }));
vi.mock('./platformBridge', () => ({
  isBrowserRuntime: mocks.isBrowserRuntime,
  pickDirectoryBrowser: mocks.pickDirectoryBrowser,
}));

import {
  __resetBrowserArchives,
  __setBrowserArchive,
  browserDataSource,
  defaultMpqFns,
  listBrowserArchives,
  orderedBrowserArchives,
  pickMpqArchives,
  wasmMpqFns,
} from './wasmMpq';
import { LayeredDataSource } from './dataSource';

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
  mocks.pickDirectoryBrowser.mockReset();
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

describe('pickMpqArchives（目录选择）', () => {
  /** 造一个 File 替身：只需要 name + arrayBuffer。 */
  function mkFile(name: string, bytes = [4, 5, 6]): File {
    return {
      name,
      arrayBuffer: async () => new Uint8Array(bytes).buffer,
    } as unknown as File;
  }

  it('无 document 环境 → 空数组（node），且不调用目录选择', async () => {
    // vitest 默认环境无 document
    expect(await pickMpqArchives()).toEqual([]);
    expect(mocks.pickDirectoryBrowser).not.toHaveBeenCalled();
  });

  it('用户取消 → 空数组', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickDirectoryBrowser.mockResolvedValue(null);
      expect(await pickMpqArchives()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('目录为空（未选中任何文件）→ 空数组', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickDirectoryBrowser.mockResolvedValue([]);
      expect(await pickMpqArchives()).toEqual([]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('目录含标准 MPQ → 只载入这 4 个，忽略无关文件（大小写不敏感）', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickDirectoryBrowser.mockResolvedValue([
        mkFile('WAR3.MPQ'),
        mkFile('war3x.mpq'),
        mkFile('War3xLocal.mpq'),
        mkFile('war3patch.MPQ'),
        mkFile('war3.exe'),          // 无关
        mkFile('Data', [1]),          // 子目录（webkdirectory 会给目录项，但无扩展名）
        mkFile('readme.txt'),         // 无关
      ]);
      const picked = await pickMpqArchives();
      // 返回的是目录里的**原始文件名**
      expect(picked).toEqual(['WAR3.MPQ', 'war3x.mpq', 'War3xLocal.mpq', 'war3patch.MPQ']);
      expect(listBrowserArchives().length).toBe(4);
      // 无关文件未登记
      expect(listBrowserArchives()).not.toContain('war3.exe');
      expect(listBrowserArchives()).not.toContain('readme.txt');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('载入后可直接读取（句柄惰性打开）', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickDirectoryBrowser.mockResolvedValue([mkFile('War3.mpq')]);
      expect(await pickMpqArchives()).toEqual(['War3.mpq']);
      mocks.loadWasmModule.mockResolvedValue(fakeWasm());
      expect(await wasmMpqFns.readFile('War3.mpq', 'a.fdf')).not.toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('目录无标准名 → 回落载入全部 .mpq（避免"选了没反应"）', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickDirectoryBrowser.mockResolvedValue([
        mkFile('MyCustom.mpq'),
        mkFile('Backup.MPQ'),
        mkFile('war3.exe'),
      ]);
      expect(await pickMpqArchives()).toEqual(['MyCustom.mpq', 'Backup.MPQ']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('目录里一个 .mpq 都没有 → 空数组，不登记', async () => {
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    try {
      mocks.pickDirectoryBrowser.mockResolvedValue([mkFile('war3.exe'), mkFile('a.txt')]);
      expect(await pickMpqArchives()).toEqual([]);
      expect(listBrowserArchives()).toEqual([]);
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

describe('orderedBrowserArchives', () => {
  it('按标准优先级排序（War3 < War3x < War3xLocal < War3Patch）', () => {
    __setBrowserArchive('War3Patch.mpq', new Uint8Array([1]));
    __setBrowserArchive('War3.mpq', new Uint8Array([2]));
    __setBrowserArchive('War3x.mpq', new Uint8Array([3]));
    expect(orderedBrowserArchives()).toEqual(['War3.mpq', 'War3x.mpq', 'War3Patch.mpq']);
  });

  it('大小写不敏感地匹配标准名，并保留用户原始文件名', () => {
    __setBrowserArchive('war3.mpq', new Uint8Array([1]));
    __setBrowserArchive('WAR3X.MPQ', new Uint8Array([2]));
    expect(orderedBrowserArchives()).toEqual(['war3.mpq', 'WAR3X.MPQ']);
  });

  it('非标准命名的档案排在其后（按名字，结果确定）', () => {
    __setBrowserArchive('Zeta.mpq', new Uint8Array([1]));
    __setBrowserArchive('War3.mpq', new Uint8Array([2]));
    __setBrowserArchive('Alpha.mpq', new Uint8Array([3]));
    expect(orderedBrowserArchives()).toEqual(['War3.mpq', 'Alpha.mpq', 'Zeta.mpq']);
  });

  it('未载入任何档案 → 空数组', () => {
    expect(orderedBrowserArchives()).toEqual([]);
  });
});

describe('browserDataSource', () => {
  it('未载入档案 → 空层栈：exists=false / read=null / list=[]', async () => {
    const ds = browserDataSource();
    expect(await ds.exists('UI\\a.blp')).toBe(false);
    expect(await ds.read('UI\\a.blp')).toBeNull();
    expect(ds.list()).toEqual([]);
  });

  it('已载入档案 → 层栈按高优先在前，且读到内容', async () => {
    __setBrowserArchive('War3.mpq', new Uint8Array([1]));
    __setBrowserArchive('War3Patch.mpq', new Uint8Array([2]));
    const ds = browserDataSource() as LayeredDataSource;
    const labels = ds.layersList.map((l) => l.label);
    // War3Patch 优先级更高，应排在 index 0
    expect(labels).toEqual(['War3Patch.mpq', 'War3.mpq']);

    mocks.loadWasmModule.mockResolvedValue(fakeWasm());
    expect(await ds.read('a.fdf')).not.toBeNull();
  });

  it('高优先层命中时不再问低优先层（覆盖语义）', async () => {
    __setBrowserArchive('War3.mpq', new Uint8Array([1]));
    __setBrowserArchive('War3Patch.mpq', new Uint8Array([2]));
    const mod = fakeWasm();
    mocks.loadWasmModule.mockResolvedValue(mod);
    const ds = browserDataSource();
    await ds.read('a.fdf');
    // 首个命中即返回：只应打开一次句柄
    expect(mod.mpq_open).toHaveBeenCalledTimes(1);
  });
});
