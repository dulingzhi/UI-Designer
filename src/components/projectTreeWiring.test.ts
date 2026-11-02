import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：ProjectTree 是帧树的核心管理入口
 * （删除/重命名/改父/复制/数组创建）。锁定编辑语义：
 * 1. 破坏性操作全部走命令层（可 undo）+ 确认框；
 * 2. 锁定帧不可删除；
 * 3. 重命名空名不生效。
 */
const src = readFileSync(join(__dirname, 'ProjectTree.tsx'), 'utf-8');

describe('ProjectTree 接线守卫', () => {
  it('删除走 RemoveFrameCommand（可 undo）', () => {
    expect(src).toContain('new RemoveFrameCommand(deleteConfirm.frameId)');
  });

  it('删除有确认框，且提示子帧数量', () => {
    expect(src).toContain('<ConfirmDialog');
    expect(src).toContain('个子控件吗');
  });

  it('锁定帧不可删除（先检查 locked）', () => {
    expect(src).toContain('if (frame.locked) {');
    expect(src).toContain('该控件已锁定');
  });

  it('重命名走 UpdateFrameCommand 且空名不生效（trim 校验）', () => {
    expect(src).toContain('executeCommand(new UpdateFrameCommand(renamingNodeId, { name: newName.trim() }));');
    expect(src).toContain('if (renamingNodeId && newName.trim()) {');
  });

  it('改父走 ChangeParentCommand（可 undo）', () => {
    expect(src).toContain('new ChangeParentCommand(frameId, newParentId)');
  });

  it('复制走 DuplicateCommand（可 undo）', () => {
    expect(src).toContain('new DuplicateCommand(frameId)');
  });

  it('表格/圆形数组创建走命令层', () => {
    expect(src).toContain('new CreateTableArrayCommand(');
    expect(src).toContain('new CreateCircleArrayCommand(');
  });

  it('全部经 useCommandStore 的 executeCommand 单出口', () => {
    const calls = (src.match(/executeCommand\(command\)/g) ?? []).length;
    expect(calls, '命令分发至少 4 处（删除/改父/复制/数组）').toBeGreaterThanOrEqual(4);
  });
});
