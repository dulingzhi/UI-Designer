// @vitest-environment jsdom
/**
 * platformBridge 单测——浏览器/桌面双通道判定的核心契约。
 *
 * 关键不变式（本文件的守卫目标）：
 * 1. Tauri 注入存在 → isTauri=true，绝不走浏览器分支；
 * 2. 真实浏览器（有 window、无 Tauri、UA 非 jsdom）→ isBrowserRuntime=true；
 * 3. **jsdom 测试环境 → isBrowserRuntime=false**（保留既有 Tauri mock 语义，
 *    否则所有 mock plugin-fs 的测试都会失效——r252 曾因此 21 个测试回归失败）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as pb from './platformBridge';

const origUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

function setUA(ua: string) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
}

function clearTauri() {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

function setTauri() {
  (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
}

beforeEach(() => {
  clearTauri();
});

afterEach(() => {
  clearTauri();
  if (origUA) Object.defineProperty(window.navigator, 'userAgent', origUA);
});

describe('platformBridge 环境判定', () => {
  it('无 Tauri 注入 → isTauri=false', () => {
    clearTauri();
    expect(pb.isTauri()).toBe(false);
  });

  it('有 Tauri 注入 → isTauri=true', () => {
    setTauri();
    expect(pb.isTauri()).toBe(true);
  });

  it('jsdom UA（测试环境）→ isBrowserRuntime=false（保留 Tauri mock 语义）', () => {
    setUA('Mozilla/5.0 (jsdom/30.1.3)');
    expect(pb.isBrowserRuntime()).toBe(false);
  });

  it('真实浏览器 UA 且无 Tauri → isBrowserRuntime=true', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36');
    expect(pb.isBrowserRuntime()).toBe(true);
  });

  it('有 Tauri 注入时即使真实浏览器 UA → isBrowserRuntime=false（桌面优先）', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0');
    setTauri();
    expect(pb.isBrowserRuntime()).toBe(false);
  });

  it('hasFileSystemAccess 反映 showOpenFilePicker 是否存在', () => {
    const w = window as unknown as { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
    const hadOpen = 'showOpenFilePicker' in w;
    const hadSave = 'showSaveFilePicker' in w;
    expect(typeof pb.hasFileSystemAccess()).toBe('boolean');
    // 恢复（jsdom 默认无此 API）
    if (!hadOpen) delete w.showOpenFilePicker;
    if (!hadSave) delete w.showSaveFilePicker;
  });
});

describe('platformBridge 文本 I/O', () => {
  it('downloadText 创建 Blob 并触发 a[download]（不抛错）', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      expect(() => pb.downloadText('x.fdf', 'Frame "TEXT" { }')).not.toThrow();
      expect(createSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
      clickSpy.mockRestore();
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it('browserPathOf 返回文件名（浏览器无真实路径）', () => {
    const f = new File(['x'], 'a.fdf', { type: 'text/plain' });
    expect(pb.browserPathOf(f)).toBe('a.fdf');
  });

  it('readFileAsText 读取 File 内容', async () => {
    const f = new File(['hello'], 'a.txt', { type: 'text/plain' });
    await expect(pb.readFileAsText(f)).resolves.toBe('hello');
  });
});
