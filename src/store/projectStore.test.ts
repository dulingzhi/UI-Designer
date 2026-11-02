import { describe, it, expect, beforeEach, vi } from 'vitest';
// Mock hotReloadExporter to avoid localStorage dependency
vi.mock('../utils/hotReloadExporter', () => ({
  hotReloadConfig: { enabled: false, outputPath: '', war3Path: '' },
  updateHotReloadConfig: vi.fn(),
  exportForHotReload: vi.fn(),
}));
// Mock war3ProcessManager to avoid localStorage dependency
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: {
    getCurrentPid: vi.fn(() => null),
    setPid: vi.fn(),
    clearPid: vi.fn(),
  },
}));
// Stub localStorage globally for any remaining usages
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

import { useProjectStore } from './projectStore';
import { useUIStore } from './uiStore';
import type { FrameData, FrameType } from '../types';

const makeFrame = (id: string, overrides: Partial<FrameData> = {}): FrameData => ({
  id,
  name: `Frame_${id}`,
  type: 'frame' as unknown as FrameType,
  x: 0.1, y: 0.1, width: 0.2, height: 0.1,
  ...overrides,
});

describe('projectStore 帧操作', () => {
  beforeEach(() => {
    // 先 reset UI 状态，再 seed project（顺序踩坑已记录于 AGENTS.md）
    useUIStore.getState().reset?.();
    useProjectStore.setState({ project: null as never });
    useProjectStore.getState().setProject({
      version: 2, libraryName: 'T', originMode: 'gameui', exportVersion: 'reforged',
      backgroundImage: '', hideGameUI: false, hideHeroBar: false, hideMiniMap: false,
      hideResources: false, hideButtonBar: false, hidePortrait: false, hideChat: false,
      appInterface: '', frames: {}, rootFrameIds: [],
      tableArrays: [], circleArrays: [], guides: [], stylePresets: [],
    } as never);
  });

  it('addFrame 写入 frames 并更新 rootFrameIds（无父帧）', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('a'));
    const p = useProjectStore.getState().project!;
    expect(p.frames['a']).toBeDefined();
    expect(p.rootFrameIds).toContain('a');
  });

  it('addFrames 批量写入', () => {
    const s = useProjectStore.getState();
    s.addFrames([makeFrame('x'), makeFrame('y')]);
    expect(Object.keys(useProjectStore.getState().project!.frames)).toContain('x');
    expect(Object.keys(useProjectStore.getState().project!.frames)).toContain('y');
  });

  it('updateFrame 局部更新保留其余字段', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('u', { text: 'hello' }));
    s.updateFrame('u', { x: 0.5 });
    const f = useProjectStore.getState().project!.frames['u'];
    expect(f.x).toBe(0.5);
    expect(f.text).toBe('hello'); // 未触碰字段保留
  });

  it('getFrame 按 id 取帧', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('g'));
    expect(useProjectStore.getState().getFrame('g')?.id).toBe('g');
    expect(useProjectStore.getState().getFrame('missing')).toBeUndefined();
  });

  it('toggleFrameLock 切换 locked', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('l'));
    s.toggleFrameLock('l');
    expect(useProjectStore.getState().project!.frames['l'].locked).toBe(true);
    s.toggleFrameLock('l');
    expect(useProjectStore.getState().project!.frames['l'].locked).toBe(false);
  });

  it('toggleFrameVisibility 切换 visible', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('v', { visible: true }));
    s.toggleFrameVisibility('v');
    expect(useProjectStore.getState().project!.frames['v'].visible).toBe(false);
  });

  it('removeFrame 移除帧并从 rootFrameIds 摘除', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('r'));
    expect(useProjectStore.getState().project!.rootFrameIds).toContain('r');
    s.removeFrame('r');
    const p = useProjectStore.getState().project!;
    expect(p.frames['r']).toBeUndefined();
    expect(p.rootFrameIds).not.toContain('r');
  });

  it('updateGeneralSettings 合并设置', () => {
    const s = useProjectStore.getState();
    s.updateGeneralSettings({ libraryName: 'MyLib', hideMiniMap: true });
    const p = useProjectStore.getState().project!;
    expect(p.libraryName).toBe('MyLib');
    expect(p.hideMiniMap).toBe(true);
    expect(p.originMode).toBe('gameui'); // 未触碰设置保留
  });
});
