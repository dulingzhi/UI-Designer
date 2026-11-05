// @vitest-environment jsdom
/**
 * `pickDirectoryBrowser` 单测——浏览器"选择目录"能力的双路径契约。
 *
 * ## 背景（本轮修正）
 * 之前的实现只提供"逐个选 MPQ 文件"，并在文档里写成"浏览器无法访问安装目录"。
 * 这是**错的**：浏览器不允许自动遍历任意路径，但**允许用户主动选择一个目录**
 * 并把其中文件交给页面。本轮改为目录选择，本文件锁住两条实现路径：
 *
 * 1. **首选** File System Access API `showDirectoryPicker()`（Chrome/Edge）：
 *    只取一层文件（不递归），`AbortError` 视为用户取消。
 * 2. **回落** `<input webkitdirectory>`（Chrome/Edge/Firefox/Safari 均支持）：
 *    取 `input.files` 全部内容。
 *
 * 探针要点（实测容易踩的坑）：
 * - `showDirectoryPicker` 不可用 / 抛非 Abort 错误时，**必须**回落到 input 路径，
 *   不能直接返回 null（否则用户"点了没反应"）。
 * - 目录里没有任何文件时返回 `null`（与"取消"同义），不是空数组。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as pb from './platformBridge';

/** 造一个 File 替身。 */
function mkFile(name: string): File {
  return { name } as unknown as File;
}

/**
 * 拦截 `<input>` 方案：捕获创建的 input 元素，便于手动触发 onchange。
 * jsdom 的 `input.click()` 不会真的弹对话框，所以要自己驱动。
 */
function captureDirectoryInput() {
  const captured: { el: HTMLInputElement | null } = { el: null };
  const origCreate = document.createElement.bind(document);
  const spy = vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = origCreate(tag);
    if (tag === 'input') {
      captured.el = el as HTMLInputElement;
      // 阻止真实点击（jsdom 下无对话框，但保持行为确定）
      (el as HTMLInputElement).click = () => {};
    }
    return el;
  }) as typeof document.createElement);
  return { captured, restore: () => spy.mockRestore() };
}

/** 给 input 装一批"用户选中的文件"并触发 change。 */
function selectFiles(el: HTMLInputElement, files: File[]) {
  Object.defineProperty(el, 'files', {
    value: Object.assign(files.slice(), { item: (i: number) => files[i] ?? null }),
    configurable: true,
  });
  el.onchange?.(new Event('change'));
}

const origShowDirectoryPicker = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker');

beforeEach(() => {
  // 默认移除 FSA API，让用例显式决定走哪条路径
  delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (origShowDirectoryPicker) {
    Object.defineProperty(window, 'showDirectoryPicker', origShowDirectoryPicker);
  } else {
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  }
});

describe('pickDirectoryBrowser — File System Access API 路径', () => {
  it('showDirectoryPicker 可用 → 只取一层文件（跳过子目录）', async () => {
    const fileA = mkFile('War3.mpq');
    const fileB = mkFile('War3x.mpq');
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = vi.fn(async () => ({
      values: () =>
        (async function* () {
          yield { kind: 'file', getFile: async () => fileA };
          yield { kind: 'directory' }; // 子目录：应被跳过（不递归）
          yield { kind: 'file', getFile: async () => fileB };
        })(),
    }));

    const files = await pb.pickDirectoryBrowser();
    expect(files).toEqual([fileA, fileB]);
  });

  it('用户取消（AbortError）→ null，且不回落', async () => {
    const spy = vi.fn(async () => {
      const err = new Error('aborted');
      (err as { name?: string }).name = 'AbortError';
      throw err;
    });
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = spy;

    const { captured, restore } = captureDirectoryInput();
    try {
      const files = await pb.pickDirectoryBrowser();
      expect(files).toBeNull();
      // 关键：取消不应再弹 input
      expect(captured.el).toBeNull();
    } finally {
      restore();
    }
  });

  it('非 Abort 错误（如权限策略拒绝）→ 回落 input 路径', async () => {
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = vi.fn(async () => {
      throw new Error('SecurityError');
    });

    const { captured, restore } = captureDirectoryInput();
    try {
      const p = pb.pickDirectoryBrowser();
      await Promise.resolve(); // 让 FSA 分支 reject 并进入回落
      await Promise.resolve();
      expect(captured.el, '应回落到 <input> 方案').toBeTruthy();
      const files = [mkFile('War3.mpq')];
      selectFiles(captured.el!, files);
      expect(await p).toEqual(files);
    } finally {
      restore();
    }
  });

  it('showDirectoryPicker 返回的目录无 values() → 返回空数组（不崩）', async () => {
    (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = vi.fn(async () => ({}));
    const files = await pb.pickDirectoryBrowser();
    expect(files).toEqual([]);
  });
});

describe('pickDirectoryBrowser — <input webkitdirectory> 回落路径', () => {
  it('无 FSA API → 用 input，且设置 webkitdirectory/multiple', async () => {
    const { captured, restore } = captureDirectoryInput();
    try {
      const p = pb.pickDirectoryBrowser();
      expect(captured.el).toBeTruthy();
      const el = captured.el!;
      expect((el as unknown as { webkitdirectory?: boolean }).webkitdirectory).toBe(true);
      expect((el as unknown as { directory?: boolean }).directory).toBe(true);
      expect(el.multiple).toBe(true);
      expect(el.type).toBe('file');

      const files = [mkFile('War3.mpq'), mkFile('War3x.mpq')];
      selectFiles(el, files);
      expect(await p).toEqual(files);
    } finally {
      restore();
    }
  });

  it('选中 0 个文件 → null', async () => {
    const { captured, restore } = captureDirectoryInput();
    try {
      const p = pb.pickDirectoryBrowser();
      selectFiles(captured.el!, []);
      expect(await p).toBeNull();
    } finally {
      restore();
    }
  });

  it('无 document（node 环境）→ null', async () => {
    const savedDoc = globalThis.document;
    // @ts-expect-error 故意移除 document 以验证 node 分支
    delete globalThis.document;
    try {
      expect(await pb.pickDirectoryBrowser()).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'document', { value: savedDoc, configurable: true });
    }
  });

  it('重复触发 change 只结算一次（settled 守卫）', async () => {
    const { captured, restore } = captureDirectoryInput();
    try {
      const p = pb.pickDirectoryBrowser();
      const el = captured.el!;
      const files = [mkFile('War3.mpq')];
      selectFiles(el, files);
      // 第二次 change（浏览器偶发重复事件）不应改写已结算结果
      selectFiles(el, [mkFile('Other.mpq')]);
      expect(await p).toEqual(files);
    } finally {
      restore();
    }
  });

  it('用户取消（无 change，靠 focus 兜底）→ 800ms 后返回 null', async () => {
    vi.useFakeTimers();
    const { captured, restore } = captureDirectoryInput();
    try {
      const p = pb.pickDirectoryBrowser();
      // 模拟"窗口重新获得焦点但没选文件"
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(900);
      expect(await p).toBeNull();
    } finally {
      restore();
      vi.useRealTimers();
    }
  });

  it('focus 兜底在已选中文件时不误判取消', async () => {
    vi.useFakeTimers();
    const { captured, restore } = captureDirectoryInput();
    try {
      const p = pb.pickDirectoryBrowser();
      const files = [mkFile('War3.mpq')];
      selectFiles(captured.el!, files);
      // 选中后再触发 focus 计时器：settled 已置位，不得覆盖结果
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(900);
      expect(await p).toEqual(files);
    } finally {
      restore();
      vi.useRealTimers();
    }
  });
});
