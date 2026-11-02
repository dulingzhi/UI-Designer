import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import {
  TextureLoader,
  TextureType,
  loadWar3Skins,
  loadTexture,
  preloadTextures,
  hasTexture,
  textureLoader,
} from './textureLoader';
import type { DataSource } from './dataSource';

// ---------------------------------------------------------------------------
// Module mocks (hoisted so the dynamic/ static imports resolve to these).
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  getCachedDataSource: vi.fn(),
  setWar3Path: vi.fn(),
  storeLoadWar3Skins: vi.fn(),
  decodeBLP: vi.fn(),
  war3SkinsFlag: true,
}));

vi.mock('@tauri-apps/plugin-fs', () => ({ readFile: mocks.readFile }));
vi.mock('./mpqManager', () => ({
  mpqManager: {
    getCachedDataSource: mocks.getCachedDataSource,
    setWar3Path: mocks.setWar3Path,
  },
}));
vi.mock('./blpDecoder', () => ({ decodeBLPToDataURL: mocks.decodeBLP }));
vi.mock('../store/projectStore', () => ({
  useProjectStore: {
    getState: () => ({
      loadWar3Skins: mocks.storeLoadWar3Skins,
      project: { war3Skins: mocks.war3SkinsFlag },
    }),
  },
}));

function makeDS(overrides: Partial<DataSource> = {}): DataSource {
  return {
    label: 'fake',
    exists: vi.fn(async () => true),
    read: vi.fn(async () => new ArrayBuffer(4)),
    list: () => [],
    ...overrides,
  } as DataSource;
}

