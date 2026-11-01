/**
 * DataSource 抽象层单测（阶段 D）。
 * 纯前端逻辑，直接实例化 InMemory 数据源与 MpqFns 内存实现，无需 Tauri/Rust 运行时。
 */
import { describe, it, expect, vi } from 'vitest';
import {
  normalizeMpqPath,
  DataSource,
  MpqFns,
  MpqDataSource,
  LayeredDataSource,
  InMemoryDataSource,
} from '../src/utils/dataSource';

/** 内存版 MpqFns：模拟 Rust `read_mpq_file` / `load_mpq_archive`。 */
function memMpqFns(filesByArchive: Record<string, Record<string, string>>): MpqFns {
  return {
    async readFile(archivePath, fileName) {
      const archive = filesByArchive[archivePath];
      if (!archive) return null;
      const content = archive[fileName.toLowerCase()];
      return content !== undefined ? new TextEncoder().encode(content).buffer : null;
    },
    async listFiles(archivePath) {
      const archive = filesByArchive[archivePath];
      return archive
        ? Object.entries(archive).map(([name, content]) => ({
            name,
            size: new TextEncoder().encode(content).length,
          }))
        : [];
    },
  };
}

describe('normalizeMpqPath', () => {
  it('将 / 归一化为 \\', () => {
    expect(normalizeMpqPath('UI/Widgets/Console/Human/a.blp')).toBe('UI\\Widgets\\Console\\Human\\a.blp');
  });
  it('去除前导反斜杠与空白', () => {
    expect(normalizeMpqPath('  \\\\UI\\a.blp')).toBe('UI\\a.blp');
  });
});

describe('InMemoryDataSource', () => {
  it('按规范化路径读写', async () => {
    const ds = new InMemoryDataSource('mem', {
      'UI/Widgets/a.blp': 'abc',
      'Textures\\Black32.blp': 'black',
    });
    expect(await ds.exists('ui\\widgets\\a.blp')).toBe(true);
    expect(await ds.exists('nope.blp')).toBe(false);
    const buf = await ds.read('UI\\Widgets\\A.BLP');
    expect(buf).not.toBeNull();
    expect(new TextDecoder().decode(buf!)).toBe('abc');
    await expect(ds.read('missing.blp')).resolves.toBeNull();
    expect(ds.list().sort()).toEqual(['textures\\black32.blp', 'ui\\widgets\\a.blp']);
  });
});

describe('MpqDataSource', () => {
  it('read 与 list 走注入的 MpqFns，且大小写不敏感', async () => {
    const fns = memMpqFns({
      '/war3/war3x.mpq': { 'ui\\widgets\\console\\human\\cb-up.blp': 'BUF1' },
    });
    const ds = new MpqDataSource({ name: 'war3x.mpq', path: '/war3/war3x.mpq' }, fns);
    const buf = await ds.read('ui/Widgets/Console/Human/CB-UP.BLP');
    expect(new TextDecoder().decode(buf!)).toBe('BUF1');
    await expect(ds.read('none.blp')).resolves.toBeNull();
    expect(await ds.exists('UI\\WIDGETS\\CONSOLE\\HUMAN\\CB-UP.BLP')).toBe(true);
    expect(await ds.exists('missing.blp')).toBe(false);
  });

  it('listfile 不可用时降级为空列表，不抛异常', async () => {
    const ds = new MpqDataSource(
      { name: 'bad.mpq', path: '/bad.mpq' },
      {
        async readFile() {
          return null;
        },
        async listFiles() {
          return Promise.reject(new Error('no listfile'));
        },
      },
    );
    expect(await ds.exists('x.blp')).toBe(false);
    const buf = await ds.read('x.blp');
    expect(buf).toBeNull();
  });

  it('提供 hasFile 时 exists 走快速路径（不依赖 listfile）', async () => {
    const hasFile = vi.fn(async (): Promise<boolean> => true);
    const ds = new MpqDataSource(
      { name: 'fast.mpq', path: '/fast.mpq' },
      {
        async readFile() {
          return null;
        },
        async listFiles() {
          return Promise.reject(new Error('listfile intentionally unavailable'));
        },
        hasFile,
      },
    );
    // 即便 listfile 不可用，hasFile 快速路径也能回答存在性。
    expect(await ds.exists('anything.txt')).toBe(true);
    expect(hasFile).toHaveBeenCalledWith('/fast.mpq', 'anything.txt');
  });
});

