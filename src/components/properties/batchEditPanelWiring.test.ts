import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：BatchEditPanel 对所有选中帧批量设值。
 * 三条不变式：
 * 1. 每帧一条 UpdateFrameCommand（进 undo 栈，可撤销）——不得绕过命令层裸改 store；
 * 2. 类型 select 的哨兵值 -1 不触发修改（未选择 ≠ 修改）；
 * 3. 修改统一经 handleBatchChange 单出口。
 */
const src = readFileSync(join(__dirname, 'BatchEditPanel.tsx'), 'utf-8');

describe('BatchEditPanel 接线守卫', () => {
  it('批量修改走 UpdateFrameCommand（可 undo，不裸改 store）', () => {
    expect(src).toContain("executeCommand(new UpdateFrameCommand(id, { [field]: value }));");
    expect(src).toContain("useCommandStore();");
  });

  it('修改统一经 handleBatchChange 单出口', () => {
    const calls = (src.match(/handleBatchChange\('/g) ?? []).length;
    expect(calls, '至少 3 个字段绑定（type/textColor/isRelative）').toBeGreaterThanOrEqual(3);
  });

  it('类型 select 哨兵 -1 不触发修改', () => {
    expect(src).toContain('const type = parseInt(e.target.value);');
    expect(src).toContain('if (type >= 0) {');
  });

  it('数字输入滚轮 stopPropagation（防画布误滚）', () => {
    expect(src).toContain('e.stopPropagation();');
  });

  it('按选中帧集合逐帧执行（selectedFrameIds.forEach）', () => {
    expect(src).toContain('selectedFrameIds.forEach(id =>');
  });
});
