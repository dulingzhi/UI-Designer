/**
 * 测试 FDF Include 和 INHERITS 功能
 */

import { parseFDFWithIncludes } from '../src/utils/fdfIncludeResolver';
import * as fs from 'fs';
import * as path from 'path';

async function testIncludeAndInherits() {
  console.log('========================================');
  console.log('   测试 Include 和 INHERITS 功能');
  console.log('========================================\n');

  // 测试文件：AdvancedOptionsDisplay.fdf
  const testFilePath = path.join(
    process.cwd(),
    'target',
    'vendor',
    'UI',
    'FrameDef',
    'Glue',
    'AdvancedOptionsDisplay.fdf'
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

  console.log(`\n模板注册表 (${result.templateRegistry.size} 个模板):`);
  console.log('----------------------------------------');
  
  // 显示前10个模板
  let count = 0;
  for (const [name, template] of result.templateRegistry) {
    if (count >= 10) {
      console.log(`... 还有 ${result.templateRegistry.size - 10} 个模板`);
      break;
    }
    console.log(`  ${name} (${template.type}, ${template.children.length} 个子控件)`);
    count++;
  }

  console.log('\n解析的 Frame:');
  console.log('----------------------------------------');
  
  result.frames.forEach((frame, index) => {
    console.log(`\n[${index + 1}] ${frame.name} (类型: ${frame.type})`);
    
    if (frame.fdfMetadata?.inherits) {
      console.log(`  继承自: ${frame.fdfMetadata.inherits}`);
      
      // 检查模板是否存在
      const template = result.templateRegistry.get(frame.fdfMetadata.inherits);
      if (template) {
        console.log(`  ✓ 模板已加载`);
        console.log(`    - 模板子控件数: ${template.children.length}`);
        
        if (frame.fdfMetadata.inheritedChildrenIds) {
          console.log(`    - 继承的子控件: ${frame.fdfMetadata.inheritedChildrenIds.length} 个（只读）`);
        }
      } else {
        console.log(`  ✗ 模板未找到!`);
      }
    }
    
    if (frame.children.length > 0) {
      console.log(`  子控件 (${frame.children.length}):`);
      frame.children.forEach((childId, i) => {
        const child = result.frames.find(f => f.id === childId);
        if (child) {
          const isInherited = frame.fdfMetadata?.inheritedChildrenIds?.includes(childId);
          const readonlyTag = isInherited ? ' [只读]' : '';
          console.log(`    ${i + 1}. ${child.name}${readonlyTag}`);
          
          if (child.fdfMetadata?.inherits) {
            console.log(`       继承自: ${child.fdfMetadata.inherits}`);
          }
        }
      });
    }
  });

  console.log('\n========================================');
  console.log('测试完成！');
  console.log('========================================');
}

testIncludeAndInherits().catch(console.error);
