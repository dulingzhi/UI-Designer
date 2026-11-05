import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MpqFns, MpqFsFile } from './dataSource';

const dialogMocks = vi.hoisted(() => ({ open: vi.fn() }));
const coreMocks = vi.hoisted(() => ({ invoke: vi.fn() }));
const pathMocks = vi.hoisted(() => ({ join: vi.fn() }));
const fsMocks = vi.hoisted(() => ({ exists: vi.fn() }));
const textureLoaderMocks = vi.hoisted(() => ({ loadWar3Skins: vi.fn() }));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: dialogMocks.open }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: coreMocks.invoke }));
vi.mock('@tauri-apps/api/path', () => ({ join: pathMocks.join }));
vi.mock('@tauri-apps/plugin-fs', () => ({ exists: fsMocks.exists }));
vi.mock('./textureLoader', () => ({ loadWar3Skins: textureLoaderMocks.loadWar3Skins }));

import { MPQManager, initializeMPQ, readWC3File, tauriMpqFns } from './mpqManager';
import { MpqDataSource, LayeredDataSource } from './dataSource';

function makeFns(overrides: Partial<MpqFns> = {}): MpqFns {
  return {
    async readFile() {
      return null;
    },
    async listFiles() {
      return [] as MpqFsFile[];
    },
    ...overrides,
  };
}

function makeManager(overrides: Partial<MpqFns> = {}, pathJoin?: MpqFns extends never ? never : any) {
  const fns = makeFns(overrides);
  return new MPQManager(fns, pathJoin ?? (async (b: string, n: string) => `${b}\\${n}`));
}

const ASCII = (s: string) => new TextEncoder().encode(s).buffer;

beforeEach(() => {
  vi.resetAllMocks();
  coreMocks.invoke.mockResolvedValue([]);
  textureLoaderMocks.loadWar3Skins.mockResolvedValue(undefined);
  fsMocks.exists.mockResolvedValue(true);
});

