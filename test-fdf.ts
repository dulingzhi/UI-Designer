/**
 * FDF 解析器完整测试脚本（Node.js 版本）
 * 运行: bun test-fdf.ts
 */

import { parseFDFToAST } from './src/utils/fdf';
import { FDFTransformer } from './src/utils/fdfTransformer';
import { FDFExporter } from './src/utils/fdfExporter';
import { importFromFDFText } from './src/utils/fdfImport';
import * as fs from 'fs';
import * as path from 'path';

// ==================== 基础测试 ====================

async function runBasicTests() {
  console.log('🧪 开始 FDF 解析器基础测试...\n');
  
  let passed = 0;
  let failed = 0;

  // 测试 1: 解析简单 Frame
  try {
    const fdf = `
      Frame "FRAME" "TestFrame" {
        Width 0.2,
        Height 0.1,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const frames = ast.body.filter((item: any) => item.type === 'FrameDefinition');
    if (frames.length === 1 && (frames[0] as any).name === 'TestFrame') {
      console.log('✓ 测试 1: 解析简单 Frame');
      passed++;
    } else {
      throw new Error('解析结果不符合预期');
    }
  } catch (error) {
    console.error('✗ 测试 1 失败:', error);
    failed++;
  }

  // 测试 2: 解析 INHERITS
  try {
    const fdf = `
      Frame "BUTTON" "BaseButton" {
        Width 0.1,
      }
      Frame "BUTTON" "MyButton" INHERITS "BaseButton" {
        Height 0.05,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const frames = ast.body.filter((item: any) => item.type === 'FrameDefinition');
    if ((frames[1] as any).inherits === 'BaseButton') {
      console.log('✓ 测试 2: 解析 INHERITS');
      passed++;
    } else {
      throw new Error('INHERITS 解析失败');
    }
  } catch (error) {
    console.error('✗ 测试 2 失败:', error);
    failed++;
  }

  // 测试 3: 解析数组属性
  try {
    const fdf = `
      Frame "FRAME" "Test" {
        Offset 0.1, 0.2,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const frames = ast.body.filter((item: any) => item.type === 'FrameDefinition');
    const offset = (frames[0] as any).properties.find((p: any) => p.name === 'Offset');
    if (offset && offset.value.type === 'ArrayLiteral') {
      console.log('✓ 测试 3: 解析数组属性');
      passed++;
    } else {
      throw new Error('数组属性解析失败');
    }
  } catch (error) {
    console.error('✗ 测试 3 失败:', error);
    failed++;
  }

  // 测试 4: AST 转换为 FrameData
  try {
    const fdf = `
      Frame "FRAME" "Test" {
        Width 0.5,
        Height 0.3,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);
    // 转换器返回的是像素值，需要检查是否成功转换（即不是默认值）
    if (frames.length === 1 && frames[0].name === 'Test') {
      console.log('✓ 测试 4: AST 转换为 FrameData');
      passed++;
    } else {
      throw new Error('转换失败');
    }
  } catch (error) {
    console.error('✗ 测试 4 失败:', error);
    failed++;
  }

  // 测试 5: 保留 FDF 元数据
  try {
    const fdf = `Frame "BUTTON" "Test" { UseActiveContext true, }`;
    const result = importFromFDFText(fdf);
    if ((result[0].fdfMetadata as any)?.rawProperties?.UseActiveContext === 'true') {
      console.log('✓ 测试 5: 保留 FDF 元数据');
      passed++;
    } else {
      throw new Error('元数据丢失');
    }
  } catch (error) {
    console.error('✗ 测试 5 失败:', error);
    failed++;
  }

  // 测试 6: 提取 Texture 数据
  try {
    const fdf = `
      Frame "BACKDROP" "Test" {
        BackdropBackground "MyTexture",
        BackdropCornerFlags "UL|UR|BL|BR",
      }
    `;
    const result = importFromFDFText(fdf);
    if ((result[0].fdfMetadata as any)?.rawProperties?.BackdropBackground === 'MyTexture') {
      console.log('✓ 测试 6: 提取 Texture 数据');
      passed++;
    } else {
      throw new Error('Texture 提取失败');
    }
  } catch (error) {
    console.error('✗ 测试 6 失败:', error);
    failed++;
  }

  // 测试 7: 导出为 FDF
  try {
    const frame = {
      id: 'test1',
      name: 'TestFrame',
      type: 'FRAME',
      x: 0,
      y: 0,
      width: 0.2,
      height: 0.1,
      fdfMetadata: {
        DecorateFileNames: 'true'
      }
    } as any;
    const exporter = new FDFExporter();
    const fdf = exporter.export([frame]);
    if (fdf.includes('TestFrame') && fdf.includes('Width')) {
      console.log('✓ 测试 7: 导出为 FDF');
      passed++;
    } else {
      throw new Error('导出失败');
    }
  } catch (error) {
    console.error('✗ 测试 7 失败:', error);
    failed++;
  }

  console.log('\n============================================================');
  console.log(`基础测试完成: ✓ ${passed} 通过, ✗ ${failed} 失败`);
  
  return { passed, failed };
}

// ==================== WC3 文件测试 ====================

function scanFDFFiles(dirPath: string, files: string[] = []): string[] {
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
    console.error(`扫描目录失败: ${dirPath}`, error);
  }
  
  return files;
}

