/**
 * 调试继承子控件的标记
 */

import { parseFDFWithIncludes } from '../src/utils/fdfIncludeResolver';
import * as fs from 'fs';
import * as path from 'path';

async function debug() {
  const testFile = path.join(
    process.cwd(),
    'target',
    'vendor',
    'UI',
    'FrameDef',
    'Glue',
    'BattleNetProfilePanel.fdf'
  );

  const content = fs.readFileSync(testFile, 'utf-8');
  const basePath = path.join(process.cwd(), 'target', 'vendor');

  console.log('解析FDF...');
  const parsed = parseFDFWithIncludes(content, { basePath });
  const frames = parsed.frames.filter(f => !f.fdfMetadata?.isTemplate);
  
  console.log(`\n总Frame数: ${frames.length}\n`);

  // 找到IconSelectButton
  const iconSelectButton = frames.find(f => f.name === 'IconSelectButton');
  if (iconSelectButton) {
    console.log('===== IconSelectButton =====');
    console.log(`ID: ${iconSelectButton.id}`);
    console.log(`继承: ${iconSelectButton.fdfMetadata?.inherits}`);
    console.log(`子控件数: ${iconSelectButton.children.length}`);
    console.log(`继承子控件IDs: ${iconSelectButton.fdfMetadata?.inheritedChildrenIds?.length || 0}`);
    
    console.log('\n所有子控件:');
    iconSelectButton.children.forEach((childId, i) => {
      const child = frames.find(f => f.id === childId);
      if (child) {
        const isInherited = iconSelectButton.fdfMetadata?.inheritedChildrenIds?.includes(childId);
        console.log(`  ${i + 1}. ${child.name} (${child.type}) - ${isInherited ? '继承' : '自定义'}`);
        if (child.fdfMetadata?.inherits) {
          console.log(`      继承自: ${child.fdfMetadata.inherits}`);
        }
      }
    });

    // 检查自定义子控件
    const inheritedIds = iconSelectButton.fdfMetadata?.inheritedChildrenIds || [];
    const customChildren = iconSelectButton.children.filter(childId => !inheritedIds.includes(childId));
    
    console.log(`\n自定义子控件数: ${customChildren.length}`);
    customChildren.forEach((childId, i) => {
      const child = frames.find(f => f.id === childId);
      if (child) {
        console.log(`  ${i + 1}. ${child.name} (${child.type})`);
      }
    });
  }

  // 再检查一个例子：ProfileListBoxScrollBar
  console.log('\n\n===== ProfileListBoxScrollBar =====');
  const scrollBar = frames.find(f => f.name === 'ProfileListBoxScrollBar');
  if (scrollBar) {
    console.log(`ID: ${scrollBar.id}`);
    console.log(`继承: ${scrollBar.fdfMetadata?.inherits}`);
    console.log(`子控件数: ${scrollBar.children.length}`);
    console.log(`继承子控件IDs: ${scrollBar.fdfMetadata?.inheritedChildrenIds?.length || 0}`);
    
    console.log('\n所有子控件:');
    scrollBar.children.forEach((childId, i) => {
      const child = frames.find(f => f.id === childId);
      if (child) {
        const isInherited = scrollBar.fdfMetadata?.inheritedChildrenIds?.includes(childId);
        console.log(`  ${i + 1}. ${child.name} (${child.type}) - ${isInherited ? '继承' : '自定义'}`);
        console.log(`      父ID: ${child.parentId}`);
        console.log(`      子控件数: ${child.children.length}`);
      }
    });
  }
}

debug().catch(console.error);
