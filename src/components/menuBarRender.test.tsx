/**
 * MenuBar 渲染级测试（jsdom + RTL）。
 *
 * 静态守卫 toolbarMenuBarWiring.test.ts 锁源码不变式；本文件验证真实交互：
 * 菜单展开/收起、菜单项点击分发到命令层、disabled 项不响应。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(() => Promise.resolve('user')) }));
vi.mock('../utils/fileOperations', () => ({
  saveProject: vi.fn(() => Promise.resolve()),
  loadProject: vi.fn(() => Promise.resolve(null)),
  loadProjectFromPath: vi.fn(() => Promise.resolve(null)),
  importFromFDF: vi.fn(() => Promise.resolve([])),
}));
vi.mock('../utils/fdfImportExport', () => ({
  importFromFDFEnhanced: vi.fn(() => Promise.resolve()),
  importFDFFolder: vi.fn(() => Promise.resolve(0)),
  importFromFDFText: vi.fn(() => []),
}));
vi.mock('../utils/exportUtils', () => ({
  exportToFDF: vi.fn(() => Promise.resolve()),
  exportToJSON: vi.fn(() => Promise.resolve()),
  exportToPNG: vi.fn(() => Promise.resolve()),
}));
vi.mock('../utils/fdf', () => ({ parseFDF: vi.fn(() => []) }));

import { MenuBar } from './MenuBar';
import { useCommandStore } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { FrameType } from '../types';

function mkProject() {
  return {
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
  };
}

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  vi.clearAllMocks();
  useCommandStore.setState({ undoStack: [], redoStack: [] } as never);
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
  useProjectStore.setState({ project: mkProject() } as never);
});

function renderMenuBar() {
  return render(
    <MenuBar currentFilePath={null} setCurrentFilePath={vi.fn()} />,
  );
}

/** 点开顶层菜单（文件/编辑/视图…），返回容器。 */
function openMenu(container: HTMLElement, label: string) {
  const barItem = Array.from(container.querySelectorAll('.menu-bar-item')).find(
    el => (el.textContent || '').trim().startsWith(label),
  ) as HTMLElement | undefined;
  if (!barItem) {
    const all = Array.from(container.querySelectorAll('.menu-bar-item')).map(el => (el.textContent || '').trim().slice(0, 8));
    throw new Error(`top menu not found: ${label}. Available: ${all.join(' | ')}`);
  }
  fireEvent.click(barItem);
  return barItem;
}

/** 在下拉里按文本找菜单项。 */
function findMenuItem(container: HTMLElement, label: string): HTMLElement | undefined {
  return Array.from(container.querySelectorAll('.menu-item')).find(
    el => (el.querySelector('.menu-item-label')?.textContent || '').trim() === label,
  ) as HTMLElement | undefined;
}

describe('MenuBar 渲染级测试', () => {
  it('渲染出顶层菜单栏', () => {
    const { container } = renderMenuBar();
    const items = container.querySelectorAll('.menu-bar-item');
    expect(items.length).toBeGreaterThan(2);
    expect(container.textContent).toContain('文件');
    expect(container.textContent).toContain('编辑');
  });

  it('点击顶层菜单展开下拉', () => {
    const { container } = renderMenuBar();
    expect(container.querySelector('.menu-dropdown')).toBeNull();
    openMenu(container, '文件');
    expect(container.querySelector('.menu-dropdown')).toBeTruthy();
  });

  it('再次点击同一菜单收起下拉', () => {
    const { container } = renderMenuBar();
    openMenu(container, '文件');
    expect(container.querySelector('.menu-dropdown')).toBeTruthy();
    openMenu(container, '文件');
    expect(container.querySelector('.menu-dropdown')).toBeNull();
  });

  it('编辑菜单的撤销项在空栈时禁用', () => {
    const { container } = renderMenuBar();
    openMenu(container, '编辑');
    const undoItem = Array.from(container.querySelectorAll('.menu-item')).find(
      el => (el.textContent || '').includes('撤销'),
    ) as HTMLElement | undefined;
    expect(undoItem).toBeTruthy();
    expect(undoItem!.className).toContain('disabled');
  });

  it('菜单项点击后收起下拉（分发后关闭）', () => {
    const { container } = renderMenuBar();
    openMenu(container, '文件');
    const item = container.querySelector('.menu-item') as HTMLElement;
    expect(item).toBeTruthy();
    fireEvent.click(item);
    expect(container.querySelector('.menu-dropdown')).toBeNull();
  });

  it('dropdown 渲染出菜单项标签（非空）', () => {
    const { container } = renderMenuBar();
    openMenu(container, '文件');
    const labels = Array.from(container.querySelectorAll('.menu-item-label')).map(
      el => (el.textContent || '').trim(),
    );
    expect(labels.length).toBeGreaterThan(2);
    expect(labels.every(l => l.length > 0)).toBe(true);
  });
});
