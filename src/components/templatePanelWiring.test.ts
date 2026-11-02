import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：TemplatePanel 是"从模板创建帧"的入口。
 * 锁定：创建走命令层（可 undo）、组合模板逐帧建、分类过滤、空态提示。
 */
const src = readFileSync(join(__dirname, 'TemplatePanel.tsx'), 'utf-8');

describe('TemplatePanel 接线守卫', () => {
  it('单模板创建走 CreateFrameCommand（可 undo）', () => {
    expect(src).toContain('template.createFrame()');
    expect(src).toContain('import { CreateFrameCommand }');
    expect(src).toContain('executeCommand(command);');
  });

  it('组合模板逐帧建且全走命令层', () => {
    expect(src).toContain('template.createFrames()');
    expect(src).toContain('framesData.forEach');
    expect(src).toContain('handleCreateFromCompositeTemplate');
  });

  it('帧 ID 唯一（时间戳+随机后缀）', () => {
    const idGen = (src.match(/frame-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)/g) ?? []).length;
    expect(idGen, '单模板与组合模板各有 ID 生成').toBeGreaterThanOrEqual(2);
  });

  it('分类过滤消费 getTemplatesByCategory', () => {
    expect(src).toContain('getTemplatesByCategory(selectedCategory)');
    expect(src).toContain("setSelectedCategory('all')");
  });

  it('无模板时空态提示', () => {
    expect(src).toContain("filteredTemplates.length === 0 && filteredCompositeTemplates.length === 0");
    expect(src).toContain('template-empty');
  });

  it('两类模板（单/组合）分别渲染', () => {
    expect(src).toContain('filteredTemplates.map');
    expect(src).toContain('filteredCompositeTemplates.map');
  });
});
