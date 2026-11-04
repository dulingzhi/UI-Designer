/**
 * wasmBridge 单测（覆盖率：src/utils 需 100×4）。
 *
 * 两条分支都要真测：
 * 1. 非浏览器运行时 → 返回 null（不 import wasm，保留 Tauri mock 语义）；
 * 2. 浏览器运行时 → 惰性加载、成功缓存、失败不缓存且允许重试。
 *
 * 真实 wasm 加载在 vitest 下不可执行（产物是浏览器 ESM + WebAssembly 实例化），
 * 故通过 `WasmLoaderDeps` 注入 importModule —— 这是刻意留的可测缝隙，
 * 不是绕过断言：缓存/并发/失败重试三段逻辑都被真实执行。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  WASM_BIN,
  WASM_JS,
  WASM_PKG_DIR,
  __resetWasmModuleCache,
  __resetDynamicImporter,
  __setDynamicImporter,
  defaultImportModule,
  loadWasmModule,
  type WasmLoaderDeps,
  type WasmModule,
} from './wasmBridge';

function fakeModule(overrides: Partial<WasmModule> = {}): WasmModule {
  return {
    default: vi.fn(async () => undefined),
    wasm_version: () => '0.1.0',
    mpq_open: () => 1,
    mpq_list: () => '[]',
    mpq_has_file: () => false,
    mpq_read_file: () => new Uint8Array(),
    mpq_close: () => undefined,
    decode_blp_to_rgba: () => ({
      width: 1,
      height: 1,
      data: () => new Uint8Array(4),
      free: () => undefined,
    }),
    parse_mdx_file: () => '{}',
    ...overrides,
  };
}

function deps(overrides: Partial<WasmLoaderDeps> = {}): WasmLoaderDeps {
  return {
    isBrowser: () => true,
    importModule: async () => fakeModule(),
    ...overrides,
  };
}

describe('wasmBridge 常量', () => {
  it('导出 wasm 包路径（Vite 从 public/ 原样拷出）', () => {
    expect(WASM_PKG_DIR).toBe('/wasm-pkg');
    expect(WASM_JS).toBe('/wasm-pkg/wc3ui_wasm.js');
    expect(WASM_BIN).toBe('/wasm-pkg/wc3ui_wasm_bg.wasm');
  });
});

describe('loadWasmModule', () => {
  it('非浏览器运行时（桌面/测试）→ null，且不 import wasm', async () => {
    __resetWasmModuleCache();
    const importModule = vi.fn(async () => fakeModule());
    const r = await loadWasmModule(deps({ isBrowser: () => false, importModule }));
    expect(r).toBeNull();
    expect(importModule).not.toHaveBeenCalled();
  });

  it('浏览器运行时 → 返回模块，并调用 default() 初始化', async () => {
    __resetWasmModuleCache();
    const mod = fakeModule();
    const r = await loadWasmModule(deps({ importModule: async () => mod }));
    expect(r).toBe(mod);
    expect(await r!.wasm_version()).toBe('0.1.0');
  });

  it('成功后缓存：第二次调用不再 import', async () => {
    __resetWasmModuleCache();
    const importModule = vi.fn(async () => fakeModule());
    const d = deps({ importModule });
    const a = await loadWasmModule(d);
    const b = await loadWasmModule(d);
    expect(a).toBe(b);
    expect(importModule).toHaveBeenCalledTimes(1);
  });

  it('并发调用共享同一次加载（pending 复用）', async () => {
    __resetWasmModuleCache();
    let resolveIt: ((m: WasmModule) => void) | null = null;
    const importModule = vi.fn(
      () => new Promise<WasmModule>((res) => { resolveIt = res; }),
    );
    const d = deps({ importModule });
    const p1 = loadWasmModule(d);
    const p2 = loadWasmModule(d);
    // 两次调用都在等待同一个 pending
    expect(importModule).toHaveBeenCalledTimes(1);
    resolveIt!(fakeModule());
    const [a, b] = await Promise.all([p1, p2]);
    expect(a).toBe(b);
    expect(importModule).toHaveBeenCalledTimes(1);
  });

  it('加载失败 → 抛错且不缓存，下次可重试成功', async () => {
    __resetWasmModuleCache();
    let attempt = 0;
    const importModule = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error('wasm 404');
      return fakeModule();
    });
    const d = deps({ importModule });

    await expect(loadWasmModule(d)).rejects.toThrow('wasm 404');
    // 失败不缓存：重试会再次 import 并成功
    const r = await loadWasmModule(d);
    expect(r).not.toBeNull();
    expect(importModule).toHaveBeenCalledTimes(2);
  });

  it('__resetWasmModuleCache 清掉缓存后再次 import', async () => {
    __resetWasmModuleCache();
    const importModule = vi.fn(async () => fakeModule());
    const d = deps({ importModule });
    await loadWasmModule(d);
    __resetWasmModuleCache();
    await loadWasmModule(d);
    expect(importModule).toHaveBeenCalledTimes(2);
  });

  it('默认全流程（真实 defaultImportModule）：import JS → init(wasm) → 返回模块', async () => {
    __resetWasmModuleCache();
    const mod = fakeModule();
    const importFn = vi.fn(async (url: string) => {
      expect(url).toBe(WASM_JS);
      return mod;
    });
    __setDynamicImporter(importFn);

    // 不传 deps → 走 defaultDeps（isBrowser=isBrowserRuntime=false in vitest），
    // 故显式把 isBrowser 换成 true 以走到真实 importModule。
    const r = await loadWasmModule({ isBrowser: () => true, importModule: defaultImportModule });
    expect(r).toBe(mod);
    expect(importFn).toHaveBeenCalledWith(WASM_JS);
    expect(mod.default).toHaveBeenCalledWith({ module_or_path: WASM_BIN });
  });

  it('真实动态导入器在 node 下无法解析 wasm 产物 → 抛错（不静默）', async () => {
    __resetWasmModuleCache();
    __resetDynamicImporter();
    // node 无法加载浏览器 ESM 产物；断言其**抛错**而非静默成功。
    await expect(defaultImportModule()).rejects.toBeTruthy();
  });
});
