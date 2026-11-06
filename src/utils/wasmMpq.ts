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
 * - 逐字节对拍（war3.mpq 全量 10609 文件）：**全部 0 不一致**——BLP 3935、wav 2695、
 *   MDX 2048、FDF 71 等逐字节等同参考实现 openwar3（r254 修复 Huffman 后）。
 */

import { isBrowserRuntime, pickDirectoryBrowser } from './platformBridge';
import { loadWasmModule, type WasmModule } from './wasmBridge';
import { LayeredDataSource, MpqDataSource, type DataSource, type MpqFns, type MpqFsFile } from './dataSource';

/** 浏览器已载入内存的 MPQ 档案（键为档案名，如 `War3.mpq`）。 */
interface BrowserArchive {
  file: File;
  /**
   * JS 侧的归档字节。
   *
   * **打开句柄后置 null**（r258 内存优化）：wasm-bindgen 的 `mpq_open(Vec<u8>)`
   * 会把 Uint8Array **搬进** wasm 线性内存，此后字节归 Rust 侧所有。
   * 若 JS 继续持有同一份，内存里就同时存在两份（实测 4× → 2×）。
   * 需要重开句柄时从 `file` 重新读取即可（File 是磁盘引用，不占内存）。
   */
  bytes: Uint8Array | null;
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
 * 浏览器侧标准档案名（与 `MPQManager` 的 `WAR3_127_MPQS` 一致）。
 * 这里提前声明，供目录筛选使用。
 */
const STANDARD_ARCHIVES = ['War3.mpq', 'War3x.mpq', 'War3xLocal.mpq', 'War3Patch.mpq'] as const;

/** 是否为需要读入的档案文件（按扩展名，大小写不敏感）。 */
function isMpqFile(name: string): boolean {
  return name.toLowerCase().endsWith('.mpq');
}

/**
 * 在浏览器中**选择 Warcraft 3 安装目录**，自动读入其中的 MPQ 档案。
 *
 * ## 与"逐个选文件"的差别
 * 用户只需选一次目录（原生目录对话框），程序自动挑出标准 MPQ
 * （`War3.mpq` / `War3x.mpq` / `War3xLocal.mpq` / `War3Patch.mpq`）。
 * 若目录里没有标准名（如自定义/改名档案），则回落到"载入目录中所有 .mpq"，
 * 避免用户以为"选了没反应"。
 *
 * ## 返回
 * 本次新载入的档案名；用户取消返回空数组。
 *
 * ## 诚实边界
 * `showDirectoryPicker()` 只能读到**一层**文件（不递归子目录）——
 * 这对 WC3 安装目录足够（MPQ 都在根下），且能避免把 `Data/` 等无关大文件拖进内存。
 */
export async function pickMpqArchives(): Promise<string[]> {
  if (typeof document === 'undefined') return [];
  const files = await pickDirectoryBrowser();
  if (!files || files.length === 0) return [];

  // 先按标准名匹配；一个都没匹配上再回落到"全部 .mpq"
  const lowerToFile = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  let targets: File[] = [];
  for (const want of STANDARD_ARCHIVES) {
    const hit = lowerToFile.get(want.toLowerCase());
    if (hit) targets.push(hit);
  }
  if (targets.length === 0) {
    targets = files.filter((f) => isMpqFile(f.name));
  }
  if (targets.length === 0) return [];

  const loaded: string[] = [];
  for (const file of targets) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    archives.set(file.name, { file, bytes, handle: null });
    loaded.push(file.name);
  }
  return loaded;
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

/**
 * 档案句柄（惰性打开，失败不缓存以便重试）。
 *
 * 打开成功后**丢弃 JS 侧的 bytes**：wasm-bindgen 的 `mpq_open(Vec<u8>)` 已把
 * `Uint8Array` 搬进 wasm 线性内存（所有权转移），JS 再留一份就是纯浪费。
 * 实测 war3.mpq（430MB）会从 4.01× 降到约 2×→1×。
 * 若之后需要重开（句柄被 close），从 `arc.file` 重新读取即可——File 只是磁盘引用。
 */
async function handleOf(name: string, mod: WasmModule): Promise<number> {
  const arc = archives.get(name)!;
  if (arc.handle !== null) return arc.handle;

  // bytes 已被丢弃过？从 File 重新读（仅在句柄被显式释放后才会发生）
  if (!arc.bytes) {
    arc.bytes = new Uint8Array(await arc.file.arrayBuffer());
  }
  const bytes = arc.bytes;
  const handle = mod.mpq_open(bytes);
  // 交接完成：wasm 侧持有字节，JS 侧释放引用让 GC 回收
  arc.bytes = null;
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

/** 已载入的档案名按标准优先级排序（同优先级按名字，保证结果稳定）。 */
export function orderedBrowserArchives(): string[] {
  const loaded = listBrowserArchives();
  const byLower = new Map(loaded.map((n) => [n.toLowerCase(), n]));
  const ordered: string[] = [];
  for (const want of STANDARD_ARCHIVES) {
    const hit = byLower.get(want.toLowerCase());
    if (hit) {
      ordered.push(hit);
      byLower.delete(want.toLowerCase());
    }
  }
  // 用户可能载入了非标准命名的档案：按名字排序追加，保持确定性
  ordered.push(...Array.from(byLower.values()).sort());
  return ordered;
}

/**
 * 用**已载入内存**的浏览器档案构建多层 `DataSource`（高优先在前）。
 *
 * 语义与 `MPQManager.getDataSource()` 对齐：低优先在前加载、高优先覆盖，
 * 因此这里反转后交给 `LayeredDataSource`。
 *
 * 未载入任何档案时返回空层栈（`DataSource` 语义：`exists=false` / `read=null`），
 * 而不是抛错——纹理浏览器在"还没选文件"时应当优雅显示空列表。
 */
export function browserDataSource(): DataSource {
  const ordered = orderedBrowserArchives();
  const layers = ordered
    .map((name) => new MpqDataSource({ name, path: name }, wasmMpqFns))
    .reverse();
  return new LayeredDataSource(layers);
}

