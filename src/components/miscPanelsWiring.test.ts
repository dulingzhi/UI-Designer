import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：组件面收尾五件套。
 * DebugPanel（坐标回显）、LazyTexturePreview（懒加载）、
 * ConfirmDialog（点遮罩取消/防冒泡）、RaceSwitcher（五族选项+setRace）。
 */
const debug = readFileSync(join(__dirname, 'DebugPanel.tsx'), 'utf-8');
const lazyTex = readFileSync(join(__dirname, 'LazyTexturePreview.tsx'), 'utf-8');
const confirm = readFileSync(join(__dirname, 'ConfirmDialog.tsx'), 'utf-8');
const race = readFileSync(join(__dirname, 'RaceSwitcher.tsx'), 'utf-8');

describe('组件收尾接线守卫', () => {
  it('DebugPanel：帧尺寸与坐标三位小数回显（与引擎精度一致）', () => {
    expect(debug).toContain('{selectedFrame.width.toFixed(3)} × {selectedFrame.height.toFixed(3)}');
    expect(debug).toContain('{selectedFrame.x.toFixed(3)}, {selectedFrame.y.toFixed(3)}');
    expect(debug).toContain('{selectedFrame && (');
  });


  it('LazyTexturePreview：观察可见才加载 + 卸载 disconnect（防泄漏）', () => {
    expect(lazyTex).toContain('new IntersectionObserver(');
    expect(lazyTex).toContain('observer.disconnect();');
    expect(lazyTex).toContain('observer.observe(containerRef.current);');
  });

  it('ConfirmDialog：遮罩点击取消 + 内容区防冒泡', () => {
    expect(confirm).toContain('<div className="confirm-dialog-overlay" onClick={onCancel}>');
    expect(confirm).toContain('onClick={(e) => e.stopPropagation()}');
    expect(confirm).toContain('onClick={onConfirm}');
  });

  it('RaceSwitcher：五族选项齐全且走 setRace（store action）', () => {
    for (const r of ["value: 'Default'", "value: 'Human'", "value: 'NightElf'", "value: 'Orc'", "value: 'Undead'"]) {
      expect(race, `缺少种族 ${r}`).toContain(r);
    }
    expect(race).toContain('setRace(option.value);');
    expect(race).toContain('setShowDropdown(false)');
  });
});
