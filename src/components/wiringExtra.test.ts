/**
 * 未守卫组件补齐接线守卫（StylePresetPanel / FrameGroupPanel / UpdateChecker）
 *
 * 背景：组件面收口（123 测/21 文件）覆盖了"有编辑/交互语义"的 21 个文件；
 * 本文件补齐 App.tsx 挂载但无守卫的 3 个组件的静态接线断言（与既有 wiring guard 同模式，
 * 因未装 jsdom 无法渲染级测试）：
 * - StylePresetPanel / FrameGroupPanel：App.tsx 菜单切换挂载、onClose 回调、卡片三操作走 store
 * - UpdateChecker：dev 环境跳过、checking/downloading 互斥、确认更新走 pendingUpdate
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const src = (c: string) => readFileSync(join(__dirname, '..', 'components', `${c}.tsx`), 'utf-8');

describe('未守卫组件接线（补齐组件面收口边界）', () => {
  it('StylePresetPanel：onClose 存在、PresetCard 三操作齐全且走 store action', () => {
    const t = src('StylePresetPanel');
    // App 挂载契约：onClose 由 App 传入（关闭面板）
    expect(t).toContain('onClose');
    // PresetCard 三操作
    const idxApply = t.indexOf('onApply');
    const idxDelete = t.indexOf('onDelete');
    const idxEdit = t.indexOf('onEdit');
    expect(idxApply).toBeGreaterThan(-1);
    expect(idxDelete).toBeGreaterThan(idxApply);
    expect(idxEdit).toBeGreaterThan(idxDelete);
    // 应用/删除走 store（useProjectStore），不直接改本地状态
    expect(t).toContain('useProjectStore');
  });

  it('FrameGroupPanel：onClose 存在、GroupCard 操作齐全且走 store action', () => {
    const t = src('FrameGroupPanel');
    expect(t).toContain('onClose');
    const idxSelect = t.indexOf('onSelect');
    const idxDelete = t.indexOf('onDelete');
    const idxEdit = t.indexOf('onEdit');
    expect(idxSelect).toBeGreaterThan(-1);
    expect(idxDelete).toBeGreaterThan(idxSelect);
    expect(idxEdit).toBeGreaterThan(idxDelete);
    expect(t).toContain('useProjectStore');
  });

  it('UpdateChecker：dev 环境跳过检查、checking/downloading 互斥、更新走 pendingUpdate', () => {
    const t = src('UpdateChecker');
    // dev 跳过（utilityPanelsWiring 已锁"更新检查 dev 跳过"，此处锁实现落点）
    expect(t.indexOf('isDevelopment')).toBeGreaterThan(-1);
    expect(t.indexOf("if (checking || downloading) return;")).toBeGreaterThan(-1);
    // 有更新 → 存 pendingUpdate → 确认后下载
    const idxPending = t.indexOf('setPendingUpdate(update)');
    const idxConfirm = t.indexOf('handleConfirmUpdate');
    expect(idxPending).toBeGreaterThan(-1);
    expect(idxConfirm).toBeGreaterThan(-1);
    expect(t).toContain("if (!pendingUpdate) return;");
    // checkOnMount 挂载契约（App.tsx checkOnMount={true}）
    expect(t).toContain('checkOnMount = false');
  });

  it('App.tsx：三组件均已挂载（守卫覆盖契约）', () => {
    const t = readFileSync(join(__dirname, '..', 'App.tsx'), 'utf-8');
    expect(t).toContain("<StylePresetPanel");
    expect(t).toContain("<FrameGroupPanel");
    expect(t).toContain("<UpdateChecker");
  });
});
