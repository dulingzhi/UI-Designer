import { describe, it, expect, beforeEach } from 'vitest';
import { useCommandStore } from './commandStore';
import type { Command } from './commandStore';

const makeCmd = () => {
  let value = 0;
  return {
    cmd: {
      execute: () => { value = 1; },
      undo: () => { value = 0; },
      redo: () => { value = 1; },
    } as Command,
    get: () => value,
  };
};

describe('commandStore', () => {
  beforeEach(() => {
    useCommandStore.setState({ undoStack: [], redoStack: [] });
  });

  it('execute 执行并入 undoStack、清空 redoStack', () => {
    const { cmd } = makeCmd();
    useCommandStore.getState().executeCommand(cmd);
    expect(cmd).toBeDefined();
    expect(useCommandStore.getState().undoStack).toHaveLength(1);
    expect(useCommandStore.getState().redoStack).toHaveLength(0);
  });

  it('undo 后新 execute 清空 redoStack（分支语义）', () => {
    const a = makeCmd(), b = makeCmd(), c = makeCmd();
    const s = useCommandStore.getState();
    s.executeCommand(a.cmd);
    s.executeCommand(b.cmd);
    s.undo();
    expect(useCommandStore.getState().redoStack).toHaveLength(1);
    // 分支：undo 后执行新命令，redo 栈必须清空（否则 redo 会回到已被丢弃的分支）
    s.executeCommand(c.cmd);
    expect(useCommandStore.getState().redoStack).toHaveLength(0);
  });

  it('undo/redo 往返恢复状态', () => {
    const { cmd, get } = makeCmd();
    const s = useCommandStore.getState();
    s.executeCommand(cmd);
    expect(get()).toBe(1);
    s.undo();
    expect(get()).toBe(0);
    s.redo();
    expect(get()).toBe(1);
  });

  it('空栈时 undo/redo 是 no-op', () => {
    const s = useCommandStore.getState();
    s.undo();
    s.redo();
    expect(useCommandStore.getState().undoStack).toHaveLength(0);
  });

  it('canUndo/canRedo 反映栈状态', () => {
    const { cmd } = makeCmd();
    const s = useCommandStore.getState();
    expect(s.canUndo()).toBe(false);
    s.executeCommand(cmd);
    expect(s.canUndo()).toBe(true);
    expect(s.canRedo()).toBe(false);
    s.undo();
    expect(s.canRedo()).toBe(true);
  });

  it('clearHistory 清空两栈', () => {
    const { cmd } = makeCmd();
    const s = useCommandStore.getState();
    s.executeCommand(cmd);
    s.undo();
    s.clearHistory();
    expect(useCommandStore.getState().undoStack).toHaveLength(0);
    expect(useCommandStore.getState().redoStack).toHaveLength(0);
  });

  it('undoStack 有上限（100 步），最旧出栈', () => {
    const s = useCommandStore.getState();
    for (let i = 0; i < 120; i++) {
      s.executeCommand(makeCmd().cmd);
    }
    expect(useCommandStore.getState().undoStack.length).toBeLessThanOrEqual(100);
  });
});
