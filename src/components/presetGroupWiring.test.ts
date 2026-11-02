import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：StylePresetPanel 与 FrameGroupPanel 是
 * 样式预设/分组 store action 的 UI 入口（store 行为已有测试，这里锁接线）。
 */
const preset = readFileSync(join(__dirname, 'StylePresetPanel.tsx'), 'utf-8');
const group = readFileSync(join(__dirname, 'FrameGroupPanel.tsx'), 'utf-8');

describe('StylePresetPanel/FrameGroupPanel 接线守卫', () => {
  it('样式应用走 applyStylePreset（带目标帧集合）', () => {
    expect(preset).toContain('applyStylePreset(presetId, targetIds);');
  });

  it('样式保存走 saveFrameAsPreset（空名不生效）', () => {
    expect(preset).toContain('handleSaveAsPreset');
    expect(preset).toContain('setNewPresetName(e.target.value)');
  });

  it('预设删除有按钮（onDelete 回调）', () => {
    expect(preset).toContain('onClick={onDelete}');
  });

  it('分组创建校验：空名或无选中直接返回', () => {
    expect(group).toContain("if (!newGroupName.trim() || selectedFrameIds.length === 0) return;");
  });

  it('分组创建按钮在无选中时 disabled（双保险）', () => {
    expect(group).toContain('disabled={selectedFrameIds.length === 0}');
  });

  it('分组创建/更新/删除全部走 store action', () => {
    expect(group).toContain('createGroup(newGroupName, selectedFrameIds);');
    expect(group).toContain('updateGroup(group.id, updates)');
    expect(group).toContain('removeGroup(deleteConfirm.id);');
  });
});
