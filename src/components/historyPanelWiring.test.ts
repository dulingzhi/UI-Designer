import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：HistoryPanel 是 undo/redo 历史的 UI 视图，
 * 与 commandStore 栈结构联动（行为已有 store 测试，这里锁 UI 接线）。
 */
const src = readFileSync(join(__dirname, 'HistoryPanel.tsx'), 'utf-8');

describe('HistoryPanel 接线守卫', () => {
  it('消费 commandStore 双栈（undoStack + redoStack）', () => {
    expect(src).toContain("const { undoStack, redoStack, undo, redo } = useCommandStore();");
  });

  it('合并视图按栈序（undoStack 正序 + redoStack 反序）', () => {
    expect(src).toContain('const fullHistory = [...undoStack, ...redoStack.slice().reverse()];');
  });

  it('回退路径：目标在 undoStack 内逐次 undo', () => {
    expect(src).toContain('if (index < currentIndex) {');
    expect(src).toContain('const steps = currentIndex - index;');
    expect(src).toContain('undo();');
  });

  it('前进路径：目标在 redoStack 内逐次 redo', () => {
    expect(src).toContain('} else if (index > currentIndex) {');
    expect(src).toContain('const steps = index - currentIndex;');
    expect(src).toContain('redo();');
  });

  it('初始状态（currentIndex === -1）有视觉标记', () => {
    expect(src).toContain("currentIndex === -1 ? 'current' : ''");
  });
});
