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

import { useUIStore, STYLE_PROPERTIES } from './uiStore';
import { useProjectStore } from './projectStore';
import { FrameData, FrameType, ProjectData } from '../types';

// 创建测试用 frame
function makeTestFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'test-frame-1',
    name: 'TestFrame',
    type: FrameType.BACKDROP,
    x: 0.1,
    y: 0.1,
    width: 0.2,
    height: 0.2,
    textColor: '#ff0000',
    textScale: 1.5,
    horAlign: 'center' as const,
    verAlign: 'center' as const,
    texture: 'test-texture.blp',
    text: 'Hello',
    font: 'MasterFont',
    fontSize: 0.024,
    fontFlags: ['FIXEDSIZE'],
    backdropBackground: 'bg.blp',
    backdropTileBackground: true,
    backdropBackgroundSize: 0.04,
    ...overrides,
  } as FrameData;
}

// 创建测试用 ProjectData（补齐 ProjectData 全部必填字段）
function makeTestProject(patch: {
  frames: Record<string, FrameData>;
  rootFrameIds: string[];
}): ProjectData {
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
  };
}

describe('STYLE_PROPERTIES', () => {
  it('包含所有预期的样式属性类别', () => {
    // 文本属性
    expect(STYLE_PROPERTIES).toContain('textColor');
    expect(STYLE_PROPERTIES).toContain('textScale');
    expect(STYLE_PROPERTIES).toContain('font');
    expect(STYLE_PROPERTIES).toContain('fontSize');
    expect(STYLE_PROPERTIES).toContain('fontFlags');
    // 纹理属性
    expect(STYLE_PROPERTIES).toContain('texture');
    // Backdrop 属性
    expect(STYLE_PROPERTIES).toContain('backdropBackground');
    expect(STYLE_PROPERTIES).toContain('backdropTileBackground');
    expect(STYLE_PROPERTIES).toContain('backdropBackgroundSize');
    expect(STYLE_PROPERTIES).toContain('backdropBackgroundInsets');
    expect(STYLE_PROPERTIES).toContain('backdropEdgeFile');
  });

  it('不包含位置/尺寸属性', () => {
    expect(STYLE_PROPERTIES).not.toContain('x');
    expect(STYLE_PROPERTIES).not.toContain('y');
    expect(STYLE_PROPERTIES).not.toContain('width');
    expect(STYLE_PROPERTIES).not.toContain('height');
    expect(STYLE_PROPERTIES).not.toContain('id');
    expect(STYLE_PROPERTIES).not.toContain('name');
    expect(STYLE_PROPERTIES).not.toContain('type');
    expect(STYLE_PROPERTIES).not.toContain('parentId');
  });
});

describe('copyStyleToClipboard', () => {
  beforeEach(() => {
    useUIStore.setState({ styleClipboard: null });
    useProjectStore.setState({
      project: makeTestProject({ frames: {}, rootFrameIds: [] }),
    });
  });

  it('复制 frame 的所有已定义样式属性到剪贴板', () => {
    const frame = makeTestFrame();
    useProjectStore.setState({
      project: makeTestProject({
        frames: { [frame.id]: frame },
        rootFrameIds: [frame.id],
      }),
    });

    useUIStore.getState().copyStyleToClipboard(frame.id);

    const clipboard = useUIStore.getState().styleClipboard;
    expect(clipboard).not.toBeNull();
    expect(clipboard!.textColor).toBe('#ff0000');
    expect(clipboard!.textScale).toBe(1.5);
    expect(clipboard!.font).toBe('MasterFont');
    expect(clipboard!.fontSize).toBe(0.024);
    expect(clipboard!.fontFlags).toEqual(['FIXEDSIZE']);
    expect(clipboard!.backdropBackground).toBe('bg.blp');
    expect(clipboard!.backdropTileBackground).toBe(true);
  });

  it('只复制已定义(非 undefined)的属性', () => {
    const frame = makeTestFrame({ font: undefined, fontSize: undefined });
    useProjectStore.setState({
      project: makeTestProject({
        frames: { [frame.id]: frame },
        rootFrameIds: [frame.id],
      }),
    });

    useUIStore.getState().copyStyleToClipboard(frame.id);

    const clipboard = useUIStore.getState().styleClipboard;
    expect(clipboard).not.toBeNull();
    expect('font' in clipboard!).toBe(false);
    expect('fontSize' in clipboard!).toBe(false);
    // 其他属性仍存在
    expect(clipboard!.textColor).toBe('#ff0000');
  });

  it('frame 不存在时不修改剪贴板', () => {
    useUIStore.getState().copyStyleToClipboard('nonexistent');
    expect(useUIStore.getState().styleClipboard).toBeNull();
  });
});

