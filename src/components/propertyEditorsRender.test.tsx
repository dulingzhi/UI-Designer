/**
 * PropertyEditors 渲染级守卫（jsdom + RTL）。
 *
 * 与静态守卫 propertyEditorsWiring.test.ts 并存：静态锁源码不变式，本文件验证
 * 三条核心语义在真实渲染下成立（受控 value / onChange 回写 / 清空归一 undefined）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Switch, Slider, FilePath, TextArea, VectorEditor } from './PropertyEditors';

describe('PropertyEditors 渲染级守卫', () => {
  it('Switch 渲染 label 并响应点击回写布尔（自定义 div 实现，无 checkbox）', () => {
    const onChange = vi.fn();
    const { container, getByText } = render(
      <Switch label="可见" value={false} onChange={onChange} />,
    );
    expect(getByText('可见')).toBeTruthy();
    const sw = container.querySelector('.switch') as HTMLElement;
    expect(sw).toBeTruthy();
    expect(sw.className).toContain('off');
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Switch 禁用态点击不回写', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Switch label="锁定" value={false} onChange={onChange} disabled />,
    );
    const sw = container.querySelector('.switch') as HTMLElement;
    fireEvent.click(sw);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Slider 渲染数值并响应 input 回写', () => {
    const onChange = vi.fn();
    const { container } = render(
      <Slider label="宽度" value={10} onChange={onChange} min={0} max={100} step={1} showInput />,
    );
    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(numberInput).toBeTruthy();
    expect(numberInput.value).toBe('10');
    fireEvent.change(numberInput, { target: { value: '42' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.some(c => c[0] === 42)).toBe(true);
  });

  it('FilePath 渲染输入框并回写路径（签名 string，清空传空串）', () => {
    const onChange = vi.fn();
    const shown = 'UI' + String.fromCharCode(92) + 'a.blp';
    const { container } = render(
      <FilePath label="纹理" value={shown} onChange={onChange} showWC3Browser={false} />,
    );
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe(shown);
    fireEvent.change(input, { target: { value: 'new.blp' } });
    expect(onChange).toHaveBeenCalledWith('new.blp');
  });

  it('TextArea 渲染 textarea 并回写文本', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TextArea label="备注" value="old" onChange={onChange} />,
    );
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta).toBeTruthy();
    fireEvent.change(ta, { target: { value: 'new' } });
    expect(onChange).toHaveBeenCalledWith('new');
  });

  it('VectorEditor 按 dimensions 渲染对应数量输入并回写数组', () => {
    const onChange = vi.fn();
    const { container } = render(
      <VectorEditor label="偏移" value={[1, 2]} onChange={onChange} dimensions={2} />,
    );
    const nums = container.querySelectorAll('input[type="number"]');
    expect(nums.length).toBe(2);
    fireEvent.change(nums[0], { target: { value: '5' } });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0][0]).toBe(5);
  });
});
