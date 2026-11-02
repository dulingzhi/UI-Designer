import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：PreferencesDialog 是全局偏好配置入口。
 * 锁定：双键持久化（preferences + war3_install_path）、受控绑定、
 * 重置确认、危险操作提示。
 */
const src = readFileSync(join(__dirname, 'PreferencesDialog.tsx'), 'utf-8');

describe('PreferencesDialog 接线守卫', () => {
  it('双键持久化：偏好 + war3 安装路径分键保存', () => {
    expect(src).toContain("localStorage.setItem('preferences', JSON.stringify(preferences))");
    expect(src).toContain("localStorage.setItem('war3_install_path', preferences.war3Path)");
    expect(src).toContain("localStorage.getItem('preferences')");
  });

  it('开关/滑条/选择全部受控（checked/value + onChange 成对）', () => {
    expect(src).toContain('checked={preferences.showGrid}');
    expect(src).toContain('checked={preferences.snapToGrid}');
    expect(src).toContain('onChange={(e) => setPreferences(prev => ({ ...prev, gridSize: parseInt(e.target.value) }))}');
    expect(src).toContain("onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' }))}");
  });

  it('重置有确认框且回落默认值', () => {
    expect(src).toContain('setShowResetConfirm(true)');
    expect(src).toContain('setPreferences(DEFAULT_PREFERENCES);');
  });

  it('清除本地数据是危险操作且有警示', () => {
    expect(src).toContain('localStorage.clear();');
    expect(src).toContain('danger-button');
    expect(src).toContain('所有本地数据已清除');
  });

  it('网格尺寸值回显（slider-value）', () => {
    expect(src).toContain('{preferences.gridSize}px');
  });
});
