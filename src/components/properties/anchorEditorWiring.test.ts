import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：未装 jsdom 无法渲染组件，用静态断言锁定
 * AnchorEditor 的编辑接线。锚点是内核对拍（SetPoint/FramePoint 9 点）的
 * 编辑入口，接线断裂=用户改不了锚点=对拍语义与实际编辑脱节。
 */
const src = readFileSync(join(__dirname, 'AnchorEditor.tsx'), 'utf-8');

describe('AnchorEditor 接线守卫', () => {
  it('9 个 FramePoint 选项齐全（对拍语义的编辑入口）', () => {
    for (const p of ['TOPLEFT', 'TOP', 'TOPRIGHT', 'LEFT', 'CENTER', 'RIGHT', 'BOTTOMLEFT', 'BOTTOM', 'BOTTOMRIGHT']) {
      expect(src, `缺少 FramePoint.${p} 选项`).toContain(`FramePoint.${p}`);
    }
  });

  it('所有修改走不可变数组更新（不原地改 state）', () => {
    // 每次修改都应复制 anchors 数组再交给 handleChange
    const copies = (src.match(/\.\.\.\(selectedFrame\.anchors \|\| \[\]\)/g) ?? []).length;
    expect(copies, '至少 3 处输入（point/x/y）应复制数组').toBeGreaterThanOrEqual(3);
  });

  it('修改统一经 handleChange("anchors", ...) 单出口', () => {
    const calls = (src.match(/handleChange\('anchors',/g) ?? []).length;
    expect(calls, 'point/x/y/删除 4 类修改都应有回写').toBeGreaterThanOrEqual(4);
  });

  it('无 anchors 时使用 createDefaultAnchors 兜底', () => {
    expect(src).toContain('createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height)');
  });

  it('锚点冲突检测被消费（detectAnchorConflicts）', () => {
    expect(src).toContain('detectAnchorConflicts');
    expect(src).toContain('anchorConflicts');
  });

  it('删除锚点经 filter 不可变操作', () => {
    expect(src).toContain("selectedFrame.anchors!.filter((_, i) => i !== index)");
  });
});
