import { describe, it, expect, vi, beforeEach } from 'vitest';

const coreMocks = vi.hoisted(() => ({ invoke: vi.fn() }));
const fsMocks = vi.hoisted(() => ({ exists: vi.fn() }));
const mpqMocks = vi.hoisted(() => ({ getWar3Path: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke: coreMocks.invoke }));
vi.mock('@tauri-apps/plugin-fs', () => ({ exists: fsMocks.exists }));
vi.mock('./mpqManager', () => ({ mpqManager: mpqMocks }));

import {
  detectKKWE,
  launchMapWithKKWE,
  isProcessRunning,
  killProcess,
  killProcessElevated,
  isWar3Running,
  killWar3Processes,
} from './kkweDetector';

describe('detectKKWE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns installed=false when required files are missing', async () => {
    coreMocks.invoke.mockResolvedValue('bob');
    fsMocks.exists.mockResolvedValue(false);
    const result = await detectKKWE();
    expect(result).toEqual({ installed: false });
    expect(fsMocks.exists).toHaveBeenCalledWith('C:\\Users\\bob\\AppData\\Local\\KKWE\\KKWE.exe');
  });

  it('returns installed=true with paths and war3Path when everything exists', async () => {
    coreMocks.invoke.mockResolvedValue('alice');
    fsMocks.exists.mockResolvedValue(true);
    mpqMocks.getWar3Path.mockReturnValue('C:\\Games\\War3');
    const result = await detectKKWE();
    expect(result).toEqual({
      installed: true,
      kkwePath: 'C:\\Users\\alice\\AppData\\Local\\KKWE\\KKWE.exe',
      launcherPath: 'C:\\Users\\alice\\AppData\\Local\\KKWE\\bin\\YDWEConfig.exe',
      war3Path: 'C:\\Games\\War3',
    });
  });

  it('leaves war3Path undefined when mpqManager has no path', async () => {
    coreMocks.invoke.mockResolvedValue('alice');
    fsMocks.exists.mockResolvedValue(true);
    mpqMocks.getWar3Path.mockReturnValue('');
    const result = await detectKKWE();
    expect(result.war3Path).toBeUndefined();
    expect(result.installed).toBe(true);
  });

  it('returns installed=false and logs on error', async () => {
    coreMocks.invoke.mockRejectedValue(new Error('no username'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await detectKKWE();
    expect(result).toEqual({ installed: false });
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('launchMapWithKKWE', () => {
  it('throws when not installed', async () => {
    await expect(launchMapWithKKWE('C:\\x.w3x', { installed: false })).rejects.toThrow('KKWE 未安装或启动器路径无效');
  });

  it('throws when launcherPath missing', async () => {
    await expect(launchMapWithKKWE('C:\\x.w3x', { installed: true })).rejects.toThrow('KKWE 未安装或启动器路径无效');
  });

  it('invokes launch with normalized backslash map path and returns pid', async () => {
    coreMocks.invoke.mockResolvedValue(4242);
    const pid = await launchMapWithKKWE('D:/maps/test.w3x', {
      installed: true,
      launcherPath: 'C:\\KKWE\\YDWEConfig.exe',
    });
    expect(pid).toBe(4242);
    expect(coreMocks.invoke).toHaveBeenCalledWith('launch_kkwe', {
      launcherPath: 'C:\\KKWE\\YDWEConfig.exe',
      mapPath: 'D:\\maps\\test.w3x',
    });
  });
});

describe('isProcessRunning', () => {
  it('returns invoke result true', async () => {
    coreMocks.invoke.mockResolvedValue(true);
    await expect(isProcessRunning(5)).resolves.toBe(true);
    expect(coreMocks.invoke).toHaveBeenCalledWith('is_process_running', { pid: 5 });
  });

  it('returns false when invoke rejects', async () => {
    coreMocks.invoke.mockRejectedValue(new Error('E'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(isProcessRunning(1)).resolves.toBe(false);
    err.mockRestore();
  });
});

describe('killProcess', () => {
  it('invokes kill_process successfully', async () => {
    coreMocks.invoke.mockResolvedValue(undefined);
    await expect(killProcess(9)).resolves.toBeUndefined();
    expect(coreMocks.invoke).toHaveBeenCalledWith('kill_process', { pid: 9 });
  });

  it('logs and rethrows on failure', async () => {
    coreMocks.invoke.mockRejectedValue(new Error('denied'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(killProcess(9)).rejects.toThrow('denied');
    err.mockRestore();
  });
});

describe('killProcessElevated', () => {
  it('invokes kill_process_elevated successfully', async () => {
    coreMocks.invoke.mockResolvedValue(undefined);
    await expect(killProcessElevated(7)).resolves.toBeUndefined();
    expect(coreMocks.invoke).toHaveBeenCalledWith('kill_process_elevated', { pid: 7 });
  });

  it('rethrows on failure', async () => {
    coreMocks.invoke.mockRejectedValue(new Error('uac'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(killProcessElevated(7)).rejects.toThrow('uac');
    err.mockRestore();
  });
});

describe('isWar3Running', () => {
  it('returns invoke result', async () => {
    coreMocks.invoke.mockResolvedValue(false);
    await expect(isWar3Running()).resolves.toBe(false);
    expect(coreMocks.invoke).toHaveBeenCalledWith('is_war3_running');
  });

  it('returns false on error', async () => {
    coreMocks.invoke.mockRejectedValue(new Error('E'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(isWar3Running()).resolves.toBe(false);
    err.mockRestore();
  });
});

describe('killWar3Processes', () => {
  it('invokes kill_war3_processes successfully', async () => {
    coreMocks.invoke.mockResolvedValue(undefined);
    await expect(killWar3Processes()).resolves.toBeUndefined();
    expect(coreMocks.invoke).toHaveBeenCalledWith('kill_war3_processes');
  });

  it('rethrows on failure', async () => {
    coreMocks.invoke.mockRejectedValue(new Error('E'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(killWar3Processes()).rejects.toThrow('E');
    err.mockRestore();
  });
});