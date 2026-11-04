/**
 * WASM 解析内核桥接（浏览器路径 A）。
 *
 * ## 目的
 * 把 Rust 侧的**纯字节解析**搬进浏览器，让纯浏览器版恢复 MPQ 档案读取 /
 * BLP 纹理解码 / MDX 模型解析能力；桌面 Tauri 路径**逐字节不变**。
 *
 * ## 双通道分派
 * - `isBrowserRuntime()` 为真（真实浏览器）→ 惰性加载 `public/wasm-pkg` 的 wasm 模块；
 * - 其余情况（Tauri 桌面 / node / jsdom 测试）→ 返回 `null`，调用方回落既有 Tauri 路径。
 *
 * 刻意**不在 Node/vitest 里加载 WASM**：既有 21 个 Tauri-mock 测试的语义必须保留
 * （与 `platformBridge.isBrowserRuntime` 同一条规则）。
 *
 * ## 诚实边界
 * - MPQ：只读经典 hash/block 表（V1/V2/V3）。V4 的 HET/BET、patch 文件不支持。
 * - BLP：BLP1 的 JPEG 与调色板（direct）路径；DXT 未实现（WC3 不用）。
 * - MDX：与桌面端共用同一份 `src-tauri/src/mdx_parser.rs` 源码（`#[path]` 引用，零漂移）。
 */

import { isBrowserRuntime } from './platformBridge';

/** WASM 模块的对外形态（与 `wasm-pack --target web` 生成的导出同名）。 */
export interface WasmModule {
  default: (input?: unknown) => Promise<unknown>;
  wasm_version(): string;
  mpq_open(archive: Uint8Array): number;
  mpq_list(handle: number): string;
  mpq_has_file(handle: number, name: string): boolean;
  mpq_read_file(handle: number, name: string): Uint8Array;
  mpq_close(handle: number): void;
  decode_blp_to_rgba(data: Uint8Array): {
    width: number;
    height: number;
    data(): Uint8Array;
    free(): void;
  };
  parse_mdx_file(data: Uint8Array): string;
}

/** wasm 包的静态资源路径（Vite 从 `public/` 原样拷出）。 */
export const WASM_PKG_DIR = '/wasm-pkg';
export const WASM_JS = `${WASM_PKG_DIR}/wc3ui_wasm.js`;
export const WASM_BIN = `${WASM_PKG_DIR}/wc3ui_wasm_bg.wasm`;

/**
 * 加载器的可注入依赖（单测用；生产走默认值）。
 *
 * 之所以留这个缝隙：真实分支需要动态 import 一个只在浏览器存在的 ESM 包，
 * vitest（node/jsdom）无法真实执行；注入后两条分支都可被真实覆盖。
 */
export interface WasmLoaderDeps {
  /** 是否走浏览器 WASM 通道。 */
  isBrowser: () => boolean;
  /** 实际加载模块（默认动态 import wasm-pack 产物并初始化）。 */
  importModule: () => Promise<WasmModule>;
}

/** 动态导入器（可注入，便于在 vitest 下真实执行默认加载路径）。 */
export type DynamicImporter = (url: string) => Promise<unknown>;

/** 真实动态导入器（唯一实现，重置时直接指回它，避免重复 lambda）。 */
const realImport: DynamicImporter = (url) => import(/* @vite-ignore */ url);

let dynamicImport: DynamicImporter = realImport;

/** 测试用：替换动态导入器（生产代码不应调用）。 */
export function __setDynamicImporter(fn: DynamicImporter): void {
  dynamicImport = fn;
}

/** 测试用：恢复真实动态导入器。 */
export function __resetDynamicImporter(): void {
  dynamicImport = realImport;
}

/** 默认加载：动态 import wasm-pack 产物并完成 wasm 实例化。 */
export const defaultImportModule = async (): Promise<WasmModule> => {
  const mod = (await dynamicImport(WASM_JS)) as WasmModule;
  await mod.default({ module_or_path: WASM_BIN });
  return mod;
};

const defaultDeps: WasmLoaderDeps = {
  isBrowser: isBrowserRuntime,
  importModule: defaultImportModule,
};

/** 模块缓存（成功加载后复用；失败不缓存，允许重试）。 */
let cached: WasmModule | null = null;
let pending: Promise<WasmModule> | null = null;

/**
 * 惰性加载 WASM 模块。
 *
 * 返回 `null` 表示「当前环境不走 WASM」（非浏览器运行时）——调用方应回落 Tauri。
 * 浏览器环境加载失败会**抛错**（真实故障不静默吞掉，便于用户看到原因）。
 */
export async function loadWasmModule(deps: WasmLoaderDeps = defaultDeps): Promise<WasmModule | null> {
  if (!deps.isBrowser()) return null;
  if (cached) return cached;
  if (pending) return pending;

  pending = deps.importModule();
  try {
    cached = await pending;
    return cached;
  } finally {
    // 无论成功失败都清空 pending：失败不缓存，下次调用可重试。
    pending = null;
  }
}

/** 测试用：重置模块缓存（生产代码不应调用）。 */
export function __resetWasmModuleCache(): void {
  cached = null;
  pending = null;
}
