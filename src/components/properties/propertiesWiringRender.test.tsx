/**
 * 属性面板接线守卫——渲染级测试（jsdom + RTL 升级版）。
 *
 * 历史：jsdom 引入前为静态断言（读源码字符串）；本文件为渲染级交互测试补强。
 * 静态守卫 propertiesWiring.test.ts 保留（两层守卫并存：静态锁字段覆盖，渲染锁实际可交互）。
 *
 * 注意：`@vitest-environment jsdom` 必须出现在文件头部注释块中（vitest 只扫描文件开头）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { FrameType, type FrameData } from '../../types';
import { TypeSpecificProperties } from './TypeSpecificProperties';

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'f1', name: 'F1', type: FrameType.BACKDROP,
    x: 0, y: 0, width: 0.1, height: 0.1, anchors: [], children: [],
    ...overrides,
  } as unknown as FrameData;
}

describe('属性面板渲染级守卫（jsdom + RTL）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BACKDROP 帧可渲染出面板 DOM', () => {
    const { container } = render(
      <TypeSpecificProperties selectedFrame={mkFrame()} handleChange={vi.fn()} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });

  it('backdrop 字段在面板中可见其初始值（渲染级 value 读取）', () => {
    const { container } = render(
      <TypeSpecificProperties
        selectedFrame={mkFrame({ backdropBackground: 'UI\\Widgets\\Bg.blp', backdropEdgeFile: 'UI\\Widgets\\Edge.blp' })}
        handleChange={vi.fn()}
      />,
    );
    const html = container.innerHTML;
    expect(html).toContain('Bg.blp');
    expect(html).toContain('Edge.blp');
  });

  it('编辑输入触发 handleChange 回写（渲染级接线验证）', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TypeSpecificProperties
        selectedFrame={mkFrame({ backdropBackground: 'old.blp' })}
        handleChange={handleChange}
      />,
    );
    const inputs = Array.from(container.querySelectorAll('input[type="text"], textarea'));
    const target = inputs.find(el => (el as HTMLInputElement).value === 'old.blp') as HTMLInputElement | undefined;
    expect(target).toBeDefined();
    // 直接派发 input 事件（不引 userEvent，避免额外依赖差异）
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(target, 'new.blp');
    target!.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handleChange).toHaveBeenCalled();
    expect(handleChange.mock.calls.some(c => String(c[1]).includes('new.blp'))).toBe(true);
  });

  it('渲染出的面板含输入控件', () => {
    const { container } = render(
      <TypeSpecificProperties
        selectedFrame={mkFrame({ backdropBackground: 'UI\\Widgets\\bg.blp' })}
        handleChange={vi.fn()}
      />,
    );
    const inputs = container.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThan(0);
  });
});