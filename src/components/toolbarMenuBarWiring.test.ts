import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：Toolbar/MenuBar 是编辑命令的全局分发入口。
 * 锁定：undo/redo 绑定与禁用态、命令层分发、选中态前置校验。
 */
const toolbar = readFileSync(join(__dirname, 'Toolbar.tsx'), 'utf-8');
const menu = readFileSync(join(__dirname, 'MenuBar.tsx'), 'utf-8');

describe('Toolbar/MenuBar 接线守卫', () => {
  it('undo/redo 绑定命令栈并按可用态禁用', () => {
    expect(toolbar).toContain('const { executeCommand, undo, redo, canUndo, canRedo } = useCommandStore();');
    expect(toolbar).toContain('disabled={!canUndo()}');
    expect(toolbar).toContain('disabled={!canRedo()}');
    expect(toolbar).toContain('onClick={undo}');
    expect(toolbar).toContain('onClick={redo}');
  });

  it('对齐/分布/画布对齐走命令层', () => {
    expect(toolbar).toContain('new AlignCommand(');
    expect(toolbar).toContain('new AlignToCanvasCommand(');
    expect(toolbar).toContain('new ZIndexCommand(');
  });

  it('命令仅在选中帧存在时执行（selectedFrameIds 前置校验）', () => {
    expect(toolbar).toContain('if (selectedFrameIds.length > 0) {');
  });

  it('MenuBar 拆分/批量删除/样式复制粘贴走命令层', () => {
    for (const cmd of ['new AlignCommand', 'new DistributeCommand', 'new BatchRemoveFrameCommand',
      'new CopyStyleCommand', 'new PasteStyleCommand', 'new RemoveFrameCommand', 'new ZIndexCommand']) {
      expect(menu, `MenuBar 缺少 ${cmd}`).toContain(cmd);
    }
  });

  it('两入口共用 executeCommand（命令栈一致，undo 语义统一）', () => {
    expect(toolbar).toContain('useCommandStore()');
    expect(menu).toContain('executeCommand');
  });
});
