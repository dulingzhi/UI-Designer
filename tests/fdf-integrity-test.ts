/**
 * FDF 完整性验证测试
 * 
 * 测试官方 FDF 文件的导入和导出功能
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parseFDF, exportFDF } from '../src/utils/fdf';

const VENDOR_DIR = join(__dirname, '..', 'vendor', 'UI', 'FrameDef', 'UI');

// 测试文件列表
const TEST_FILES = [
  'ConsoleUI.fdf',
  'EscMenuMainPanel.fdf',
  'InfoPanelUnitDetail.fdf',
  'ResourceBar.fdf',
];

console.log('========================================');
console.log('FDF 完整性验证测试');
console.log('========================================\n');

let passedTests = 0;
let failedTests = 0;

for (const fileName of TEST_FILES) {
  const filePath = join(VENDOR_DIR, fileName);
  
  console.log(`测试文件: ${fileName}`);
  console.log('----------------------------------------');
  
  try {
    // 1. 读取原始 FDF
    const originalFDF = readFileSync(filePath, 'utf-8');
    console.log(`✓ 读取成功 (${originalFDF.length} 字符)`);
    
    // 2. 解析为 FrameData
    const frames = parseFDF(originalFDF, {
      baseWidth: 800,
      baseHeight: 600,
    });
    console.log(`✓ 解析成功 (${frames.length} 个 Frame)`);
    
    // 打印 Frame 统计
    const frameTypes = frames.reduce((acc, frame) => {
      const typeName = getFrameTypeName(frame.type);
      acc[typeName] = (acc[typeName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('  Frame 类型统计:');
    for (const [type, count] of Object.entries(frameTypes)) {
      console.log(`    - ${type}: ${count}`);
    }
    
    // 3. 导出为 FDF
    const exportedFDF = exportFDF(frames, {
      indent: '\t',
      includeComments: false,
      baseWidth: 800,
      baseHeight: 600,
    });
    console.log(`✓ 导出成功 (${exportedFDF.length} 字符)`);
    
    // 4. 保存导出结果（用于手动检查）
    const outputPath = join(__dirname, `exported_${fileName}`);
    writeFileSync(outputPath, exportedFDF, 'utf-8');
    console.log(`✓ 保存到: ${outputPath}`);
    
    // 5. 再次解析导出的 FDF（往返测试）
    const reImportedFrames = parseFDF(exportedFDF, {
      baseWidth: 800,
      baseHeight: 600,
    });
    console.log(`✓ 往返测试成功 (${reImportedFrames.length} 个 Frame)`);
    
    // 6. 验证 Frame 数量一致
    if (frames.length === reImportedFrames.length) {
      console.log(`✓ Frame 数量一致: ${frames.length}`);
    } else {
      console.log(`✗ Frame 数量不一致: 原始 ${frames.length}, 重新导入 ${reImportedFrames.length}`);
      failedTests++;
      continue;
    }
    
    // 7. 验证关键属性
    let propertyErrors = 0;
    for (let i = 0; i < frames.length; i++) {
      const original = frames[i];
      const reImported = reImportedFrames[i];
      
      // 验证名称
      if (original.name !== reImported.name) {
        console.log(`  ✗ Frame ${i}: 名称不匹配 (${original.name} vs ${reImported.name})`);
        propertyErrors++;
      }
      
      // 验证类型
      if (original.type !== reImported.type) {
        console.log(`  ✗ Frame ${i}: 类型不匹配 (${original.type} vs ${reImported.type})`);
        propertyErrors++;
      }
      
      // 验证尺寸（允许小误差）
      if (original.width && reImported.width) {
        const widthDiff = Math.abs(original.width - reImported.width);
        if (widthDiff > 0.001) {
          console.log(`  ✗ Frame ${i}: 宽度差异过大 (${widthDiff})`);
          propertyErrors++;
        }
      }
      
      if (original.height && reImported.height) {
        const heightDiff = Math.abs(original.height - reImported.height);
        if (heightDiff > 0.001) {
          console.log(`  ✗ Frame ${i}: 高度差异过大 (${heightDiff})`);
          propertyErrors++;
        }
      }
    }
    
    if (propertyErrors === 0) {
      console.log(`✓ 属性验证通过`);
      passedTests++;
    } else {
      console.log(`✗ 发现 ${propertyErrors} 个属性错误`);
      failedTests++;
    }
    
  } catch (error) {
    console.log(`✗ 测试失败: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.log(error.stack);
    }
    failedTests++;
  }
  
  console.log('');
}

console.log('========================================');
console.log('测试总结');
console.log('========================================');
console.log(`通过: ${passedTests}`);
console.log(`失败: ${failedTests}`);
console.log(`总计: ${passedTests + failedTests}`);
console.log(`成功率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n✅ 所有测试通过！FDF 解析和生成系统工作正常。');
  process.exit(0);
} else {
  console.log(`\n⚠️ 有 ${failedTests} 个测试失败，请检查错误信息。`);
  process.exit(1);
}

// 辅助函数：获取 Frame 类型名称
function getFrameTypeName(type: number): string {
  const typeNames: Record<number, string> = {
    0: 'ORIGIN',
    1: 'BACKDROP',
    2: 'BUTTON',
    3: 'BROWSER_BUTTON',
    4: 'SCRIPT_DIALOG_BUTTON',
    5: 'CHECKLIST_BOX',
    6: 'ESC_MENU_BACKDROP',
    7: 'OPTIONS_POPUP_MENU_BACKDROP_TEMPLATE',
    8: 'QUEST_BUTTON_BASE_TEMPLATE',
    9: 'QUEST_BUTTON_DISABLED_BACKDROP_TEMPLATE',
    10: 'QUEST_BUTTON_PUSHED_BACKDROP_TEMPLATE',
    11: 'CHECKBOX',
    12: 'INVIS_BUTTON',
    13: 'TEXT_FRAME',
    14: 'HORIZONTAL_BAR',
    15: 'HOR_BAR_BACKGROUND',
    16: 'HOR_BAR_TEXT',
    17: 'HOR_BAR_BACKGROUND_TEXT',
    18: 'HORIZONTAL_BAR_TEMPLATE',
    19: 'EDITBOX',
    20: 'SLIDER',
    21: 'TEXTAREA',
  };
  
  return typeNames[type] || `UNKNOWN(${type})`;
}