// browser globals used by the loader
let blobUrls: string[] = [];
beforeEach(() => {
  mocks.readFile.mockReset();
  mocks.setWar3Path.mockReset();
  mocks.storeLoadWar3Skins.mockReset();
  mocks.decodeBLP.mockReset();
  mocks.decodeBLP.mockResolvedValue('data:image/png;base64,BLP');
  mocks.war3SkinsFlag = true;
  mocks.getCachedDataSource.mockReset();
  mocks.getCachedDataSource.mockReturnValue(makeDS());

  blobUrls = [];
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const u = `blob:mock/${blobUrls.length}`;
    blobUrls.push(u);
    return u;
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
describe('TextureLoader.getTextureType', () => {
  it('returns UNKNOWN for empty path', () => {
    expect(new TextureLoader(makeDS()).getTextureType('')).toBe(TextureType.UNKNOWN);
  });

  it('classifies data: URLs', () => {
    expect(new TextureLoader(makeDS()).getTextureType('data:image/png;base64,')).toBe(
      TextureType.DATA_URL,
    );
  });

  it('classifies http/https URLs', () => {
    const l = new TextureLoader(makeDS());
    expect(l.getTextureType('http://x.com/a.png')).toBe(TextureType.HTTP_URL);
    expect(l.getTextureType('https://x.com/a.png')).toBe(TextureType.HTTP_URL);
  });

  it('classifies Windows / unix absolute paths as LOCAL_FILE', () => {
    const l = new TextureLoader(makeDS());
    expect(l.getTextureType('C:\\Users\\a\\b.png')).toBe(TextureType.LOCAL_FILE);
    expect(l.getTextureType('D:/tex/a.png')).toBe(TextureType.LOCAL_FILE);
    expect(l.getTextureType('/home/u/a.png')).toBe(TextureType.LOCAL_FILE);
  });

  it('classifies WC3 paths', () => {
    const l = new TextureLoader(makeDS());
    expect(l.getTextureType('Textures\\foo.blp')).toBe(TextureType.WC3_PATH);
    expect(l.getTextureType('UI\\a.blp')).toBe(TextureType.WC3_PATH);
    expect(l.getTextureType('UI/war3skins.txt')).toBe(TextureType.WC3_PATH);
    expect(l.getTextureType('Textures/foo.blp')).toBe(TextureType.WC3_PATH);
  });

  it('classifies WC3_BUILTIN when the plain name is in the builtin map', async () => {
    // trigger loadWar3Skins to populate WC3_BUILTIN_TEXTURES
    const ds = makeDS({
      read: vi.fn(async () =>
        new TextEncoder().encode('HumanCommandButton.blp=Textures\\H.blp\n').buffer,
      ),
    });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins();
    const l = new TextureLoader(makeDS());
    expect(l.getTextureType('HumanCommandButton.blp')).toBe(TextureType.WC3_BUILTIN);
    expect(l.getTextureType('NotBTN.blp')).toBe(TextureType.UNKNOWN);
  });
});

// ---------------------------------------------------------------------------
describe('TextureLoader.loadTexture caching + dedupe', () => {
  it('throws on empty path', async () => {
    await expect(new TextureLoader(makeDS()).loadTexture('')).rejects.toThrow('纹理路径不能为空');
  });

  it('returns cached url on second load when not force-reload', async () => {
    const ds = makeDS({ read: vi.fn(async () => new ArrayBuffer(4)) });
    const l = new TextureLoader(ds);
    const url1 = await l.loadTexture('Textures\\a.blp');
    const url2 = await l.loadTexture('Textures\\a.blp');
    expect(url2).toBe(url1);
    expect(ds.read).toHaveBeenCalledTimes(1);
  });

  it('forceReload bypasses cache', async () => {
    const ds = makeDS({ read: vi.fn(async () => new ArrayBuffer(4)) });
    const l = new TextureLoader(ds);
    mocks.decodeBLP.mockResolvedValue('data:1');
    const url1 = await l.loadTexture('Textures\\a.blp');
    await l.loadTexture('Textures\\a.blp'); // caches
    mocks.decodeBLP.mockResolvedValue('data:2');
    const url3 = await l.loadTexture('Textures\\a.blp', true);
    expect(url3).toBe('data:2');
    expect(ds.read).toHaveBeenCalledTimes(2);
  });

  it('dedupes concurrent loads for the same path into one promise', async () => {
    let resolveRead: (v: ArrayBuffer) => void;
    const gate = new Promise<ArrayBuffer>((r) => (resolveRead = r));
    const ds = makeDS({ read: vi.fn(() => gate) });
    const l = new TextureLoader(ds);
    const p1 = l.loadTexture('Textures\\a.blp');
    const p2 = l.loadTexture('Textures\\a.blp');
    resolveRead!(new ArrayBuffer(4));
    await expect(Promise.all([p1, p2])).resolves.toEqual(['data:image/png;base64,BLP', 'data:image/png;base64,BLP']);
    // deduped: single read + single _loadTexture invocation
    expect(ds.read).toHaveBeenCalledTimes(1);
    expect(mocks.decodeBLP).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
describe('TextureLoader._loadTexture type dispatch', () => {
  it('DATA_URL uses path directly', async () => {
    const l = new TextureLoader(makeDS());
    const url = await l.loadTexture('data:image/png;base64,AAA');
    expect(url).toBe('data:image/png;base64,AAA');
  });

  it('HTTP_URL uses path directly', async () => {
    const l = new TextureLoader(makeDS());
    const url = await l.loadTexture('https://x/a.png');
    expect(url).toBe('https://x/a.png');
  });

  it('WC3_PATH loads via dataSource and decodes .blp', async () => {
    const ds = makeDS({ read: vi.fn(async () => new ArrayBuffer(8)) });
    const l = new TextureLoader(ds);
    const url = await l.loadTexture('Textures\\Real.blp');
    expect(mocks.decodeBLP).toHaveBeenCalled();
    expect(url).toBe('data:image/png;base64,BLP');
    // normalized path (forward slashes -> backslashes)
    expect(ds.read).toHaveBeenCalledWith('Textures\\Real.blp');
  });

  it('WC3_BUILTIN maps to real path and loads', async () => {
    const ds = makeDS({
      read: vi.fn(async () =>
        new TextEncoder().encode('HumanCommandButton.blp=Textures\\H.blp\n').buffer,
      ),
    });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins();
    const l = new TextureLoader(ds);
    const url = await l.loadTexture('HumanCommandButton.blp');
    expect(url).toBe('data:image/png;base64,BLP');
    expect(mocks.decodeBLP).toHaveBeenCalled();
    expect(ds.read).toHaveBeenCalledWith('Textures\\H.blp');
  });

  it('WC3_PATH non-blp creates a Blob URL', async () => {
    const ds = makeDS({ read: vi.fn(async () => new ArrayBuffer(4)) });
    const l = new TextureLoader(ds);
    const url = await l.loadTexture('Textures\\a.jpg');
    expect(url).toMatch(/^blob:/);
    expect(l.getCacheStatus().size).toBe(1);
  });

  it('WC3_PATH read returns null -> throws "WC3 纹理未找到" (no error log)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ds = makeDS({ read: vi.fn(async () => null) });
    const l = new TextureLoader(ds);
    await expect(l.loadTexture('Textures\\missing.blp')).rejects.toThrow('WC3 纹理未找到');
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('WC3_PATH read rejects with a non-Error rethrows without logging', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ds = makeDS({ read: vi.fn(async () => { throw 'raw-string-error'; }) });
    const l = new TextureLoader(ds);
    await expect(l.loadTexture('Textures\\x.blp')).rejects.toBe('raw-string-error');
    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('unsupported type rejects and logs the error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const l = new TextureLoader(makeDS());
    // 'notARealPath' -> UNKNOWN -> default in _loadTexture
    await expect(l.loadTexture('someplainname')).rejects.toThrow('不支持的纹理路径');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('LOCAL_FILE .blp decodes via readFile', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const l = new TextureLoader(makeDS());
    const url = await l.loadTexture('C:\\dir\\tex.blp');
    expect(mocks.decodeBLP).toHaveBeenCalled();
    expect(url).toBe('data:image/png;base64,BLP');
  });

  it('LOCAL_FILE readFile failure wraps in a friendly error and logs', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.readFile.mockRejectedValue(new Error('fs boom'));
    const l = new TextureLoader(makeDS());
    await expect(l.loadTexture('C:\\missing\\x.blp')).rejects.toThrow('读取本地文件失败');
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe('TextureLoader.loadWC3Texture + mime types', () => {
  it('getMimeType covers png/jpg/jpeg/gif/bmp/webp/tga/blp/default via local loads', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const l = new TextureLoader(makeDS());
    const urls: string[] = [];
    for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tga', 'bin']) {
      urls.push(await l.loadTexture(`C:\\a.${ext}`));
    }
    expect(urls.every((u) => u.startsWith('blob:'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('TextureLoader cache internals', () => {
  it('getCacheStatus reports entries/age and removeFromCache revokes blob url', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1]));
    const l = new TextureLoader(makeDS());
    await l.loadTexture('C:\\a.png');
    const status = l.getCacheStatus();
    expect(status.size).toBe(1);
    expect(status.entries[0].accessCount).toBe(1);
    expect(status.entries[0].age).toBeGreaterThanOrEqual(0);

    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    l.removeFromCache('C:\\a.png');
    expect(revoke).toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(0);
    // removing a missing key is a no-op
    l.removeFromCache('nope');
  });

  it('expired entries are evicted and blob revoked', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    mocks.readFile.mockResolvedValue(new Uint8Array([1]));
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxAge: 100 });
    await l.loadTexture('C:\\a.png');
    nowSpy.mockReturnValue(1200); // age 200 > 100
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const url = await l.loadTexture('C:\\a.png');
    expect(revoke).toHaveBeenCalled();
    expect(url).toMatch(/^blob:/); // reloaded fresh
    nowSpy.mockRestore();
  });

  it('expired non-blob (DATA_URL) entry is dropped without revoke', async () => {
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxAge: 100 });
    await l.loadTexture('data:image/png;base64,X'); // cached as data url
    nowSpy.mockReturnValue(1200);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const url = await l.loadTexture('data:image/png;base64,X');
    expect(url).toBe('data:image/png;base64,X'); // reloaded, no revoke needed
    expect(revoke).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('setCacheOptions updates maxSize and maxAge', () => {
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 7, maxAge: 999 });
    // verify via behavior
    expect(l.getCacheStatus().maxSize).toBe(7);
  });

  it('evictLRU runs on empty cache without error (maxSize 0, lruPath null)', async () => {
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 0 });
    const url = await l.loadTexture('data:image/png;base64,E');
    expect(url).toBe('data:image/png;base64,E');
  });

  it('evictLRU skips revoke for non-blob evicted entry (data url)', async () => {
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 1 });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const url1 = await l.loadTexture('data:image/png;base64,D1');
    await l.loadTexture('data:image/png;base64,D2'); // evicts D1 (non-blob)
    expect(url1).toBe('data:image/png;base64,D1');
    expect(revoke).not.toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(1);
  });

  it('evictLRU takes the false path when a later entry is NOT lower-score', async () => {
    // Fresh cache, maxSize=2. Load a then b (both accessCount 1).
    // evictLRU loop over [a, b]: a seen first (lru=a). Score(b) = 1000 + timestamp(b),
    // and timestamp(a) <= timestamp(b) so Score(b) >= Score(a) => `score < lruScore` is FALSE.
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 2 });
    await l.loadTexture('C:\\a.png');
    await l.loadTexture('C:\\b.png');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    await l.loadTexture('C:\\c.png'); // over capacity -> evict a (older, lower score)
    expect(revoke).toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(2);
  });

  it('evictLRU compares access counts and skips higher-score entry', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 2 });
    await l.loadTexture('C:\\low.png'); // acc 1
    await l.loadTexture('C:\\high.png'); // acc 1
    await l.loadTexture('C:\\low.png'); // low acc 2, high acc 1 -> iteration [low, high], high has lower score => sets lru; low higher => false branch
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    await l.loadTexture('C:\\new.png'); // triggers evictLRU
    expect(revoke).toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(2);
  });

  it('evictLRU evicts the OLDEST entry (not the newest) when access counts are equal', async () => {
    // 方向性修复锁定：旧公式 acc*1000+age 淘汰 score 最小 = 刚加载项（age 小），
    // 与 LRU 相反。正确行为：同 acc 下淘汰更旧者。
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    vi.useFakeTimers();
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 2 });
    vi.setSystemTime(1000);
    await l.loadTexture('C:\\old.png');
    vi.setSystemTime(5000);
    await l.loadTexture('C:\\new.png');
    await l.loadTexture('C:\\third.png'); // over capacity -> evict oldest (old.png)
    const paths = l.getCacheStatus().entries.map((e) => e.path);
    expect(paths).toContain('C:\\new.png');
    expect(paths).not.toContain('C:\\old.png');
    vi.useRealTimers();
  });

  it('evictLRU protects frequently-accessed entries over single-access ones', async () => {
    // acc 权重语义：热门项（acc 高）即使更旧也不被逐
    mocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3, 4]));
    vi.useFakeTimers();
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 2 });
    vi.setSystemTime(1000);
    await l.loadTexture('C:\\hot.png');
    await l.loadTexture('C:\\hot.png'); // acc 2
    vi.setSystemTime(60000);
    await l.loadTexture('C:\\cold.png'); // acc 1, newer
    await l.loadTexture('C:\\third.png');
    const paths = l.getCacheStatus().entries.map((e) => e.path);
    expect(paths).toContain('C:\\hot.png');
    expect(paths).not.toContain('C:\\cold.png');
    vi.useRealTimers();
  });

  it('evictLRU revokes blob urls when over capacity', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1]));
    const l = new TextureLoader(makeDS());
    l.setCacheOptions({ maxSize: 2 });
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    await l.loadTexture('C:\\a.png');
    await l.loadTexture('C:\\b.png');
    // accessCount on a
    await l.loadTexture('C:\\a.png');
    await l.loadTexture('C:\\c.png'); // over capacity -> evict LRU (b least accessed)
    expect(revoke).toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(2);
  });

  it('clearCache revokes all blob urls and clears', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1]));
    const l = new TextureLoader(makeDS());
    await l.loadTexture('C:\\a.png');
    await l.loadTexture('C:\\b.png');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    l.clearCache();
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(l.getCacheStatus().size).toBe(0);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('clearCache leaves non-blob entries untouched', async () => {
    const l = new TextureLoader(makeDS());
    await l.loadTexture('data:image/png;base64,C1');
    await l.loadTexture('data:image/png;base64,C2');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    l.clearCache();
    expect(revoke).not.toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(0);
    log.mockRestore();
  });

  it('removeFromCache skips revoke for non-blob entry', async () => {
    const l = new TextureLoader(makeDS());
    await l.loadTexture('data:image/png;base64,R');
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    l.removeFromCache('data:image/png;base64,R');
    expect(revoke).not.toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
describe('TextureLoader.getTextureInfo / hasTexture / preloadTextures', () => {
  it('getTextureInfo hits cache after load', async () => {
    mocks.readFile.mockResolvedValue(new Uint8Array([1]));
    const l = new TextureLoader(makeDS());
    await l.loadTexture('C:\\a.png');
    const info = await l.getTextureInfo('C:\\a.png');
    expect(info.cached).toBe(true);
    expect(info.type).toBe(TextureType.LOCAL_FILE);
  });

  it('getTextureInfo loads when not cached', async () => {
    const l = new TextureLoader(makeDS());
    const info = await l.getTextureInfo('Textures\\a.blp');
    expect(info.cached).toBe(true);
    expect(info.type).toBe(TextureType.WC3_PATH);
  });

  it('hasTexture true for data/http URLs', async () => {
    const l = new TextureLoader(makeDS());
    expect(await l.hasTexture('data:x')).toBe(true);
    expect(await l.hasTexture('http://x')).toBe(true);
  });

  it('hasTexture checks local file via readFile', async () => {
    const l = new TextureLoader(makeDS());
    mocks.readFile.mockResolvedValue(new Uint8Array([1]));
    expect(await l.hasTexture('C:\\a.png')).toBe(true);
    mocks.readFile.mockRejectedValue(new Error('no'));
    expect(await l.hasTexture('C:\\a.png')).toBe(false);
  });

  it('hasTexture for UNKNOWN returns false', async () => {
    expect(await new TextureLoader(makeDS()).hasTexture('nonsense')).toBe(false);
  });

  it('hasTexture for WC3_PATH checks dataSource existence', async () => {
    const ds = makeDS({ exists: vi.fn(async () => true) });
    const l = new TextureLoader(ds);
    expect(await l.hasTexture('Textures\\a.blp')).toBe(true);
    expect(ds.exists).toHaveBeenCalledWith('Textures\\a.blp');
    (ds.exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    expect(await l.hasTexture('Textures\\a.blp')).toBe(false);
  });

  it('hasTexture for WC3_BUILTIN resolves mapped path existence', async () => {
    const ds = makeDS({
      read: vi.fn(async () => new TextEncoder().encode('HumanCommandButton.blp=Textures\\H.blp').buffer),
      exists: vi.fn(async () => true),
    });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins(); // sets WC3_BUILTIN_TEXTURES
    const l = new TextureLoader(makeDS());
    expect(await l.hasTexture('HumanCommandButton.blp')).toBe(true);
    expect(ds.exists).not.toHaveBeenCalled(); // l uses its own makeDS(), mapped path normally checked on l's DS
  });

  it('unquote 语义：成对引号剥离（openwar3 仲裁 1.27 值带引号）', async () => {
    const ds = makeDS({
      read: vi.fn(async () =>
        new TextEncoder().encode('[Default]\nCampaignButtonHighlight.blp="UI\\Widgets\\X.blp"').buffer),
      exists: vi.fn(async () => true),
    });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins();
    const l = new TextureLoader(makeDS());
    expect(l.getTextureType('CampaignButtonHighlight.blp')).toBe(TextureType.WC3_BUILTIN);
    // 用独立探针 Loader 验证映射值已剥离引号（exists 收到真实路径而非带引号字符串）
    const probeExists = vi.fn(async (p: string) => p === 'UI\\Widgets\\X.blp');
    const probe = new TextureLoader(makeDS({ exists: probeExists }));
    expect(await probe.hasTexture('CampaignButtonHighlight.blp')).toBe(true);
    expect(probeExists.mock.calls[0][0]).toBe('UI\\Widgets\\X.blp');
  });

  it('段落感知：种族段不覆盖已有映射（防 override 冒充全局路径）', async () => {
    const content = [
      '[Default]',
      'SharedTexture.blp=Textures\\DefaultShared.blp',
      'HumanOnly.blp=Textures\\HumanOnly.blp',
      '[Human]',
      'SharedTexture.blp=Textures\\HumanShared.blp', // 种族 override 不得覆盖 Default
      '[Orc]',
      'SharedTexture.blp=Textures\\OrcShared.blp',
    ].join('\n');
    const ds = makeDS({
      read: vi.fn(async () => new TextEncoder().encode(content).buffer),
      exists: vi.fn(async (p: string) => p === 'Textures\\DefaultShared.blp'),
    });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins();
    const l = new TextureLoader(makeDS());
    // SharedTexture 解析到 Default 段的值（第一个生效，种族段被跳过）——
    // 用独立探针 Loader 记录 exists 收到的路径
    const probedPaths: string[] = [];
    const probeExists = vi.fn(async (p: string) => {
      probedPaths.push(p);
      return p === 'Textures\\DefaultShared.blp' || p === 'Textures\\HumanOnly.blp';
    });
    const probe = new TextureLoader(makeDS({ exists: probeExists }));
    expect(await probe.hasTexture('SharedTexture.blp')).toBe(true);
    expect(await probe.hasTexture('HumanOnly.blp')).toBe(true);
    expect(probedPaths).toContain('Textures\\DefaultShared.blp');
    expect(probedPaths).toContain('Textures\\HumanOnly.blp');
    // 种族段 override 路径不得出现（HumanShared/OrcShared 被段落守卫跳过）
    expect(probedPaths.some((p) => p.includes('HumanShared') || p.includes('OrcShared'))).toBe(false);
  });

  it('preloadTextures returns map and logs failures', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ds = makeDS({
      read: vi.fn(async (p: string) => (p.includes('bad') ? null : new ArrayBuffer(4))),
    });
    const l = new TextureLoader(ds);
    const total = await l.preloadTextures(['Textures\\a.blp', 'Textures\\bad.blp']);
    expect(total.has('Textures\\a.blp')).toBe(true);
    expect(total.has('Textures\\bad.blp')).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe('loadWar3Skins parsing', () => {
  it('parses key=value lines, keeps only valid image paths, merges', async () => {
    const content = [
      '// comment',
      '[section]',
      '',
      '  ',
      'HumanNext.blp=Textures\\H_next.blp',
      'HumanSkip.tga=Textures\\H_skip.tga',
      'HumanBad.mdl=units\\bad.mdl',
      'HasSpace.blp = Textures\\Spaced.blp ',
      'notanimage=nope.txt',
      'noequals',
    ].join('\n');
    const ds = makeDS({ read: vi.fn(async () => new TextEncoder().encode(content).buffer) });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins();
    const l = new TextureLoader(makeDS());
    // merged into builtin map
    expect(l.getTextureType('HumanNext.blp')).toBe(TextureType.WC3_BUILTIN);
    expect(mocks.storeLoadWar3Skins).toHaveBeenCalledWith(content);
  });

  it('returns early without error when read returns null (uses default mapping)', async () => {
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.getCachedDataSource.mockReturnValue(makeDS({ read: vi.fn(async () => null) }));
    await expect(loadWar3Skins()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('catches fatal errors from read/parse', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.getCachedDataSource.mockReturnValue(
      makeDS({ read: vi.fn(async () => { throw new Error('io exploded'); }) }),
    );
    await expect(loadWar3Skins()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('catches and logs project-store load failure', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ds = makeDS({ read: vi.fn(async () => new TextEncoder().encode('A.png=B.png').buffer) });
    mocks.getCachedDataSource.mockReturnValue(ds);
    mocks.storeLoadWar3Skins.mockImplementation(() => { throw new Error('store boom'); });
    await expect(loadWar3Skins()).resolves.toBeUndefined();
    expect(errSpy).toHaveBeenCalledWith('[TextureLoader] 加载 war3skins.txt 到项目状态失败:', expect.any(Error));
    errSpy.mockRestore();
  });

  it('reports war3Skins state as 未加载 when project flag is falsy', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mocks.war3SkinsFlag = false;
    const ds = makeDS({ read: vi.fn(async () => new TextEncoder().encode('A.png=B.png').buffer) });
    mocks.getCachedDataSource.mockReturnValue(ds);
    await loadWar3Skins();
    const line = logSpy.mock.calls
      .map((call) => call.filter((a) => typeof a === 'string').join(' '))
      .find((m) => String(m).includes('当前 war3Skins 状态'));
    expect(String(line)).toContain('未加载');
    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
describe('constructor + shortcut functions', () => {
  it('constructor falls back to mpqManager.getCachedDataSource()', () => {
    const l = new TextureLoader();
    expect(mocks.getCachedDataSource).toHaveBeenCalled();
    expect(l.getCacheStatus().size).toBe(0);
  });

  it('global textureLoader instance exists', () => {
    expect(textureLoader).toBeInstanceOf(TextureLoader);
  });

  it('shortcut loadTexture/preloadTextures/hasTexture work via global instance', async () => {
    const url = await loadTexture('data:image/png;base64,shortcut');
    expect(url).toBe('data:image/png;base64,shortcut');

    const map = await preloadTextures(['data:a', 'data:b']);
    expect(map.has('data:a')).toBe(true);

    expect(await hasTexture('data:c')).toBe(true);
    expect(await hasTexture('')).toBe(false);
  });
});