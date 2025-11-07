/**
 * 调试FDF导出 - 查看具体的Frame差异
 */

import { parseFDFWithIncludes } from '../src/utils/fdfIncludeResolver';
import { exportToFDF } from '../src/utils/fdfExport';
import * as fs from 'fs';
import * as path from 'path';

async function debugExport() {
  console.log('========================================');
  console.log('   调试 FDF 导出');
  console.log('========================================\n');

  // 测试一个失败的文件 - BattleNetProfilePanel.fdf (159 → 64)
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

  // 第一次解析
  console.log('第一次解析...');
  const parsed1 = parseFDFWithIncludes(content, { basePath });
  const frames1 = parsed1.frames.filter(f => !f.fdfMetadata?.isTemplate);
  
  console.log(`解析到 ${frames1.length} 个Frame（排除模板）`);
  console.log(`模板数量: ${parsed1.templateRegistry.size}`);
  
  console.log('\n顶层Frame:');
  frames1.filter(f => !f.parentId).forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name} (${f.children.length} 个子控件)`);
    if (f.fdfMetadata?.inherits) {
      console.log(`     继承: ${f.fdfMetadata.inherits}`);
      if (f.fdfMetadata.inheritedChildrenIds) {
        console.log(`     继承子控件: ${f.fdfMetadata.inheritedChildrenIds.length} 个`);
      }
    }
  });

  // 导出
  console.log('\n导出FDF...');
  const exported = exportToFDF(frames1);
  
  // 保存导出结果用于检查
  const outputPath = path.join(process.cwd(), 'tests', 'debug-export-output.fdf');
  fs.writeFileSync(outputPath, exported, 'utf-8');
  console.log(`导出文件已保存: ${outputPath}`);
  
  console.log('\n导出的FDF前30行:');
  const lines = exported.split('\n').slice(0, 30);
  lines.forEach((line, i) => {
    console.log(`${(i + 1).toString().padStart(3)}: ${line}`);
  });

  // 第二次解析（使用相同的模板注册表）
  console.log('\n\n第二次解析...');
  const parsed2 = parseFDFWithIncludes(exported, { 
    basePath,
    existingTemplateRegistry: parsed1.templateRegistry 
  });
  const frames2 = parsed2.frames.filter(f => !f.fdfMetadata?.isTemplate);
  
  console.log(`解析到 ${frames2.length} 个Frame（排除模板）`);
  
  console.log('\n顶层Frame:');
  frames2.filter(f => !f.parentId).forEach((f, i) => {
    console.log(`  ${i + 1}. ${f.name} (${f.children.length} 个子控件)`);
  });

  // 比较
  console.log('\n========================================');
  console.log('   比较结果');
  console.log('========================================');
  
  console.log(`\nFrame数量: ${frames1.length} → ${frames2.length}`);
  
  if (frames1.length !== frames2.length) {
    console.log('\n❌ Frame数量不匹配!');
    
    // 找出缺失的Frame
    const names1 = new Set(frames1.map(f => f.name));
    const names2 = new Set(frames2.map(f => f.name));
    
    const missing = frames1.filter(f => !names2.has(f.name));
    const extra = frames2.filter(f => !names1.has(f.name));
    
    if (missing.length > 0) {
      console.log(`\n缺失的Frame (${missing.length}):`);
      missing.forEach(f => {
        console.log(`  - ${f.name} (父: ${f.parentId ? frames1.find(p => p.id === f.parentId)?.name : '无'})`);
        if (f.fdfMetadata?.inherits) {
          console.log(`    继承: ${f.fdfMetadata.inherits}`);
        }
      });
    }
    
    if (extra.length > 0) {
      console.log(`\n多余的Frame (${extra.length}):`);
      extra.forEach(f => {
        console.log(`  - ${f.name}`);
      });
    }
  } else {
    console.log('\n✓ Frame数量一致');
  }

  console.log('\n========================================');
  console.log('调试完成！');
  console.log('========================================');
}

debugExport().catch(console.error);
