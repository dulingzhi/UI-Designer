/**
 * FDF导出功能测试
 */

import fs from 'fs';
import path from 'path';
import { parseFDF } from '../src/utils/fdf';
import { exportToFDF } from '../src/utils/fdfExport';

const TEST_FDF_FILE = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef', 'UI', 'EscMenuMainPanel.fdf');

console.log('🔍 FDF导出功能测试\n');
console.log('='.repeat(80));

// 1. 读取原始FDF
console.log('\n1️⃣  读取原始FDF文件...');
const originalFDF = fs.readFileSync(TEST_FDF_FILE, 'utf-8');
console.log(`   文件大小: ${originalFDF.length} 字符`);

// 2. 解析FDF
console.log('\n2️⃣  解析FDF到FrameData...');
const frames = parseFDF(originalFDF);
console.log(`   解析得到 ${frames.length} 个Frame`);

// 3. 导出回FDF
console.log('\n3️⃣  导出FrameData到FDF格式...');
const exportedFDF = exportToFDF(frames, {
  indent: '    ',
  includeComments: true
});
console.log(`   导出文件大小: ${exportedFDF.length} 字符`);

// 4. 保存导出的FDF
const exportPath = path.join(process.cwd(), 'tests', 'exported_EscMenuMainPanel.fdf');
fs.writeFileSync(exportPath, exportedFDF, 'utf-8');
console.log(`   ✅ 已保存到: ${path.relative(process.cwd(), exportPath)}`);

// 5. 显示前50行
console.log('\n4️⃣  导出的FDF内容预览 (前50行):');
console.log('='.repeat(80));
const lines = exportedFDF.split('\n');
lines.slice(0, 50).forEach((line, index) => {
  console.log(`${(index + 1).toString().padStart(3, ' ')}: ${line}`);
});

if (lines.length > 50) {
  console.log(`... (省略剩余 ${lines.length - 50} 行)`);
}

// 6. 再次解析导出的FDF,验证完整性
console.log('\n5️⃣  验证导出的FDF...');
try {
  const reparsedFrames = parseFDF(exportedFDF);
  console.log(`   ✅ 重新解析成功: ${reparsedFrames.length} 个Frame`);
  
  if (reparsedFrames.length === frames.length) {
    console.log(`   ✅ Frame数量一致: ${frames.length}`);
  } else {
    console.log(`   ⚠️  Frame数量不一致: 原始=${frames.length}, 重新解析=${reparsedFrames.length}`);
  }
  
  // 检查Frame名称
  const originalNames = frames.map(f => f.name).sort();
  const reparsedNames = reparsedFrames.map(f => f.name).sort();
  const missingNames = originalNames.filter(name => !reparsedNames.includes(name));
  const extraNames = reparsedNames.filter(name => !originalNames.includes(name));
  
  if (missingNames.length === 0 && extraNames.length === 0) {
    console.log(`   ✅ Frame名称完全一致`);
  } else {
    if (missingNames.length > 0) {
      console.log(`   ⚠️  缺失的Frame: ${missingNames.join(', ')}`);
    }
    if (extraNames.length > 0) {
      console.log(`   ⚠️  多出的Frame: ${extraNames.join(', ')}`);
    }
  }
  
} catch (error) {
  console.log(`   ❌ 重新解析失败: ${error}`);
}

console.log('\n' + '='.repeat(80));
console.log('✅ FDF导出测试完成!');
console.log('='.repeat(80));
