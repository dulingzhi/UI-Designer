/**
 * MPQManager → DataSource 适配层单测（阶段 D）。
 * 通过注入内存版 MpqFns，验证 loadArchive 后 getDataSource() 的三层读时序，
 * 不依赖真实 Tauri/Rust 后端。
 */
import { describe, it, expect, vi } from 'vitest';
import { MPQManager } from '../src/utils/mpqManager';
import type { MpqFns } from '../src/utils/dataSource';

// unloadAll() 会调用真实 Tauri invoke；在 node 下必须打桩，避免同步抛错。
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve()),
}));

/** 注入式 MpqFns：以档案路径为 key，模拟 Rust read_mpq_file / listfile。 */
function memMpqFns(archives: Record<string, Record<string, string>>): MpqFns {
  return {
    async readFile(archivePath, fileName) {
      const map = archives[archivePath];
      if (!map) return null;
      const content = map[fileName.toLowerCase()];
      return content !== undefined ? new TextEncoder().encode(content).buffer : null;
    },
    async listFiles(archivePath) {
      const files = archives[archivePath] ?? {};
      return Object.entries(files).map(([name, content]) => ({
        name,
        size: new TextEncoder().encode(content).length,
      }));
    },
  };
}

describe('MPQManager.getDataSource()', () => {
  it('loadArchive 后 DataSource 多层读取按高优先覆盖', async () => {
    const basePath = '/w3';
    const fns = memMpqFns({
      [`${basePath}\\War3.mpq`]: { 'ui\\shared.blp': 'WAR3', 'ui\\only-war3.txt': 'W3' },
      [`${basePath}\\War3x.mpq`]: { 'ui\\shared.blp': 'WAR3X' },
      [`${basePath}\\War3Patch.mpq`]: { 'ui\\only-patch.txt': 'PATCH' },
    });
    const manager = new MPQManager(fns, (base, name) =>
      Promise.resolve(`${base}\\${name}`),
    );

    // 模拟 setWar3Path 内部路径（此处直接手动调用 loadArchive 降低耦合）
    // loadStandardArchives 依赖 this.war3Path 与 join()，此处注入私有字段绕过：
    (manager as unknown as { war3Path: string }).war3Path = '/w3';
    await Promise.all([
      manager.loadArchive('War3.mpq'),
      manager.loadArchive('War3x.mpq'),
      manager.loadArchive('War3Patch.mpq'),
    ]);

    const ds = manager.getDataSource();

    // 高优先覆盖：War3x 的 UI\SHARED.blp 优先于 War3 的 ui\shared.blp。
    const shared = await ds.read('UI\\shared.blp');
    expect(new TextDecoder().decode(shared!)).toBe('WAR3X');

    // 仅在低层存在的文件仍可回退读取。
    const war3Only = await ds.read('ui\\only-war3.txt');
    expect(new TextDecoder().decode(war3Only!)).toBe('W3');
    const patchOnly = await ds.read('ui\\only-patch.txt');
    expect(new TextDecoder().decode(patchOnly!)).toBe('PATCH');

    // 不存在返回 null。
    await expect(ds.read('ui\\missing.blp')).resolves.toBeNull();
  });

  it('未加载档案时返回空 DataSource', async () => {
    const manager = new MPQManager(memMpqFns({}));
    const ds = manager.getDataSource();
    await expect(ds.read('ui\\x.blp')).resolves.toBeNull();
    expect(ds.list()).toEqual([]);
  });

  it('getCachedDataSource() 返回稳定共享实例，卸载后重建（D-4 下游消费路径）', async () => {
    const basePath = '/w3';
    const fns = memMpqFns({
      [`${basePath}\\War3.mpq`]: { 'ui\\a.blp': 'A' },
    });
    const manager = new MPQManager(fns, (base, name) =>
      Promise.resolve(`${base}\\${name}`),
    );
    (manager as unknown as { war3Path: string }).war3Path = '/w3';
    await manager.loadArchive('War3.mpq');

    // 首次获取后复用同一实例（下游 TextureCache/textureLoader 共享）。
    const first = manager.getCachedDataSource();
    const second = manager.getCachedDataSource();
    expect(second).toBe(first);

    // 卸载后缓存置空：下一次获取（重新加载档案后）重建为带档案的新实例。
    manager.unloadAll();
    await manager.loadArchive('War3.mpq');
    const reconstructed = manager.getCachedDataSource();
    expect(reconstructed).not.toBe(first);
    const buf = await reconstructed.read('ui\\a.blp');
    expect(new TextDecoder().decode(buf!)).toBe('A');
  });
});