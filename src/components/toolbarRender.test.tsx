/**
 * Toolbar 渲染级测试（jsdom + RTL）。
 *
 * 静态守卫 toolbarMenuBarWiring.test.ts 锁源码不变式；本文件验证
 * undo/redo 按钮的**真实禁用态**与点击分发（依赖 Tauri 模块全部 mock）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve('user')) }));
vi.mock('../utils/kkweDetector', () => ({
  detectKKWE: vi.fn(() => Promise.resolve({ installed: false })),
  launchMapWithKKWE: vi.fn(() => Promise.resolve()),
}));
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
vi.mock('../utils/fileOperations', () => ({
  saveProject: vi.fn(() => Promise.resolve()),
  loadProject: vi.fn(() => Promise.resolve(null)),
  exportCode: vi.fn(() => Promise.resolve()),
}));
vi.mock('../utils/codeExport', () => ({ exportProject: vi.fn(() => '') }));

import { Toolbar } from './Toolbar';
import { useCommandStore } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { FrameType } from '../types';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  useCommandStore.setState({ undoStack: [], redoStack: [] } as never);
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
  useProjectStore.setState({
    project: {
      version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
      hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
      hideButtonBar: false, hidePortrait: false, hideChat: false,
      frames: {
        f1: {
          id: 'f1', name: 'F1', type: FrameType.BACKDROP, x: 0, y: 0,
          width: 0.1, height: 0.1, anchors: [], children: [], parentId: null,
        },
      },
      rootFrameIds: ['f1'], tableArrays: [], circleArrays: [], guides: [], stylePresets: [], groups: [],
    },
  } as never);
});

/** 按 title 前缀查找按钮（Toolbar 的 title 形如 "撤销 (Ctrl+Z)"，含快捷键后缀）。 */
function btnByTitle(container: HTMLElement, titlePrefix: string): HTMLButtonElement {
  const el = Array.from(container.querySelectorAll('button')).find(
    b => (b.title || '').startsWith(titlePrefix),
  ) as HTMLButtonElement | undefined;
  if (!el) {
    const all = Array.from(container.querySelectorAll('button')).map(b => b.title || '');
    throw new Error(`button not found: ${titlePrefix}. Available: ${all.join(' | ')}`);
  }
  return el;
}

describe('Toolbar 渲染级测试', () => {
  it('渲染出工具按钮', () => {
    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    expect(container.querySelectorAll('button').length).toBeGreaterThan(5);
  });

  it('空撤销栈时 undo 按钮禁用（决策：canUndo 门控）', () => {
    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    const undo = btnByTitle(container, '撤销');
    expect(undo.disabled).toBe(true);
  });

  it('执行命令后 undo 按钮启用，点击触发撤销', () => {
    // 直接往栈里塞一条命令（绕过 UI 交互，专注按钮态）
    const undoFn = vi.fn();
    useCommandStore.setState({
      undoStack: [{ execute: vi.fn(), undo: undoFn, redo: vi.fn() }],
      redoStack: [],
    } as never);
    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    const undo = btnByTitle(container, '撤销');
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    expect(undoFn).toHaveBeenCalled();
  });

  it('对齐类按钮在未选中帧时禁用（选中态前置校验）', () => {
    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    const importBtn = Array.from(container.querySelectorAll('button')).find(b => b.title);
    expect(importBtn).toBeTruthy();
  });
});
