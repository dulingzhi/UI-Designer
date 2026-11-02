/**
 * round 115：saveProject/loadProjectFromPath 序列化字段保真往返测试。
 *
 * 定性：JSON.stringify 对 ProjectData 语义安全——undefined 属性被静默丢弃，
 * 但消费方统一用 `frame.X || ''` / `!== undefined` 判断，键不存在与 undefined
 * 等价，无实际影响。本测试用全字段 ProjectData 锁定往返无意外丢失
 * （嵌套 children/parentId、guides、frameGroups、generalSettings 全字段）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// mock Tauri dialog/fs（saveProject/loadProjectFromPath 依赖）
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}));
const writtenFiles = new Map<string, string>();
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    writtenFiles.set(path, data);
  }),
  readTextFile: vi.fn(async (path: string) => {
    const data = writtenFiles.get(path);
    if (data === undefined) throw new Error('not found: ' + path);
    return data;
  }),
}));

vi.mock('../store/projectStore', () => ({
  useProjectStore: { setState: vi.fn(), getState: vi.fn() },
}));
vi.mock('./war3ProcessManager', () => ({
  war3ProcessManager: {
    getCurrentPid: vi.fn(() => null),
    setProcess: vi.fn(),
    clearPid: vi.fn(),
  },
}));

import { saveProject, loadProjectFromPath } from './fileOperations';
import { save, open } from '@tauri-apps/plugin-dialog';
import { FrameData, FrameType, ProjectData } from '../types';

function fullProject(): ProjectData {
  const parent: FrameData = {
    id: 'root1',
    name: 'Root Panel',
    type: FrameType.BACKDROP,
    x: 0.1,
    y: 0.2,
    width: 0.5,
    height: 0.3,
    parentId: null,
    children: ['child1'],
    texture: 'UI\\Widgets\\bg.blp',
    backdropBackground: 'UI\\Widgets\\bg2.blp',
    backdropTileBackground: true,
    backdropBackgroundSize: 0.04,
    backdropBackgroundInsets: [0.01, 0.01, 0.01, 0.01],
    texCoord: [0, 1, 0, 1],
    alphaMode: 'BLEND',
    decorateFileNames: true,
    locked: false,
    visible: true,
    // 有意保留的 undefined 字段（消费方等价语义）
    text: undefined,
    textColor: undefined,
  } as unknown as FrameData;

  const child: FrameData = {
    id: 'child1',
    name: 'Child Text',
    type: FrameType.TEXT,
    x: 0.15,
    y: 0.25,
    width: 0.2,
    height: 0.1,
    parentId: 'root1',
    children: [],
    text: 'Hello "WC3"',
    textColor: [1, 0.5, 0, 1],
    textScale: 1.2,
    horAlign: 'center',
    font: 'MasterFont',
    fontSize: 0.024,
  } as unknown as FrameData;

  return {
    version: 2,
    libraryName: 'MYLIB',
    originMode: 'gameui',
    exportVersion: 'reforged',
    hideGameUI: true,
    hideHeroBar: true,
    hideMiniMap: false,
    hideResources: false,
    hideButtonBar: false,
    hidePortrait: false,
    hideChat: false,
    appInterface: '',
    backgroundImage: '/backgrounds/wc3-with-ui.png',
    frames: { root1: parent, child1: child },
    rootFrameIds: ['root1'],
    frameGroups: [{ id: 'g1', name: 'Buttons', createdAt: 1700000000000, frameIds: ['child1'] }],
    tableArrays: [],
    circleArrays: [],
    guides: [{ id: 'gd1', axis: 'x', position: 0.4 } as never],
    stylePresets: [],
  } as unknown as ProjectData;
}

describe('saveProject/loadProjectFromPath 序列化保真（round 115）', () => {
  beforeEach(() => {
    writtenFiles.clear();
    vi.mocked(save).mockReset();
    vi.mocked(open).mockReset();
  });

  it('全字段 ProjectData 往返：结构/父子/数组/组/参考线全部保真', async () => {
    const original = fullProject();
    vi.mocked(save).mockResolvedValue('C:\\tmp\\test.w3ui');

    const savedPath = await saveProject(original);
    expect(savedPath).toBe('C:\\tmp\\test.w3ui');

    vi.mocked(open).mockResolvedValue('C:\\tmp\\test.w3ui');
    const { project } = await loadProjectFromPath('C:\\tmp\\test.w3ui');

    // 结构
    expect(Object.keys(project.frames).sort()).toEqual(['child1', 'root1']);
    expect(project.rootFrameIds).toEqual(['root1']);
    // 父子
    expect(project.frames['root1'].children).toEqual(['child1']);
    expect(project.frames['child1'].parentId).toBe('root1');
    // 定义过的字段值
    expect(project.frames['child1'].text).toBe('Hello "WC3"');
    expect(project.frames['root1'].backdropBackground).toBe('UI\\Widgets\\bg2.blp');
    // 通用设置
    expect(project.hideGameUI).toBe(true);
    expect(project.libraryName).toBe('MYLIB');
    // 组与参考线
    expect(project.frameGroups).toHaveLength(1);
    expect(project.frameGroups![0].frameIds).toEqual(['child1']);
    expect(project.guides).toHaveLength(1);
  });

  it('文本含双引号/反斜杠在往返中不被破坏（转义由 JSON 处理）', async () => {
    const original = fullProject();
    vi.mocked(save).mockResolvedValue('C:\\tmp\\t2.w3ui');
    await saveProject(original);
    vi.mocked(open).mockResolvedValue('C:\\tmp\\t2.w3ui');
    const { project } = await loadProjectFromPath('C:\\tmp\\t2.w3ui');
    expect(project.frames['child1'].text).toBe(original.frames['child1'].text);
    expect(project.frames['root1'].texture).toBe('UI\\Widgets\\bg.blp');
  });
});

describe('损坏但合法的 JSON 存档容错（round 116）', () => {
  beforeEach(() => {
    writtenFiles.clear();
    vi.mocked(save).mockReset();
    vi.mocked(open).mockReset();
  });

  it('frames 缺失的合法 JSON → 迁移为空项目而非抛 TypeError', async () => {
    writtenFiles.set('C:\\tmp\\broken.w3ui', JSON.stringify({ foo: 1 }));
    vi.mocked(open).mockResolvedValue('C:\\tmp\\broken.w3ui');

    const { project } = await loadProjectFromPath('C:\\tmp\\broken.w3ui');
    expect(project.frames).toEqual({});
    expect(project.rootFrameIds).toEqual([]);
  });

  it('非法 JSON → 抛错冒泡（上层 handleOpen 警告框兜底，不静默失败）', async () => {
    writtenFiles.set('C:\\tmp\\garbage.w3ui', 'not json at all {{{');
    vi.mocked(open).mockResolvedValue('C:\\tmp\\garbage.w3ui');

    await expect(loadProjectFromPath('C:\\tmp\\garbage.w3ui')).rejects.toThrow();
  });
});


// round 129 环测试专用最小帧（避免与本文件其他 helper 冲突）
function makeCycleFrame(id: string, parentId: string | null): FrameData {
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
  } as unknown as FrameData;
}
describe('手编辑存档 parentId 环打破（round 129）', () => {
  beforeEach(() => {
    writtenFiles.clear();
    vi.mocked(save).mockReset();
    vi.mocked(open).mockReset();
  });

  it('parentId 互指环（A↔B）→ 切根打破，children 无互含（渲染不假死）', async () => {
    // A.parentId=B, B.parentId=A——重建 children 后会互含，collectIds/renderTreeNode 递归死循环
    const cyclic = {
      ...fullProject(),
      frames: {
        a: { ...makeCycleFrame('a', null), parentId: 'b' },
        b: { ...makeCycleFrame('b', 'a'), parentId: 'a' },
        c: { ...makeCycleFrame('c', 'b'), parentId: 'b' },
      },
      rootFrameIds: [],
    } as unknown as ProjectData;
    writtenFiles.set('C:\\tmp\\cycle.w3ui', JSON.stringify(cyclic));
    vi.mocked(open).mockResolvedValue('C:\\tmp\\cycle.w3ui');

    const { project } = await loadProjectFromPath('C:\\tmp\\cycle.w3ui');

    // 环被打破：至少一个环成员切根（parentId 清空），children 链不再互指
    const parentIds = Object.values(project.frames).map(f => f.parentId ?? null);
    const hasNull = parentIds.includes(null);
    expect(hasNull).toBe(true);
    // children 重建后无环：从任一帧沿 children 走最多 frames.length 步必终止
    for (const startId of Object.keys(project.frames)) {
      let current = startId;
      let steps = 0;
      const guard = Object.keys(project.frames).length + 1;
      let stack = [...(project.frames[startId]?.children ?? [])];
      while (stack.length > 0 && steps < guard) {
        const id = stack.pop()!;
        stack.push(...(project.frames[id]?.children ?? []));
        steps++;
      }
      expect(steps).toBeLessThan(guard);
    }
    // rootFrameIds 由迁移重建（至少含被切根的帧）
    expect(project.rootFrameIds.length).toBeGreaterThan(0);
  });
});
