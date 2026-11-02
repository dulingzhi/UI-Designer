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

  it('addFrame 到无 children 字段的父帧不崩溃（导入 FDF 场景）', () => {
    const s = useProjectStore.getState();
    // 父帧无 children（导入 FDF 的真实形状）
    s.addFrame(makeFrame('p0') as FrameData & { children?: string[] });
    const p0 = useProjectStore.getState().project!.frames['p0'];
    delete (p0 as any).children; // 模拟导入帧缺可选字段
    s.addFrame({ ...makeFrame('c0'), parentId: 'p0' });
    expect(useProjectStore.getState().project!.frames['c0'].parentId).toBe('p0');
  });

  it('addFrames 父子帧同批导入（父帧无 children）不崩溃', () => {
    const s = useProjectStore.getState();
    const parent = makeFrame('p1');
    delete (parent as any).children;
    s.addFrames([parent, { ...makeFrame('c1'), parentId: 'p1' }]);
    const p = useProjectStore.getState().project!;
    expect(p.frames['c1'].parentId).toBe('p1');
    expect((p.frames['p1'] as any).children).toContain('c1');
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

describe('projectStore 数组编辑器', () => {
  beforeEach(() => {
    useProjectStore.setState({ project: null as never });
    useProjectStore.getState().setProject({
      version: 2, libraryName: 'T', originMode: 'gameui', exportVersion: 'reforged',
      backgroundImage: '', hideGameUI: false, hideHeroBar: false, hideMiniMap: false,
      hideResources: false, hideButtonBar: false, hidePortrait: false, hideChat: false,
      appInterface: '', frames: {}, rootFrameIds: [],
      tableArrays: [], circleArrays: [], guides: [], stylePresets: [],
    } as never);
  });

  const tarr = (id: string) => ({ id, name: `tbl_${id}`, count: 5 } as never);
  const carr = (id: string) => ({ id, name: `cir_${id}`, count: 6 } as never);
  const guide = (id: string) => ({ id, axis: 'x', position: 0.3 } as never);
  const preset = (id: string) => ({ id, name: `pre_${id}`, category: 'btn' } as never);

  it('tableArray 增/改/删', () => {
    const s = useProjectStore.getState();
    s.addTableArray(tarr('t1'));
    expect(useProjectStore.getState().project!.tableArrays).toHaveLength(1);
    s.updateTableArray('t1', { count: 8 } as never);
    expect((useProjectStore.getState().project!.tableArrays[0] as any).count).toBe(8);
    s.removeTableArray('t1');
    expect(useProjectStore.getState().project!.tableArrays).toHaveLength(0);
  });

  it('circleArray 增/改/删', () => {
    const s = useProjectStore.getState();
    s.addCircleArray(carr('c1'));
    expect(useProjectStore.getState().project!.circleArrays).toHaveLength(1);
    s.removeCircleArray('c1');
    expect(useProjectStore.getState().project!.circleArrays).toHaveLength(0);
  });

  it('guide 增/改/清空', () => {
    const s = useProjectStore.getState();
    s.addGuide(guide('g1'));
    s.addGuide(guide('g2'));
    expect(useProjectStore.getState().project!.guides).toHaveLength(2);
    s.clearGuides();
    expect(useProjectStore.getState().project!.guides).toHaveLength(0);
  });

  it('stylePreset 增/删', () => {
    const s = useProjectStore.getState();
    s.addStylePreset(preset('s1'));
    expect(useProjectStore.getState().project!.stylePresets).toHaveLength(1);
    s.removeStylePreset('s1');
    expect(useProjectStore.getState().project!.stylePresets).toHaveLength(0);
  });

  it('applyStylePreset 将样式字段应用到目标帧', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('a1', { texture: 'old.png' }));
    s.addFrame(makeFrame('a2'));
    s.addStylePreset({ id: 'px', name: 'Red', category: '默认',
      style: { texture: 'red.png' } } as never);
    s.applyStylePreset('px', ['a1', 'a2']);
    const p = useProjectStore.getState().project!;
    expect(p.frames['a1'].texture).toBe('red.png');
    expect(p.frames['a2'].texture).toBe('red.png');
    // 非目标帧不受影响
    expect(p.frames['a1'].name).toBe('Frame_a1');
  });

  it('applyStylePreset 未知 presetId 是 no-op', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('b1', { texture: 'keep.png' }));
    s.applyStylePreset('missing', ['b1']);
    expect(useProjectStore.getState().project!.frames['b1'].texture).toBe('keep.png');
  });
});
