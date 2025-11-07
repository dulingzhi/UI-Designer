/**
 * 测试 WITHCHILDREN 功能
 */

import { parseFDFWithIncludes } from '../src/utils/fdfIncludeResolver';
import * as fs from 'fs';
import * as path from 'path';

async function testWithChildren() {
  console.log('========================================');
  console.log('   测试 WITHCHILDREN 功能');
  console.log('========================================\n');

  // 测试文件：BattleNetProfilePanel.fdf (包含 INHERITS WITHCHILDREN)
  const testFilePath = path.join(
    process.cwd(),
    'target',
    'vendor',
    'UI',
    'FrameDef',
    'Glue',
    'BattleNetProfilePanel.fdf'
  );

  if (!fs.existsSync(testFilePath)) {
    console.error(`测试文件不存在: ${testFilePath}`);
    return;
  }

  console.log(`测试文件: ${testFilePath}\n`);

  // 读取文件
  const content = fs.readFileSync(testFilePath, 'utf-8');

  // 解析（启用 Include 解析）
  const basePath = path.join(process.cwd(), 'target', 'vendor');
  const result = parseFDFWithIncludes(content, { basePath });

  console.log(`\n模板注册表: ${result.templateRegistry.size} 个模板`);

  // 查找使用 WITHCHILDREN 的 Frame（包括嵌套）
  console.log('\n使用 WITHCHILDREN 的 Frame:');
  console.log('========================================');
  
  let foundCount = 0;
  
  result.frames.forEach((frame, index) => {
    if (frame.fdfMetadata?.inheritedChildrenIds && frame.fdfMetadata.inheritedChildrenIds.length > 0) {
      foundCount++;
      const template = result.templateRegistry.get(frame.fdfMetadata.inherits || '');
      
      console.log(`\n[${foundCount}] ${frame.name}`);
      console.log(`  继承自: ${frame.fdfMetadata.inherits} (WITHCHILDREN)`);
      console.log(`  模板子控件: ${template?.children.length || 0} 个`);
      console.log(`  继承的子控件ID: ${frame.fdfMetadata.inheritedChildrenIds.length} 个（只读）`);
      console.log(`  总子控件: ${frame.children.length} 个`);
      console.log(`  自定义子控件: ${frame.children.length - frame.fdfMetadata.inheritedChildrenIds.length} 个`);
      
      // 显示子控件列表
      if (frame.children.length > 0 && foundCount <= 3) {
        console.log(`\n  所有子控件 (${frame.children.length}):`);
        frame.children.forEach((childId, i) => {
          const child = result.frames.find(f => f.id === childId);
          if (child) {
            const isInherited = frame.fdfMetadata?.inheritedChildrenIds?.includes(childId) || false;
            const tag = isInherited ? ' [继承-只读]' : ' [自定义-可编辑]';
            console.log(`    ${i + 1}. ${child.name}${tag}`);
          }
        });
      }
    }
  });
  
  if (foundCount === 0) {
    console.log('\n未找到使用 WITHCHILDREN 的 Frame');
    console.log('可能原因:');
    console.log('  1. withChildren 标记未正确传递到 FrameData');
    console.log('  2. 模板中没有子控件');
    console.log('  3. WITHCHILDREN 解析有问题');
    
    // 调试: 显示一些Frame的元数据
    console.log('\n调试信息 - 前5个Frame的继承状态:');
    result.frames.slice(0, 5).forEach((f, i) => {
      console.log(`  [${i + 1}] ${f.name}`);
      console.log(`      继承: ${f.fdfMetadata?.inherits || '无'}`);
      console.log(`      子控件: ${f.children.length} 个`);
      console.log(`      继承ID列表: ${f.fdfMetadata?.inheritedChildrenIds?.join(', ') || '无'}`);
    });
  } else {
    console.log(`\n找到 ${foundCount} 个使用 WITHCHILDREN 的 Frame`);
  }

  console.log('\n========================================');
  console.log('测试完成！');
  console.log('========================================');
}

testWithChildren().catch(console.error);
