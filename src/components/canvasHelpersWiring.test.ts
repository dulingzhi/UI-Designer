import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：画布辅助渲染组件四件套。
 * ContextMenu：禁用项不触发 + 点外关闭；GuideLine：位置钳制；
 * Ruler：刻度密度随缩放；BackdropEdge：九宫格边渲染。
 */
const menu = readFileSync(join(__dirname, 'ContextMenu.tsx'), 'utf-8');
const guide = readFileSync(join(__dirname, 'GuideLine.tsx'), 'utf-8');
const ruler = readFileSync(join(__dirname, 'Ruler.tsx'), 'utf-8');

describe('画布辅助组件接线守卫', () => {
  it('ContextMenu：禁用项/无动作项不触发', () => {
    expect(menu).toContain('if (item.disabled || !item.action) {');
    expect(menu).toContain('item.action();');
  });

  it('ContextMenu：菜单项展示与子菜单支持', () => {
    expect(menu).toContain('{items.map((item, index) => {');
    expect(menu).toContain('submenuState.index].submenu!');
  });

  it('GuideLine：拖动位置钳制在画布范围内', () => {
    expect(guide).toContain('const clampedPosition = Math.max(0, Math.min(maxPosition, newPosition));');
  });

  it('GuideLine：WC3 坐标换算展示（设计坐标↔引擎坐标）', () => {
    expect(guide).toContain('guide.wc3Position !== undefined');
    expect(guide).toContain('{guide.position.toFixed(1)}px');
  });

  it('Ruler：刻度密度随缩放调整（防刻度过密）', () => {
    expect(ruler).toContain('} else if (scale > 2) {');
    expect(ruler).toContain('const generateTicks = () => {');
  });

  it('Ruler：像素↔WC3 坐标双向换算（scale+offset 参与）', () => {
    expect(ruler).toContain('const endWc3 = (length - offset) / (pixelsPerUnit * scale);');
    expect(ruler).toContain('ruler-${orientation}');
  });

  // BackdropEdge.tsx 已删除（孤儿组件：渲染走 SceneGraphManager WebGL 路径，
  // React 版从未接入；连带 useTextureLoader/useTextureLoaderBatch 零消费链）。
});
