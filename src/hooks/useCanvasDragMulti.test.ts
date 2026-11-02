/**
 * round 126：多选拖拽几何语义测试。
 *
 * 场景：画布多选（框选/Ctrl+点击）后拖动——原实现只移动被拖帧，其余选中帧
 * 留在原地（与主流编辑器相悖）。修复：computeMultiDragFrames 对其余选中帧
 * 应用同一 delta；endDrag 组合命令一次 Ctrl+Z 全撤。
 *
 * 锚点平移语义（数学一致性核心断言）：
 * - 绝对锚点（无 relativeTo）：x/y 为世界坐标 → += delta 跟随移动
 * - 相对锚点（有 relativeTo）：x/y 为相对参照帧的偏移，参照帧未动时
 *   offset += delta 使解算位置平移同量——两种锚点统一 += delta 数学一致
 */
import { describe, it, expect, vi } from 'vitest';

// useCanvasDrag → uiStore → hotReloadExporter（模块级 localStorage 读取）——标准 mock 头部
vi.mock('../utils/hotReloadExporter', () => ({
  hotReloadConfig: { enabled: false, outputPath: '', war3Path: '' },
  updateHotReloadConfig: vi.fn(),
  exportForHotReload: vi.fn(),
}));
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: {
    getCurrentPid: vi.fn(() => null),
    setPid: vi.fn(),
    clearPid: vi.fn(),
  },
}));
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

import { computeMultiDragFrames } from './useCanvasDrag';
import { FrameAnchor, FrameData } from '../types';

function makeFrame(id: string, x: number, y: number, anchors?: FrameAnchor[]): FrameData {
  return {
    id,
    name: id,
    type: 'backdrop' as never,
    x,
    y,
    width: 0.2,
    height: 0.1,
    parentId: null,
    children: [],
    anchors,
  } as unknown as FrameData;
}

describe('computeMultiDragFrames（round 126 多选拖拽）', () => {
  const starts = new Map([
    ['main', { x: 0.1, y: 0.2 }],
    ['abs', { x: 0.3, y: 0.4 }],
    ['rel', { x: 0.5, y: 0.6 }],
  ]);
  const project = {
    frames: {
      main: makeFrame('main', 0.1, 0.2),
      abs: makeFrame('abs', 0.3, 0.4, [
        { point: 'TOPLEFT', x: 0.3, y: 0.4 } as FrameAnchor,
      ]),
      rel: makeFrame('rel', 0.5, 0.6, [
        { point: 'TOPLEFT', relativeTo: 'abs', x: 0.05, y: 0.03 } as FrameAnchor,
      ]),
    },
  };

  it('其余选中帧应用同一 delta（绝对位置平移）', () => {
    const extra = computeMultiDragFrames(project, starts, 'main', 0.15, 0.3);
    expect(extra['abs'].x).toBeCloseTo(0.35, 10);
    expect(extra['abs'].y).toBeCloseTo(0.5, 10);
    expect(extra['rel'].x).toBeCloseTo(0.55, 10);
    expect(extra['rel'].y).toBeCloseTo(0.7, 10);
    // 被拖帧不在返回集中（由主路径处理）
    expect(extra['main']).toBeUndefined();
  });

  it('锚点统一 += delta：绝对锚点跟随、相对锚点 offset 平移（解算位置等量平移）', () => {
    const extra = computeMultiDragFrames(project, starts, 'main', 0.15, 0.3);
    const dx = 0.05, dy = 0.1;
    // 绝对锚点：世界坐标 += delta
    expect(extra['abs'].anchors![0].x).toBeCloseTo(0.3 + dx, 10);
    expect(extra['abs'].anchors![0].y).toBeCloseTo(0.4 + dy, 10);
    // 相对锚点：offset += delta（参照帧 abs 未动，解算位置平移同量）
    expect(extra['rel'].anchors![0].x).toBeCloseTo(0.05 + dx, 10);
    expect(extra['rel'].anchors![0].y).toBeCloseTo(0.03 + dy, 10);
  });

  it('单选（starts.size<=1）或零位移返回空——不产生额外帧写入', () => {
    const single = new Map([['main', { x: 0.1, y: 0.2 }]]);
    expect(computeMultiDragFrames(project, single, 'main', 0.15, 0.3)).toEqual({});
    expect(computeMultiDragFrames(project, starts, 'main', 0.1, 0.2)).toEqual({});
  });
});
