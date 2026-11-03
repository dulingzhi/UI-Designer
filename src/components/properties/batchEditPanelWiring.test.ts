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
    // r140：组合命令——cmds.push 收集；单帧 executeCommand / 多帧 先 execute 再 pushCommand。
    expect(src).toContain("cmds.push(new UpdateFrameCommand(id, {");
    expect(src).toContain('const composite = {');
    expect(src).toContain('composite.execute();');
    expect(src).toContain('pushCommand(composite);');
    // r242 修正：原断言只查 pushCommand 存在（把「只入栈不执行」缺陷当期望）；
    // 现锁顺序语义 + 空选择防护，运行时由 batchEditRender.test.tsx 验证。
    expect(src.indexOf('composite.execute();')).toBeLessThan(src.indexOf('pushCommand(composite);'));
    expect(src).toContain('if (cmds.length === 0) return;');
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
