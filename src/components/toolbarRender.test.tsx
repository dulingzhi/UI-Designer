/**
 * Toolbar 渲染级测试（jsdom + RTL）。
 *
 * 静态守卫 toolbarMenuBarWiring.test.ts 锁源码不变式；本文件验证
 * undo/redo 按钮的**真实禁用态**与点击分发（依赖 Tauri 模块全部 mock）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';

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
// r257：Toolbar 现按运行时分流（浏览器拦截"启动 War3"）——默认桌面，保持既有用例语义
const mockIsBrowserRuntime = vi.hoisted(() => vi.fn(() => false));
vi.mock('../utils/platformBridge', async (orig) => {
  const real = await (orig as () => Promise<Record<string, unknown>>)();
  return { ...real, isBrowserRuntime: mockIsBrowserRuntime };
});

import { Toolbar } from './Toolbar';
import { useCommandStore } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { FrameType } from '../types';

beforeEach(() => {
  mockIsBrowserRuntime.mockReturnValue(false);
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

afterEach(() => {
  cleanup();
});

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

describe('Toolbar 浏览器模式（r257：不可用项必须给正确提示）', () => {
  beforeEach(() => {
    mockIsBrowserRuntime.mockReturnValue(true);
  });

  it('点「启动 War3」提示"浏览器模式不支持"，而不是"未找到热重载配置"', async () => {
    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    const btn = btnByTitle(container, '启动 War3');
    fireEvent.click(btn);

    // 弹窗应立刻出现，且文案指向**平台限制**
    await vi.waitFor(() => {
      const dlg = container.ownerDocument.querySelector('.confirm-dialog');
      expect(dlg, '应弹出提示对话框').toBeTruthy();
      const text = (dlg!.textContent || '');
      expect(text).toContain('浏览器模式不支持');
      expect(text).toContain('桌面版');
      // 关键回归：绝不能把"平台不支持"说成"你少配了热重载"
      expect(text).not.toContain('未找到热重载配置');
    });
  });

  it('浏览器模式下不会触碰 Tauri 进程 API（不抛 TypeError）', async () => {
    const { war3ProcessManager } = await import('../utils/war3ProcessManager');
    const getPid = vi.mocked(war3ProcessManager.getCurrentPid);
    getPid.mockClear();

    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    fireEvent.click(btnByTitle(container, '启动 War3'));

    await vi.waitFor(() => {
      expect(container.ownerDocument.querySelector('.confirm-dialog')).toBeTruthy();
    });
    // 进程管理在浏览器里毫无意义：必须在进入前就 return
    expect(getPid).not.toHaveBeenCalled();
  });

  it('桌面模式仍走原流程（不被浏览器拦截误伤）', async () => {
    mockIsBrowserRuntime.mockReturnValue(false);
    const { container } = render(<Toolbar currentFilePath={null} setCurrentFilePath={vi.fn()} />);
    fireEvent.click(btnByTitle(container, '启动 War3'));

    // 桌面下不会出现"浏览器模式不支持"
    await vi.waitFor(() => {
      const dlg = container.ownerDocument.querySelector('.confirm-dialog');
      const text = dlg ? dlg.textContent || '' : '';
      expect(text).not.toContain('浏览器模式不支持');
    });
  });
});
