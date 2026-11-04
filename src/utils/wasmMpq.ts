/**
 * 浏览器端 MPQ 数据源（路径 A 的产品接线）。
 *
 * ## 与桌面路径的关系
 * 桌面走 `tauriMpqFns`（Tauri `invoke` → Rust `wow_mpq`）。浏览器没有文件系统访问，
 * 改由用户**主动选择 MPQ 文件**，字节留在内存，解析交给 WASM 内核。
 * 两条路径实现同一个 `MpqFns` 接口，`MPQManager` / `DataSource` 无感知。
 *
 * ## 诚实边界
 * - 浏览器不能遍历安装目录：需用户逐个选 MPQ（`War3.mpq` / `War3x.mpq` / …）。
 * - WASM 侧只读经典 hash/block 表（V1/V2/V3），V4 的 HET/BET 与 patch 文件不支持。
 * - 逐字节对拍（war3.mpq 全量）：BLP 3935/3935、MDX 2048/2048、FDF 71/71 与参考实现
 *   openwar3 完全一致；`.wav`（Huffman+ADPCM 音频）与参考存在差异，属音频编解码，
 *   不影响 UI 设计器的纹理/模型/FDF 能力。
 */

import { isBrowserRuntime, pickFileBrowser } from './platformBridge';
import { loadWasmModule, type WasmModule } from './wasmBridge';
import type { MpqFns, MpqFsFile } from './dataSource';

/** 浏览器已载入内存的 MPQ 档案（键为档案名，如 `War3.mpq`）。 */
interface BrowserArchive {
  file: File;
  bytes: Uint8Array;
  /** WASM 归档句柄；首次使用时惰性打开。 */
  handle: number | null;
}

const archives = new Map<string, BrowserArchive>();

/** 测试用：清空已载入的浏览器档案（生产由用户重新选文件覆盖）。 */
export function __resetBrowserArchives(): void {
  archives.clear();
}

/** 测试用：注入预置档案（避免测试里造真实 MPQ 字节）。 */
export function __setBrowserArchive(name: string, bytes: Uint8Array, file?: File): void {
  archives.set(name, {
    file: file ?? new File([bytes as unknown as BlobPart], name),
    bytes,
    handle: null,
  });
}

/** 已载入的档案名列表（供 UI 展示）。 */
export function listBrowserArchives(): string[] {
  return Array.from(archives.keys());
}

/**
 * 在浏览器中选择一个 MPQ 档案并读入内存。
 *
 * 返回成功载入的档案名数组（未选则空数组）。档案通常只有 3~4 个，
 * 由 UI 重复调用逐个添加（`<input multiple>` 在部分浏览器被禁用）。
 */
export async function pickMpqArchives(): Promise<string[]> {
  if (typeof document === 'undefined') return [];
  const file = await pickFileBrowser('.mpq,.MPQ');
  if (!file) return [];
  const bytes = new Uint8Array(await file.arrayBuffer());
  archives.set(file.name, { file, bytes, handle: null });
  return [file.name];
}

/**
 * 取档案名（大小写不敏感）。
 *
 * 先按完整路径精确/忽略大小写匹配；再按 **basename** 匹配——因为上层
 * `MPQManager` 传的是 `join(war3Path, 'War3.mpq')` 这种完整路径，
 * 而浏览器只把用户选中的文件名（`War3.mpq`）作为键。
 */
function findArchiveName(archivePath: string): string | null {
  if (archives.has(archivePath)) return archivePath;
  const lower = archivePath.toLowerCase();
  for (const name of archives.keys()) {
    if (name.toLowerCase() === lower) return name;
  }
  const base = archivePath.split(/[/\\]/).pop()?.toLowerCase();
  if (!base) return null;
  for (const name of archives.keys()) {
    if (name.toLowerCase() === base) return name;
  }
  return null;
}

/** 档案句柄（惰性打开，失败不缓存以便重试）。 */
async function handleOf(name: string, mod: WasmModule): Promise<number> {
  const arc = archives.get(name)!;
  if (arc.handle !== null) return arc.handle;
  const handle = mod.mpq_open(arc.bytes);
  arc.handle = handle;
  return handle;
}

/**
 * 基于 WASM 的 `MpqFns` 实现（浏览器分支）。
 *
 * 语义与 `tauriMpqFns` 一致：找不到文件返回 `null`，列表来自 `(listfile)`。
 */
export const wasmMpqFns: MpqFns = {
  async readFile(archivePath: string, fileName: string) {
    const name = findArchiveName(archivePath);
    if (!name) return null;
    const mod = await loadWasmModule();
    if (!mod) return null;
    const handle = await handleOf(name, mod);
    try {
      const bytes = mod.mpq_read_file(handle, fileName);
      // 复制到独立 ArrayBuffer：WASM 内存会随下次调用失效，不能直接暴露视图。
      return bytes.slice().buffer as ArrayBuffer;
    } catch {
      return null;
    }
  },

  async listFiles(archivePath: string): Promise<MpqFsFile[]> {
    const name = findArchiveName(archivePath);
    if (!name) return [];
    const mod = await loadWasmModule();
    if (!mod) return [];
    const handle = await handleOf(name, mod);
    try {
      const names: string[] = JSON.parse(mod.mpq_list(handle));
      return names.map((n) => ({ name: n, size: 0 }));
    } catch {
      // `(listfile)` 缺失：与桌面 `list_files` 一致降级为空列表，不抛错。
      return [];
    }
  },

  async hasFile(archivePath: string, fileName: string) {
    const name = findArchiveName(archivePath);
    if (!name) return false;
    const mod = await loadWasmModule();
    if (!mod) return false;
    const handle = await handleOf(name, mod);
    try {
      return mod.mpq_has_file(handle, fileName);
    } catch {
      return false;
    }
  },
};

/**
 * 按运行时选择 MPQ 实现：浏览器 → WASM，其余（桌面/测试）→ Tauri。
 *
 * 与 `platformBridge.isBrowserRuntime()` 同一判定，保证既有 21 个 Tauri-mock
 * 测试语义不变（jsdom 被判为非浏览器）。
 */
export function defaultMpqFns(tauriFns: MpqFns): MpqFns {
  return isBrowserRuntime() ? wasmMpqFns : tauriFns;
}
