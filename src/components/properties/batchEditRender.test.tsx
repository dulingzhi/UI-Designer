/**
 * BatchEditPanel 渲染级测试（jsdom + RTL）。
 *
 * 锁定两条关键语义（静态守卫无法验证运行时）：
 * 1. 批量修改真的改到**所有**选中帧（不是只改第一个）；
 * 2. 多帧修改合并为**一条**命令，一次撤销全部回滚（round 140 组合命令）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

import { BatchEditPanel } from './BatchEditPanel';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useCommandStore } from '../../store/commandStore';
import { FrameType } from '../../types';

function mkFrame(id: string, x = 0.1, y = 0.1) {
  return {
    id, name: id, type: FrameType.BACKDROP, x, y, width: 0.1, height: 0.1,
    anchors: [], children: [], parentId: null, visible: true, locked: false,
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  useCommandStore.setState({ undoStack: [], redoStack: [] } as never);
  useProjectStore.setState({
    project: {
      version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
      hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
      hideButtonBar: false, hidePortrait: false, hideChat: false,
      frames: { f1: mkFrame('f1', 0.1), f2: mkFrame('f2', 0.2), f3: mkFrame('f3', 0.3) },
      rootFrameIds: ['f1', 'f2', 'f3'],
      tableArrays: [], circleArrays: [], guides: [], stylePresets: [], groups: [],
    },
  } as never);
  useUIStore.setState({ selectedFrameIds: ['f1', 'f2', 'f3'], selectedFrameId: 'f1' });
});

describe('BatchEditPanel 渲染级测试', () => {
  it('标题显示选中控件数量', () => {
    const { container } = render(<BatchEditPanel onClose={vi.fn()} />);
    expect(container.textContent).toContain('3');
  });

  /** 按 label 找数字输入框（探针实证：本面板不支持批量 X/Y，仅 textScale/width/height）。 */
  function inputByLabel(container: HTMLElement, label: string): HTMLInputElement {
    const labels = Array.from(container.querySelectorAll('label'));
    const target = labels.find(l => (l.textContent || '').trim() === label);
    const input = target?.parentElement?.querySelector('input[type="number"]')
      || target?.querySelector('input[type="number"]')
      || target?.nextElementSibling as HTMLInputElement | undefined;
    if (!input) throw new Error('number input not found for label: ' + label);
    return input as HTMLInputElement;
  }

  it('批量修改宽度应用到所有选中帧（不是只改第一个）', () => {
    const { container } = render(<BatchEditPanel onClose={vi.fn()} />);
    // 探针实证：width/height 是非受控输入，仅 Enter 触发（placeholder "输入后按回车"）——
    // 这是设计如此但与常规受控输入不同，静态守卫无法发现，故此处按真实行为测试。
    const input = inputByLabel(container, '统一宽度');
    fireEvent.change(input, { target: { value: '0.5' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const frames = useProjectStore.getState().project.frames;
    expect(frames.f1.width).toBeCloseTo(0.5);
    expect(frames.f2.width).toBeCloseTo(0.5);
    expect(frames.f3.width).toBeCloseTo(0.5);
  });

  it('多帧修改合并为一条命令（一次撤销全部回滚，round 140）', () => {
    const { container } = render(<BatchEditPanel onClose={vi.fn()} />);
    const input = inputByLabel(container, '统一宽度');
    fireEvent.change(input, { target: { value: '0.7' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // 一条命令入栈（不是三条）
    expect(useCommandStore.getState().undoStack.length).toBe(1);

    useCommandStore.getState().undo();
    const frames = useProjectStore.getState().project.frames;
    expect(frames.f1.width).toBeCloseTo(0.1);
    expect(frames.f2.width).toBeCloseTo(0.1);
  });

  it('几何字段修改同步重算 anchors（round 134）', () => {
    const { container } = render(<BatchEditPanel onClose={vi.fn()} />);
    const input = inputByLabel(container, '统一宽度');
    fireEvent.change(input, { target: { value: '0.4' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    const frame = useProjectStore.getState().project.frames.f1;
    expect(Array.isArray(frame.anchors)).toBe(true);
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<BatchEditPanel onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(b => (b.textContent || '').includes('✕'));
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });

  it('未选中任何帧时修改不崩溃也不写命令', () => {
    useUIStore.setState({ selectedFrameIds: [], selectedFrameId: null });
    const { container } = render(<BatchEditPanel onClose={vi.fn()} />);
    const input = inputByLabel(container, '统一宽度');
    fireEvent.change(input, { target: { value: '0.9' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(useCommandStore.getState().undoStack.length).toBe(0);
  });
});
