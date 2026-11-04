// @vitest-environment jsdom
/**
 * platformBridge 未覆盖分支补测（v8 精确覆盖门禁要求）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as pb from './platformBridge';

const origUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
afterEach(() => {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  if (origUA) Object.defineProperty(window.navigator, 'userAgent', origUA);
  vi.restoreAllMocks();
});

describe('platformBridge 边界分支', () => {
  it('hasFileSystemAccess：两个 picker 都存在时 true', () => {
    const w = window as unknown as Record<string, unknown>;
    w.showOpenFilePicker = () => {};
    w.showSaveFilePicker = () => {};
    expect(pb.hasFileSystemAccess()).toBe(true);
    delete w.showOpenFilePicker;
    delete w.showSaveFilePicker;
  });

  it('hasFileSystemAccess：仅一个存在时 false', () => {
    const w = window as unknown as Record<string, unknown>;
    w.showOpenFilePicker = () => {};
    expect(pb.hasFileSystemAccess()).toBe(false);
    delete w.showOpenFilePicker;
  });

  it('readTextFileUniversal：浏览器分支读 fetch 成功', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/120.0', configurable: true,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Frame "TEXT" { }', { status: 200 }),
    );
    await expect(pb.readTextFileUniversal('blob:x')).resolves.toContain('Frame');
  });

  it('readTextFileUniversal：浏览器分支 fetch 失败抛错', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/120.0', configurable: true,
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    await expect(pb.readTextFileUniversal('blob:y')).rejects.toThrow('读取失败');
  });

  it('writeTextFileUniversal：浏览器分支走下载（不抛错）', async () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 Chrome/120.0', configurable: true,
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:z');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await expect(pb.writeTextFileUniversal('a.fdf', 'x')).resolves.toBeUndefined();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('browserPathOf / downloadBlob 正常路径', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:w');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    expect(() => pb.downloadBlob('b.bin', new Blob(['x']))).not.toThrow();
    expect(clickSpy).toHaveBeenCalled();
  });

  it('downloadText 在无 document 时抛错', () => {
    const g = globalThis as { document?: Document };
    const saved = g.document;
    delete g.document;
    try {
      expect(() => pb.downloadText('a.txt', 'x')).toThrow('需要浏览器环境');
    } finally {
      g.document = saved;
    }
  });

  it('pickFileBrowser：无 document 时返回 null', async () => {
    const g = globalThis as { document?: Document };
    const saved = g.document;
    delete g.document;
    try {
      await expect(pb.pickFileBrowser()).resolves.toBeNull();
    } finally {
      g.document = saved;
    }
  });

  it('pickFileBrowser：选文件后 resolve 该 File', async () => {
    const f = new File(['x'], 'a.fdf');
    const inputRef = { current: null as HTMLInputElement | null };
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      inputRef.current = el as HTMLInputElement;
      return el;
    });
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
    const p = pb.pickFileBrowser();
    // 模拟 change 事件注入选中的文件
    const input = inputRef.current as HTMLInputElement | null;
    if (input) {
      Object.defineProperty(input, 'files', { value: [f], configurable: true });
      input.onchange?.(new Event('change'));
    }
    await expect(p).resolves.toBe(f);
  });
});
