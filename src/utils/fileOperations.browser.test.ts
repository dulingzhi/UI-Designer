// @vitest-environment jsdom
/**
 * fileOperations 浏览器分支补测（浏览器路径 B 的核心验证）。
 *
 * 目标：在 isBrowserRuntime()=true 时，5 个文件操作函数走浏览器分支
 * （prompt 确认文件名 + Blob 下载 / input[type=file] 选择），
 * 而不是 Tauri 对话框。桌面分支由 fileOperations.test.ts 覆盖（保持原样）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const origUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

/** 强制进入"真实浏览器"判定（UA 去掉 jsdom 且无 Tauri）。 */
function enterBrowserMode() {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    configurable: true,
  });
}

beforeEach(() => {
  vi.resetModules();
  enterBrowserMode();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
});

afterEach(() => {
  if (origUA) Object.defineProperty(window.navigator, 'userAgent', origUA);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** 拦截下载：记录 a[download] 的文件名与内容。
 *  注意：不能 mock appendChild/removeChild 的返回值语义（jsdom 会抛
 *  "node to be removed is not a child"），改为在 click 时读取元素属性。 */
function captureDownloads() {
  const captured: Array<{ filename: string; blob: Blob }> = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const last = captured[captured.length - 1];
    if (last) last.filename = this.download;
  });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
    captured.push({ filename: '', blob: b as Blob });
    return 'blob:captured';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return captured;
}

function makeProject() {
  return {
    version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
    backgroundImage: '', hideGameUI: false, hideHeroBar: false, hideMiniMap: false,
    hideResources: false, hideButtonBar: false, hidePortrait: false, hideChat: false,
    frames: {}, rootFrameIds: [], fdfTemplates: [], currentRace: 'Human',
    war3Skins: null, tableArrays: [], circleArrays: [], guides: [],
    stylePresets: [], frameGroups: [],
  } as unknown as import('../types').ProjectData;
}

describe('saveProject 浏览器分支', () => {
  it('prompt 确认文件名后下载，返回文件名', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'my.w3ui'));
    const { saveProject } = await import('./fileOperations');
    const r = await saveProject(makeProject());
    expect(r).toBe('my.w3ui');
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[0].filename).toBe('my.w3ui');
  });

  it('prompt 返回 null（用户取消）→ 返回 null 且不下载', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => null));
    const { saveProject } = await import('./fileOperations');
    await expect(saveProject(makeProject())).resolves.toBeNull();
    expect(captured.length).toBe(0);
  });

  it('window.prompt 不存在时回落默认文件名', async () => {
    const captured = captureDownloads();
    const savedPrompt = (window as unknown as { prompt?: unknown }).prompt;
    delete (window as unknown as { prompt?: unknown }).prompt;
    try {
      const { saveProject } = await import('./fileOperations');
      const r = await saveProject(makeProject());
      expect(r).toBe('myproject.w3ui');
      expect(captured[0]?.filename).toBe('myproject.w3ui');
    } finally {
      if (savedPrompt) (window as unknown as { prompt?: unknown }).prompt = savedPrompt;
    }
  });

  it('显式传入 filePath 时不弹 prompt，直接下载', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'ignored'));
    const { saveProject } = await import('./fileOperations');
    const r = await saveProject(makeProject(), 'given.w3ui');
    expect(r).toBe('given.w3ui');
    expect(captured[0]?.filename).toBe('given.w3ui');
  });
});

describe('loadProject 浏览器分支', () => {
  it('选择 .w3ui 后解析并迁移，path 为文件名', async () => {
    const project = makeProject();
    const file = new File([JSON.stringify(project)], 'proj.w3ui', { type: 'application/json' });
    const { pickFileBrowser } = await import('./platformBridge');
    vi.spyOn({ pickFileBrowser }, 'pickFileBrowser');
    // 直接 mock 平台层选择器
    vi.doMock('./platformBridge', async (orig) => {
      const real = await orig<typeof import('./platformBridge')>();
      return { ...real, pickFileBrowser: vi.fn(() => Promise.resolve(file)) };
    });
    vi.resetModules();
    enterBrowserMode();
    const mod = await import('./fileOperations');
    const r = await mod.loadProject();
    expect(r).toBeTruthy();
    expect(r!.path).toBe('proj.w3ui');
  });

  it('用户取消选择 → 返回 null', async () => {
    vi.doMock('./platformBridge', async (orig) => {
      const real = await orig<typeof import('./platformBridge')>();
      return { ...real, pickFileBrowser: vi.fn(() => Promise.resolve(null)) };
    });
    vi.resetModules();
    enterBrowserMode();
    const mod = await import('./fileOperations');
    await expect(mod.loadProject()).resolves.toBeNull();
  });
});

describe('loadProjectFromPath 浏览器分支（file:// / blob: 走 fetch）', () => {
  it('读取 blob URL 内容并解析', async () => {
    const project = makeProject();
    enterBrowserMode();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(project), { status: 200 }),
    );
    const { loadProjectFromPath } = await import('./fileOperations');
    const r = await loadProjectFromPath('blob:fake');
    expect(r).toBeTruthy();
    expect(r!.path).toBe('blob:fake');
  });

  it('fetch 失败时抛出（异常链完整）', async () => {
    enterBrowserMode();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    const { loadProjectFromPath } = await import('./fileOperations');
    await expect(loadProjectFromPath('blob:missing')).rejects.toThrow();
  });
});

describe('exportCode 浏览器分支', () => {
  it('按语言扩展名下载，返回文件名', async () => {
    const captured = captureDownloads();
    enterBrowserMode();
    const { exportCode } = await import('./fileOperations');
    const r = await exportCode('function x() {}', 'lua');
    expect(r).toBe('ui_export.lua');
    expect(captured[0]?.filename).toBe('ui_export.lua');
  });

  it('jass / ts 扩展名分别正确', async () => {
    enterBrowserMode();
    const { exportCode } = await import('./fileOperations');
    captureDownloads();
    expect(await exportCode('x', 'jass')).toBe('ui_export.j');
    expect(await exportCode('x', 'ts')).toBe('ui_export.ts');
  });
});

describe('importFromFDF 浏览器分支', () => {
  it('选择 .fdf 后解析为 FrameData[]（走内核 layout）', async () => {
    const fdf = 'Frame "BACKDROP" "Bg" {\n  Width 0.1,\n  Height 0.1,\n}';
    const file = new File([fdf], 'a.fdf', { type: 'text/plain' });
    vi.doMock('./platformBridge', async (orig) => {
      const real = await orig<typeof import('./platformBridge')>();
      return { ...real, pickFileBrowser: vi.fn(() => Promise.resolve(file)) };
    });
    vi.resetModules();
    enterBrowserMode();
    const mod = await import('./fileOperations');
    const frames = await mod.importFromFDF();
    expect(frames).toBeTruthy();
    expect(frames!.length).toBeGreaterThan(0);
  });

  it('用户取消 → null', async () => {
    vi.doMock('./platformBridge', async (orig) => {
      const real = await orig<typeof import('./platformBridge')>();
      return { ...real, pickFileBrowser: vi.fn(() => Promise.resolve(null)) };
    });
    vi.resetModules();
    enterBrowserMode();
    const mod = await import('./fileOperations');
    await expect(mod.importFromFDF()).resolves.toBeNull();
  });
});
