/**
 * PreferencesDialog 渲染级测试（jsdom + RTL）。
 *
 * 历史背景（round 97）：该面板 6 项中 5 项保存后**零消费**（画布读 uiStore 而偏好只写
 * localStorage）。修复引入 handleSave 实时同步 uiStore。本文件验证该修复**运行时成立**，
 * 防止回归——静态守卫只能断言"代码里有 setShowGrid"，无法证明保存真的改了 store。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(() => Promise.resolve(null)) }));
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn((a: string, b: string) => `${a}/${b}`) }));
vi.mock('@tauri-apps/plugin-fs', () => ({ exists: vi.fn(() => Promise.resolve(true)) }));

import { PreferencesDialog } from './PreferencesDialog';
import { useUIStore } from '../store/uiStore';

const store: Record<string, string> = {};

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k]);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((k: string) => store[k] ?? null),
    setItem: vi.fn((k: string, v: string) => { store[k] = v; }),
    removeItem: vi.fn((k: string) => { delete store[k]; }),
    clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  });
  vi.clearAllMocks();
  useUIStore.setState({ showGrid: true, showAnchors: false, snapToGrid: false, gridSize: 10 });
});

function findButton(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    b => (b.textContent || '').trim().includes(text),
  ) as HTMLButtonElement | undefined;
}

function findCheckboxByLabel(container: HTMLElement, labelText: string): HTMLInputElement | undefined {
  const labels = Array.from(container.querySelectorAll('label'));
  const target = labels.find(l => (l.textContent || '').includes(labelText));
  return target?.querySelector('input[type="checkbox"]') as HTMLInputElement | undefined;
}

describe('PreferencesDialog 渲染级测试', () => {
  it('渲染出对话框与标签页', () => {
    const { container } = render(<PreferencesDialog onClose={vi.fn()} />);
    expect(container.querySelectorAll('button').length).toBeGreaterThan(2);
    expect(container.textContent).toBeTruthy();
  });

  it('保存时把画布偏好同步到 uiStore（round 97 修复的运行时验证）', () => {
    // 预置：偏好存 showGrid=false / snapToGrid=true / gridSize=20（探针实证：handleSave 只同步
    // 这三项到 uiStore，showAnchors 不在 Preferences 接口内，不臆造断言）
    store['preferences'] = JSON.stringify({ showGrid: false, snapToGrid: true, gridSize: 20 });
    const { container } = render(<PreferencesDialog onClose={vi.fn()} />);
    const save = findButton(container, '保存');
    expect(save).toBeTruthy();
    fireEvent.click(save!);

    const ui = useUIStore.getState();
    expect(ui.showGrid).toBe(false);
    expect(ui.snapToGrid).toBe(true);
    expect(ui.gridSize).toBe(20);
  });

  it('保存写入 localStorage（持久化）', () => {
    const { container } = render(<PreferencesDialog onClose={vi.fn()} />);
    fireEvent.click(findButton(container, '保存')!);
    expect(localStorage.setItem).toHaveBeenCalledWith('preferences', expect.any(String));
  });

  it('取消按钮调用 onClose 且不写 store', () => {
    const onClose = vi.fn();
    store['preferences'] = JSON.stringify({ showGrid: false });
    const { container } = render(<PreferencesDialog onClose={onClose} />);
    const cancel = findButton(container, '取消');
    expect(cancel).toBeTruthy();
    fireEvent.click(cancel!);
    expect(onClose).toHaveBeenCalled();
    expect(useUIStore.getState().showGrid).toBe(true); // 未被偏好覆盖
  });

  it('不承诺无实现的语言/主题控件（round 97 删除项不回潮）', () => {
    const { container } = render(<PreferencesDialog onClose={vi.fn()} />);
    const text = container.textContent || '';
    // theme/language 控件已删；若未来重新加入必须有真实实现，届时本断言应更新
    expect(text).not.toMatch(/主题|language|语言/i);
  });
});
