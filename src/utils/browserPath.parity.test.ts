// 浏览器路径 B 端到端验证（jsdom 模拟真实浏览器运行时，非 mock Tauri）
// @vitest-environment jsdom
/**
 * 端到端验收：在"真实浏览器"判定下，跑完整 FDF 往返链路。
 *
 * 与单元测试的区别：本文件不 mock Tauri API，而是让 isBrowserRuntime()=true，
 * 验证 exportToFDF（浏览器分支）→ importFromFDF（浏览器分支）的**真实往返**。
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

const SAMPLE_FDF = `Frame "BACKDROP" "Bg" {
\tWidth 0.2,
\tHeight 0.1,
\tAnchor TOPLEFT, 0.1, 0.5,
\tBackdropBackground "UI\\\\Widgets\\\\Bg.blp",
}

Frame "TEXT" "Label" {
\tWidth 0.3,
\tHeight 0.05,
\tAnchor TOPLEFT, 0.1, 0.45,
\tText "Hello Browser",
\tFontJustificationH "JUSTIFYCENTER",
}
`;

describe('浏览器模式端到端：FDF 解析链路', () => {
  it('importFromFDFText 在浏览器模式解析真实 FDF（无 Tauri 依赖）', async () => {
    const { importFromFDFText } = await import('./fdfImport');
    const frames = importFromFDFText(SAMPLE_FDF);
    expect(frames.length).toBe(2);
    const names = frames.map(f => f.name);
    expect(names).toContain('Bg');
    expect(names).toContain('Label');
    // 文本与对齐字段真写回（非仅 meta）
    const label = frames.find(f => f.name === 'Label')!;
    expect(label.text).toBe('Hello Browser');
  });

  it('parseFDF（内核 layout）在浏览器模式可用', async () => {
    const { parseFDF } = await import('./fdf');
    const frames = parseFDF(SAMPLE_FDF, { useKernelLayout: true });
    expect(frames.length).toBeGreaterThan(0);
    // 内核 layout 应产出非零几何
    const bg = frames.find(f => f.name === 'Bg');
    expect(bg).toBeTruthy();
    expect(bg!.width).toBeGreaterThan(0);
  });

  it('exportToFDF 浏览器分支触发下载且产物可被再解析（往返闭合）', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let capturedBlob: Blob | null = null;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: Blob | MediaSource) => {
      capturedBlob = b as Blob;
      return 'blob:x';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.stubGlobal('prompt', vi.fn(() => 'out.fdf'));

    const { exportToFDF } = await import('./exportUtils');
    const { importFromFDFText } = await import('./fdfImport');

    const project = {
      version: 2, libraryName: 'BTest', originMode: 'gameui', exportVersion: 'reforged',
      frames: {
        f1: {
          id: 'f1', name: 'Btn', type: 'BUTTON', x: 0.1, y: 0.5, width: 0.2, height: 0.05,
          anchors: [], children: [], parentId: null, text: 'Click', z: 0,
        },
      },
      rootFrameIds: ['f1'], fdfTemplates: [], currentRace: 'Human', war3Skins: null,
      tableArrays: [], circleArrays: [], guides: [], stylePresets: [], frameGroups: [],
    } as unknown as import('../types').ProjectData;

    // 探针实证：exportToFDF 签名 Promise<void>（不返回路径）——验证下载副作用
    await expect(exportToFDF(project)).resolves.toBeUndefined();
    expect(clickSpy).toHaveBeenCalled();
    expect(capturedBlob).toBeTruthy();

    const fdfText = await capturedBlob!.text();
    expect(fdfText).toContain('Btn');
    // 往返：产物可被同一解析器读回
    const back = importFromFDFText(fdfText);
    expect(back.length).toBeGreaterThan(0);
    expect(back.some(f => f.name === 'Btn')).toBe(true);
  });
});
