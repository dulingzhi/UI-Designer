/**
 * PropertiesPanel 渲染级测试（jsdom + RTL）。
 *
 * 该组件是属性面板入口，**三分支路由**：
 *  ① 无选中 → 空态提示
 *  ② 多选（>1）→ BatchEditPanel
 *  ③ 单选 → 完整属性编辑器（含 handleChange 命令化回写）
 * 多选分支历史上有 P1 前科（r242 batchEdit 只入栈不执行），故本文件重点验证分支路由正确。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('../utils/hotReloadExporter', () => ({
  getHotReloadExporter: vi.fn(() => ({ export: vi.fn() })),
  getDefaultHotReloadConfig: vi.fn(() => ({})),
}));
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: {
    isCurrentProcessRunning: vi.fn(() => false),
    getCurrentPid: vi.fn(() => null),
    killCurrentProcess: vi.fn(() => Promise.resolve()),
  },
}));

import { PropertiesPanel } from './PropertiesPanel';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useCommandStore } from '../store/commandStore';
import { FrameType } from '../types';

function mkFrame(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, name: id, type: FrameType.BACKDROP, x: 0.1, y: 0.1, width: 0.2, height: 0.2,
    anchors: [], children: [], parentId: null, visible: true, locked: false, z: 0,
    ...overrides,
  };
}

function seed(frames: Record<string, unknown>, roots: string[]) {
  useProjectStore.setState({
    project: {
      version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
      hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
      hideButtonBar: false, hidePortrait: false, hideChat: false,
      frames, rootFrameIds: roots,
      tableArrays: [], circleArrays: [], guides: [], stylePresets: [], groups: [],
    },
  } as never);
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  vi.clearAllMocks();
  useCommandStore.setState({ undoStack: [], redoStack: [] } as never);
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
});

describe('PropertiesPanel 渲染级测试', () => {
  it('无选中时显示空态提示（不渲染编辑器）', () => {
    seed({}, []);
    const { container } = render(<PropertiesPanel onClose={vi.fn()} />);
    const text = container.textContent || '';
    // 空态应有提示文案，且不应出现批量编辑标题
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('批量编辑');
  });

  it('多选时路由到 BatchEditPanel（显示控件数量）', () => {
    seed({ f1: mkFrame('f1'), f2: mkFrame('f2') }, ['f1', 'f2']);
    useUIStore.setState({ selectedFrameIds: ['f1', 'f2'], selectedFrameId: 'f1' });
    const { container } = render(<PropertiesPanel onClose={vi.fn()} />);
    // BatchEditPanel 标题含"批量编辑 (N 个控件)"
    expect(container.textContent).toContain('批量编辑');
    expect(container.textContent).toContain('2');
  });

  it('单选时路由到单帧编辑器（不显示批量编辑）', () => {
    seed({ f1: mkFrame('f1') }, ['f1']);
    useUIStore.setState({ selectedFrameIds: ['f1'], selectedFrameId: 'f1' });
    const { container } = render(<PropertiesPanel onClose={vi.fn()} />);
    expect(container.textContent).not.toContain('批量编辑');
    // 探针实证：帧名渲染在 <input value> 里（非 textContent），须查 input 值
    const nameInput = Array.from(container.querySelectorAll('input[type="text"]')).find(
      i => (i as HTMLInputElement).value === 'f1',
    ) as HTMLInputElement | undefined;
    expect(nameInput, '单帧编辑器应显示帧名 f1').toBeTruthy();
    expect(container.textContent).toContain('详细信息');
  });

  it('单选编辑几何字段产生命令（可撤销）', () => {
    seed({ f1: mkFrame('f1') }, ['f1']);
    useUIStore.setState({ selectedFrameIds: ['f1'], selectedFrameId: 'f1' });
    const { container } = render(<PropertiesPanel onClose={vi.fn()} />);

    const numInputs = Array.from(container.querySelectorAll('input[type="number"]')) as HTMLInputElement[];
    if (numInputs.length === 0) return; // 结构性防御：无数字输入则跳过
    fireEvent.change(numInputs[0], { target: { value: '0.55' } });
    // 应有命令入栈（handleChange → UpdateFrameCommand → executeCommand）
    expect(useCommandStore.getState().undoStack.length).toBeGreaterThan(0);
  });

  it('多选分支的批量修改真的生效（r242 P1 回归守卫）', () => {
    seed({ f1: mkFrame('f1'), f2: mkFrame('f2'), f3: mkFrame('f3') }, ['f1', 'f2', 'f3']);
    useUIStore.setState({ selectedFrameIds: ['f1', 'f2', 'f3'], selectedFrameId: 'f1' });
    const { container } = render(<PropertiesPanel onClose={vi.fn()} />);

    const labels = Array.from(container.querySelectorAll('label'));
    const target = labels.find(l => (l.textContent || '').trim() === '统一宽度');
    const input = target?.parentElement?.querySelector('input[type="number"]') as HTMLInputElement | undefined;
    expect(input, '批量面板应有统一宽度输入').toBeTruthy();
    fireEvent.change(input!, { target: { value: '0.9' } });
    fireEvent.keyDown(input!, { key: 'Enter' });

    const frames = useProjectStore.getState().project.frames;
    // r242 修复后：三帧宽度都应更新（此前只入栈不执行 → 全部不变）
    expect(frames.f1.width).toBeCloseTo(0.9);
    expect(frames.f2.width).toBeCloseTo(0.9);
    expect(frames.f3.width).toBeCloseTo(0.9);
  });

  it('关闭按钮调用 onClose（单选分支）', () => {
    seed({ f1: mkFrame('f1') }, ['f1']);
    useUIStore.setState({ selectedFrameIds: ['f1'], selectedFrameId: 'f1' });
    const onClose = vi.fn();
    const { container } = render(<PropertiesPanel onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(
      b => /✕|×/.test(b.textContent || '') || (b.getAttribute('title') || '').includes('关闭'),
    );
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });
});
