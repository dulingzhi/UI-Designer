import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：数组创建对话框是批量生成帧的参数入口。
 * 锁定：数值解析 NaN 防护、count 告警阈值、输入上限、二次确认。
 */
const table = readFileSync(join(__dirname, 'TableArrayDialog.tsx'), 'utf-8');
const circle = readFileSync(join(__dirname, 'CircleArrayDialog.tsx'), 'utf-8');

describe('数组对话框接线守卫', () => {
  it('TableArray 数值解析有默认值兜底（NaN 防护）', () => {
    expect(table).toContain('setRows(parseInt(e.target.value) || 1)');
    expect(table).toContain('setXGap(parseFloat(e.target.value) || 0)');
  });

  it('TableArray 行×列超 100 触发告警', () => {
    expect(table).toContain('if (rows * cols > 100) {');
    expect(table).toContain('setShowCountWarning(true)');
  });

  it('TableArray 有二次确认（ConfirmDialog）', () => {
    expect(table).toContain('<ConfirmDialog');
  });

  it('CircleArray 半径最小 0.01（防 0 半径退化）', () => {
    expect(circle).toContain('setRadius(parseFloat(e.target.value) || 0.01)');
  });

  it('CircleArray count 最小 2（防 1 帧圆阵）', () => {
    expect(circle).toContain('setCount(parseInt(e.target.value) || 2)');
  });

  it('CircleArray 世界坐标输入有上限钳制（0..0.8）', () => {
    expect(circle).toContain('max="0.8"');
  });
});
