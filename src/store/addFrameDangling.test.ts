/**
 * round 108：addFrame 悬空 parentId 幽灵帧缺陷回归测试。
 *
 * 复现路径：复制子帧 → 删除其原父帧 → Ctrl+V（PasteFrameCommand 以原 parentId
 * 粘贴副本）。原实现 addFrame 对悬空 parentId 既不挂父 children 也不入
 * rootFrameIds——副本存在却不可见不可选（幽灵帧）。
 * 修复：悬空 parentId 归一化为根帧（与 fileOperations 迁移清理语义一致）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/hotReloadExporter', () => ({
  hotReloadConfig: { enabled: false, outputPath: '', war3Path: '' },
  updateHotReloadConfig: vi.fn(),
  exportForHotReload: vi.fn(),
}));
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: {
    getCurrentPid: vi.fn(() => null),
    setPid: vi.fn(),
    clearPid: vi.fn(),
  },
}));
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

import { useProjectStore } from './projectStore';
import { FrameData, FrameType, ProjectData } from '../types';

function makeFrame(id: string, parentId: string | null): FrameData {
  return {
    id,
    name: id,
    type: FrameType.BACKDROP,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    parentId,
    children: [],
  } as FrameData;
}

function seedProject(frames: Record<string, FrameData>, rootFrameIds: string[]) {
  const project = {
    version: 2,
    libraryName: 'TESTLIB',
    originMode: 'gameui',
    exportVersion: 'reforged',
    hideGameUI: false,
    hideHeroBar: false,
    hideMiniMap: false,
    hideResources: false,
    hideButtonBar: false,
    hidePortrait: false,
    hideChat: false,
    backgroundImage: '',
    frames,
    rootFrameIds,
    frameGroups: [],
    tableArrays: [],
    circleArrays: [],
    guides: [],
    stylePresets: [],
  } as unknown as ProjectData;
  useProjectStore.setState({ project });
}

describe('addFrame 悬空 parentId（round 108 幽灵帧修复）', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: useProjectStore.getState().project });
  });

  it('parentId 指向不存在帧时归一化为根帧（入 rootFrameIds + parentId 置空）', () => {
    seedProject(
      { existing: makeFrame('existing', null) },
      ['existing'],
    );

    const orphan = makeFrame('ghost', 'deleted-parent');
    useProjectStore.getState().addFrame(orphan);

    const state = useProjectStore.getState().project;
    expect(state.frames['ghost'].parentId).toBeNull();
    expect(state.rootFrameIds).toContain('ghost');
  });

  it('parentId 有效时不影响既有行为（仍挂父 children、不入根）', () => {
    seedProject(
      { parent: makeFrame('parent', null) },
      ['parent'],
    );

    useProjectStore.getState().addFrame(makeFrame('child', 'parent'));

    const state = useProjectStore.getState().project;
    expect(state.frames['parent'].children).toContain('child');
    expect(state.rootFrameIds).not.toContain('child');
  });
});
