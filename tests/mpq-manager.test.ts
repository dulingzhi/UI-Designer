/**
 * MPQ 管理器测试
 * 
 * 测试 Warcraft 3 MPQ 档案的加载和文件读取功能
 */

import { MPQManager } from '../src/utils/mpqManager';

/**
 * 测试 MPQ 管理器
 */
async function testMPQManager() {
  console.log('='.repeat(60));
  console.log('MPQ 管理器功能测试');
  console.log('='.repeat(60));
  
  const manager = new MPQManager();
  
  // 测试1: 设置路径 (需要手动指定有效的 War3 路径)
  console.log('\n[测试1] 设置 Warcraft 3 路径');
  
  // 常见的 War3 安装路径
  const possiblePaths = [
    'C:\\Program Files (x86)\\Warcraft III',
    'C:\\Program Files\\Warcraft III',
    'D:\\Warcraft III',
    'D:\\Games\\Warcraft III',
  ];
  
  let war3Path: string | null = null;
  
  for (const path of possiblePaths) {
    try {
      await manager.setWar3Path(path);
      war3Path = path;
      console.log(`✓ 找到 War3 路径: ${path}`);
      break;
    } catch (error) {
      console.log(`✗ 路径无效: ${path}`);
    }
  }
  
  if (!war3Path) {
    console.error('\n✗ 未找到 Warcraft 3 安装路径');
    console.log('请手动设置 war3Path 变量后重试');
    return;
  }
  
  // 测试2: 加载 MPQ 档案
  console.log('\n[测试2] 加载标准 MPQ 档案');
  
  try {
    const result = await manager.loadStandardArchives();
    console.log(`✓ 加载完成: ${result.success} 成功, ${result.failed} 失败`);
    
    const status = manager.getStatus();
    console.log(`  - 总文件数: ${status.totalFiles}`);
    
    status.archives.forEach(archive => {
      const icon = archive.loaded ? '✓' : '✗';
      console.log(`  ${icon} ${archive.name}: ${archive.fileCount} 个文件`);
      if (archive.error) {
        console.log(`      错误: ${archive.error}`);
      }
    });
    
  } catch (error: any) {
    console.error('✗ 加载失败:', error.message);
    return;
  }
  
  // 测试3: 读取特定文件
  console.log('\n[测试3] 读取 UI 纹理文件');
  
  const testFiles = [
    'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
    'UI\\Widgets\\Console\\Human\\CommandButton-Up.blp',
    'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp',
  ];
  
  for (const filePath of testFiles) {
    try {
      const buffer = await manager.readFile(filePath);
      
      if (buffer) {
        console.log(`✓ ${filePath}`);
        console.log(`  大小: ${buffer.byteLength} 字节`);
      } else {
        console.log(`✗ ${filePath} - 未找到`);
      }
    } catch (error: any) {
      console.log(`✗ ${filePath} - 读取失败: ${error.message}`);
    }
  }
  
  // 测试4: 搜索 BLP 文件
  console.log('\n[测试4] 搜索 BLP 文件');
  
  const blpFiles = manager.searchFiles('UI\\Widgets\\EscMenu\\*.blp');
  console.log(`找到 ${blpFiles.length} 个 EscMenu BLP 文件:`);
  
  blpFiles.slice(0, 10).forEach(file => {
    console.log(`  - ${file.fileName} (${file.archiveName})`);
  });
  
  if (blpFiles.length > 10) {
    console.log(`  ... 还有 ${blpFiles.length - 10} 个文件`);
  }
  
  // 测试5: 列出目录
  console.log('\n[测试5] 列出 UI\\Widgets 目录');
  
  const widgetFiles = manager.listDirectory('UI\\Widgets');
  console.log(`找到 ${widgetFiles.length} 个文件`);
  
  // 按文件名分组
  const byExtension: Record<string, number> = {};
  widgetFiles.forEach(file => {
    const ext = file.fileName.split('.').pop()?.toLowerCase() || 'unknown';
    byExtension[ext] = (byExtension[ext] || 0) + 1;
  });
  
  console.log('文件类型统计:');
  Object.entries(byExtension).forEach(([ext, count]) => {
    console.log(`  .${ext}: ${count} 个`);
  });
  
  // 测试6: 导出文件列表
  console.log('\n[测试6] 导出文件列表');
  
  const fileList = manager.exportFileList();
  const lineCount = fileList.split('\n').length;
  console.log(`文件列表已生成 (${lineCount} 行)`);
  
  // 保存到文件 (可选)
  // await writeTextFile('mpq_files.txt', fileList);
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

/**
 * 性能测试
 */
async function performanceTest() {
  console.log('\n' + '='.repeat(60));
  console.log('性能测试');
  console.log('='.repeat(60));
  
  const manager = new MPQManager();
  
  // 假设已经加载了档案
  // await manager.setWar3Path('...');
  // await manager.loadStandardArchives();
  
  // 测试文件读取性能
  const testFile = 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp';
  
  const iterations = 100;
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    await manager.readFile(testFile);
  }
  
  const endTime = performance.now();
  const avgTime = (endTime - startTime) / iterations;
  
  console.log(`读取文件 ${iterations} 次:`);
  console.log(`  平均耗时: ${avgTime.toFixed(2)}ms`);
}

// 运行测试
testMPQManager().catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
