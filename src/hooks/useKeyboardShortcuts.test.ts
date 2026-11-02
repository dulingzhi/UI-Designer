/**
 * useKeyboardShortcuts 静态守卫（无 jsdom，与 wiring guard 同模式）
 *
 * 锁定 round 87 修复：Shift+方向键精细微调必须是**独立分支**（0.001 步长）——
 * 原缺陷把 shiftKey 判断放在 !e.shiftKey 分支内恒 false，精调功能从未生效。
 * 顺序断言：Shift 分支必须出现在无修饰键分支**之后**（else-if 链）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const src = readFileSync(join(__dirname, 'useKeyboardShortcuts.ts'), 'utf-8');

describe('useKeyboardShortcuts 静态守卫', () => {
  it('无修饰键分支不含 shiftKey 步长判断（防死功能回归）', () => {
    const noModIdx = src.indexOf("else if (!e.ctrlKey && !e.shiftKey && !e.altKey)");
    const shiftBranchIdx = src.indexOf("Shift + 方向键：精细微调");
    expect(noModIdx).toBeGreaterThan(-1);
    expect(shiftBranchIdx).toBeGreaterThan(noModIdx);
    // 无修饰键分支到 Shift 分支之间不得出现 "e.shiftKey ?"（原缺陷模式）
    const noModBody = src.slice(noModIdx, shiftBranchIdx);
    expect(noModBody).not.toContain('e.shiftKey ?');
  });

  it('Shift+方向键独立分支以 0.001 步长微调', () => {
    const shiftBranch = src.slice(src.indexOf('Shift + 方向键：精细微调'), src.indexOf('// ========== 辅助函数'));
    expect(shiftBranch).toContain('const step = 0.001');
    expect(shiftBranch).toContain("'ArrowLeft'");
    expect(shiftBranch).toContain("'ArrowRight'");
    expect(shiftBranch).toContain("'ArrowUp'");
    expect(shiftBranch).toContain("'ArrowDown'");
    // 精调走 nudgeSelected（round 127：内部含命令层，多选组合命令一次撤销）
    expect(shiftBranch).toContain('nudgeSelected(');
  });

  it('round 127：方向键多选微调辅助存在（多帧组合命令一次撤销）', () => {
    expect(src).toContain('const nudgeSelected = (dx: number, dy: number)');
    expect(src).toContain('useCommandStore.getState().pushCommand({');
    expect(src).toContain('selectedFrameIds.length > 0 ? ui.selectedFrameIds');
    // 组合命令语义：单帧 executeCommand，多帧 pushCommand
    expect(src).toContain('cmds.length === 1');
  });

  it('修饰键分支互斥链完整（Ctrl / Ctrl+Shift / Alt / Alt+Shift / 无修饰 / Shift 独立）', () => {
    expect(src).toContain("e.ctrlKey && !e.shiftKey && !e.altKey");
    expect(src).toContain("e.ctrlKey && e.shiftKey && !e.altKey");
    expect(src).toContain("e.altKey && !e.shiftKey && !e.ctrlKey");
    expect(src).toContain("e.altKey && e.shiftKey && !e.ctrlKey");
    expect(src).toContain("!e.ctrlKey && !e.shiftKey && !e.altKey");
    expect(src).toContain("e.shiftKey && !e.ctrlKey && !e.altKey");
  });
});
