import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：HotReloadPanel 是编辑器↔War3 热重载的配置与
 * 手动导出入口。锁定：
 * 1. 配置持久化（localStorage 往返）——重开面板不丢配置；
 * 2. 手动导出走 getHotReloadExporter(config).export（与自动热重载同链路）；
 * 3. war3Path 未配置时导出按钮 disabled（防导到无效路径）。
 */
const src = readFileSync(join(__dirname, 'HotReloadPanel.tsx'), 'utf-8');

describe('HotReloadPanel 接线守卫', () => {
  it('配置持久化：localStorage 写入与读取成对', () => {
    expect(src).toContain("localStorage.getItem('hotReloadConfig')");
    expect(src).toContain("localStorage.setItem('hotReloadConfig', JSON.stringify(newConfig))");
  });

  it('手动导出走热重载导出链路（enabled 参数传入）', () => {
    expect(src).toContain('getHotReloadExporter(config).export(project, true)');
  });

  it('war3Path 未配置时导出按钮 disabled', () => {
    expect(src).toContain('disabled={!kkweInfo.installed || !kkweInfo.war3Path}');
  });

  it('outputPath 显示给用户（可核对导出位置）', () => {
    expect(src).toContain('UI内容: <code>{config.outputPath}</code>');
  });

  it('enabled 开关受控（checkbox 绑定 config.enabled）', () => {
    expect(src).toContain('checked={config.enabled}');
  });
});
