// @vitest-environment jsdom
/**
 * platformBridge Tauri 分支补测（v8 100% 门禁）。
 * 通过注入 __TAURI_INTERNALS__ 让 isBrowserRuntime()=false，
 * 走 readTextFileUniversal / writeTextFileUniversal 的 Tauri 分支。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

const mockReadTextFile = vi.fn((p: string) => Promise.resolve('content:' + p));
const mockWriteTextFile = vi.fn((p: string, c: string) => { void p; void c; return Promise.resolve(); });

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: (p: string) => mockReadTextFile(p),
  writeTextFile: (p: string, c: string) => mockWriteTextFile(p, c),
}));

import * as pb from './platformBridge';

afterEach(() => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  vi.clearAllMocks();
});

function withTauri() {
  (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
}

describe('platformBridge Tauri 分支', () => {
  it('readTextFileUniversal：有 Tauri 注入时走 plugin-fs 并透传路径', async () => {
    withTauri();
    expect(pb.isBrowserRuntime()).toBe(false);
    await expect(pb.readTextFileUniversal('C:/x.fdf')).resolves.toBe('content:C:/x.fdf');
    expect(mockReadTextFile).toHaveBeenCalledWith('C:/x.fdf');
  });

  it('writeTextFileUniversal：有 Tauri 注入时走 plugin-fs', async () => {
    withTauri();
    await expect(pb.writeTextFileUniversal('C:/y.fdf', 'data')).resolves.toBeUndefined();
    expect(mockWriteTextFile).toHaveBeenCalledWith('C:/y.fdf', 'data');
  });

  it('isBrowserRuntime：document.defaultView 带 __TAURI_INTERNALS__ → false', () => {
    // 覆盖 L33 分支：defaultView 自身带 Tauri 注入
    const win = window as unknown as { __TAURI_INTERNALS__?: unknown };
    win.__TAURI_INTERNALS__ = {};
    try {
      expect(pb.isBrowserRuntime()).toBe(false);
    } finally {
      delete win.__TAURI_INTERNALS__;
    }
  });

  it('isBrowserRuntime：navigator 为 undefined 时不崩溃', () => {
    const savedNav = globalThis.navigator;
    // @ts-expect-error 临时移除
    delete globalThis.navigator;
    try {
      const r = pb.isBrowserRuntime();
      expect(typeof r).toBe('boolean');
    } finally {
      globalThis.navigator = savedNav;
    }
  });
});
