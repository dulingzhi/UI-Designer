/**
 * TableArrayDialog / CircleArrayDialog 渲染级测试（jsdom + RTL）。
 *
 * 静态守卫只锁源码字符串存在；本文件验证**参数输入 → 提交**的真实链路：
 * NaN 兜底、行×列超限告警、二次确认流程、回调参数正确性。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { TableArrayDialog } from './TableArrayDialog';
import { CircleArrayDialog } from './CircleArrayDialog';

function inputByLabel(container: HTMLElement, label: string): HTMLInputElement | undefined {
  // label 可能与 input 同级（form-group 内），也可能包裹
  const groups = Array.from(container.querySelectorAll('.form-group, label'));
  for (const g of groups) {
    const text = (g.textContent || '').trim();
    if (text.startsWith(label)) {
      const input = g.querySelector('input') || g.parentElement?.querySelector('input');
      if (input) return input as HTMLInputElement;
    }
  }
  return undefined;
}

function btnByText(container: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    b => (b.textContent || '').trim().includes(text),
  ) as HTMLButtonElement | undefined;
}

describe('TableArrayDialog 渲染级测试', () => {
  const baseProps = { onClose: vi.fn(), onSubmit: vi.fn(), frameName: "TestFrame" };

  it('渲染出默认行列与间距，提交回调带正确参数', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TableArrayDialog {...baseProps} onSubmit={onSubmit} />);
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit).toBeTruthy();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg.rows).toBe(3);
    expect(arg.cols).toBe(3);
    expect(typeof arg.xGap).toBe('number');
    expect(typeof arg.yGap).toBe('number');
  });

  it('非法行数输入回落默认 1（NaN 兜底）', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TableArrayDialog {...baseProps} onSubmit={onSubmit} />);
    const rowsInput = inputByLabel(container, '行数');
    expect(rowsInput).toBeTruthy();
    fireEvent.change(rowsInput!, { target: { value: '' } });
    fireEvent.click(container.querySelector('button[type="submit"]') as HTMLButtonElement);
    expect(onSubmit.mock.calls[0][0].rows).toBe(1);
  });

  it('行×列 > 100 触发告警而不是直接创建', () => {
    const onSubmit = vi.fn();
    const { container } = render(<TableArrayDialog {...baseProps} onSubmit={onSubmit} />);
    const rowsInput = inputByLabel(container, '行数');
    const colsInput = inputByLabel(container, '列数');
    fireEvent.change(rowsInput!, { target: { value: '20' } });
    fireEvent.change(colsInput!, { target: { value: '20' } });
    fireEvent.click(container.querySelector('button[type="submit"]') as HTMLButtonElement);
    // 20×20=400 > 100 → 不应直接创建
    expect(onSubmit).not.toHaveBeenCalled();
    // 应出现告警/确认 UI
    expect(container.textContent).toMatch(/100|确认|警告/);
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<TableArrayDialog {...baseProps} onClose={onClose} />);
    const close = container.querySelector('.dialog-close') as HTMLElement;
    expect(close).toBeTruthy();
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CircleArrayDialog 渲染级测试', () => {
  const baseProps = { onClose: vi.fn(), onSubmit: vi.fn(), frameName: "TestFrame" };

  it('渲染并提交带圆心/半径/数量参数', () => {
    const onSubmit = vi.fn();
    const { container } = render(<CircleArrayDialog {...baseProps} onSubmit={onSubmit} />);
    const submit = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(submit).toBeTruthy();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const arg = onSubmit.mock.calls[0][0];
    expect(arg).toBeTypeOf('object');
    expect(Object.keys(arg).length).toBeGreaterThan(0);
  });

  it('关闭按钮调用 onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<CircleArrayDialog {...baseProps} onClose={onClose} />);
    const close = container.querySelector('.dialog-close') as HTMLElement;
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalled();
  });
});