describe('LayeredDataSource', () => {
  const low = new InMemoryDataSource('low', { 'a\\shared.blp': 'LOW', 'only-low.blp': 'L' });
  const high = new InMemoryDataSource('high', { 'A\\SHARED.blp': 'HIGH', 'only-high.blp': 'H' });

  it('index0=最高优先，读时序高优先层命中即返回', async () => {
    const stacked = new LayeredDataSource([high, low]);
    const buf = await stacked.read('a\\shared.blp');
    expect(new TextDecoder().decode(buf!)).toBe('HIGH');
    // 不存在于高层时回退到低层。
    const lowOnly = await stacked.read('only-low.blp');
    expect(new TextDecoder().decode(lowOnly!)).toBe('L');
    const highOnly = await stacked.read('only-high.blp');
    expect(new TextDecoder().decode(highOnly!)).toBe('H');
    await expect(stacked.read('nope.blp')).resolves.toBeNull();
  });

  it('exists 任一命中即 true', async () => {
    const stacked = new LayeredDataSource([high, low]);
    expect(await stacked.exists('only-low.blp')).toBe(true);
    expect(await stacked.exists('only-high.blp')).toBe(true);
    expect(await stacked.exists('nope.blp')).toBe(false);
  });

  it('list 合并且高优先同名路径去重', () => {
    const stacked = new LayeredDataSource([high, low]);
    const listed = stacked.list().map((p) => p.toLowerCase());
    // 高优先层 index0 的同名项存在。
    expect(listed).toContain('a\\shared.blp');
    expect(listed).toContain('only-low.blp');
    expect(listed).toContain('only-high.blp');
    // 同名项只保留一个（大小写不敏感去重）。
    const shared = listed.filter((p) => p === 'a\\shared.blp');
    expect(shared.length).toBe(1);
  });
});

describe('MpqDataSource + Layered 组合（近似 loadStandardArchives）', () => {
  it('四层 MPQ 按高优先在前叠加入栈，读时序高优先优先', async () => {
    const fns = memMpqFns({
      '/w/war3.mpq': { 'ui\\war3skins.txt': 'war3-skins' },
      '/w/war3x.mpq': { 'ui\\war3skins.txt': 'war3x-skins', 'ui\\q.blp': 'Q' },
      '/w/war3xlocal.mpq': { 'ui\\q.blp': 'QLOCAL' },
      '/w/war3patch.mpq': { 'ui\\war3skins.txt': 'patch-skins' },
    });
    const make = (name: string) =>
      new MpqDataSource(
        { name, path: `/w/${name.toLowerCase()}` },
        fns,
      );
    // openwar3 PROFILE tft = [war3, war3x, war3xlocal, war3patch]，低优先在前；
    // 入栈后"后加载覆盖前，最高优先在前" → index0 为 war3patch。
    const layered = new LayeredDataSource([
      make('War3Patch.mpq'),
      make('War3xLocal.mpq'),
      make('War3x.mpq'),
      make('War3.mpq'),
    ]);
    // war3skins 在多层存在：最高优先的 War3Patch 生效。
    const skins = await layered.read('UI\\war3skins.txt');
    expect(new TextDecoder().decode(skins!)).toBe('patch-skins');
    // q.blp 只存在 war3x 与 war3xlocal：war3patch 无此文件，回退到 war3xlocal。
    const q = await layered.read('ui/q.blp');
    expect(new TextDecoder().decode(q!)).toBe('QLOCAL');
    await expect(layered.read('missing.blp')).resolves.toBeNull();
  });
});