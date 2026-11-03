/**
 * utilityPanels 渲染级测试（jsdom + RTL）。
 *
 * 覆盖 ShortcutHelp / AboutDialog / UpdateChecker 三个工具面板。
 * 静态守卫只锁源码字符串；本文件验证真实渲染与交互。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn(() => Promise.resolve('0.1.1')) }));
vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn(() => Promise.resolve()) }));

import { ShortcutHelp } from './ShortcutHelp';
import { AboutDialog } from './AboutDialog';
import { UpdateChecker } from './UpdateChecker';

describe('ShortcutHelp 渲染级测试', () => {
  it('isOpen=false 时不渲染内容', () => {
    const { container } = render(<ShortcutHelp isOpen={false} onClose={vi.fn()} />);
    // 未打开时不应有快捷键列表
    expect(container.textContent).not.toContain('Ctrl+Z');
  });

  it('isOpen=true 时渲染快捷键清单', () => {
    const { container } = render(<ShortcutHelp isOpen={true} onClose={vi.fn()} />);
    expect(container.textContent).toMatch(/Ctrl\+[A-Z0-9]/);
  });

  it('渲染的快捷键条目数量合理（>10）', () => {
    const { container } = render(<ShortcutHelp isOpen={true} onClose={vi.fn()} />);
    const text = container.textContent || '';
    const count = (text.match(/Ctrl\+|Alt\+|Shift\+/g) || []).length;
    expect(count).toBeGreaterThan(10);
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<ShortcutHelp isOpen={true} onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(
      b => /关闭|✕|×|知道了/.test(b.textContent || ''),
    );
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AboutDialog 渲染级测试', () => {
  it('渲染出版本号（Tauri getVersion 优先）', async () => {
    const { container } = render(<AboutDialog onClose={vi.fn()} />);
    await waitFor(() => {
      expect(container.textContent).toContain('0.1.1');
    });
  });

  it('getVersion 失败时回落 package.json 版本（不空白）', async () => {
    const appMod = await import('@tauri-apps/api/app');
    (appMod.getVersion as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('no tauri'));
    const { container } = render(<AboutDialog onClose={vi.fn()} />);
    await waitFor(() => {
      // 版本号形如 x.y.z
      expect(container.textContent).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<AboutDialog onClose={onClose} />);
    const close = Array.from(container.querySelectorAll('button')).find(
      b => /关闭|✕|×|确定/.test(b.textContent || ''),
    );
    expect(close).toBeTruthy();
    fireEvent.click(close!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('UpdateChecker 渲染级测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('默认不自动检查（checkOnMount 默认 false）', async () => {
    const updaterMod = await import('@tauri-apps/plugin-updater');
    render(<UpdateChecker />);
    await new Promise(r => setTimeout(r, 200));
    expect(updaterMod.check).not.toHaveBeenCalled();
  });

  it('开发环境跳过更新检查（探针实证：vitest 下 import.meta.env.DEV 为 true）', async () => {
    const updaterMod = await import('@tauri-apps/plugin-updater');
    render(<UpdateChecker checkOnMount />);
    await new Promise(r => setTimeout(r, 200));
    // 设计行为：DEV 环境直接 return，不调 check()——这是静态守卫断言过的语义，
    // 渲染级测试确认它运行时成立（防"开发环境误报更新"回归）
    expect(updaterMod.check).not.toHaveBeenCalled();
  });

  it('无更新/DEV 环境时 DOM 无更新提示（静默）', async () => {
    const { container } = render(<UpdateChecker checkOnMount />);
    await new Promise(r => setTimeout(r, 200));
    expect(container.textContent).not.toMatch(/发现新版本|立即更新/);
  });

  it('暴露 window.checkForUpdates 供父组件调用（round 124 无依赖数组）', async () => {
    render(<UpdateChecker />);
    await new Promise(r => setTimeout(r, 100));
    expect(typeof (window as unknown as { checkForUpdates?: unknown }).checkForUpdates).toBe('function');
  });
});