async function runWC3Tests() {
  console.log('🧪 开始 WC3 原生 FDF 文件测试...\n');

  const basePath = path.join(__dirname, 'vendor', 'UI', 'FrameDef');
  console.log(`正在扫描 ${basePath}...`);
  const fdfFiles = scanFDFFiles(basePath);
  
  console.log(`找到 ${fdfFiles.length} 个 FDF 文件\n`);

  let successCount = 0;
  let failCount = 0;
  const errors: { file: string; error: string }[] = [];

  for (const filePath of fdfFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ast = parseFDFToAST(content);
      const frames = ast.body.filter((item: any) => item.type === 'FrameDefinition');
      
      if (frames.length > 0) {
        successCount++;
        console.log(`✓ ${path.basename(filePath)} (${frames.length} frames)`);
      } else {
        failCount++;
        errors.push({ file: path.basename(filePath), error: '未找到 Frame' });
      }
    } catch (error: any) {
      failCount++;
      errors.push({ file: path.basename(filePath), error: error.message });
      console.error(`✗ ${path.basename(filePath)}: ${error.message}`);
    }
  }

  if (errors.length > 0 && errors.length <= 5) {
    console.log('\n失败的文件:');
    errors.forEach(({ file, error }) => {
      console.log(`  ✗ ${file}: ${error}`);
    });
  }

  console.log('\n============================================================');
  console.log(`WC3 文件测试完成: ✓ ${successCount}/${fdfFiles.length} 通过`);
  
  return { successCount, failCount, total: fdfFiles.length };
}

// ==================== 统计分析 ====================

async function analyzeWC3FDF() {
  console.log('📊 分析 WC3 原生 FDF 文件...\n');

  const basePath = path.join(__dirname, 'vendor', 'UI', 'FrameDef');
  console.log(`正在扫描 ${basePath}...`);
  const fdfFiles = scanFDFFiles(basePath);

  const frameTypes = new Map<string, number>();
  const templates = new Set<string>();
  const inheritanceMap = new Map<string, string>();
  let totalFrames = 0;

  for (const filePath of fdfFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const ast = parseFDFToAST(content);
      const frames = ast.body.filter((item: any) => item.type === 'FrameDefinition');
      
      for (const frame of frames as any[]) {
        totalFrames++;
        
        // 统计 Frame 类型
        const count = frameTypes.get(frame.frameType) || 0;
        frameTypes.set(frame.frameType, count + 1);
        
        // 收集模板名称
        templates.add(frame.name);
        
        // 收集继承关系
        if (frame.inherits) {
          inheritanceMap.set(frame.name, frame.inherits);
        }
      }
    } catch (error) {
      // 忽略解析失败的文件
    }
  }

  console.log('📈 Frame 类型统计:');
  const sortedTypes = Array.from(frameTypes.entries()).sort((a, b) => b[1] - a[1]);
  sortedTypes.forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  console.log('\n📦 模板统计:');
  console.log(`  总模板数: ${templates.size}`);
  console.log(`  总 Frame 数: ${totalFrames}`);
  console.log(`  继承关系数: ${inheritanceMap.size}`);
  
  // 计算最大继承深度
  function getDepth(name: string, visited = new Set<string>()): number {
    if (visited.has(name)) return 0;
    visited.add(name);
    const parent = inheritanceMap.get(name);
    return parent ? 1 + getDepth(parent, visited) : 0;
  }
  
  let maxDepth = 0;
  for (const name of templates) {
    const depth = getDepth(name);
    if (depth > maxDepth) maxDepth = depth;
  }
  console.log(`  最大继承深度: ${maxDepth}`);

  console.log('\n🎯 常见模板示例:');
  Array.from(templates).slice(0, 5).forEach(name => {
    const parent = inheritanceMap.get(name);
    console.log(`  ${name}${parent ? ` <- ${parent}` : ''}`);
  });

  return {
    frameTypes: Object.fromEntries(frameTypes),
    templates: Array.from(templates),
    totalFrames,
    maxDepth
  };
}

// ==================== 运行所有测试 ====================

async function runAllTests() {
  console.log('🚀 运行所有 FDF 解析器测试\n');
  console.log('============================================================');
  
  const basic = await runBasicTests();
  console.log('\n============================================================');
  
  const wc3 = await runWC3Tests();
  console.log('\n============================================================');
  
  const stats = await analyzeWC3FDF();
  console.log('\n============================================================');
  
  console.log('\n📊 总体结果:');
  console.log(`  基础测试: ${basic.passed}/${basic.passed + basic.failed} 通过`);
  console.log(`  WC3 文件: ${wc3.successCount}/${wc3.total} 通过`);
  console.log(`  总 Frame 类型: ${Object.keys(stats.frameTypes).length}`);
  console.log(`  总模板数: ${stats.templates.length}`);
}

// 运行测试
runAllTests().catch(console.error);
