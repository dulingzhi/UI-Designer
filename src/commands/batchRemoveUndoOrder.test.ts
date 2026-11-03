/**
 * round 109：BatchRemoveFrameCommand undo 恢复顺序回归测试。
 *
 * 场景：跨层级多选删除（先选子帧后选父帧）→ undo。
 * round 108 起 addFrame 把"父不存在"的帧归一化为根帧——若 undo 按
 * 用户选择序（子先于父）恢复，子帧被错误升级为根帧，与后续恢复的
 * 父 children 快照形成树断裂。修复：undo 按拓扑序（父先）恢复。
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

import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { BatchRemoveFrameCommand } from './FrameCommands';
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

describe('BatchRemoveFrameCommand undo 恢复顺序（round 109）', () => {
  beforeEach(() => {
    useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
  });

  it('子先于父选择删除，undo 后树结构完整（父 children + 子 parentId 一致）', () => {
 // 树：root ── parent ── child
    const root = makeFrame('root', null);
    const parent = { ...makeFrame('parent', 'root'), children: ['child'] };
    const child = makeFrame('child', 'parent');
    seedProject(
      { root, parent, child },
      ['root'],
    );

 // 用户先选子帧再选父帧（子先于父的删除顺序）
    const cmd = new BatchRemoveFrameCommand(['child', 'parent']);
    cmd.execute();
    expect(useProjectStore.getState().project.frames['child']).toBeUndefined();
    expect(useProjectStore.getState().project.frames['parent']).toBeUndefined();

    cmd.undo();

    const state = useProjectStore.getState().project;
 // 关键断言：child 没有被归一化成根帧（round 108 修复的回归风险）
    expect(state.frames['child'].parentId).toBe('parent');
    expect(state.rootFrameIds).not.toContain('child');
 // 父的 children 快照与 child.parentId 一致
    expect(state.frames['parent'].children).toContain('child');
 // parent 挂回其原父 root（本就不是根帧）
    expect(state.frames['parent'].parentId).toBe('root');
    expect(state.frames['root'].children).toContain('parent');
    expect(state.rootFrameIds).toEqual(['root']);
  });

  it('兄弟帧多选删除（无层级关系）undo 行为不变', () => {
    seedProject(
      { a: makeFrame('a', null), b: makeFrame('b', null) },
      ['a', 'b'],
    );

    const cmd = new BatchRemoveFrameCommand(['a', 'b']);
    cmd.execute();
    cmd.undo();

    const state = useProjectStore.getState().project;
    expect(Object.keys(state.frames).sort()).toEqual(['a', 'b']);
    expect(state.rootFrameIds.sort()).toEqual(['a', 'b']);
  });
});
