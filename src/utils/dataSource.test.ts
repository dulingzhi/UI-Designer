import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  normalizeMpqPath,
  MpqDataSource,
  LayeredDataSource,
  InMemoryDataSource,
} from './dataSource';
import type { MpqFns, DataSource } from './dataSource';

describe('normalizeMpqPath', () => {
  it('trims whitespace', () => {
    expect(normalizeMpqPath('  UI\\test.blp  ')).toBe('UI\\test.blp');
  });

  it('converts forward slashes to backslashes', () => {
    expect(normalizeMpqPath('Textures/foo/bar.blp')).toBe('Textures\\foo\\bar.blp');
  });

  it('strips leading backslashes', () => {
    expect(normalizeMpqPath('\\UI\\war3skins.txt')).toBe('UI\\war3skins.txt');
    expect(normalizeMpqPath('\\\\UI\\x.txt')).toBe('UI\\x.txt');
  });
});

describe('MpqDataSource', () => {
  function makeFns(overrides: Partial<MpqFns> = {}): MpqFns {
    return {
      readFile: vi.fn(async (_a, _f) => new ArrayBuffer(0)),
      listFiles: vi.fn(async () => []),
      ...overrides,
    } as MpqFns;
  }

  it('exposes label from archive name and archivePath', () => {
    const ds = new MpqDataSource({ name: 'War3x.mpq', path: 'C:\\w\\War3x.mpq' }, makeFns());
    expect(ds.label).toBe('War3x.mpq');
    expect(ds.archivePath).toBe('C:\\w\\War3x.mpq');
  });

  it('uses hasFile when present (short-circuit) and normalizes path', async () => {
    const hasFile = vi.fn(async () => true);
    const listFiles = vi.fn(async () => []);
    const ds = new MpqDataSource(
      { name: 'War3.mpq', path: 'P' },
      makeFns({ hasFile, listFiles }),
    );
    expect(await ds.exists('UI/A a.blp')).toBe(true);
    expect(hasFile).toHaveBeenCalledWith('P', 'UI\\A a.blp');
    expect(listFiles).not.toHaveBeenCalled();
  });

  it('falls back to listfile membership check when hasFile is absent', async () => {
    const listFiles = vi.fn(async () => [
      { name: 'Textures/X.blp', size: 10 },
      { name: 'ui\\other.blp', size: 5 },
    ]);
    const ds = new MpqDataSource({ name: 'War3.mpq', path: 'P' }, makeFns({ listFiles }));
    expect(await ds.exists('TEXTURES/X.BLP')).toBe(true);
    expect(await ds.exists('Textures\\missing.blp')).toBe(false);
  });

  it('caches the listPromise so listFiles is only called once', async () => {
    const listFiles = vi.fn(async () => [{ name: 'a.txt', size: 1 }]);
    const ds = new MpqDataSource({ name: 'War3.mpq', path: 'P' }, makeFns({ listFiles }));
    await ds.exists('a.txt');
    await ds.exists('a.txt');
    expect(listFiles).toHaveBeenCalledTimes(1);
  });

  it('falls back to an empty list when listFiles rejects, and can recover later', async () => {
    const ds = new MpqDataSource({ name: 'War3.mpq', path: 'P' }, makeFns());
    const ms = ds as unknown as { fns: MpqFns };
    ms.fns.listFiles = vi.fn(async () => {
      throw new Error('boom');
    });
    await expect(ds.exists('anything')).resolves.toBe(false);

    // listPromise reset to null, next call retries successfully
    ms.fns.listFiles = vi.fn(async () => [{ name: 'ok.txt', size: 2 }]);
    await expect(ds.exists('OK.TXT')).resolves.toBe(true);
  });

  it('read calls readFile with normalized path', async () => {
    const readFile = vi.fn(async () => null);
    const ds = new MpqDataSource({ name: 'War3.mpq', path: 'P' }, makeFns({ readFile }));
    expect(await ds.read('UI/A.txt')).toBeNull();
    expect(readFile).toHaveBeenCalledWith('P', 'UI\\A.txt');
  });

  it('list returns fileList, empty before prefetch', async () => {
    const ds = new MpqDataSource({ name: 'War3.mpq', path: 'P' }, makeFns());
    expect(ds.list()).toEqual([]);
    await ds.prefetchList();
    expect(ds.list()).toEqual([]);
  });
});

