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

// Mock war3SkinsParser（setRace/loadWar3Skins 动态 import 它）
vi.mock('../utils/war3SkinsParser', () => {
  const data = {
    skins: ['Human', 'Orc', 'NightElf', 'Undead', 'Default'],
    Human: { BTN_Hero: 'Human\\BTN_HumanHero.dds' },
    Orc: { BTN_Hero: 'Orc\\BTN_OrcHero.dds' },
    NightElf: {}, Undead: {}, Default: { BTN_Hero: 'Default\\BTN_Hero.dds' },
  };
  return {
    parseWar3Skins: vi.fn(() => data),
    getTextureForRace: vi.fn((_: unknown, race: string, key: string) => (data as any)[race]?.[key]),
    findTextureKey: vi.fn((_: unknown, path: string) =>
      Object.entries((data as any).Default).find(([, v]) => v === path)?.[0] ??
      Object.entries((data as any).Human).find(([, v]) => v === path)?.[0]),
  };
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
 frames: {}, rootFrameIds: [],
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
 frames: {}, rootFrameIds: [],
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

  it('saveFrameAsPreset 捕获帧样式字段', () => {
    const s = useProjectStore.getState();
    s.addFrame(makeFrame('src', { texture: 'btn.png', text: 'OK', textScale: 0.012 }));
    s.saveFrameAsPreset('src', 'MyBtn', 'buttons');
    const presets = useProjectStore.getState().project!.stylePresets!;
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe('MyBtn');
    expect((presets[0] as any).style.texture).toBe('btn.png');
    expect((presets[0] as any).style.text).toBe('OK');
  });

  it('saveFrameAsPreset 未知帧是 no-op', () => {
    useProjectStore.getState().saveFrameAsPreset('ghost', 'X');
    expect(useProjectStore.getState().project!.stylePresets!).toHaveLength(0);
  });

  it('group 增改删与成员去重', () => {
    const s = useProjectStore.getState();
    const gid = s.createGroup('G1', ['f1', 'f2']);
    expect(gid).toMatch(/^group_/);
    expect(useProjectStore.getState().project!.frameGroups).toHaveLength(1);
 // 重复添加去重
    s.addFramesToGroup(gid, ['f2', 'f3']);
    expect((useProjectStore.getState().project!.frameGroups![0] as any).frameIds).toEqual(['f1', 'f2', 'f3']);
    s.removeFramesFromGroup(gid, ['f1']);
    expect((useProjectStore.getState().project!.frameGroups![0] as any).frameIds).toEqual(['f2', 'f3']);
    s.updateGroup(gid, { name: 'G2' });
    expect((useProjectStore.getState().project!.frameGroups![0] as any).name).toBe('G2');
    s.removeGroup(gid);
    expect(useProjectStore.getState().project!.frameGroups).toHaveLength(0);
  });

  it('loadWar3Skins 解析并存储 skins', async () => {
    await useProjectStore.getState().loadWar3Skins('[Human]\nBTN_Hero=Human\\BTN_HumanHero.dds');
    const skins = useProjectStore.getState().project!.war3Skins as unknown;
    expect(skins).toBeDefined();
    expect((skins as any).Human.BTN_Hero).toContain('Human');
  });

  it('setRace 切换种族相关纹理并更新 currentRace', async () => {
    const s = useProjectStore.getState();
    await s.loadWar3Skins('x'); // 先加载 skins
    s.addFrame(makeFrame('r1', { texture: 'Human\\BTN_HumanHero.dds' }));
    s.addFrame(makeFrame('r2', { texture: 'unrelated.png' }));
    await s.setRace('Orc');
    const p = useProjectStore.getState().project!;
 // r1: Human 路径反查键名 BTN_Hero → Orc 纹理
    expect(p.frames['r1'].texture).toBe('Orc\\BTN_OrcHero.dds');
 // r2: 无关纹理不动
    expect(p.frames['r2'].texture).toBe('unrelated.png');
    expect(p.currentRace).toBe('Orc');
  });

  it('setRace 在未加载 skins 时是 no-op', async () => {
    s_before: {
      const st = useProjectStore.getState();
      st.addFrame(makeFrame('z1', { texture: 'Human\\BTN_HumanHero.dds' }));
      await st.setRace('Orc'); // 无 war3Skins → 直接返回
    }
    expect(useProjectStore.getState().project!.frames['z1'].texture).toBe('Human\\BTN_HumanHero.dds');
    expect(useProjectStore.getState().project!.currentRace).toBeUndefined();
  });
});
