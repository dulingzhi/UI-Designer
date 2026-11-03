/**
 * 决策项 6：ProjectTree 键盘导航纯函数测试。
 * collectVisibleOrder（展开序 DFS）是 ArrowUp/Down 移动选择的序源。
 */
import { describe, it, expect } from 'vitest';
import { collectVisibleOrder } from './ProjectTree';

describe('collectVisibleOrder（决策项 6）', () => {
  const frames = {
    root1: { children: ['c1', 'c2'] },
    c1: { children: ['g1'] },
    c2: { children: [] },
    g1: { children: [] },
    root2: { children: [] },
  };

  it('全展开：先序 DFS 序列', () => {
    const order = collectVisibleOrder(frames, ['root1', 'root2'], new Set(['root1', 'c1']));
    expect(order).toEqual(['root1', 'c1', 'g1', 'c2', 'root2']);
  });

  it('折叠 root1：其子树全部不可见', () => {
    const order = collectVisibleOrder(frames, ['root1', 'root2'], new Set());
    expect(order).toEqual(['root1', 'root2']);
  });

  it('缺失帧（存档竞态）跳过不崩溃', () => {
    const order = collectVisibleOrder(frames, ['root1', 'ghost', 'root2'], new Set(['root1', 'c1']));
    expect(order).toEqual(['root1', 'c1', 'g1', 'c2', 'root2']);
  });
});
