/**
 * ProjectTree 渲染级测试（jsdom + RTL）。
 *
 * 决策项 6 键盘导航的端到端验证：真实渲染 + 真实 store + 键盘事件，
 * 补足 collectVisibleOrder 纯函数测试未覆盖的 DOM 事件链路。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ProjectTree } from './ProjectTree';
import { FrameType } from '../types';

const localStorageStub = {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

vi.mock('../utils/hotReloadExporter', () => ({
  getHotReloadExporter: vi.fn(() => ({ export: vi.fn() })),
  getDefaultHotReloadConfig: vi.fn(() => ({})),
}));
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: { isCurrentProcessRunning: vi.fn(() => false), getCurrentPid: vi.fn(() => null) },
}));

beforeEach(() => {
  vi.stubGlobal('localStorage', localStorageStub);
  localStorageStub.getItem.mockReturnValue(null);
  vi.clearAllMocks();
});

async function seed() {
  const { useProjectStore } = await import('../store/projectStore');
  const { useUIStore } = await import('../store/uiStore');
  const mk = (id: string, name: string, parentId: string | null = null, children: string[] = []) => ({
    id, name, type: FrameType.BACKDROP, x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children, parentId, visible: true, locked: false,
  });
  useProjectStore.setState({
    project: {
      version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
      hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
      hideButtonBar: false, hidePortrait: false, hideChat: false,
      frames: {
        root1: mk('root1', 'Root1', null, ['child1']),
        child1: mk('child1', 'Child1', 'root1'),
        root2: mk('root2', 'Root2'),
      },
      rootFrameIds: ['root1', 'root2'],
      tableArrays: [], circleArrays: [], guides: [], stylePresets: [], groups: [],
    },
  } as never);
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
  return { useUIStore };
}

function findTextNode(container: HTMLElement, text: string): HTMLElement {
  const el = Array.from(container.querySelectorAll('*')).find(
    e => e.textContent === text && e.children.length === 0,
  ) as HTMLElement | undefined;
  if (!el) throw new Error('text node not found: ' + text);
  return el;
}

describe('ProjectTree 渲染级测试', () => {
  it('渲染出根帧名称', async () => {
    await seed();
    const { container } = render(<ProjectTree onClose={vi.fn()} />);
    expect(container.innerHTML).toContain('Root1');
    expect(container.innerHTML).toContain('Root2');
  });

  it('点击节点选中该帧（store 联动）', async () => {
    const { useUIStore } = await seed();
    const { container } = render(<ProjectTree onClose={vi.fn()} />);
    fireEvent.click(findTextNode(container, 'Root2'));
    expect(useUIStore.getState().selectedFrameId).toBe('root2');
  });

  it('ArrowDown/ArrowUp 在树容器上移动选择（决策项 6 键盘导航）', async () => {
    const { useUIStore } = await seed();
    const { container } = render(<ProjectTree onClose={vi.fn()} />);
    const tree = container.querySelector('.project-tree') as HTMLElement;
    expect(tree.getAttribute('tabindex')).toBe('0');

    // 探针教训：必须经 UI 点击选中（触发 re-render），键盘 handler 闭包才拿到新 selectedFrameId；
    // 直接调 store.selectFrame 后不 re-render，闭包仍为 null → curIdx=-1 → 仍选 order[0]。
    fireEvent.click(findTextNode(container, 'Root1'));
    expect(useUIStore.getState().selectedFrameId).toBe('root1');

    fireEvent.keyDown(tree, { key: 'ArrowDown' });
    expect(useUIStore.getState().selectedFrameId).toBe('child1');

    fireEvent.keyDown(tree, { key: 'ArrowUp' });
    expect(useUIStore.getState().selectedFrameId).toBe('root1');
  });

  it('ArrowLeft 折叠已展开节点，再 ArrowRight 展开', async () => {
    const { useUIStore } = await seed();
    const { container } = render(<ProjectTree onClose={vi.fn()} />);
    const tree = container.querySelector('.project-tree') as HTMLElement;
    fireEvent.click(findTextNode(container, 'Root1'));

    // 折叠：child1 应不再可见
    fireEvent.keyDown(tree, { key: 'ArrowLeft' });
    expect(container.innerHTML).not.toContain('Child1');

    // 展开：child1 重新出现
    fireEvent.keyDown(tree, { key: 'ArrowRight' });
    expect(container.innerHTML).toContain('Child1');
  });
});
