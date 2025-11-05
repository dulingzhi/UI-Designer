/**
 * FDF 解析器 Node.js 测试脚本
 * 运行: node test-fdf.js
 */

const fs = require('fs');
const path = require('path');

// 导入 FDF 解析器（需要转译 TypeScript）
// 由于是 TypeScript，我们需要先编译或使用 tsx/ts-node

console.log('🚀 FDF 解析器测试\n');
console.log('============================================================');

// 测试 1: 检查 vendor 目录
const vendorPath = path.join(__dirname, 'vendor', 'UI', 'FrameDef');
console.log(`\n📁 检查目录: ${vendorPath}`);

if (!fs.existsSync(vendorPath)) {
  console.error('❌ vendor 目录不存在！');
  process.exit(1);
}

// 递归扫描 FDF 文件
function scanFDFFiles(dirPath, files = []) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        scanFDFFiles(fullPath, files);
      } else if (entry.isFile() && entry.name.endsWith('.fdf')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`❌ 扫描失败: ${error.message}`);
  }
  
  return files;
}

const fdfFiles = scanFDFFiles(vendorPath);
console.log(`✅ 找到 ${fdfFiles.length} 个 FDF 文件\n`);

// 显示文件列表
console.log('📋 文件列表:');
fdfFiles.slice(0, 10).forEach((file, index) => {
  console.log(`  ${index + 1}. ${path.basename(file)}`);
});
if (fdfFiles.length > 10) {
  console.log(`  ... 还有 ${fdfFiles.length - 10} 个文件`);
}

console.log('\n============================================================');
console.log(`\n✅ 扫描成功！共 ${fdfFiles.length} 个 FDF 文件`);
console.log('\n提示: 要运行完整测试，请使用 bun 或 tsx:');
console.log('  bun test-fdf.ts');
console.log('  或');
console.log('  npx tsx test-fdf.ts');
