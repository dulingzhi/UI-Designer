import { create } from 'zustand';

// 命令接口
export interface Command {
  execute: () => void;
  undo: () => void;
  redo: () => void;
}

interface CommandState {
  undoStack: Command[];
  redoStack: Command[];
  
  executeCommand: (command: Command) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

// undo 栈上限：防止长期编辑无限增长（命令闭包持有旧 state，泄漏风险）。
// 最旧出栈——100 步覆盖常规编辑会话（行业标准量级）。
const MAX_UNDO_HISTORY = 100;

export const useCommandStore = create<CommandState>((set, get) => ({
  undoStack: [],
  redoStack: [],

  executeCommand: (command) => {
    command.execute();
    set((state) => {
      const next = [...state.undoStack, command];
      return {
        undoStack: next.length > MAX_UNDO_HISTORY ? next.slice(next.length - MAX_UNDO_HISTORY) : next,
        redoStack: [], // 清空重做栈
      };
    });
  },

  undo: () => {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;

    const command = undoStack[undoStack.length - 1];
    command.undo();

    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, command],
    });
  },

  redo: () => {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;

    const command = redoStack[redoStack.length - 1];
    command.redo();

    set({
      undoStack: [...undoStack, command],
      redoStack: redoStack.slice(0, -1),
    });
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}));
