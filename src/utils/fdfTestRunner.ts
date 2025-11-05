/**
 * FDF 解析器测试工具
 * 
 * 在浏览器控制台运行：
 * 1. 导入此文件
 * 2. 运行 runBasicTests() 或 runWC3Tests()
 */

import { parseFDFToAST } from '../utils/fdf';
import { FDFTransformer } from '../utils/fdfTransformer';
import { FDFExporter } from '../utils/fdfExporter';
import { importFromFDFText } from '../utils/fdfImport';
import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { resolveResource, join } from '@tauri-apps/api/path';

// ==================== 基础测试 ====================

export async function runBasicTests() {
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
    console.assert(ast.type === 'Program', '✗ AST 类型应为 Program');
    console.assert(ast.body.length === 1, '✗ 应包含 1 个节点');
    console.log('✓ 测试 1: 解析简单 Frame');
    passed++;
  } catch (error) {
    console.error('✗ 测试 1 失败:', error);
    failed++;
  }

  // 测试 2: 解析 INHERITS
  try {
    const fdf = `
      Frame "BUTTON" "MyButton" INHERITS "ButtonTemplate" {
        Width 0.3,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const frame = ast.body[0];
    if (frame.type === 'FrameDefinition') {
      console.assert(frame.inherits === 'ButtonTemplate', '✗ INHERITS 应为 ButtonTemplate');
      console.log('✓ 测试 2: 解析 INHERITS');
      passed++;
    } else {
      throw new Error('节点类型不是 FrameDefinition');
    }
  } catch (error) {
    console.error('✗ 测试 2 失败:', error);
    failed++;
  }

  // 测试 3: 解析数组属性
  try {
    const fdf = `
      Frame "TEXT" "TestText" {
        SetTexCoord 0.0, 1.0, 0.0, 1.0,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const frame = ast.body[0];
    if (frame.type === 'FrameDefinition') {
      const prop = frame.properties.find((p: any) => p.type === 'Property' && p.name === 'SetTexCoord');
      console.assert(!!prop, '✗ 应找到 SetTexCoord 属性');
      console.assert(prop && (prop as any).value && (prop as any).value.type === 'ArrayLiteral', '✗ 应为 ArrayLiteral');
      console.log('✓ 测试 3: 解析数组属性');
      passed++;
    } else {
      throw new Error('节点类型不是 FrameDefinition');
    }
  } catch (error) {
    console.error('✗ 测试 3 失败:', error);
    failed++;
  }

  // 测试 4: AST 转换为 FrameData
  try {
    const fdf = `
      Frame "BUTTON" "MyButton" {
        Width 0.2,
        Height 0.05,
      }
    `;
    const ast = parseFDFToAST(fdf);
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);
    
    console.assert(frames.length === 1, '✗ 应转换为 1 个 FrameData');
    console.assert(frames[0].name === 'MyButton', '✗ 名称应为 MyButton');
    console.log('✓ 测试 4: AST 转换为 FrameData');
    passed++;
  } catch (error) {
    console.error('✗ 测试 4 失败:', error);
    failed++;
  }

  // 测试 5: 保留 FDF 元数据
  try {
    const fdf = `
      Frame "BUTTON" "MyButton" INHERITS "ButtonTemplate" {
        Width 0.2,
      }
    `;
    const frames = importFromFDFText(fdf);
    
    console.assert(frames.length === 1, '✗ 应导入 1 个控件');
    console.assert(!!frames[0].fdfMetadata, '✗ 应包含 FDF 元数据');
    console.assert(frames[0].fdfMetadata?.inherits === 'ButtonTemplate', '✗ INHERITS 应为 ButtonTemplate');
    console.log('✓ 测试 5: 保留 FDF 元数据');
    passed++;
  } catch (error) {
    console.error('✗ 测试 5 失败:', error);
    failed++;
  }

  // 测试 6: 提取 Texture 数据
  try {
    const fdf = `
      Frame "BACKDROP" "MyBackdrop" {
        SetTexture "TeamColor00.blp",
        SetTexCoord 0.0, 1.0, 0.0, 1.0,
        SetAlphaMode "BLEND",
      }
    `;
    const frames = importFromFDFText(fdf);
    
    console.assert(!!frames[0].fdfTexture, '✗ 应包含 Texture 数据');
    console.assert(frames[0].fdfTexture?.file.includes('TeamColor00.blp'), '✗ 文件名不匹配');
    console.assert(frames[0].fdfTexture?.alphaMode === 'BLEND', '✗ AlphaMode 应为 BLEND');
    console.log('✓ 测试 6: 提取 Texture 数据');
    passed++;
  } catch (error) {
    console.error('✗ 测试 6 失败:', error);
    failed++;
  }

  // 测试 7: 导出为 FDF
  try {
    const fdf = `Frame "BUTTON" "MyButton" {
  Width 0.2,
  Height 0.05,
}`;
    const ast = parseFDFToAST(fdf);
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);
    
    const exporter = new FDFExporter();
    const exported = exporter.export(frames);
    
    console.assert(exported.includes('Frame'), '✗ 导出应包含 Frame');
    console.assert(exported.includes('MyButton'), '✗ 导出应包含 MyButton');
    console.log('✓ 测试 7: 导出为 FDF');
    passed++;
  } catch (error) {
    console.error('✗ 测试 7 失败:', error);
    failed++;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`基础测试完成: ✓ ${passed} 通过, ✗ ${failed} 失败`);
  return { passed, failed };
}

