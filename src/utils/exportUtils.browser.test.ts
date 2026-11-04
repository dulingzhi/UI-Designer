// @vitest-environment jsdom
/**
 * exportUtils 浏览器分支补测（浏览器路径 B）。
 * 覆盖 exportToFDF / exportToJSON / exportToPNG 的浏览器下载分支。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const origUA = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent');

function enterBrowserMode() {
  delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    configurable: true,
  });
}

function captureDownloads() {
  const captured: Array<{ filename: string; blob: Blob | null }> = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const last = captured[captured.length - 1];
    if (last) last.filename = this.download;
  });
  vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
    captured.push({ filename: '', blob: b instanceof Blob ? b : null });
    return 'blob:cap';
  });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  return captured;
}

function makeProject() {
  return {
    version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
    frames: {}, rootFrameIds: [], fdfTemplates: [], currentRace: 'Human', war3Skins: null,
    tableArrays: [], circleArrays: [], guides: [], stylePresets: [], frameGroups: [],
  } as unknown as import('../types').ProjectData;
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

describe('exportToFDF 浏览器分支', () => {
  it('prompt 确认后下载 FDF，onShowAlert 收到成功回调', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'o.fdf'));
    const alerts: Array<{ title: string }> = [];
    const { exportToFDF } = await import('./exportUtils');
    await exportToFDF(makeProject(), false, (o) => alerts.push(o));
    expect(captured[0]?.filename).toBe('o.fdf');
    expect(alerts.some(a => a.title === '成功')).toBe(true);
  });

  it('prompt 取消（null）→ 不下载', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => null));
    const { exportToFDF } = await import('./exportUtils');
    await exportToFDF(makeProject());
    expect(captured.length).toBe(0);
  });

  it('无 onShowAlert 时也不抛错（静默成功路径）', async () => {
    captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'x.fdf'));
    const { exportToFDF } = await import('./exportUtils');
    await expect(exportToFDF(makeProject())).resolves.toBeUndefined();
  });

  it('enhanced=true 走增强内容生成', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'e.fdf'));
    const { exportToFDF } = await import('./exportUtils');
    await exportToFDF(makeProject(), true);
    expect(captured[0]?.blob).toBeTruthy();
  });

  it('enhanced=true 时 onShowAlert 消息含「增强模式」（覆盖三元分支）', async () => {
    captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'e2.fdf'));
    const alerts: Array<{ title: string; message: string }> = [];
    const { exportToFDF } = await import('./exportUtils');
    await exportToFDF(makeProject(), true, (o) => alerts.push(o as { title: string; message: string }));
    const ok = alerts.find(a => a.title === '成功');
    expect(ok).toBeTruthy();
    expect(ok!.message).toContain('增强模式');
  });

  it('window.prompt 不存在时回落默认名', async () => {
    const captured = captureDownloads();
    const saved = (window as unknown as { prompt?: unknown }).prompt;
    delete (window as unknown as { prompt?: unknown }).prompt;
    try {
      const { exportToFDF } = await import('./exportUtils');
      await exportToFDF(makeProject());
      expect(captured[0]?.filename).toBe('ui-design.fdf');
    } finally {
      if (saved) (window as unknown as { prompt?: unknown }).prompt = saved;
    }
  });
});

describe('exportToJSON 浏览器分支', () => {
  it('prompt 确认后下载 JSON（application/json）', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'p.json'));
    const { exportToJSON } = await import('./exportUtils');
    await exportToJSON(makeProject());
    expect(captured[0]?.filename).toBe('p.json');
  });

  it('prompt 取消 → 不下载', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => null));
    const { exportToJSON } = await import('./exportUtils');
    await exportToJSON(makeProject());
    expect(captured.length).toBe(0);
  });

  it('window.prompt 缺失时回落 ui-design.json', async () => {
    const captured = captureDownloads();
    const saved = (window as unknown as { prompt?: unknown }).prompt;
    delete (window as unknown as { prompt?: unknown }).prompt;
    try {
      const { exportToJSON } = await import('./exportUtils');
      await exportToJSON(makeProject());
      expect(captured[0]?.filename).toBe('ui-design.json');
    } finally {
      if (saved) (window as unknown as { prompt?: unknown }).prompt = saved;
    }
  });
});

describe('exportToPNG 浏览器分支', () => {
  function mkCanvas(withBlob: boolean) {
    return {
      width: 10, height: 10,
      toBlob(cb: (b: Blob | null) => void, type?: string) {
        void type;
        cb(withBlob ? new Blob(['png'], { type: 'image/png' }) : null);
      },
    } as unknown as HTMLCanvasElement;
  }

  it('canvas 有内容 → 下载 PNG 并回调成功', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'i.png'));
    const alerts: Array<{ title: string }> = [];
    const { exportToPNG } = await import('./exportUtils');
    await exportToPNG(mkCanvas(true), (o) => alerts.push(o));
    expect(captured[0]?.filename).toBe('i.png');
    expect(alerts.some(a => a.title === '成功')).toBe(true);
  });

  it('toBlob 返回 null → 回调错误（不下载）', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => 'i.png'));
    const alerts: Array<{ title: string }> = [];
    const { exportToPNG } = await import('./exportUtils');
    await exportToPNG(mkCanvas(false), (o) => alerts.push(o));
    expect(alerts.some(a => a.title === '错误')).toBe(true);
    expect(captured.length).toBe(0);
  });

  it('canvas 为 null → 直接错误回调', async () => {
    const alerts: Array<{ title: string }> = [];
    const { exportToPNG } = await import('./exportUtils');
    await exportToPNG(null, (o) => alerts.push(o));
    expect(alerts.some(a => a.title === '错误')).toBe(true);
  });

  it('prompt 取消 → 不下载', async () => {
    const captured = captureDownloads();
    vi.stubGlobal('prompt', vi.fn(() => null));
    const { exportToPNG } = await import('./exportUtils');
    await exportToPNG(mkCanvas(true));
    expect(captured.length).toBe(0);
  });
});
