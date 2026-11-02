import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：WC3TextureBrowser 是纹理资产选择入口。
 * 锁定：路径传递语义（双击/确定 → onSelect + onClose）、目录与文件
 * 行为区分、确定按钮无选中时不触发、图片格式过滤。
 */
const src = readFileSync(join(__dirname, 'WC3TextureBrowser.tsx'), 'utf-8');

describe('WC3TextureBrowser 接线守卫', () => {
  it('双击文件才 onSelect（目录不触发选择）', () => {
    expect(src).toContain('const handleItemDoubleClick = (item: TextureItem) => {');
    expect(src).toContain('if (!item.isDirectory) {');
    expect(src).toContain('onSelect(item.path);');
  });

  it('单击目录进入并清空搜索（不选中）', () => {
    expect(src).toContain('loadDirectory(item.path);');
    expect(src).toContain("setSearchQuery('');");
    expect(src).toContain('setSelectedPath(item.path);');
  });

  it('确定按钮无选中时不触发 onSelect', () => {
    expect(src).toContain('if (selectedPath) {');
    expect(src).toContain('onSelect(selectedPath);');
  });

  it('选择后关闭面板（onClose 与 onSelect 同步）', () => {
    const onSelectCalls = (src.match(/onSelect\(/g) ?? []).length;
    expect(onSelectCalls, '双击与确定两处 onSelect').toBeGreaterThanOrEqual(2);
    expect((src.match(/onClose\(\);/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('图片格式过滤含 WC3 主要纹理格式', () => {
    for (const ext of ['.blp', '.tga', '.dds', '.png']) {
      expect(src, `缺少格式 ${ext}`).toContain(`'${ext}'`);
    }
  });

  it('搜索经 mpqManager.searchFiles 通配', () => {
    expect(src).toContain("mpqManager.searchFiles(`*${query}*`)");
  });
});
