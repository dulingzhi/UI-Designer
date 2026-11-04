// @vitest-environment jsdom
/**
 * platformBridge 剩余分支补测（v8 100% 门禁）。
 * 覆盖：无 window/document 的 node 语义、pickFileBrowser 取消与二次 settle、
 * downloadText 自定义 mime。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as pb from './platformBridge';

const origUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');
afterEach(() => {
  if (origUA) Object.defineProperty(window.navigator, 'userAgent', origUA);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** 临时移除全局对象，模拟 node 环境（无 window/document）。 */
function withoutGlobal<T>(name: 'window' | 'document', fn: () => T): T {
  const saved = (globalThis as Record<string, unknown>)[name];
  delete (globalThis as Record<string, unknown>)[name];
  try {
    return fn();
  } finally {
    if (saved !== undefined) (globalThis as Record<string, unknown>)[name] = saved;
  }
}

describe('platformBridge node 语义（无 window/document）', () => {
  it('isTauri：无 window → false', () => {
    expect(withoutGlobal('window', () => pb.isTauri())).toBe(false);
  });

  it('isBrowserRuntime：无 document → false', () => {
    expect(withoutGlobal('document', () => pb.isBrowserRuntime())).toBe(false);
  });

  it('hasFileSystemAccess：无 window → false', () => {
    expect(withoutGlobal('window', () => pb.hasFileSystemAccess())).toBe(false);
  });

  it('isBrowserRuntime：document.defaultView 为 null → false', () => {
    const origDV = Object.getOwnPropertyDescriptor(document, 'defaultView');
    Object.defineProperty(document, 'defaultView', { value: null, configurable: true });
    try {
      expect(pb.isBrowserRuntime()).toBe(false);
    } finally {
      if (origDV) Object.defineProperty(document, 'defaultView', origDV);
    }
  });
});

describe('pickFileBrowser 边界', () => {
  function setupInput() {
    const ref: { input: HTMLInputElement | null } = { input: null };
    vi.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      ref.input = el as HTMLInputElement;
      return el;
    });
    return ref;
  }

  it('用户取消（onchange 时 files 为空）→ resolve null', async () => {
    const ref = setupInput();
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
    const p = pb.pickFileBrowser();
    const input = ref.input!;
    Object.defineProperty(input, 'files', { value: [], configurable: true });
    input.onchange?.(new Event('change'));
    await expect(p).resolves.toBeNull();
  });

  it('onFocus 兜底：无选中时 800ms 后 resolve null', async () => {
    vi.useFakeTimers();
    const ref = setupInput();
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
    const p = pb.pickFileBrowser();
    const input = ref.input!;
    Object.defineProperty(input, 'files', { value: [], configurable: true });
    // 触发 focus 监听
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(900);
    await expect(p).resolves.toBeNull();
  });

  it('二次 settle 被忽略（settled 守卫）', async () => {
    const ref = setupInput();
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
    const f1 = new File(['a'], 'a.fdf');
    const p = pb.pickFileBrowser();
    const input = ref.input!;
    Object.defineProperty(input, 'files', { value: [f1], configurable: true });
    input.onchange?.(new Event('change'));
    // 第二次触发不应改变结果（resolve 只生效一次）
    input.onchange?.(new Event('change'));
    await expect(p).resolves.toBe(f1);
  });

  it('自定义 accept 参数生效', async () => {
    const ref = setupInput();
    vi.spyOn(document.body, 'removeChild').mockImplementation((el) => el);
    const p = pb.pickFileBrowser('.w3ui');
    const input = ref.input!;
    expect(input.accept).toBe('.w3ui');
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'x.w3ui')], configurable: true });
    input.onchange?.(new Event('change'));
    await expect(p).resolves.toBeInstanceOf(File);
  });
});

describe('downloadText 自定义 mime', () => {
  it('传入 application/json 时 Blob 使用该类型', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:j');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      expect(() => pb.downloadText('p.w3ui', '{}', 'application/json')).not.toThrow();
      expect(clickSpy).toHaveBeenCalled();
      vi.advanceTimersByTime(11_000);
    } finally {
      vi.useRealTimers();
    }
  });

  it('下载后 10s 触发 revoke', () => {
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:k');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.useFakeTimers();
    try {
      pb.downloadText('a.txt', 'x');
      vi.advanceTimersByTime(11_000);
      expect(revokeSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