describe('LayeredDataSource', () => {
  function mem(label: string, files: Record<string, string>): DataSource {
    return new InMemoryDataSource(label, files);
  }

  it('joins layer labels and exposes layersList', () => {
    const layers = [mem('A', {}), mem('B', {})];
    const ds = new LayeredDataSource(layers);
    expect(ds.label).toBe('A+B');
    expect(ds.layersList).toEqual(layers);
    expect(ds.layersList).toBe(layers as readonly DataSource[]);
  });

  it('exists returns true as soon as a high-priority layer hits', async () => {
    const layerA = {
      label: 'A',
      exists: vi.fn(async () => true),
      read: vi.fn(async () => null),
      list: () => [],
    };
    const layerB = {
      label: 'B',
      exists: vi.fn(async () => true),
      read: vi.fn(async () => null),
      list: () => [],
    };
    const ds = new LayeredDataSource([layerA, layerB]);
    expect(await ds.exists('UI\\a.blp')).toBe(true);
    expect(layerA.exists).toHaveBeenCalledWith('UI\\a.blp');
    expect(layerB.exists).not.toHaveBeenCalled();
  });

  it('exists returns false when no layer hits', async () => {
    const layerA = { label: 'A', exists: vi.fn(async () => false), read: vi.fn(), list: () => [] };
    const layerB = { label: 'B', exists: vi.fn(async () => false), read: vi.fn(), list: () => [] };
    const ds = new LayeredDataSource([layerA, layerB]);
    expect(await ds.exists('UI\\a.blp')).toBe(false);
    expect(layerA.exists).toHaveBeenCalled();
    expect(layerB.exists).toHaveBeenCalled();
  });

  it('read returns first non-null result and stops', async () => {
    const bufA = new ArrayBuffer(4);
    const layerA = { label: 'A', exists: vi.fn(), read: vi.fn(async () => null), list: () => [] };
    const layerB = { label: 'B', exists: vi.fn(), read: vi.fn(async () => bufA), list: () => [] };
    const ds = new LayeredDataSource([layerA, layerB]);
    expect(await ds.read('a.blp')).toBe(bufA);
    expect(layerA.read).toHaveBeenCalledWith('a.blp');
    expect(layerB.read).toHaveBeenCalled();
  });

  it('read returns null when all layers return null and normalizes path for each call', async () => {
    const spy = vi.fn(async () => null);
    const layerA = { label: 'A', read: spy, list: () => [] };
    const layerB = { label: 'B', read: spy, list: () => [] };
    const ds = new LayeredDataSource([layerA, layerB]);
    expect(await ds.read('Textures/x/y.blp')).toBeNull();
    expect(spy).toHaveBeenCalledWith('Textures\\x\\y.blp');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('list merges lower-priority duplicates under high-priority and sorts', () => {
    const low = new InMemoryDataSource('low', { 'Textures/Shared.blp': 'a', 'ZZZ.blp': 'z' });
    const high = new InMemoryDataSource('high', { 'Textures\\SHARED.blp': 'b', 'AAA.blp': 'a' });
    const ds = new LayeredDataSource([high, low]);
    // high-priority 'SHARED.blp' wins over low's 'Shared.blp' (keys stored lowercased)
    expect(ds.list()).toEqual(['aaa.blp', 'textures\\shared.blp', 'zzz.blp']);
  });
});

describe('InMemoryDataSource', () => {
  it('normalizes and case-insensitively stores various content types', async () => {
    const text = new ArrayBuffer(2);
    const u8 = new Uint8Array([1, 2, 3]);
    const ds = new InMemoryDataSource('mem', {
      'UI/A.txt': 'hello',
      'UI/b.txt': text,
      'UI/c.txt': u8,
    });

    expect(await ds.exists('ui\\a.txt')).toBe(true);
    expect(await ds.exists('ui\\missing.txt')).toBe(false);

    const readA = await ds.read('UI\\A.TXT');
    expect(new TextDecoder().decode(readA)).toBe('hello');
    expect(await ds.read('ui\\missing.txt')).toBeNull();

    expect(ds.list().sort()).toEqual(['ui\\a.txt', 'ui\\b.txt', 'ui\\c.txt']);
    expect(ds.label).toBe('mem');
  });

  it('handles Uint8Array that is a subarray view (offset/length preserved)', async () => {
    const backing = new Uint8Array([9, 9, 5, 6, 7, 9]);
    const view = backing.subarray(2, 5); // [5,6,7]
    const ds = new InMemoryDataSource('v', { 'a.bin': view });
    const data = await ds.read('a.bin');
    const read = new Uint8Array(data!);
    expect(Array.from(read)).toEqual([5, 6, 7]);
  });

  it('returns empty list when constructed with no files', () => {
    expect(new InMemoryDataSource('empty').list()).toEqual([]);
  });
});