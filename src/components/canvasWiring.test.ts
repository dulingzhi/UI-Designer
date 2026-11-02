import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：Canvas 是渲染+交互核心（1016 行）。
 * 锁定：SceneGraphManager 生命周期（异步创建 + cancelled 竞态 + dispose）、
 * 右键菜单动作走命令层、hitTest 是点击判定入口、hook 化交互。
 */
const src = readFileSync(join(__dirname, 'Canvas.tsx'), 'utf-8');

describe('Canvas 接线守卫', () => {
  it('SceneGraphManager 异步创建有 cancelled 竞态防护', () => {
    expect(src).toContain('let cancelled = false;');
    expect(src).toContain('if (cancelled) {');
    expect(src).toContain('created.dispose();');
    // dispose 分支必须紧跟 cancelled 判断（顺序：cancelled → dispose → return）
    expect(src.indexOf('if (cancelled) {')).toBeLessThan(src.indexOf('created.dispose();'));
  });

  it('卸载时 dispose + 清空 ref（防 use-after-dispose）', () => {
    expect(src).toContain('cancelled = true;');
    expect(src).toContain('sg?.dispose();');
    expect(src).toContain('sceneGraphRef.current = null;');
  });

  it('渲染初始化失败显式记录（不静默白屏）', () => {
    expect(src).toContain('[Canvas] 渲染器初始化失败:');
  });

  it('右键菜单动作全部走命令层（可 undo）', () => {
    for (const cmd of ['CopyFrameCommand', 'CopyStyleCommand', 'DuplicateFrameCommand',
      'PasteFrameCommand', 'RemoveFrameCommand', 'UpdateFrameCommand']) {
      expect(src, `缺少 ${cmd}`).toContain(`new ${cmd}(`);
    }
  });

  it('点击判定走 WebGL hitTest（产品真实命中路径）', () => {
    expect(src).toContain("frameId = hitTest(");
  });

  it('交互经 hook 化（拖拽/缩放/平移）', () => {
    expect(src).toContain('useCanvasDrag(');
    expect(src).toContain('useCanvasResize(');
    expect(src).toContain('useCanvasPan(');
  });
});
