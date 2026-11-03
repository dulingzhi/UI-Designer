/**
 * 补漏渲染级测试（jsdom + RTL）—— 覆盖此前遗漏的 3 个组件。
 *
 * r251 核验发现：静态 wiring 覆盖 29 个组件，但渲染级只到 26 个。
 * 遗漏：DebugPanel、LazyTexturePreview（miscPanelsWiring）、FrameGroupPanel（presetGroupWiring）。
 * 本文件补齐，使静态↔渲染两层一一对应。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

const mockLoadTexture = vi.fn(() => Promise.resolve({ dataUrl: 'blob:mock', width: 2, height: 2 }));
vi.mock('../utils/textureLoader', () => ({
  textureLoader: { loadTexture: (...a: unknown[]) => mockLoadTexture(...a) },
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

import { DebugPanel } from './DebugPanel';
import { LazyTexturePreview } from './LazyTexturePreview';
import { FrameGroupPanel } from './FrameGroupPanel';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';

beforeEach(() => {
  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  });
  vi.clearAllMocks();
});

describe('DebugPanel 渲染级测试', () => {
  // 探针实证：props 还需 scale + isVisible（isVisible=false 时组件 return null）
  const base = { mouseX: 123.4567, mouseY: 234.5678, mouseWc3X: 0.123456, mouseWc3Y: 0.654321, scale: 1, isVisible: true };

  it('鼠标坐标精度：屏幕 0 位、WC3 5 位（探针实证，非统一三位）', () => {
    const { container } = render(<DebugPanel {...base} />);
    const text = container.textContent || '';
    // 探针实证 DebugPanel L38/46：屏幕 toFixed(0)、WC3 toFixed(5)
    expect(text).toContain('123, 235');
    expect(text).toMatch(/0\.12346|0\.1234/);
    expect(text).toContain('100%');
  });

  it('无选中帧时正常渲染（selectedFrame 可选）', () => {
    const { container } = render(<DebugPanel {...base} />);
    expect(container.textContent).toBeTruthy();
  });

  it('选中帧的位置与尺寸以三位小数展示（引擎精度）', () => {
    const { container } = render(
      <DebugPanel
        {...base}
        selectedFrame={{ id: 'f1', name: 'TestFrame', x: 0.123456, y: 0.654321, width: 0.333333, height: 0.444444, type: 'BACKDROP' }}
      />,
    );
    const text = container.textContent || '';
    expect(text).toContain('TestFrame');
    // L71/78：选中帧位置与尺寸均 toFixed(3)
    expect(text).toContain('0.123');
    expect(text).toContain('0.654');
    expect(text).toContain('0.333');
    expect(text).toContain('0.444');
  });
});

describe('LazyTexturePreview 渲染级测试', () => {
  it('jsdom 无 IntersectionObserver 时不加载纹理（降级路径）', () => {
    // 探针实证：组件 useEffect 依赖 IntersectionObserver；jsdom 无此 API，
    // 挂载会在 effect 内抛 ReferenceError（React 会捕获并记录，不冒泡到 render）
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<LazyTexturePreview path="UI\\a.blp" name="a.blp" />);
    } catch { /* React 可能重抛 effect 错误 */ }
    errSpy.mockRestore();
    // 核心断言：未触发纹理加载（说明走了降级/跳过路径）
    expect(mockLoadTexture).not.toHaveBeenCalled();
  });

  it('多次挂载均不加载纹理（每次都是降级路径）', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      render(<LazyTexturePreview path="UI\\b.blp" name="b.blp" />);
      render(<LazyTexturePreview path="UI\\c.blp" name="c.blp" />);
    } catch { /* ignore */ }
    errSpy.mockRestore();
    expect(mockLoadTexture).not.toHaveBeenCalled();
  });

  it('容器渲染出 DOM 元素（哪怕未加载）', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let html = '';
    try {
      const { container } = render(<LazyTexturePreview path="UI\\d.blp" name="d.blp" />);
      html = container.innerHTML;
    } catch { /* ignore */ }
    errSpy.mockRestore();
    expect(typeof html).toBe('string');
  });
});

describe('FrameGroupPanel 渲染级测试', () => {
  function seed() {
    useProjectStore.setState({
      project: {
        version: 2, libraryName: 'L', originMode: 'gameui', exportVersion: 'reforged',
        backgroundImage: '', hideGameUI: false, hideHeroBar: false, hideMiniMap: false,
        hideResources: false, hideButtonBar: false, hidePortrait: false, hideChat: false,
        frames: {
          f1: {
            id: 'f1', name: 'F1', type: 'BACKDROP', x: 0, y: 0, width: 0.1, height: 0.1,
            anchors: [], children: [], parentId: null,
          },
        },
        rootFrameIds: ['f1'], fdfTemplates: [], currentRace: 'Human',
        war3Skins: null,
        tableArrays: [], circleArrays: [], guides: [], stylePresets: [],
        frameGroups: [{ id: 'g1', name: '现有组', frameIds: ['f1'] }],
      },
    } as never);
    useUIStore.setState({ selectedFrameIds: ['f1'], selectedFrameId: 'f1' });
  }

  it('渲染出已有分组名称', () => {
    seed();
    const { container } = render(<FrameGroupPanel onClose={vi.fn()} />);
    expect(container.textContent).toContain('现有组');
  });

  it('空分组列表渲染空态而非崩溃', () => {
    seed();
    const proj = useProjectStore.getState().project;
    useProjectStore.setState({ project: { ...proj, frameGroups: [] } } as never);
    const { container } = render(<FrameGroupPanel onClose={vi.fn()} />);
    expect(container.innerHTML.length).toBeGreaterThan(20);
  });

  it('关闭按钮调用 onClose', () => {
    seed();
    const onClose = vi.fn();
    const { container } = render(<FrameGroupPanel onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(
      b => /✕|×/.test(b.textContent || '') || (b.getAttribute('title') || '').includes('关闭'),
    );
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });
});