// ==================== 辅助函数 ====================

// 递归扫描目录获取所有 FDF 文件
async function scanFDFFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const entries = await readDir(dirPath);
    
    for (const entry of entries) {
      const fullPath = `${dirPath}/${entry.name}`;
      
      if (entry.isDirectory) {
        // 递归扫描子目录
        const subFiles = await scanFDFFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile && entry.name.endsWith('.fdf')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`扫描目录失败: ${dirPath}`, error);
  }
  
  return files;
}

// ==================== WC3 原生文件测试 ====================

export async function runWC3Tests() {
  console.log('🧪 开始 WC3 原生 FDF 文件测试...\n');

  try {
    // 获取资源目录（src-tauri/target/debug/）然后向上回退到项目根目录
    const resourcePath = await resolveResource('');
    // resourcePath 类似: D:\Projects\W3UIDesigner\Wc3 UI Designer\src-tauri\target\debug
    // 需要回退到: D:\Projects\W3UIDesigner\Wc3 UI Designer
    const projectRoot = resourcePath.replace(/[\\\/]src-tauri[\\\/]target[\\\/](debug|release).*$/, '');
    const basePath = `${projectRoot}/vendor/UI/FrameDef`.replace(/\\/g, '/');
    
    console.log(`正在扫描 ${basePath}...`);
    const fdfFiles = await scanFDFFiles(basePath);
    
    console.log(`找到 ${fdfFiles.length} 个 FDF 文件\n`);

    let successCount = 0;
    let failCount = 0;
    const errors: { file: string; error: string }[] = [];

    // 解析每个文件
    for (const filePath of fdfFiles) {
      const fileName = filePath.split(/[\\/]/).pop() || filePath;
      try {
        const content = await readTextFile(filePath);
        const ast = parseFDFToAST(content);
        
        if (ast.type === 'Program' && ast.body.length > 0) {
          successCount++;
          console.log(`✓ ${fileName} (${ast.body.length} 个定义)`);
        } else {
          throw new Error('解析结果为空');
        }
      } catch (error) {
        failCount++;
        errors.push({
          file: fileName,
          error: error instanceof Error ? error.message : String(error)
        });
        console.error(`✗ ${fileName}:`, error);
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`WC3 文件测试完成: ✓ ${successCount}/${fdfFiles.length} 通过`);
    
    if (errors.length > 0) {
      console.log(`\n失败的文件 (${errors.length}):`);
      errors.slice(0, 10).forEach(e => {
        console.log(`  ${e.file}: ${e.error.substring(0, 50)}...`);
      });
    }

    return { successCount, failCount, total: fdfFiles.length };
  } catch (error) {
    console.error('扫描文件失败:', error);
    throw error;
  }
}

// ==================== 统计分析 ====================

export async function analyzeWC3FDF() {
  console.log('📊 分析 WC3 原生 FDF 文件...\n');

  try {
    // 获取项目根目录
    const resourcePath = await resolveResource('');
    const projectRoot = resourcePath.replace(/[\\\/]src-tauri[\\\/]target[\\\/](debug|release).*$/, '');
    const basePath = `${projectRoot}/vendor/UI/FrameDef`.replace(/\\/g, '/');
    
    console.log(`正在扫描 ${basePath}...`);
    const fdfFiles = await scanFDFFiles(basePath);

    const frameTypes = new Map<string, number>();
    const templates = new Set<string>();
    const inheritanceMap = new Map<string, string>();
    let totalFrames = 0;

    for (const filePath of fdfFiles) {
      try {
        const content = await readTextFile(filePath);
        const ast = parseFDFToAST(content);

        ast.body.forEach((node: any) => {
          if (node.type === 'FrameDefinition') {
            totalFrames++;
            
            // 统计类型
            const count = frameTypes.get(node.frameType) || 0;
            frameTypes.set(node.frameType, count + 1);
            
            // 收集模板
            if (node.name) {
              templates.add(node.name);
            }
            
            // 收集继承关系
            if (node.name && node.inherits) {
              inheritanceMap.set(node.name, node.inherits);
            }
          }
        });
      } catch (error) {
        // 忽略解析失败的文件
      }
    }

    console.log('📈 Frame 类型统计:');
    const sortedTypes = Array.from(frameTypes.entries()).sort((a, b) => b[1] - a[1]);
    sortedTypes.forEach(([type, count]) => {
      console.log(`  ${type.padEnd(20)} ${count}`);
    });

    console.log(`\n📦 模板统计:`);
    console.log(`  总模板数: ${templates.size}`);
    console.log(`  总 Frame 数: ${totalFrames}`);
    console.log(`  继承关系数: ${inheritanceMap.size}`);

    // 计算最大继承深度
    const getDepth = (name: string, visited = new Set<string>()): number => {
      if (visited.has(name)) return 0;
      if (!inheritanceMap.has(name)) return 0;
      visited.add(name);
      const parent = inheritanceMap.get(name)!;
      return 1 + getDepth(parent, visited);
    };

    let maxDepth = 0;
    inheritanceMap.forEach((_parent, child) => {
      const depth = getDepth(child);
      if (depth > maxDepth) maxDepth = depth;
    });

    console.log(`  最大继承深度: ${maxDepth}`);

    // 显示常见模板
    console.log(`\n🎯 常见模板示例:`);
    const commonTemplates = Array.from(templates).slice(0, 20);
    commonTemplates.forEach(name => {
      const inherits = inheritanceMap.get(name);
      console.log(`  ${name}${inherits ? ` → ${inherits}` : ''}`);
    });

    return {
      frameTypes: Object.fromEntries(frameTypes),
      templates: Array.from(templates),
      totalFrames,
      maxDepth,
    };
  } catch (error) {
    console.error('分析失败:', error);
    throw error;
  }
}

// ==================== 主入口 ====================

export async function runAllTests() {
  console.log('🚀 运行所有 FDF 解析器测试\n');
  console.log('='.repeat(60));
  
  const basic = await runBasicTests();
  console.log('\n' + '='.repeat(60));
  
  const wc3 = await runWC3Tests();
  console.log('\n' + '='.repeat(60));
  
  const stats = await analyzeWC3FDF();
  console.log('\n' + '='.repeat(60));
  
  console.log('\n📊 总体结果:');
  console.log(`  基础测试: ${basic.passed}/${basic.passed + basic.failed} 通过`);
  console.log(`  WC3 文件: ${wc3.successCount}/${wc3.total} 通过`);
  console.log(`  总 Frame 类型: ${Object.keys(stats.frameTypes).length}`);
  console.log(`  总模板数: ${stats.templates.length}`);
  
  return { basic, wc3, stats };
}
