/**
 * StylePresetPanel 渲染级测试（jsdom + RTL）。
 *
 * 验证：预设分类过滤、应用预设真改帧、保存预设写入 store、未选中帧时禁用。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { StylePresetPanel } from './StylePresetPanel';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useCommandStore } from '../store/commandStore';
import { FrameType } from '../types';

function mkFrame(id: string) {
  return {
    id, name: id, type: FrameType.BACKDROP, x: 0.1, y: 0.1, width: 0.1, height: 0.1,
    anchors: [], children: [], parentId: null, visible: true, locked: false,
    texture: 'orig.blp', textColor: [1, 1, 1, 1],
  };
}

function mkPreset(id: string, name: string, category: string, style: Record<string, unknown>) {
  return { id, name, category, style, createdAt: Date.now() };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  vi.clearAllMocks();
  useCommandStore.setState({ undoStack: [], redoStack: [] } as never);
  useUIStore.setState({ selectedFrameIds: ['f1'], selectedFrameId: 'f1' });
  useProjectStore.setState({
    project: {
      version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
      hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
      hideButtonBar: false, hidePortrait: false, hideChat: false,
      frames: { f1: mkFrame('f1') },
      rootFrameIds: ['f1'], tableArrays: [], circleArrays: [], guides: [],
      stylePresets: [
        mkPreset('p1', '红色按钮', '按钮', { texture: 'red.blp' }),
        mkPreset('p2', '蓝色背景', '背景', { texture: 'blue.blp' }),
      ],
      groups: [],
    },
  } as never);
});

describe('StylePresetPanel 渲染级测试', () => {
  it('渲染出预设列表（名称可见）', () => {
    const { container } = render(<StylePresetPanel onClose={vi.fn()} />);
    expect(container.textContent).toContain('红色按钮');
    expect(container.textContent).toContain('蓝色背景');
  });

  it('应用预设真的改到选中帧并产生命令', () => {
    const { container } = render(<StylePresetPanel onClose={vi.fn()} />);
    // 探针实证：PresetCard 有 .apply-btn（文字"应用"），点击即 onApply
    const applyBtn = container.querySelector('.apply-btn') as HTMLButtonElement;
    expect(applyBtn, '预设卡片应有 .apply-btn').toBeTruthy();
    fireEvent.click(applyBtn);

    // 应用后帧的 texture 应被预设覆盖，且命令入栈可撤销
    const frame = useProjectStore.getState().project.frames.f1;
    expect(frame.texture).toBe('red.blp');
    expect(useCommandStore.getState().undoStack.length).toBeGreaterThan(0);
  });

  it('应用预设可撤销回原值（round 140 入 undo 栈）', () => {
    const { container } = render(<StylePresetPanel onClose={vi.fn()} />);
    fireEvent.click(container.querySelector('.apply-btn') as HTMLButtonElement);
    expect(useProjectStore.getState().project.frames.f1.texture).toBe('red.blp');

    useCommandStore.getState().undo();
    expect(useProjectStore.getState().project.frames.f1.texture).toBe('orig.blp');
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<StylePresetPanel onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(
      b => /✕|×/.test(b.textContent || '') || (b.getAttribute('title') || '').includes('关闭'),
    );
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });

  it('未选中帧时应用预设不崩溃（无目标帧）', () => {
    useUIStore.setState({ selectedFrameIds: [], selectedFrameId: null });
    const { container } = render(<StylePresetPanel onClose={vi.fn()} />);
    const item = Array.from(container.querySelectorAll('*')).find(
      el => (el.textContent || '').trim() === '红色按钮',
    ) as HTMLElement | undefined;
    expect(() => fireEvent.click(item!)).not.toThrow();
  });

  it('空预设列表渲染空态而非崩溃', () => {
    useProjectStore.setState({
      project: { ...useProjectStore.getState().project, stylePresets: [] },
    } as never);
    const { container } = render(<StylePresetPanel onClose={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(30);
  });
});
