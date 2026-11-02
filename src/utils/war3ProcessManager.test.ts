import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const kkweMocks = vi.hoisted(() => ({
  isProcessRunning: vi.fn(),
  killProcess: vi.fn(),
  killProcessElevated: vi.fn(),
  isWar3Running: vi.fn(),
  killWar3Processes: vi.fn(),
}));
const hotReloadMocks = vi.hoisted(() => ({
  getHotReloadExporter: vi.fn(),
}));
const projectStoreMocks = vi.hoisted(() => ({
  useProjectStore: { getState: vi.fn() },
}));

vi.mock('./kkweDetector', () => kkweMocks);
vi.mock('./hotReloadExporter', () => hotReloadMocks);
vi.mock('../store/projectStore', () => projectStoreMocks);

import { war3ProcessManager } from './war3ProcessManager';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((k: string) => (k in store ? store[k] : null)),
    setItem: vi.fn((k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: vi.fn((k: string) => {
      delete store[k];
    }),
    _reset() {
      store = {};
    },
    _store: () => store,
  };
})();

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorageMock._reset();
  (war3ProcessManager as any).currentPid = null;
  vi.stubGlobal('localStorage', localStorageMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('war3ProcessManager', () => {
  it('getCurrentPid returns in-memory PID when set', () => {
    (war3ProcessManager as any).currentPid = 1234;
    expect(war3ProcessManager.getCurrentPid()).toBe(1234);
    (war3ProcessManager as any).currentPid = null;
  });

  it('getCurrentPid recovers and caches PID from localStorage', () => {
    localStorageMock.setItem('war3_process_pid', '5678');
    expect(war3ProcessManager.getCurrentPid()).toBe(5678);
    expect(war3ProcessManager.getCurrentPid()).toBe(5678);
  });

  it('getCurrentPid ignores non-numeric stored PID and returns null', () => {
    localStorageMock.setItem('war3_process_pid', 'abc');
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
  });

  it('getCurrentPid returns null when no storage value', () => {
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
  });

  it('setProcess stores PID and verifies after 2s when running', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    kkweMocks.isProcessRunning.mockResolvedValue(true);
    const p = war3ProcessManager.setProcess(4321);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('war3_process_pid', '4321');
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(kkweMocks.isProcessRunning).toHaveBeenCalledWith(4321);
    log.mockRestore();
  });

  it('setProcess warns when PID is no longer running', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    kkweMocks.isProcessRunning.mockResolvedValue(false);
    const p = war3ProcessManager.setProcess(111);
    await vi.advanceTimersByTimeAsync(2000);
    await p;
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('PID进程不存在'));
    log.mockRestore();
    warn.mockRestore();
  });

  it('isCurrentProcessRunning returns false when no PID', async () => {
    (war3ProcessManager as any).currentPid = null;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const r = await war3ProcessManager.isCurrentProcessRunning();
    expect(r).toBe(false);
    expect(kkweMocks.isProcessRunning).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('isCurrentProcessRunning delegates to kkwe when PID set', async () => {
    (war3ProcessManager as any).currentPid = 999;
    kkweMocks.isProcessRunning.mockResolvedValue(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await war3ProcessManager.isCurrentProcessRunning()).toBe(true);
    expect(kkweMocks.isProcessRunning).toHaveBeenCalledWith(999);
    (war3ProcessManager as any).currentPid = null;
    log.mockRestore();
  });

  it('killCurrentProcess kills all when no PID', async () => {
    (war3ProcessManager as any).currentPid = null;
    kkweMocks.killWar3Processes.mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.killCurrentProcess();
    expect(kkweMocks.killWar3Processes).toHaveBeenCalled();
    log.mockRestore();
  });

  it('killCurrentProcess kills, clears, and cleans localStorage on success', async () => {
    (war3ProcessManager as any).currentPid = 777;
    kkweMocks.killProcess.mockResolvedValue(undefined);
    localStorageMock.setItem('war3_process_pid', '777');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.killCurrentProcess();
    expect(kkweMocks.killProcess).toHaveBeenCalledWith(777);
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('war3_process_pid');
    log.mockRestore();
  });

  it('killCurrentProcess escalates to elevated when access denied, and succeeds', async () => {
    (war3ProcessManager as any).currentPid = 888;
    kkweMocks.killProcess.mockRejectedValue(new Error('Access is denied'));
    kkweMocks.killProcessElevated.mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await war3ProcessManager.killCurrentProcess();
    expect(kkweMocks.killProcessElevated).toHaveBeenCalledWith(888);
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    log.mockRestore();
    errSpy.mockRestore();
    warn.mockRestore();
  });

  it('killCurrentProcess throws when user cancels UAC', async () => {
    (war3ProcessManager as any).currentPid = 999;
    kkweMocks.killProcess.mockRejectedValue(new Error('拒绝访问'));
    kkweMocks.killProcessElevated.mockRejectedValue(new Error('canceled'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(war3ProcessManager.killCurrentProcess()).rejects.toThrow('用户取消了权限提升');
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    errSpy.mockRestore();
  });

  it('killCurrentProcess falls back to killing all War3 when elevated fails', async () => {
    (war3ProcessManager as any).currentPid = 1010;
    kkweMocks.killProcess.mockRejectedValue(new Error('Access is denied'));
    kkweMocks.killProcessElevated.mockRejectedValue(new Error('some other error'));
    kkweMocks.killWar3Processes.mockResolvedValue(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.killCurrentProcess();
    expect(kkweMocks.killWar3Processes).toHaveBeenCalled();
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    errSpy.mockRestore();
    log.mockRestore();
  });

  it('killCurrentProcess throws when fallback also fails', async () => {
    (war3ProcessManager as any).currentPid = 1111;
    kkweMocks.killProcess.mockRejectedValue(new Error('Access is denied'));
    kkweMocks.killProcessElevated.mockRejectedValue(new Error('other'));
    kkweMocks.killWar3Processes.mockRejectedValue(new Error('fallback boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(war3ProcessManager.killCurrentProcess()).rejects.toThrow('无法结束War3进程');
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    errSpy.mockRestore();
  });

  it('killCurrentProcess uses fallback path on a generic (non-permission) error and clears on success', async () => {
    (war3ProcessManager as any).currentPid = 1212;
    kkweMocks.killProcess.mockRejectedValue(new Error('some generic error'));
    kkweMocks.killWar3Processes.mockResolvedValue(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.killCurrentProcess();
    expect(kkweMocks.killWar3Processes).toHaveBeenCalled();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('war3_process_pid');
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    errSpy.mockRestore();
    log.mockRestore();
  });

  it('killCurrentProcess uses fallback path on a generic (non-permission) error and rethrows on failure', async () => {
    (war3ProcessManager as any).currentPid = 1212;
    kkweMocks.killProcess.mockRejectedValue(new Error('some generic error'));
    kkweMocks.killWar3Processes.mockRejectedValue(new Error('generic fallback boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(war3ProcessManager.killCurrentProcess()).rejects.toThrow('generic fallback boom');
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    errSpy.mockRestore();
    log.mockRestore();
  });

  it('isWar3Running returns true from detector', async () => {
    kkweMocks.isWar3Running.mockResolvedValue(true);
    expect(await war3ProcessManager.isWar3Running()).toBe(true);
  });

  it('isWar3Running returns false and logs on error', async () => {
    kkweMocks.isWar3Running.mockRejectedValue(new Error('boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await war3ProcessManager.isWar3Running()).toBe(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('killAllWar3Processes succeeds and clears PID', async () => {
    (war3ProcessManager as any).currentPid = 55;
    kkweMocks.killWar3Processes.mockResolvedValue(undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.killAllWar3Processes();
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
    log.mockRestore();
  });

  it('killAllWar3Processes rethrows on failure', async () => {
    kkweMocks.killWar3Processes.mockRejectedValue(new Error('kill all boom'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(war3ProcessManager.killAllWar3Processes()).rejects.toThrow('kill all boom');
    errSpy.mockRestore();
  });

  it('restoreFromStorage returns early when no stored PID', async () => {
    localStorageMock.setItem('war3_process_pid', '');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.restoreFromStorage();
    expect(kkweMocks.isProcessRunning).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('restoreFromStorage clears invalid stored PID', async () => {
    localStorageMock.setItem('war3_process_pid', 'xx');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.restoreFromStorage();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('war3_process_pid');
    log.mockRestore();
  });

  it('restoreFromStorage restores PID when process is running', async () => {
    localStorageMock.setItem('war3_process_pid', '42');
    kkweMocks.isProcessRunning.mockResolvedValue(true);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.restoreFromStorage();
    expect(war3ProcessManager.getCurrentPid()).toBe(42);
    log.mockRestore();
  });

  it('restoreFromStorage clears record when process no longer running', async () => {
    localStorageMock.setItem('war3_process_pid', '43');
    kkweMocks.isProcessRunning.mockResolvedValue(false);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.restoreFromStorage();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('war3_process_pid');
    expect(war3ProcessManager.getCurrentPid()).toBeNull();
    log.mockRestore();
  });

  it('triggerExport returns early with no config', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.triggerExport();
    expect(hotReloadMocks.getHotReloadExporter).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('triggerExport returns early when config disabled', async () => {
    localStorageMock.setItem('hotReloadConfig', JSON.stringify({ enabled: false }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await war3ProcessManager.triggerExport();
    expect(hotReloadMocks.getHotReloadExporter).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('triggerExport exports via hotReloadExporter with project', async () => {
    localStorageMock.setItem('hotReloadConfig', JSON.stringify({ enabled: true, file: 'ui.w3x' }));
    const project = { name: 'p' };
    projectStoreMocks.useProjectStore.getState.mockReturnValue({ project });
    const exporter = { export: vi.fn().mockResolvedValue(undefined) };
    hotReloadMocks.getHotReloadExporter.mockReturnValue(exporter);
    await war3ProcessManager.triggerExport();
    expect(hotReloadMocks.getHotReloadExporter).toHaveBeenCalledWith({
      enabled: true,
      file: 'ui.w3x',
    });
    expect(exporter.export).toHaveBeenCalledWith(project, true);
  });

  it('isCurrentProcessRunning recovers PID from localStorage when memory is empty', async () => {
    // 单独调用（未先 getCurrentPid/restoreFromStorage）也应从 localStorage 恢复——
    // 旧行为只查内存，漏恢复属脆弱耦合（依赖调用方先调 getCurrentPid）
    localStorageMock.setItem('war3_process_pid', '9999');
    kkweMocks.isProcessRunning.mockResolvedValue(true);
    const r = await war3ProcessManager.isCurrentProcessRunning();
    expect(r).toBe(true);
    expect(kkweMocks.isProcessRunning).toHaveBeenCalledWith(9999);
  });
});