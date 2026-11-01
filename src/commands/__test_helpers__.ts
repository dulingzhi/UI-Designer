// 命令单测共享辅助：建测试 Frame/Project 的最小可复用构造。
// 仅用于 src/commands/*.test.ts，不参与覆盖率统计（见 vitest 覆盖率 include 范围只含 src/utils/**）。

import { FrameData, FrameType, ProjectData } from '../types';

export function makeTestFrame(overrides: Partial<FrameData> = {}): FrameData {
  const base: FrameData = {
    id: `frame-${Math.random().toString(36).substring(7)}`,
    name: 'TestFrame',
    type: FrameType.BACKDROP,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.1,
    z: 0,
    parentId: null,
    children: [],
    anchors: [],
  };
  return { ...base, ...overrides } as FrameData;
}

export function makeTestFrameFixed(id: string, overrides: Partial<FrameData> = {}): FrameData {
  return makeTestFrame({ id, ...overrides });
}

export function makeTestProject(
  patch: { frames: Record<string, FrameData>; rootFrameIds: string[] }
): ProjectData {
  return {
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
    appInterface: 'dark',
    backgroundImage: '/backgrounds/wc3-with-ui.png',
    frames: patch.frames,
    rootFrameIds: patch.rootFrameIds,
    tableArrays: [],
    circleArrays: [],
    guides: [],
    frameGroups: [],
  };
}