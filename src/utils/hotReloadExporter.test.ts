import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectData } from '../types';

// localStorage must exist BEFORE hotReloadExporter.ts is imported (module-level
// DEFAULT_HOT_RELOAD_CONFIG calls getDefaultHotReloadConfig -> localStorage.getItem).
const localStorageMock = vi.hoisted(() => {
  const m = new Map<string, string>();
  // Prime war3_install_path so the module-import-time call to
  // getDefaultHotReloadConfig() takes the war3Path (truthy) branch.
  m.set('war3_install_path', 'D:/Games\\War3');
  const store = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => void m.clear(),
  };
  if (typeof globalThis !== 'undefined') {
    (globalThis as unknown as { localStorage?: unknown }).localStorage = store;
  }
  return store;
});

// Tauri + game launcher mocks (fabricated so the module can be imported and tested in Node)
const fsMocks = vi.hoisted(() => ({
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
}));
const kkweMocks = vi.hoisted(() => ({
  detectKKWE: vi.fn(),
  launchMapWithKKWE: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: fsMocks.writeTextFile,
  mkdir: fsMocks.mkdir,
}));
vi.mock('./kkweDetector', () => ({
  detectKKWE: kkweMocks.detectKKWE,
  launchMapWithKKWE: kkweMocks.launchMapWithKKWE,
}));

import {
  HotReloadExporter,
  DEFAULT_HOT_RELOAD_CONFIG,
  getHotReloadExporter,
  HotReloadConfig,
} from './hotReloadExporter';

function makeProject(): ProjectData {
  return {
    version: 1,
    libraryName: 'Lib',
    originMode: 'gameui',
    exportVersion: 'reforged',
    hideGameUI: false,
    hideHeroBar: false,
    hideMiniMap: false,
    hideResources: false,
    hideButtonBar: false,
    hidePortrait: false,
    hideChat: false,
    appInterface: undefined as never,
    frames: {},
    rootFrameIds: [],
    tableArrays: [],
    circleArrays: [],
  };
}

function config(overrides: Partial<HotReloadConfig> = {}): HotReloadConfig {
  return {
    enabled: true,
    outputPath: 'C:\\out\\UI-Designer\\ui_generated.lua',
    loaderPath: 'C:\\out\\UI-Designer\\ui_loader.lua',
    testMapPath: 'C:\\out\\Maps\\Test\\test.w3x',
    autoLaunch: false,
    debounceMs: 5,
    ...overrides,
  };
}

const idle = () => new Promise<void>((r) => setTimeout(r, 0));

