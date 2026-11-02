import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：辅助面板三件套。
 * UpdateChecker：开发环境跳过 + 错误不静默；AboutDialog：版本双源兜底。
 */
const upd = readFileSync(join(__dirname, 'UpdateChecker.tsx'), 'utf-8');
const about = readFileSync(join(__dirname, 'AboutDialog.tsx'), 'utf-8');
const help = readFileSync(join(__dirname, 'ShortcutHelp.tsx'), 'utf-8');

describe('辅助面板接线守卫', () => {
  it('UpdateChecker：开发环境跳过更新检查（不误报）', () => {
    expect(upd).toContain("import.meta.env.DEV || import.meta.env.MODE === 'development'");
    expect(upd).toContain('[UpdateChecker] 开发环境，跳过更新检查');
  });

  it('UpdateChecker：检查/下载失败不静默（console.error）', () => {
    expect(upd).toContain('检查更新失败:');
    expect(upd).toContain('更新失败:');
  });

  it('UpdateChecker：新版本发现有回调通知（可联动 UI 提示）', () => {
    expect(upd).toContain('onUpdateAvailable?.(version);');
    expect(upd).toContain('是否立即更新');
  });

  it('AboutDialog：版本双源（Tauri getVersion 优先，package.json 兜底）', () => {
    expect(about).toContain("useState(packageJson.version)");
    expect(about).toContain('getVersion().then(setVersion).catch(');
    expect(about).toContain('Using package.json version');
  });

  it('ShortcutHelp：快捷键清单非空且有关闭回调', () => {
    expect((help.match(/keys: '/g) ?? []).length).toBeGreaterThanOrEqual(20);
    expect(help).toContain('onClose');
  });
});
