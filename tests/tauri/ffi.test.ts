/**
 * Tauri FFI 契约单测（阶段 D-3）。
 *
 * 目标：验证默认 `tauriMpqFns` 把 `DataSource` 操作映射到正确的 Rust 命令名与
 * 参数名（`read_mpq_file` / `load_mpq_archive` / `has_mpq_file`），并做
 * number[] → ArrayBuffer 的转换。这样即使没有真实 Rust 后端，也能守住接口契约。
 *
 * 通过 vitest `vi.mock('@tauri-apps/api/core')` 截获 `invoke`，断言调用。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// 在 mock 之后导入真实实现。
import { tauriMpqFns } from '../../src/utils/mpqManager';

describe('tauriMpqFns FFI 契约', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('readFile → read_mpq_file，number[] 转为 ArrayBuffer', async () => {
    invokeMock.mockResolvedValue([72, 105]); // "Hi" UTF-8
    const buf = await tauriMpqFns.readFile('/w/War3x.mpq', 'UI\\a.txt');
    expect(invokeMock).toHaveBeenCalledWith('read_mpq_file', {
      archivePath: '/w/War3x.mpq',
      fileName: 'UI\\a.txt',
    });
    // 数字数组 → ArrayBuffer。
    const bytes = new Uint8Array(buf!);
    expect(Array.from(bytes)).toEqual([72, 105]);
  });

  it('readFile 返回 null 时透传 null', async () => {
    invokeMock.mockResolvedValue(undefined);
    await expect(
      tauriMpqFns.readFile('/w/War3x.mpq', 'missing.txt'),
    ).resolves.toBeNull();
  });

  it('listFiles → load_mpq_archive，参数名 path', async () => {
    invokeMock.mockResolvedValue([{ name: 'UI\\x.blp', size: 100 }]);
    const files = await tauriMpqFns.listFiles('/w/War3.mpq');
    expect(invokeMock).toHaveBeenCalledWith('load_mpq_archive', {
      path: '/w/War3.mpq',
    });
    expect(files).toEqual([{ name: 'UI\\x.blp', size: 100 }]);
  });

  it('hasFile → has_mpq_file，返回布尔', async () => {
    invokeMock.mockResolvedValue(true);
    await expect(
      tauriMpqFns.hasFile!('/w/War3Patch.mpq', 'UI\\y.txt'),
    ).resolves.toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('has_mpq_file', {
      archivePath: '/w/War3Patch.mpq',
      fileName: 'UI\\y.txt',
    });
  });

  it('listFiles 失败（无 listfile）时按 MpqDataSource 契约降级空列表', async () => {
    // 该用例验证 adapt 层（见 dataSource.test.ts），此处仅确认命令签名。
    invokeMock.mockRejectedValue(new Error('no listfile'));
    await expect(tauriMpqFns.listFiles('/bad.mpq')).rejects.toThrow('no listfile');
  });
});