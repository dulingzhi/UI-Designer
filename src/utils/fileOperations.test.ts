import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectData, FrameData, FrameType } from '../types';

const dialogMocks = vi.hoisted(() => ({ save: vi.fn(), open: vi.fn() }));
const fsMocks = vi.hoisted(() => ({ writeTextFile: vi.fn(), readTextFile: vi.fn() }));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: dialogMocks.save,
  open: dialogMocks.open,
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: fsMocks.writeTextFile,
  readTextFile: fsMocks.readTextFile,
}));
// fdf is a heavy parser; stub it so the test only exercises fileOperations wiring.
vi.mock('./fdf', () => ({ parseFDF: vi.fn() }));

import { saveProject, loadProject, loadProjectFromPath, exportCode, importFromFDF } from './fileOperations';
import { parseFDF } from './fdf';

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
    appInterface: undefined,
    frames: {
      f1: {
        id: 'f1',
        name: 'Root',
        type: FrameType.FRAME,
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        z: 0,
        children: [],
        tooltip: false,
        isRelative: false,
      },
    },
    rootFrameIds: ['f1'],
    tableArrays: [],
    circleArrays: [],
  };
}

describe('saveProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes to the provided path without prompting', async () => {
    fsMocks.writeTextFile.mockResolvedValue(undefined);
    const path = await saveProject(makeProject(), 'C:\\out\\x.w3ui');
    expect(path).toBe('C:\\out\\x.w3ui');
    expect(dialogMocks.save).not.toHaveBeenCalled();
    expect(fsMocks.writeTextFile).toHaveBeenCalledTimes(1);
  });

  it('prompts with a save dialog when no path given, returning null on cancel', async () => {
    dialogMocks.save.mockResolvedValue(null);
    const path = await saveProject(makeProject());
    expect(path).toBeNull();
    expect(dialogMocks.save).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'myproject.w3ui' }));
    expect(fsMocks.writeTextFile).not.toHaveBeenCalled();
  });

  it('uses the dialog path when chosen', async () => {
    dialogMocks.save.mockResolvedValue('C:\\chosen\\my.w3ui');
    fsMocks.writeTextFile.mockResolvedValue(undefined);
    const path = await saveProject(makeProject());
    expect(path).toBe('C:\\chosen\\my.w3ui');
    expect(fsMocks.writeTextFile).toHaveBeenCalledWith('C:\\chosen\\my.w3ui', expect.stringContaining('"name": "Root"'));
  });

  it('logs and rethrows on failure', async () => {
    fsMocks.writeTextFile.mockRejectedValue(new Error('disk full'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(saveProject(makeProject(), 'C:\\x.w3ui')).rejects.toThrow('disk full');
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});

describe('loadProject', () => {
  it('returns null when the dialog is cancelled', async () => {
    dialogMocks.open.mockResolvedValue(null);
    await expect(loadProject()).resolves.toBeNull();
  });

  it('returns null when an array path is returned (multi-selection)', async () => {
    dialogMocks.open.mockResolvedValue(['a.w3ui', 'b.w3ui']);
    await expect(loadProject()).resolves.toBeNull();
  });

  it('loads and migrates a project from the chosen path', async () => {
    // Provide a project missing anchors to trigger migration default creation.
    const raw = {
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
      frames: {
        f1: { id: 'f1', name: 'Root', type: 1, x: 10, y: 20, width: 100, height: 50, parentId: '' },
        f2: { id: 'f2', name: 'Child', type: 1, x: 0, y: 0, width: 10, height: 10, parentId: 'f1' },
      },
      rootFrameIds: ['f1'],
      tableArrays: [],
      circleArrays: [],
    };
    dialogMocks.open.mockResolvedValue('C:\\p\\my.w3ui');
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify(raw));
    const result = await loadProject();
    expect(result?.path).toBe('C:\\p\\my.w3ui');
    const f1 = result!.project.frames['f1'];
    // Migration rebuilt children from parentId.
    expect(f1.children).toEqual(['f2']);
    expect(f1.anchors).toBeDefined();
    expect(f1.anchors!.length).toBe(1);
  });

  it('logs and rethrows on failure', async () => {
    dialogMocks.open.mockResolvedValue('C:\\p\\bad.w3ui');
    fsMocks.readTextFile.mockRejectedValue(new Error('no file'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(loadProject()).rejects.toThrow('no file');
    err.mockRestore();
  });
});

describe('loadProjectFromPath', () => {
  it('loads a project that already has anchors', async () => {
    const raw = {
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
      frames: {
        g: { id: 'g', name: 'N', type: 1, x: 0, y: 0, width: 5, height: 5, anchors: [{ point: 0, x: 0, y: 5 }] },
      },
      rootFrameIds: ['g'],
      tableArrays: [],
      circleArrays: [],
    };
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify(raw));
    const result = await loadProjectFromPath('C:\\a.w3ui');
    expect(result!.project.frames['g'].anchors).toHaveLength(1);
  });

  it('migrates frames with empty anchors', async () => {
    const raw = {
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
      frames: {
        a: { id: 'a', name: 'A', type: 1, x: 1, y: 2, width: 3, height: 4, anchors: [], parentId: null },
        b: { id: 'b', name: 'B', type: 1, x: 0, y: 0, width: 3, height: 4, parentId: 'a', childOrder: 0 },
      },
      rootFrameIds: ['a'],
      tableArrays: [],
      circleArrays: [],
    };
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify(raw));
    const result = await loadProjectFromPath('C:\\a.w3ui');
    const a = result!.project.frames['a'];
    expect(a.anchors![0].x).toBe(1);
    expect(a.anchors![0].y).toBe(2 + 4); // topLeft = y + height
    expect(a.children).toContain('b');
  });

  it('dedupes children already present in the children array', async () => {
    // Two frames both list a duplicated child reference; migration rebuilds
    // children from parentId and must not push a duplicate.
    const raw = {
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
      frames: {
        a: { id: 'a', name: 'A', type: 1, x: 0, y: 0, width: 3, height: 4, parentId: null },
        b: { id: 'b', name: 'B', type: 1, x: 0, y: 0, width: 3, height: 4, parentId: 'a' },
        c: { id: 'c', name: 'C', type: 1, x: 0, y: 0, width: 3, height: 4, parentId: 'a' },
      },
      rootFrameIds: ['a'],
      tableArrays: [],
      circleArrays: [],
    };
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify(raw));
    const result = await loadProjectFromPath('C:\\a.w3ui');
    // b and c both reference parent a; no duplicate entries.
    expect(result!.project.frames['a'].children).toEqual(['b', 'c']);
  });

  it('keeps an already-populated children array rebuilt from parentId', async () => {
    const raw = {
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
      frames: {
        a: { id: 'a', name: 'A', type: 1, x: 0, y: 0, width: 3, height: 4, parentId: null },
        b: { id: 'b', name: 'B', type: 1, x: 0, y: 0, width: 3, height: 4, parentId: 'a' },
      },
      rootFrameIds: ['a'],
      tableArrays: [],
      circleArrays: [],
    };
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify(raw));
    const result = await loadProjectFromPath('C:\\a.w3ui');
    expect(result!.project.frames['a'].children).toEqual(['b']);
  });

  it('handles invalid JSON, logs and rethrows', async () => {
    fsMocks.readTextFile.mockResolvedValue('{bad json');
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(loadProjectFromPath('C:\\bad.w3ui')).rejects.toThrow();
    err.mockRestore();
  });
});

