import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：SidePanel 是模板/历史侧栏容器。
 * 锁定：tab 切换互斥渲染、展开/收起状态、空态提示、命令名映射展示。
 */
const src = readFileSync(join(__dirname, 'SidePanel.tsx'), 'utf-8');

describe('SidePanel 接线守卫', () => {
  it('两个 tab 互斥渲染（templates / history）', () => {
    expect(src).toContain("{activeTab === 'templates' && (");
    expect(src).toContain("{activeTab === 'history' && (");
  });

  it('tab 按钮有 active 视觉态', () => {
    expect(src).toContain("activeTab === 'history' ? 'active' : ''");
    expect(src).toContain("activeTab === 'templates' ? 'active' : ''");
  });

  it('展开/收起状态切换（isExpanded）', () => {
    expect(src).toContain("setIsExpanded(!isExpanded)");
    expect(src).toContain("isExpanded ? 'expanded' : 'collapsed'");
  });

  it('空态提示存在（无内容时不白屏）', () => {
    expect(src).toContain('side-panel-empty');
  });

  it('数组命令名有中文映射（历史面板可读）', () => {
    expect(src).toContain("'CreateTableArrayCommand': '表格阵列'");
  });
});
