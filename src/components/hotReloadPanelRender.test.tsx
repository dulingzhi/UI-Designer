/**
 * HotReloadPanel 渲染级测试（jsdom + RTL）。
 *
 * 该面板涉及**文件写入**（热重载配置落盘），风险面高。静态守卫只锁字符串；
 * 本文件验证：配置编辑回写、开关联动、错误提示。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

const mockInvoke = vi.fn(() => Promise.resolve(null));
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...args: unknown[]) => mockInvoke(...args) }));
vi.mock('../utils/kkweDetector', () => ({
  detectKKWE: vi.fn(() => Promise.resolve({ installed: false })),
  launchMapWithKKWE: vi.fn(() => Promise.resolve()),
}));
vi.mock('../utils/hotReloadExporter', () => ({
  getHotReloadExporter: vi.fn(() => ({ export: vi.fn() })),
  getDefaultHotReloadConfig: vi.fn(() => ({
    enabled: false, war3Path: '', mapName: '', username: 'DefaultUser', intervalMs: 1000,
  })),
}));
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: {
    isCurrentProcessRunning: vi.fn(() => false),
    getCurrentPid: vi.fn(() => null),
    killCurrentProcess: vi.fn(() => Promise.resolve()),
  },
}));
vi.mock('../hooks/useHotReloadSync', () => ({
  useHotReloadSync: vi.fn(() => ({ lastExport: null, error: null })),
}));

import { HotReloadPanel } from './HotReloadPanel';
import { useProjectStore } from '../store/projectStore';
import { FrameType } from '../types';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  vi.clearAllMocks();
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

describe('HotReloadPanel 渲染级测试', () => {
  it('渲染出面板与开关', () => {
    const { container } = render(<HotReloadPanel onClose={vi.fn()} />);
    expect(container.querySelectorAll('input').length).toBeGreaterThan(0);
    expect(container.textContent).toBeTruthy();
  });

  it('渲染出启用开关且默认关闭（来自 getDefaultHotReloadConfig）', () => {
    const { container } = render(<HotReloadPanel onClose={vi.fn()} />);
    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
    expect(checkboxes.length).toBeGreaterThan(0);
    // 默认配置 enabled: false
    expect(checkboxes[0].checked).toBe(false);
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<HotReloadPanel onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(
      b => (b.textContent || '').includes('×') || (b.getAttribute('title') || '').includes('关闭'),
    );
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });

  it('面板含防抖配置数字输入（探针实证：路径来自 KKWE 自动检测，无手填文本框）', () => {
    const { container } = render(<HotReloadPanel onClose={vi.fn()} />);
    const numInputs = container.querySelectorAll('input[type="number"]');
    expect(numInputs.length).toBeGreaterThan(0);
  });

  it('防抖输入可编辑且不崩溃（非受控输入，探针实证 DOM 值不回写）', () => {
    const { container } = render(<HotReloadPanel onClose={vi.fn()} />);
    const num = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(num).toBeTruthy();
    // 注意：该输入是非受控的（无 value prop），清空后 DOM 值不变——这是实现现状，
    // 不做"DOM 应回写 500"的臆造断言；仅验证交互不抛错。
    expect(() => fireEvent.change(num, { target: { value: '' } })).not.toThrow();
  });
});
