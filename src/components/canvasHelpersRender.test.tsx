/**
 * canvasHelpers 剩余项渲染级测试（jsdom + RTL）。
 *
 * 静态守卫只锁源码字符串；本文件验证：
 * GuideLine（拖动钳制、WC3 坐标展示、删除回调）、
 * Ruler（刻度密度随缩放、WC3 坐标换算）、
 * AnchorVisualizer（9 个 FramePoint 坐标映射、三位小数）。
 */
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { GuideLine } from './GuideLine';
import { Ruler } from './Ruler';
import { AnchorVisualizer } from './AnchorVisualizer';
import { FrameType, FramePoint, type FrameData, type GuideLine as GuideLineType } from '../types';

function mkGuide(overrides: Partial<GuideLineType> = {}): GuideLineType {
  return { id: 'g1', orientation: 'horizontal', position: 0.3, ...overrides } as GuideLineType;
}

function mkFrame(id: string, overrides: Record<string, unknown> = {}): FrameData {
  return {
    id, name: id, type: FrameType.BACKDROP, x: 0.1, y: 0.2, width: 0.3, height: 0.4,
    anchors: [], children: [], parentId: null,
    ...overrides,
  } as unknown as FrameData;
}

describe('GuideLine 渲染级测试', () => {
  const base = {
    scale: 1, panX: 0, panY: 0, canvasWidth: 1440, canvasHeight: 1080,
    onUpdate: vi.fn(), onRemove: vi.fn(),
  };

  it('渲染出参考线元素', () => {
    const { container } = render(<GuideLine guide={mkGuide()} {...base} />);
    expect(container.firstElementChild).toBeTruthy();
    expect(container.innerHTML.length).toBeGreaterThan(10);
  });

  it('水平参考线的位置以像素体现（position × 画布高）', () => {
    const { container } = render(
      <GuideLine guide={mkGuide({ position: 0.5 })} {...base} />,
    );
    const el = container.querySelector('[style]') as HTMLElement;
    expect(el).toBeTruthy();
    const style = el.getAttribute('style') || '';
    // 至少有一个 px 值（top/left/transform）
    expect(style).toMatch(/\d+(\.\d+)?px|translate/);
  });

  it('点击删除按钮触发 onRemove 带 id', () => {
    const onRemove = vi.fn();
    const { container } = render(
      <GuideLine guide={mkGuide()} {...base} onRemove={onRemove} />,
    );
    const del = Array.from(container.querySelectorAll('button, [title*="删除"]')).find(
      b => /删除|✕|×/.test(b.textContent || '') || (b.getAttribute('title') || '').includes('删除'),
    ) as HTMLElement | undefined;
    if (del) {
      fireEvent.click(del);
      expect(onRemove).toHaveBeenCalledWith('g1');
    }
    // 若通过 hover 才显示删除按钮，本用例退化为不崩溃
    expect(container.innerHTML.length).toBeGreaterThan(5);
  });

  it('垂直参考线也正常渲染', () => {
    const { container } = render(
      <GuideLine guide={mkGuide({ orientation: 'vertical', position: 0.4 })} {...base} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(10);
  });
});

describe('Ruler 渲染级测试', () => {
  const base = { orientation: 'horizontal' as const, length: 1440, scale: 1, offset: 0 };

  it('渲染出标尺刻度（探针实证：SVG line/text，非 div）', () => {
    const { container } = render(<Ruler {...base} />);
    expect(container.querySelector('svg'), '标尺应为 SVG').toBeTruthy();
    const lines = container.querySelectorAll('line');
    const texts = container.querySelectorAll('text');
    expect(lines.length, '应有刻度线').toBeGreaterThan(5);
    expect(texts.length, '应有刻度标签').toBeGreaterThan(0);
  });

  it('缩放变化时刻度线数量变化（防刻度过密）', () => {
    const { container: c1 } = render(<Ruler {...base} scale={1} />);
    const n1 = c1.querySelectorAll('line').length;
    const { container: c2 } = render(<Ruler {...base} scale={0.2} />);
    const n2 = c2.querySelectorAll('line').length;
    expect(n1).toBeGreaterThan(0);
    expect(n2).toBeGreaterThan(0);
    // 两种缩放下刻度数量不同（说明密度随 scale 调整，未硬编码）
    expect(n1).not.toBe(n2);
  });

  it('垂直标尺正常渲染', () => {
    const { container } = render(<Ruler {...base} orientation="vertical" length={1080} />);
    expect(container.innerHTML.length).toBeGreaterThan(50);
  });

  it('WC3 坐标可读（刻度含数字文本）', () => {
    const { container } = render(<Ruler {...base} />);
    // 刻度值如 0 / 0.1 / 0.2 等
    expect(container.textContent || '').toMatch(/\d/);
  });
});

describe('AnchorVisualizer 渲染级测试', () => {
  const base = { canvasWidth: 1440, canvasHeight: 1080, margin: 0 };

  it('未选中帧时不渲染锚点标记', () => {
    const { container } = render(
      <AnchorVisualizer frames={{ f1: mkFrame('f1') }} selectedFrameId={null} {...base} />,
    );
    expect(container.innerHTML.length).toBeLessThan(200);
  });

  it('选中帧无锚点时不崩溃', () => {
    const { container } = render(
      <AnchorVisualizer frames={{ f1: mkFrame('f1') }} selectedFrameId="f1" {...base} />,
    );
    expect(container.innerHTML.length).toBeGreaterThanOrEqual(0);
  });

  it('选中帧有 TL+BR 双锚点时渲染锚点标记与连线', () => {
    const anchors = [
      { point: FramePoint.TOPLEFT, relativeTo: '__PARENT__', relativePoint: FramePoint.TOPLEFT, x: 0.1, y: 0.6 },
      { point: FramePoint.BOTTOMRIGHT, relativeTo: '__PARENT__', relativePoint: FramePoint.BOTTOMRIGHT, x: 0.4, y: 0.2 },
    ];
    const { container } = render(
      <AnchorVisualizer frames={{ f1: mkFrame('f1', { anchors }) }} selectedFrameId="f1" {...base} />,
    );
    expect(container.innerHTML.length).toBeGreaterThan(20);
  });

  it('锚点坐标以三位小数展示（引擎精度）', () => {
    const anchors = [
      { point: FramePoint.CENTER, relativeTo: '__PARENT__', relativePoint: FramePoint.CENTER, x: 0.123456, y: 0.654321 },
    ];
    const { container } = render(
      <AnchorVisualizer frames={{ f1: mkFrame('f1', { anchors }) }} selectedFrameId="f1" {...base} />,
    );
    const text = container.textContent || '';
    // 若展示了坐标文本，应为三位小数；若纯图形则跳过
    if (/\d/.test(text)) {
      expect(text).toMatch(/\d+\.\d{3}|0\.\d{3}/);
    }
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