describe('hotReloadExporter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // hotReloadExporter uses window.setTimeout for debounce; provide it in Node
    vi.stubGlobal('window', { setTimeout, clearTimeout });
  });

  describe('DEFAULT_HOT_RELOAD_CONFIG', () => {
    it('builds war3-derived paths when war3_install_path is set at import', () => {
      // war3_install_path primed to 'D:/Games\\War3' before import -> truthy branch of getDefaultHotReloadConfig
      const cfg = DEFAULT_HOT_RELOAD_CONFIG;
      expect(cfg.outputPath).toBe('D:\\Games\\War3\\UI-Designer\\ui_generated.lua');
      expect(cfg.loaderPath).toBe('D:\\Games\\War3\\UI-Designer\\ui_loader.lua');
      expect(cfg.testMapPath).toBe('D:\\Games\\War3\\Maps\\Test\\test.w3x');
      expect(cfg.enabled).toBe(false);
      expect(cfg.autoLaunch).toBe(false);
      expect(cfg.debounceMs).toBe(500);
    });

    it('fresh import without war3 path uses username documents path (system_username set)', async () => {
      localStorageMock.clear();
      localStorageMock.setItem('system_username', 'bob');
      vi.resetModules();
      const mod = await import('./hotReloadExporter');
      const cfg = mod.DEFAULT_HOT_RELOAD_CONFIG;
      expect(cfg.outputPath).toBe('C:\\Users\\bob\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_generated.lua');
      expect(cfg.loaderPath).toBe('C:\\Users\\bob\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_loader.lua');
      // getHotReloadExporter() with no arg reaches the config||DEFAULT fallback (fresh globalExporter is null)
      const exp = mod.getHotReloadExporter();
      expect((exp as unknown as { config: HotReloadConfig }).config.outputPath).toBe(
        'C:\\Users\\bob\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_generated.lua'
      );
    });

    it('fresh import defaults username to 81468 when system_username absent', async () => {
      localStorageMock.clear();
      vi.resetModules();
      const mod = await import('./hotReloadExporter');
      expect(mod.DEFAULT_HOT_RELOAD_CONFIG.outputPath).toBe(
        'C:\\Users\\81468\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_generated.lua'
      );
    });
  });

  describe('getHotReloadExporter', () => {
    it('creates singleton on first call and reuses it', () => {
      const a = getHotReloadExporter(config({ outputPath: 'C:\\a.lua' }));
      const b = getHotReloadExporter();
      expect(a).toBe(b);
    });

    it('updates config when passed on subsequent call', () => {
      const a = getHotReloadExporter(config({ outputPath: 'C:\\a.lua' }));
      const b = getHotReloadExporter(config({ outputPath: 'C:\\b.lua' }));
      expect(a).toBe(b);
      expect((a as unknown as { config: HotReloadConfig }).config.outputPath).toBe('C:\\b.lua');
    });
  });

  describe('updateConfig', () => {
    it('merges partial config', () => {
      const e = new HotReloadExporter(config());
      e.updateConfig({ outputPath: 'X.lua', debounceMs: 10 });
      const c = (e as unknown as { config: HotReloadConfig }).config;
      expect(c.outputPath).toBe('X.lua');
      expect(c.debounceMs).toBe(10);
      expect(c.enabled).toBe(true);
    });
  });

  describe('export()', () => {
    it('skips export when not forced and disabled', async () => {
      const e = new HotReloadExporter(config({ enabled: false }));
      await e.export(makeProject());
      expect(fsMocks.mkdir).not.toHaveBeenCalled();
      expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
    });

    it('exports even when disabled if force is true', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config({ enabled: false }));
      await e.export(makeProject(), true);
      expect(fsMocks.mkdir).toHaveBeenCalled();
      expect(fsMocks.writeTextFile).toHaveBeenCalledTimes(2);
      // output + loader written
      expect(fsMocks.writeTextFile.mock.calls[0][0]).toBe('C:\\out\\UI-Designer\\ui_generated.lua');
      expect(fsMocks.writeTextFile.mock.calls[1][0]).toBe('C:\\out\\UI-Designer\\ui_loader.lua');
      // both contents are non-empty Lua
      expect(fsMocks.writeTextFile.mock.calls[0][1]).toContain('UI Designer');
      expect(fsMocks.writeTextFile.mock.calls[1][1]).toContain('加载器脚本');
    });

    it('skips a second overlapping export while one is running', async () => {
      let release!: () => void;
      fsMocks.mkdir.mockImplementation(() => new Promise<void>((res) => (release = res)));
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config());
      const p1 = e.export(makeProject());
      await idle();
      // second call while isExporting
      await e.export(makeProject());
      expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
      release!();
      await p1;
    });

    it('rethrows and resets isExporting when mkdir fails', async () => {
      fsMocks.mkdir.mockRejectedValue(new Error('nope'));
      const e = new HotReloadExporter(config());
      await expect(e.export(makeProject())).rejects.toThrow('创建目录失败');
      expect((e as unknown as { isExporting: boolean }).isExporting).toBe(false);
    });

    it('rethrows when writing UI content fails', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockRejectedValueOnce(new Error('disk'));
      const e = new HotReloadExporter(config());
      await expect(e.export(makeProject())).rejects.toThrow('写入 UI 内容失败');
      expect((e as unknown as { isExporting: boolean }).isExporting).toBe(false);
    });

    it('rethrows when writing loader fails', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockResolvedValueOnce(undefined as never);
      fsMocks.writeTextFile.mockRejectedValueOnce(new Error('disk2'));
      const e = new HotReloadExporter(config());
      await expect(e.export(makeProject())).rejects.toThrow('写入加载器失败');
      expect((e as unknown as { isExporting: boolean }).isExporting).toBe(false);
    });

    it('auto-launches game via KKWE when installed', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      kkweMocks.detectKKWE.mockResolvedValue({ installed: true });
      kkweMocks.launchMapWithKKWE.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config({ autoLaunch: true }));
      await e.export(makeProject(), true);
      expect(kkweMocks.detectKKWE).toHaveBeenCalled();
      expect(kkweMocks.launchMapWithKKWE).toHaveBeenCalledWith('C:\\out\\Maps\\Test\\test.w3x', { installed: true });
    });

    it('warns but does not launch when KKWE is not installed', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      kkweMocks.detectKKWE.mockResolvedValue({ installed: false });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const e = new HotReloadExporter(config({ autoLaunch: true }));
      await e.export(makeProject(), true);
      expect(kkweMocks.launchMapWithKKWE).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('exportDebounced()', () => {
    it('returns early when disabled', () => {
      const e = new HotReloadExporter(config({ enabled: false }));
      e.exportDebounced(makeProject());
      expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
    });

    it('schedules export after the debounce delay', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config({ debounceMs: 5 }));
      e.exportDebounced(makeProject());
      expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 30));
      expect(fsMocks.mkdir).toHaveBeenCalled();
      expect(fsMocks.writeTextFile).toHaveBeenCalledTimes(2);
    });

    it('clears an existing debounce timer before scheduling a new one', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config({ debounceMs: 20 }));
      e.exportDebounced(makeProject());
      e.exportDebounced(makeProject()); // second call resets timer
      await new Promise((r) => setTimeout(r, 40));
      // exactly one export ran
      expect(fsMocks.writeTextFile).toHaveBeenCalledTimes(2);
    });

    it('logs failure when debounced export rejects', async () => {
      fsMocks.mkdir.mockResolvedValue(undefined as never);
      fsMocks.writeTextFile.mockRejectedValue(new Error('boom'));
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});
      const e = new HotReloadExporter(config({ debounceMs: 5 }));
      e.exportDebounced(makeProject());
      await new Promise((r) => setTimeout(r, 30));
      expect(err).toHaveBeenCalled();
      err.mockRestore();
    });
  });

  describe('cancelPendingExport()', () => {
    it('clears an active debounce timer and nulls it', async () => {
      const e = new HotReloadExporter(config({ debounceMs: 50 }));
      e.exportDebounced(makeProject());
      e.cancelPendingExport();
      await new Promise((r) => setTimeout(r, 80));
      expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
    });

    it('is a no-op when no timer is pending', () => {
      const e = new HotReloadExporter(config());
      expect(() => e.cancelPendingExport()).not.toThrow();
    });
  });

  describe('导出竞态：跳过时记录 pending 并补充导出', () => {
    it('导出期间触发的导出记录为 pending，完成后补充导出最新版本', async () => {
      let release!: () => void;
      fsMocks.mkdir.mockImplementation(() => new Promise<void>((r) => { release = r; }));
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config());

      // 第一次导出：挂在 mkdir
      const p1 = e.export(makeProject());
      await idle();
      // 导出期间的"新编辑"触发第二次导出 → 被 isExporting 跳过但记录 pending
      await e.export(makeProject());
      expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
      // 放行第一次导出 → 完成后应补充导出
      release!();
      await p1;
      await new Promise((r) => setTimeout(r, 0));
      // 补充导出走完整链路：写 UI + 写 loader
      expect(fsMocks.writeTextFile).toHaveBeenCalledTimes(2);
    });

    it('补充导出失败不冒泡（记录日志）', async () => {
      let release!: () => void;
      fsMocks.mkdir
        .mockImplementationOnce(() => new Promise<void>((r) => { release = r; }))
        .mockRejectedValueOnce(new Error('dir gone'));
      fsMocks.writeTextFile.mockResolvedValue(undefined as never);
      const e = new HotReloadExporter(config());
      const err = vi.spyOn(console, 'error').mockImplementation(() => {});

      const p1 = e.export(makeProject());
      await idle();
      await e.export(makeProject()); // 记录 pending
      release!();
      await p1;
      await new Promise((r) => setTimeout(r, 0));
      // 补充导出在 mkdir 失败被捕获：p1 自身写 2 次（UI+loader），补充导出未追加第三次
      expect(fsMocks.writeTextFile).toHaveBeenCalledTimes(2);
      expect(err).toHaveBeenCalled();
      err.mockRestore();
    });
  });
});