describe('Canvas 显示状态', () => {
  it('默认值正确', () => {
    const state = useUIStore.getState();
    expect(state.showGrid).toBe(true);
    expect(state.showAnchors).toBe(false);
    expect(state.showRulers).toBe(true);
    expect(state.snapToGrid).toBe(true);
    expect(state.gridSize).toBe(0.01);
  });

  it('setShowGrid 正确切换', () => {
    useUIStore.getState().setShowGrid(false);
    expect(useUIStore.getState().showGrid).toBe(false);
    useUIStore.getState().setShowGrid(true);
    expect(useUIStore.getState().showGrid).toBe(true);
  });

  it('setShowAnchors 正确切换', () => {
    useUIStore.getState().setShowAnchors(true);
    expect(useUIStore.getState().showAnchors).toBe(true);
  });

  it('setShowRulers 正确切换', () => {
    useUIStore.getState().setShowRulers(false);
    expect(useUIStore.getState().showRulers).toBe(false);
  });

  it('setSnapToGrid 正确切换', () => {
    useUIStore.getState().setSnapToGrid(false);
    expect(useUIStore.getState().snapToGrid).toBe(false);
  });

  it('setGridSize 正确设置', () => {
    useUIStore.getState().setGridSize(0.05);
    expect(useUIStore.getState().gridSize).toBe(0.05);
  });
});

describe('pasteStyleFromClipboard', () => {
  beforeEach(() => {
    useUIStore.setState({ styleClipboard: null });
  });

  it('将样式粘贴到目标 frame', () => {
    const source = makeTestFrame({ id: 'source' });
    const target = makeTestFrame({
      id: 'target',
      textColor: '#000000',
      textScale: 1.0,
      font: 'OtherFont',
    });

    useProjectStore.setState({
      project: makeTestProject({
        frames: { [source.id]: source, [target.id]: target },
        rootFrameIds: [source.id, target.id],
      }),
    });

    // 先复制源样式
    useUIStore.getState().copyStyleToClipboard(source.id);
    // 再粘贴到目标
    useUIStore.getState().pasteStyleFromClipboard([target.id]);

    const updated = useProjectStore.getState().project.frames[target.id];
    expect(updated.textColor).toBe('#ff0000');
    expect(updated.textScale).toBe(1.5);
    expect(updated.font).toBe('MasterFont');
  });

  it('不粘贴到锁定的 frame', () => {
    const source = makeTestFrame({ id: 'source' });
    const locked = makeTestFrame({
      id: 'locked',
      textColor: '#000000',
      locked: true,
    });

    useProjectStore.setState({
      project: makeTestProject({
        frames: { [source.id]: source, [locked.id]: locked },
        rootFrameIds: [source.id, locked.id],
      }),
    });

    useUIStore.getState().copyStyleToClipboard(source.id);
    useUIStore.getState().pasteStyleFromClipboard([locked.id]);

    const updated = useProjectStore.getState().project.frames[locked.id];
    expect(updated.textColor).toBe('#000000'); // 未变
  });

  it('没有剪贴板时不做任何操作', () => {
    const frame = makeTestFrame({ textColor: '#000000' });
    useProjectStore.setState({
      project: makeTestProject({
        frames: { [frame.id]: frame },
        rootFrameIds: [frame.id],
      }),
    });

    useUIStore.getState().pasteStyleFromClipboard([frame.id]);

    const updated = useProjectStore.getState().project.frames[frame.id];
    expect(updated.textColor).toBe('#000000'); // 未变
  });
});

