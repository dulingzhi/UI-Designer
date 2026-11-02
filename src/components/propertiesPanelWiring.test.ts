import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：PropertiesPanel 是属性编辑主入口（525 行），
 * 聚合 AnchorEditor/TextProperties/TextureProperties/TypeSpecificProperties
 * 四个子编辑器。锁定：统一命令层出口、动态尺寸感知、模板继承提示。
 */
const src = readFileSync(join(__dirname, 'PropertiesPanel.tsx'), 'utf-8');

describe('PropertiesPanel 接线守卫', () => {
  it('所有字段修改走 UpdateFrameCommand（可 undo）', () => {
    expect(src).toContain('executeCommand(new UpdateFrameCommand(selectedFrameId, { [field]: value }));');
    expect(src).toContain('if (!selectedFrameId) return;');
  });

  it('handleChange 单实例下发四个子编辑器（props 一致性）', () => {
    for (const child of ['AnchorEditor', 'TextProperties', 'TextureProperties', 'TypeSpecificProperties']) {
      expect(src, `缺少子编辑器 ${child}`).toContain(`<${child}`);
    }
    expect((src.match(/handleChange=\{handleChange\}/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('字段按帧类型显隐（shouldShowField 消费）', () => {
    expect(src).toContain("shouldShowField(selectedFrame.type, 'text')");
    expect(src).toContain("shouldShowField(selectedFrame.type, 'texture')");
  });

  it('动态尺寸感知：多锚点帧用求解器算有效位置', () => {
    expect(src).toContain('const calculatedPos = calculatePositionFromAnchors(selectedFrame, project.frames);');
    expect(src).toContain('const effectiveFrame = calculatedPos ? { ...selectedFrame, ...calculatedPos } : selectedFrame;');
  });

  it('模板继承信息展示（导入 FDF 的 inheritedChildrenIds）', () => {
    expect(src).toContain('selectedFrame.fdfMetadata.inherits');
    expect(src).toContain('selectedFrame.fdfMetadata.inheritedChildrenIds');
  });
});