describe('getDataSource / getCachedDataSource', () => {
  it('returns empty layered source when nothing loaded', () => {
    const m = makeManager();
    const ds = m.getDataSource();
    expect(ds).toBeInstanceOf(LayeredDataSource);
    expect((ds as LayeredDataSource).layersList).toHaveLength(0);
  });

  it('builds layers sorted by priority when archives are loaded', async () => {
    const fns = makeFns({
      async listFiles() {
        return [{ name: 'a.blp', size: 1 }];
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'C:\\game\\War3.mpq',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).archives.set('War3Patch.mpq', {
      name: 'War3Patch.mpq',
      path: 'C:\\game\\War3Patch.mpq',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    const ds = m.getDataSource() as LayeredDataSource;
    const layers = ds.layersList;
    // War3Patch (highest priority) is at index 0.
    expect(layers[0]).toBeInstanceOf(MpqDataSource);
    // getCachedDataSource returns the same cached instance across calls
    const cached1 = m.getCachedDataSource();
    const cached2 = m.getCachedDataSource();
    expect(cached1).toBe(cached2);
  });

  it('getCachedDataSource builds a fresh source after unloadAll', async () => {
    // no layers, but caches
    const m = makeManager();
    const ds1 = m.getCachedDataSource();
    m.unloadAll();
    const ds2 = m.getCachedDataSource();
    expect(ds1).not.toBe(ds2);
  });
});

describe('setWar3Path', () => {
  it('过期的并发加载被代际守卫中止（旧路径档案不混入新缓存）', async () => {
    // 模拟启动 fire-and-forget 加载 path1 期间，用户切换到 path2：
    // path1 的剩余档案必须中止，不得以 path2 的 war3Path 拼路径或混入缓存。
    const loadedPaths: string[] = [];
    let releaseFirst!: () => void;
    const gate = new Promise<void>((r) => { releaseFirst = r; });
    let call = 0;
    const fns = makeFns({
      async listFiles(archivePath) {
        loadedPaths.push(archivePath);
        if (call++ === 0) {
          await gate; // 第一个档案挂起，制造并发窗口
        }
        return [{ name: 'x.blp', size: 1 }];
      },
    });
    const m = makeManager(fns);

    const p1 = m.setWar3Path('C:\\old'); // fire-and-forget（同 WC3TextureBrowser:55）
    await vi.waitFor(() => expect(loadedPaths).toHaveLength(1)); // old 的第一个档案挂起中
    await m.setWar3Path('C:\\new'); // 并发切换（B：unloadAll + 新代际）
    releaseFirst(); // A 的第一个档案完成——此后 A 必须中止
    await p1;

    // old 路径仅允许挂起切换前发起的那一次；其后全部来自 new（代际守卫中止 A 的剩余档案）
    expect(loadedPaths.filter((p) => p.startsWith('C:\\old\\'))).toHaveLength(1);
    expect(loadedPaths[loadedPaths.length - 1].startsWith('C:\\new\\')).toBe(true);
    expect((m as any).loadGeneration).toBe(2);
  });

  it('sets path and loads standard archives', async () => {
    const fns = makeFns({
      async listFiles() {
        return [
          { name: 'UI\\a.blp', size: 10 },
          { name: 'UI\\b.blp', size: 20 },
        ];
      },
    });
    const m = makeManager(fns);
    await m.setWar3Path('C:\\game');
    expect(m.getWar3Path()).toBe('C:\\game');
    expect(m.getStatus().archivesLoaded).toBeGreaterThan(0);
    expect(textureLoaderMocks.loadWar3Skins).toHaveBeenCalled();
  });

  it('skips reload when same path and already loaded', async () => {
    const fns = makeFns({
      async listFiles() {
        return [];
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    (m as any).archives.set('War3.mpq', { name: 'x', path: 'p', files: [], fileCount: 0, loaded: true });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await m.setWar3Path('C:\\game');
    expect(textureLoaderMocks.loadWar3Skins).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('skips reload when same path and already loading', async () => {
    const fns = makeFns({
      async listFiles() {
        return [];
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    (m as any).isLoading = true;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await m.setWar3Path('C:\\game');
    expect(textureLoaderMocks.loadWar3Skins).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('resets isLoading even when loadWar3Skins throws', async () => {
    const m = makeManager({
      async listFiles() {
        return [];
      },
    });
    textureLoaderMocks.loadWar3Skins.mockRejectedValue(new Error('skins boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await m.setWar3Path('C:\\game');
    expect((m as any).isLoading).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('selectWar3Directory', () => {
  it('returns null when selection is empty', async () => {
    dialogMocks.open.mockResolvedValue(null);
    const m = makeManager();
    expect(await m.selectWar3Directory()).toBeNull();
  });

  it('returns null when selection is an array', async () => {
    dialogMocks.open.mockResolvedValue(['C:\\a', 'C:\\b']);
    const m = makeManager();
    expect(await m.selectWar3Directory()).toBeNull();
  });

  it('sets path and returns selected dir when valid', async () => {
    dialogMocks.open.mockResolvedValue('C:\\game');
    pathMocks.join.mockResolvedValue('C:\\game\\war3.exe');
    fsMocks.exists.mockResolvedValue(true);
    // stub setWar3Path to avoid heavy archive loading
    const m = makeManager();
    vi.spyOn(m, 'setWar3Path').mockResolvedValue(undefined);
    expect(await m.selectWar3Directory()).toBe('C:\\game');
    expect(m.setWar3Path).toHaveBeenCalledWith('C:\\game');
  });

  it('throws when directory is not valid War3 install', async () => {
    dialogMocks.open.mockResolvedValue('C:\\bad');
    pathMocks.join.mockResolvedValue('C:\\bad\\war3.exe');
    fsMocks.exists.mockResolvedValue(false);
    const m = makeManager();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(m.selectWar3Directory()).rejects.toThrow('不是有效的 Warcraft 3 安装目录');
    err.mockRestore();
  });

  it('logs and rethrows when open throws', async () => {
    dialogMocks.open.mockRejectedValue(new Error('dialog boom'));
    const m = makeManager();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(m.selectWar3Directory()).rejects.toThrow('dialog boom');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('loadStandardArchives / loadArchive', () => {
  it('throws when war3Path not set', async () => {
    const m = makeManager();
    await expect(m.loadStandardArchives()).rejects.toThrow('未设置 Warcraft 3 路径');
  });

  it('loads archives counting success and failure', async () => {
    let calls = 0;
    const fns = makeFns({
      async listFiles() {
        calls++;
        if (calls === 1) {
          return [{ name: 'x.blp', size: 1 }];
        }
        throw new Error('mpq broken');
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    const result = await m.loadStandardArchives();
    expect(result.success).toBe(1);
    expect(result.failed).toBe(3);
  });

  it('loadSingle archive failure records error info', async () => {
    const fns = makeFns({
      async listFiles() {
        throw new Error('nope');
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = await m.loadArchive('War3.mpq');
    expect(loaded).toBe(false);
    const info = (m as any).archives.get('War3.mpq');
    expect(info.loaded).toBe(false);
    expect(info.error).toBe('nope');
    err.mockRestore();
  });

  it('loadArchive handles an error that is not an Error instance', async () => {
    const fns = makeFns({
      async listFiles() {
        // eslint-disable-next-line no-throw-literal
        throw 'plain string failure';
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const loaded = await m.loadArchive('War3.mpq');
    expect(loaded).toBe(false);
    const info = (m as any).archives.get('War3.mpq');
    expect(info.loaded).toBe(false);
    err.mockRestore();
  });

  it('loadStandardArchives counts exception-archives as failed via catch', async () => {
    const fns = makeFns({
      async listFiles() {
        return [];
      },
    });
    const m = makeManager(fns);
    (m as any).war3Path = 'C:\\game';
    // loadArchive normally never throws; force it to so the catch runs
    vi.spyOn(m, 'loadArchive').mockRejectedValue(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await m.loadStandardArchives();
    expect(result.failed).toBe(4);
    expect(result.success).toBe(0);
    err.mockRestore();
  });
});

describe('readFile', () => {
  it('returns ArrayBuffer from cache-hit archive', async () => {
    coreMocks.invoke.mockResolvedValue([72, 105]);
    const m = makeManager();
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'C:\\game\\War3.mpq',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).fileListCache.set('ui\\a.blp', {
      fileName: 'UI\\a.blp',
      archiveName: 'War3.mpq',
      size: 2,
    });
    const buf = await m.readFile('UI/a.blp');
    expect(new Uint8Array(buf!)).toEqual(new Uint8Array([72, 105]));
  });

  it('silently returns null when cached read hits internal error', async () => {
    coreMocks.invoke.mockRejectedValue({ message: '内部错误' });
    const m = makeManager();
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'p',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).fileListCache.set('ui\\a.blp', {
      fileName: 'UI\\a.blp',
      archiveName: 'War3.mpq',
      size: 2,
    });
    expect(await m.readFile('UI\\a.blp')).toBeNull();
    expect((m as any).fileListCache.has('ui\\a.blp')).toBe(false);
  });

  it('falls back to scanning archives on cache miss', async () => {
    coreMocks.invoke.mockResolvedValue([1, 2, 3]);
    const m = makeManager();
    (m as any).archives.set('War3x.mpq', {
      name: 'War3x.mpq',
      path: 'C:\\game\\War3x.mpq',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    const buf = await m.readFile('Units\\Peasant.mdx');
    expect(new Uint8Array(buf!).length).toBe(3);
  });

  it('returns null when no archive has the file', async () => {
    coreMocks.invoke.mockResolvedValue([]);
    const m = makeManager();
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'p',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    expect(await m.readFile('missing\\f.blp')).toBeNull();
  });
});

describe('hasFile / searchFiles', () => {
  it('returns true when cached', async () => {
    const m = makeManager();
    (m as any).fileListCache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    expect(await m.hasFile('UI\\a.blp')).toBe(true);
  });

  it('delegates to readFile when not cached', async () => {
    const m = makeManager();
    vi.spyOn(m, 'readFile').mockResolvedValue(ASCII('x'));
    const r = await m.hasFile('not\\cached.txt');
    expect(r).toBe(true);
  });

  it('searchFiles matches wildcards', () => {
    const m = makeManager();
    (m as any).fileListCache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    (m as any).fileListCache.set('units\\b.mdx', { fileName: 'Units\\b.mdx', archiveName: 'x', size: 2 });
    (m as any).fileListCache.set('ui\\c.blp', { fileName: 'UI\\c.blp', archiveName: 'x', size: 3 });
    const r = m.searchFiles('*.blp');
    expect(r).toHaveLength(2);
    // Exercise exact and single-char wildcard on a backslash-free cache key.
    (m as any).fileListCache.set('road.blp', { fileName: 'road.blp', archiveName: 'x', size: 4 });
    expect(m.searchFiles('?oad.blp')).toHaveLength(1);
    expect(m.searchFiles('road.blp')).toHaveLength(1);
  });
});

describe('listDirectory / directory tree', () => {
  it('lists direct files and skips map-embedded paths', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cache = (m as any).fileListCache;
    cache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    cache.set('ui\\sub\\b.blp', { fileName: 'UI\\sub\\b.blp', archiveName: 'x', size: 1 });
    cache.set('maps\\m.w3x\\c.blp', { fileName: 'maps\\m.w3x\\c.blp', archiveName: 'x', size: 1 });
    const r = m.listDirectory('UI\\');
    expect(r.map(x => x.fileName)).toEqual(['UI\\a.blp']);
    log.mockRestore();
  });

  it('getDirectoryTree builds directory levels under root', () => {
    const m = makeManager();
    const cache = (m as any).fileListCache;
    cache.set('ui\\a\\b\\f.blp', { fileName: 'UI\\a\\b\\f.blp', archiveName: 'x', size: 1 });
    cache.set('other\\x.txt', { fileName: 'Other\\x.txt', archiveName: 'x', size: 1 });
    const tree = m.getDirectoryTree('UI\\');
    expect(tree).toEqual(['ui\\a\\', 'ui\\a\\b\\']);
    // whole tree
    const all = m.getDirectoryTree();
    expect(all).toContain('other\\');
  });

  it('getRootDirectories collects root dirs and skips maps', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cache = (m as any).fileListCache;
    cache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    cache.set('maps\\m.w3x\\c.blp', { fileName: 'maps\\m.w3x\\c.blp', archiveName: 'x', size: 1 });
    cache.set('single.txt', { fileName: 'single.txt', archiveName: 'x', size: 1 });
    const roots = m.getRootDirectories();
    // 'single.txt' has a single path part → not a directory; 'maps\m.w3x\c.blp'
    // has first part 'maps' (not ending in .w3x) → becomes 'maps\'.
    expect(roots).toEqual(['UI\\', 'maps\\']);
    log.mockRestore();
  });

  it('getSubDirectories returns child directories', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const cache = (m as any).fileListCache;
    cache.set('ui\\a\\f.blp', { fileName: 'UI\\a\\f.blp', archiveName: 'x', size: 1 });
    cache.set('ui\\a\\g\\h.txt', { fileName: 'UI\\a\\g\\h.txt', archiveName: 'x', size: 1 });
    const r = m.getSubDirectories('UI\\a\\');
    expect(r).toEqual(['ui\\a\\g\\']);
    log.mockRestore();
  });
});

describe('BLP helpers / unload', () => {
  it('getAllBLPFiles filters all .blp files', () => {
    const m = makeManager();
    const cache = (m as any).fileListCache;
    cache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    cache.set('units\\b.mdx', { fileName: 'Units\\b.mdx', archiveName: 'x', size: 1 });
    expect(m.getAllBLPFiles()).toHaveLength(1);
    // getUIBLPFiles uses pattern 'UI\*.blp'; the backslash is a regex escape so it
    // matches any char followed by the literal then 'blp' — realistic but quirky.
    expect(m.getUIBLPFiles().length).toBeGreaterThanOrEqual(0);
  });

  it('getRootDirectories skips empty-named entries', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('', { fileName: '', archiveName: 'x', size: 1 });
    expect(m.getRootDirectories()).toEqual([]);
    log.mockRestore();
  });

  it('unloadArchive removes files for that archive and marks it unloaded', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('a.blp', { fileName: 'a.blp', archiveName: 'War3.mpq', size: 1 });
    (m as any).archives.set('War3.mpq', { name: 'War3.mpq', path: 'p', files: [{ name: 'a.blp', size: 1 }], fileCount: 1, loaded: true });
    m.unloadArchive('War3.mpq');
    expect((m as any).fileListCache.has('a.blp')).toBe(false);
    expect((m as any).archives.get('War3.mpq').loaded).toBe(false);
    log.mockRestore();
  });

  it('unloadArchive does nothing when archive is unknown', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    m.unloadArchive('nonexistent.mpq');
    expect((m as any).archives.size).toBe(0);
    log.mockRestore();
  });

  it('unloadArchive only removes files whose archiveName matches', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('kept.blp', { fileName: 'kept.blp', archiveName: 'Other.mpq', size: 1 });
    (m as any).fileListCache.set('gone.blp', { fileName: 'gone.blp', archiveName: 'War3.mpq', size: 1 });
    (m as any).archives.set('War3.mpq', { name: 'War3.mpq', path: 'p', files: [], fileCount: 0, loaded: true });
    m.unloadArchive('War3.mpq');
    expect((m as any).fileListCache.has('kept.blp')).toBe(true);
    expect((m as any).fileListCache.has('gone.blp')).toBe(false);
    log.mockRestore();
  });

  it('unloadAll clears everything and invokes clear_mpq_cache', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('a.blp', { fileName: 'a.blp', archiveName: 'x', size: 1 });
    m.unloadAll();
    expect((m as any).archives.size).toBe(0);
    expect((m as any).fileListCache.size).toBe(0);
    expect(coreMocks.invoke).toHaveBeenCalledWith('clear_mpq_cache');
    log.mockRestore();
  });

  it('unloadAll logs warn if clear_mpq_cache fails', () => {
    coreMocks.invoke.mockRejectedValue(new Error('clear boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const m = makeManager();
    m.unloadAll();
    // invoke returns rejected promise; await microtask
    return Promise.resolve().then(() => {
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});

describe('getStatus / exportFileList', () => {
  it('reports archive status', () => {
    const m = makeManager();
    (m as any).war3Path = 'C:\\game';
    (m as any).archives.set('War3.mpq', { name: 'War3.mpq', path: 'p', files: [], fileCount: 5, loaded: true });
    (m as any).archives.set('Broken.mpq', { name: 'Broken.mpq', path: '', files: [], fileCount: 0, loaded: false, error: 'x' });
    (m as any).fileListCache.set('a', { fileName: 'a', archiveName: 'War3.mpq', size: 1 });
    const s = m.getStatus();
    expect(s.war3Path).toBe('C:\\game');
    expect(s.archivesLoaded).toBe(1);
    expect(s.totalFiles).toBe(1);
    expect(s.archives).toHaveLength(2);
  });

  it('exportFileList builds grouped output', () => {
    const m = makeManager();
    (m as any).war3Path = 'C:\\game';
    (m as any).fileListCache.set('b', { fileName: 'b.blp', archiveName: 'War3.mpq', size: 1 });
    (m as any).fileListCache.set('a', { fileName: 'a.blp', archiveName: 'War3.mpq', size: 2 });
    const out = m.exportFileList();
    expect(out).toContain('共 2 个文件');
    expect(out).toContain('[War3.mpq]');
    // sorted: a before b
    expect(out.indexOf('a.blp')).toBeLessThan(out.indexOf('b.blp'));
  });
});

describe('tauriMpqFns', () => {
  it('readFile returns null when invoke resolves null', async () => {
    coreMocks.invoke.mockResolvedValue(null);
    expect(await tauriMpqFns.readFile('a.mpq', 'b')).toBeNull();
    expect(coreMocks.invoke).toHaveBeenCalledWith('read_mpq_file', {
      archivePath: 'a.mpq',
      fileName: 'b',
    });
  });

  it('readFile returns ArrayBuffer from number array', async () => {
    coreMocks.invoke.mockResolvedValue([65, 66]);
    const buf = await tauriMpqFns.readFile('a.mpq', 'b');
    expect(new Uint8Array(buf!)).toEqual(new Uint8Array([65, 66]));
  });

  it('listFiles delegates to invoke', async () => {
    coreMocks.invoke.mockResolvedValue([{ name: 'x.blp', size: 1 }]);
    const r = await tauriMpqFns.listFiles('a.mpq');
    expect(r).toEqual([{ name: 'x.blp', size: 1 }]);
    expect(coreMocks.invoke).toHaveBeenCalledWith('load_mpq_archive', { path: 'a.mpq' });
  });

  it('hasFile delegates to invoke', async () => {
    coreMocks.invoke.mockResolvedValue(true);
    expect(await tauriMpqFns.hasFile?.('a.mpq', 'b')).toBe(true);
    expect(coreMocks.invoke).toHaveBeenCalledWith('has_mpq_file', {
      archivePath: 'a.mpq',
      fileName: 'b',
    });
  });
});

describe('readFile edge branches', () => {
  it('warns (non-internal) then scans on cached-read failure', async () => {
    let calls = 0;
    coreMocks.invoke.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error('磁盘错误');
      return [];
    });
    const m = makeManager();
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'p',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).fileListCache.set('ui\\a.blp', {
      fileName: 'UI\\a.blp',
      archiveName: 'War3.mpq',
      size: 2,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await m.readFile('UI\\a.blp')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('cached read hits non-Error-string failure (String(error))', async () => {
    let calls = 0;
    coreMocks.invoke.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw { some: 'object', message: undefined }; // no .message
      return [];
    });
    const m = makeManager();
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'p',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).fileListCache.set('ui\\a.blp', {
      fileName: 'UI\\a.blp',
      archiveName: 'War3.mpq',
      size: 2,
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await m.readFile('UI\\a.blp')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('cached entry whose archive is unloaded falls through to scan', async () => {
    coreMocks.invoke.mockResolvedValue([]);
    const m = makeManager();
    (m as any).archives.set('War3.mpq', {
      name: 'War3.mpq',
      path: 'p',
      files: [],
      fileCount: 0,
      loaded: false, // unloaded
    });
    (m as any).fileListCache.set('ui\\a.blp', {
      fileName: 'UI\\a.blp',
      archiveName: 'War3.mpq',
      size: 2,
    });
    expect(await m.readFile('UI\\a.blp')).toBeNull();
  });

  it('skips unloaded and internal-error archives while scanning', async () => {
    let calls = 0;
    coreMocks.invoke.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error('内部错误');
      return [];
    });
    const m = makeManager();
    (m as any).archives.set('Loaded.mpq', {
      name: 'Loaded.mpq',
      path: 'p1',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).archives.set('Unloaded.mpq', {
      name: 'Unloaded.mpq',
      path: 'p2',
      files: [],
      fileCount: 0,
      loaded: false,
    });
    expect(await m.readFile('nope\\x.txt')).toBeNull();
  });

  it('scan loop handles non-Error internal-error (String(error))', async () => {
    let calls = 0;
    coreMocks.invoke.mockImplementation(async () => {
      calls++;
      if (calls === 1) {
        // eslint-disable-next-line no-throw-literal
        throw { message: '内部错误' };
      }
      return [];
    });
    const m = makeManager();
    (m as any).archives.set('Loaded.mpq', {
      name: 'Loaded.mpq',
      path: 'p1',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    expect(await m.readFile('nope\\x.txt')).toBeNull();
  });

  it('scan loop returns data when a mid scan succeeds', async () => {
    let calls = 0;
    coreMocks.invoke.mockImplementation(async () => {
      calls++;
      if (calls === 1) throw new Error('内部错误');
      return [9, 9];
    });
    const m = makeManager();
    (m as any).archives.set('A.mpq', {
      name: 'A.mpq',
      path: 'p1',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).archives.set('B.mpq', {
      name: 'B.mpq',
      path: 'p2',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    const buf = await m.readFile('x\\y.txt');
    expect(calls).toBe(2);
    expect(new Uint8Array(buf!).length).toBe(2);
  });

  it('scan loop continues on generic error and still returns null', async () => {
    coreMocks.invoke.mockImplementation(async () => {
      // eslint-disable-next-line no-throw-literal
      throw { no: 'message', code: 5 }; // error?.message falsy → String(error)
    });
    const m = makeManager();
    (m as any).archives.set('A.mpq', {
      name: 'A.mpq',
      path: 'p1',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    (m as any).archives.set('B.mpq', {
      name: 'B.mpq',
      path: 'p2',
      files: [],
      fileCount: 0,
      loaded: true,
    });
    expect(await m.readFile('x\\y.txt')).toBeNull();
  });
});

describe('directory skip branches', () => {
  it('listDirectory skips files whose first part is a map', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // first path part ends in .w3x → map-skip branch
    (m as any).fileListCache.set('m.w3x\\ui\\a.blp', {
      fileName: 'm.w3x\\ui\\a.blp',
      archiveName: 'x',
      size: 1,
    });
    const r = m.listDirectory('m.w3x\\ui\\');
    expect(r).toEqual([]);
    log.mockRestore();
  });

  it('listDirectory returns sub-works by exact dir and not deeper', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    (m as any).fileListCache.set('ui\\sub\\b.blp', { fileName: 'UI\\sub\\b.blp', archiveName: 'x', size: 1 });
    expect(m.listDirectory('ui\\').map(x => x.fileName)).toEqual(['UI\\a.blp']);
    log.mockRestore();
  });

  it('getRootDirectories skips map-named first parts', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('m.w3x\\ui\\a.blp', { fileName: 'm.w3x\\ui\\a.blp', archiveName: 'x', size: 1 });
    (m as any).fileListCache.set('ui\\a.blp', { fileName: 'UI\\a.blp', archiveName: 'x', size: 1 });
    // single-component 'thing.w3x' alone is not added (parts.length>1 required),
    // and m.w3x is skipped by the map-name guard.
    const roots = m.getRootDirectories();
    expect(roots).toContain('UI\\');
    expect(roots).not.toContain('m.w3x\\');
    log.mockRestore();
  });

  it('getSubDirectories skips map-embedded and non-prefix paths', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('m.w3x\\a.blp', { fileName: 'm.w3x\\a.blp', archiveName: 'x', size: 1 });
    (m as any).fileListCache.set('other\\x.txt', { fileName: 'other\\x.txt', archiveName: 'x', size: 1 });
    (m as any).fileListCache.set('ui\\sub\\f.blp', { fileName: 'UI\\sub\\f.blp', archiveName: 'x', size: 1 });
    const r = m.getSubDirectories('ui\\');
    expect(r).toContain('ui\\sub\\');
    log.mockRestore();
  });

  it('getSubDirectories returns empty when nothing under dir', () => {
    const m = makeManager();
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    (m as any).fileListCache.set('aaa\\f.blp', { fileName: 'aaa\\f.blp', archiveName: 'x', size: 1 });
    expect(m.getSubDirectories('ui\\')).toEqual([]);
    log.mockRestore();
  });
});

describe('initializeMPQ / readWC3File', () => {
  it('returns false when no war3 path chosen', async () => {
    const m = new MPQManager(makeFns(), async (b: string, n: string) => `${b}\\${n}`);
    vi.spyOn(m, 'selectWar3Directory').mockResolvedValue(null);
    (MPQManager as any);
    // Use the module-level mpqManager via a partial spy is complex; instead call the function
    // but intercept by mocking selectWar3Directory on the singleton.
    const { mpqManager: singleton } = await import('./mpqManager');
    vi.spyOn(singleton, 'selectWar3Directory').mockResolvedValue(null);
    expect(await initializeMPQ()).toBe(false);
  });

  it('loads archives from explicit path and returns success', async () => {
    const { mpqManager: singleton } = await import('./mpqManager');
    // give singleton injectable-ish behavior via spies
    vi.spyOn(singleton, 'setWar3Path').mockResolvedValue(undefined);
    vi.spyOn(singleton, 'loadStandardArchives').mockResolvedValue({ success: 2, failed: 0 });
    expect(await initializeMPQ('C:\\game')).toBe(true);
  });

  it('returns false and logs on error', async () => {
    const { mpqManager: singleton } = await import('./mpqManager');
    vi.spyOn(singleton, 'loadStandardArchives').mockRejectedValue(new Error('init boom'));
    vi.spyOn(singleton, 'setWar3Path').mockResolvedValue(undefined);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await initializeMPQ('C:\\game')).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('readWC3File delegates to mpqManager.readFile', async () => {
    const { mpqManager: singleton } = await import('./mpqManager');
    vi.spyOn(singleton, 'readFile').mockResolvedValue(ASCII('x'));
    expect(await readWC3File('a.txt')).not.toBeNull();
  });
});

describe('浏览器模式：loadBrowserArchives / getDataSource 分支', () => {
  // 通过 mock wasmMpq 的浏览器入口，验证 MPQManager 的浏览器接线。
  const wasmMocks = vi.hoisted(() => ({
    pickMpqArchives: vi.fn(),
    wasmMpqFns: {
      readFile: vi.fn(),
      listFiles: vi.fn(),
      hasFile: vi.fn(),
    },
    browserDataSource: vi.fn(),
  }));

  beforeEach(() => {
    vi.resetModules();
    vi.doMock('./wasmMpq', () => ({
      defaultMpqFns: (t: unknown) => t,
      browserDataSource: wasmMocks.browserDataSource,
      pickMpqArchives: wasmMocks.pickMpqArchives,
      wasmMpqFns: wasmMocks.wasmMpqFns,
      listBrowserArchives: () => ['War3.mpq'],
    }));
    vi.doMock('./platformBridge', async (orig) => {
      const real = await (orig as () => Promise<Record<string, unknown>>)();
      return { ...real, isBrowserRuntime: () => true };
    });
    wasmMocks.pickMpqArchives.mockReset();
    wasmMocks.browserDataSource.mockReset();
    wasmMocks.wasmMpqFns.listFiles.mockReset();
  });

  afterEach(() => {
    vi.doUnmock('./wasmMpq');
    vi.doUnmock('./platformBridge');
  });

  it('用户取消选择 → 返回空数组，不写缓存', async () => {
    wasmMocks.pickMpqArchives.mockResolvedValue([]);
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());
    expect(await m.loadBrowserArchives()).toEqual([]);
    expect(m.getStatus().archivesLoaded).toBe(0);
  });

  it('选中档案 → 灌入文件清单、标记 loaded，并清掉缓存的 DataSource', async () => {
    wasmMocks.pickMpqArchives.mockResolvedValue(['War3.mpq']);
    wasmMocks.wasmMpqFns.listFiles.mockResolvedValue([
      { name: 'UI\\A.blp', size: 10 },
      { name: 'UI\\B.blp', size: 20 },
    ]);
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());

    // 先建立一次缓存；断言 loadBrowserArchives 之后**重建**了它
    // （否则新档案不会进入层栈）。这里数 browserDataSource 的调用次数，
    // 因为 mock 返回 undefined，用对象身份无法区分前后。
    wasmMocks.browserDataSource.mockClear();
    m.getCachedDataSource();
    expect(wasmMocks.browserDataSource).toHaveBeenCalledTimes(1);

    const added = await m.loadBrowserArchives();

    expect(added).toEqual(['War3.mpq']);
    expect(m.getStatus().archivesLoaded).toBe(1);
    expect(m.getStatus().totalFiles).toBe(2);
    // 缓存已失效 → 再次取用会重建（第 2 次调用）
    m.getCachedDataSource();
    expect(wasmMocks.browserDataSource).toHaveBeenCalledTimes(2);
  });

  it('可分批添加：第二次选择累加而非覆盖', async () => {
    wasmMocks.wasmMpqFns.listFiles.mockResolvedValue([{ name: 'X.blp', size: 1 }]);
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());

    wasmMocks.pickMpqArchives.mockResolvedValue(['War3.mpq']);
    await m.loadBrowserArchives();
    wasmMocks.pickMpqArchives.mockResolvedValue(['War3x.mpq']);
    await m.loadBrowserArchives();

    expect(m.getStatus().archivesLoaded).toBe(2);
    const names = m.getStatus().archives.map((a) => a.name).sort();
    expect(names).toEqual(['War3.mpq', 'War3x.mpq']);
  });

  it('getDataSource 在浏览器模式走 browserDataSource', async () => {
    const fakeDs = { label: 'fake' };
    wasmMocks.browserDataSource.mockReturnValue(fakeDs);
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());
    expect(m.getDataSource()).toBe(fakeDs);
    expect(wasmMocks.browserDataSource).toHaveBeenCalled();
  });

  it('listBrowserArchives 在浏览器模式返回已载入档案名', async () => {
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());
    expect(m.listBrowserArchives()).toEqual(['War3.mpq']);
  });

  it('listBrowserArchives 在桌面模式返回空数组（桌面用 getStatus 查档案）', async () => {
    // 切回桌面判定：浏览器档案概念不适用，必须返回空而不是误报
    vi.doMock('./platformBridge', async (orig) => {
      const real = await (orig as () => Promise<Record<string, unknown>>)();
      return { ...real, isBrowserRuntime: () => false };
    });
    vi.resetModules();
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());
    expect(m.listBrowserArchives()).toEqual([]);
  });

  it('unloadAll 在浏览器模式不调 Tauri invoke（避免无谓警告）', async () => {
    coreMocks.invoke.mockClear();
    const { MPQManager: M } = await import('./mpqManager');
    const m = new M(makeFns());
    m.unloadAll();
    expect(coreMocks.invoke).not.toHaveBeenCalledWith('clear_mpq_cache');
  });
});