describe('选择类 action（round 105 补齐，编辑器核心交互）', () => {
  beforeEach(() => {
    useUIStore.setState({
      selectedFrameId: null,
      selectedFrameIds: [],
      highlightedFrameIds: [],
    });
    useProjectStore.setState({
      project: makeTestProject({ frames: {}, rootFrameIds: [] }),
    });
  });

  it('selectFrame 单选并同步 selectedFrameId；null 清空', () => {
    useUIStore.getState().selectFrame('a');
    expect(useUIStore.getState().selectedFrameId).toBe('a');
    expect(useUIStore.getState().selectedFrameIds).toEqual(['a']);

    useUIStore.getState().selectFrame(null);
    expect(useUIStore.getState().selectedFrameId).toBeNull();
    expect(useUIStore.getState().selectedFrameIds).toEqual([]);
  });

  it('toggleSelectFrame 加选/移除，selectedFrameId=最后成员', () => {
    useUIStore.getState().toggleSelectFrame('a');
    useUIStore.getState().toggleSelectFrame('b');
    expect(useUIStore.getState().selectedFrameIds).toEqual(['a', 'b']);
    expect(useUIStore.getState().selectedFrameId).toBe('b');

    useUIStore.getState().toggleSelectFrame('a');
    expect(useUIStore.getState().selectedFrameIds).toEqual(['b']);
    expect(useUIStore.getState().selectedFrameId).toBe('b');
  });

  it('clearSelection 清空双状态', () => {
    useUIStore.getState().selectMultipleFrames(['a', 'b']);
    useUIStore.getState().clearSelection();
    expect(useUIStore.getState().selectedFrameId).toBeNull();
    expect(useUIStore.getState().selectedFrameIds).toEqual([]);
  });

  it('selectGroup 选中组成员并同步 selectedFrameId=最后成员（round 105 修复）', () => {
    useProjectStore.setState({
      project: makeTestProject({
        frames: { a: makeTestFrame({ id: 'a' }), b: makeTestFrame({ id: 'b' }) },
        rootFrameIds: ['a', 'b'],
      }),
      // frameGroups 不在 makeTestProject 里，直接补
    } as never);
    useProjectStore.setState((s) => ({
      project: { ...s.project, frameGroups: [{ id: 'g1', name: 'G', createdAt: 0, frameIds: ['a', 'b'] }] },
    }));

    // 先造一个旧选中残留
    useUIStore.getState().selectFrame('old-frame');
    useUIStore.getState().selectGroup('g1');

    expect(useUIStore.getState().selectedFrameIds).toEqual(['a', 'b']);
    // 修复点：selectedFrameId 必须同步为最后成员，而非残留 'old-frame'
    expect(useUIStore.getState().selectedFrameId).toBe('b');
  });

  it('selectGroup 未知组静默 no-op（不改当前选择）', () => {
    useUIStore.getState().selectFrame('keep');
    useUIStore.getState().selectGroup('no-such-group');
    expect(useUIStore.getState().selectedFrameId).toBe('keep');
    expect(useUIStore.getState().selectedFrameIds).toEqual(['keep']);
  });

  it('selectGroup 组缺 frameIds 字段不抛错（手编辑存档防御，round 105 修复）', () => {
    useProjectStore.setState((s) => ({
      project: { ...s.project, frameGroups: [{ id: 'g2', name: 'Bad', createdAt: 0 } as never] },
    }));
    expect(() => useUIStore.getState().selectGroup('g2')).not.toThrow();
    expect(useUIStore.getState().selectedFrameIds).toEqual([]);
  });
});

describe('dirty 未保存标志（round 142 迁移入 uiStore，round 145 补测）', () => {
  beforeEach(() => {
    useUIStore.getState().setDirty(false);
  });

  it('初始状态 dirty=false', () => {
    expect(useUIStore.getState().dirty).toBe(false);
  });

  it('setDirty(true/false) 往返切换', () => {
    useUIStore.getState().setDirty(true);
    expect(useUIStore.getState().dirty).toBe(true);
    useUIStore.getState().setDirty(false);
    expect(useUIStore.getState().dirty).toBe(false);
  });
});