describe('exportCode', () => {
  it('returns null when dialog cancelled', async () => {
    dialogMocks.save.mockResolvedValue(null);
    await expect(exportCode('code', 'lua')).resolves.toBeNull();
  });

  it('writes jass/lua/ts files with the right extension', async () => {
    fsMocks.writeTextFile.mockResolvedValue(undefined);
    dialogMocks.save.mockResolvedValue('C:\\out\\ui_export.j');
    await exportCode('jass code', 'jass');
    expect(dialogMocks.save).toHaveBeenCalledWith(expect.objectContaining({
      filters: [{ name: 'JASS File', extensions: ['j'] }],
      defaultPath: 'ui_export.j',
    }));
    expect(fsMocks.writeTextFile).toHaveBeenCalledWith('C:\\out\\ui_export.j', 'jass code');

    dialogMocks.save.mockResolvedValue('C:\\out\\ui_export.lua');
    await exportCode('lua', 'lua');
    expect(fsMocks.writeTextFile).toHaveBeenCalledWith('C:\\out\\ui_export.lua', 'lua');

    dialogMocks.save.mockResolvedValue('C:\\out\\ui_export.ts');
    await exportCode('ts', 'ts');
    expect(fsMocks.writeTextFile).toHaveBeenCalledWith('C:\\out\\ui_export.ts', 'ts');
  });

  it('logs and rethrows on failure', async () => {
    dialogMocks.save.mockResolvedValue('C:\\out\\x.ts');
    fsMocks.writeTextFile.mockRejectedValue(new Error('denied'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(exportCode('c', 'ts')).rejects.toThrow('denied');
    err.mockRestore();
  });
});

describe('importFromFDF', () => {
  it('returns null when dialog cancelled', async () => {
    dialogMocks.open.mockResolvedValue(null);
    await expect(importFromFDF()).resolves.toBeNull();
  });

  it('returns null on array path', async () => {
    dialogMocks.open.mockResolvedValue(['a.fdf']);
    await expect(importFromFDF()).resolves.toBeNull();
  });

  it('reads and parses an fdf file using kernel layout', async () => {
    dialogMocks.open.mockResolvedValue('C:\\fdf\\a.fdf');
    fsMocks.readTextFile.mockResolvedValue('Frame "BACKDROP" "X" {}');
    vi.mocked(parseFDF).mockReturnValue([] as FrameData[]);
    const result = await importFromFDF();
    expect(result).toEqual([]);
    expect(parseFDF).toHaveBeenCalledWith('Frame "BACKDROP" "X" {}', { useKernelLayout: true });
  });

  it('logs and rethrows on failure', async () => {
    dialogMocks.open.mockResolvedValue('C:\\fdf\\a.fdf');
    fsMocks.readTextFile.mockRejectedValue(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(importFromFDF()).rejects.toThrow('boom');
    err.mockRestore();
  });
});

describe('loadProjectFromPath 悬空 parentId 迁移', () => {
  it('指向不存在帧的 parentId 迁移时清理为 null（round 145：与正常根帧一致）', async () => {
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify({
      frames: {
        a: { id: 'a', name: 'A', type: FrameType.FRAME, x: 0, y: 0, width: 1, height: 1, parentId: '' },
        b: { id: 'b', name: 'B', type: FrameType.FRAME, x: 0, y: 0, width: 1, height: 1, parentId: 'ghost' },
      },
    }));
    const { project } = await loadProjectFromPath('C:\\p.w3ui');
    // 悬空引用被清理（不再随再次保存永久化）
    expect(project.frames.b.parentId).toBe(null);
    // 有效父子关系不受影响
    expect(project.frames.a.children).toEqual([]);
  });

  it('有效 parentId 与完整父子链正常保留', async () => {
    fsMocks.readTextFile.mockResolvedValue(JSON.stringify({
      frames: {
        p: { id: 'p', name: 'P', type: FrameType.FRAME, x: 0, y: 0, width: 2, height: 2, parentId: '' },
        c: { id: 'c', name: 'C', type: FrameType.FRAME, x: 0, y: 0, width: 1, height: 1, parentId: 'p' },
      },
    }));
    const { project } = await loadProjectFromPath('C:\\p.w3ui');
    expect(project.frames.c.parentId).toBe('p');
    expect(project.frames.p.children).toEqual(['c']);
  });
});