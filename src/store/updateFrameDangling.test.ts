/**
 * round 112：updateFrame parentId 变更的悬空归一化回归测试。
 *
 * 场景：ProjectTree 拖拽帧 A 到帧 B 下（updateFrame({parentId: 'B'})），
 * 若 B 恰好已被删除（悬空）——原实现不挂 children 又不入 rootFrameIds
 * （仅对 null 判定）→ 幽灵帧复发（同族第 8 处）。
 * 修复：悬空归一化为根帧，与 addFrame（round 108）语义一致。
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

describe('updateFrame parentId 悬空归一化（round 112）', () => {
  beforeEach(() => {
    seedProject(
      { root: makeFrame('root', null) },
      ['root'],
    );
  });

  it('拖拽到已删除的父 → 归一化为根帧（parentId 置空 + 入 rootFrameIds）', () => {
    useProjectStore.getState().addFrame(makeFrame('moving', null));
 // 此时 'deleted' 不存在于 frames
    useProjectStore.getState().updateFrame('moving', { parentId: 'deleted' });

    const state = useProjectStore.getState().project;
    expect(state.frames['moving'].parentId).toBeNull();
    expect(state.rootFrameIds).toContain('moving');
  });

  it('正常父存在 → 挂新父 children、移出根集（既有行为不回归）', () => {
    useProjectStore.getState().addFrame(makeFrame('parent2', null));
    useProjectStore.getState().addFrame(makeFrame('moving2', null));

    useProjectStore.getState().updateFrame('moving2', { parentId: 'parent2' });

    const state = useProjectStore.getState().project;
    expect(state.frames['parent2'].children).toContain('moving2');
    expect(state.rootFrameIds).not.toContain('moving2');
  });

  it('从子帧拖回根（parentId: null）→ 移出新父 children、入根集', () => {
    useProjectStore.getState().addFrame(makeFrame('p', null));
    useProjectStore.getState().addFrame(makeFrame('c', 'p'));

    useProjectStore.getState().updateFrame('c', { parentId: null });

    const state = useProjectStore.getState().project;
    expect(state.frames['c'].parentId).toBeNull();
    expect(state.frames['p'].children).not.toContain('c');
    expect(state.rootFrameIds).toContain('c');
  });
});
