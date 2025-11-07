/**
 * 测试FDF文件的解析和导出是否完全正确
 * 验证：解析 -> 导出 -> 再解析，数据是否一致
 */

import * as fs from 'fs';
import * as path from 'path';
import { FDFLexer } from '../src/utils/fdfLexer';
import { FDFParser } from '../src/utils/fdfParser';
import { FDFTransformer } from '../src/utils/fdfTransformer';
import { exportToFDF } from '../src/utils/fdfExport';
import type { FrameData } from '../src/types';

// 测试单个Frame定义
function testSingleFrame() {
  console.log('=== 测试 InventoryMainPanel 解析 ===\n');
  
  const fdfContent = `
Frame "BACKDROP" "InventoryMainPanel" {
    Width 0.340,
    Height 0.380,
    
    SetPoint CENTER, "UIParent", CENTER, 0.0, 0.05,
    
    BackdropTileBackground,
    BackdropBackground "QuestDialogBackground",
    BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R",
    BackdropCornerSize 0.032,
    BackdropBackgroundSize 0.256,
    BackdropBackgroundInsets 0.006 0.006 0.006 0.006,
    BackdropEdgeFile "QuestDialogBorder",
    BackdropBlendAll,
}
`;

  console.log('原始FDF内容:');
  console.log(fdfContent);
  console.log('\n--- 步骤1: 词法分析 ---\n');
  
  // 词法分析
  const lexer = new FDFLexer(fdfContent);
  const tokens = lexer.tokenize();
  
  console.log(`Token数量: ${tokens.length}`);
  console.log('前20个Token:');
  tokens.slice(0, 20).forEach((token, i) => {
    console.log(`  ${i}: ${token.type.padEnd(15)} = "${token.value}"`);
  });
  
  console.log('\n--- 步骤2: 语法分析 ---\n');
  
  // 语法分析
  const parser = new FDFParser(tokens);
  const ast = parser.parse();
  
  console.log(`AST节点数: ${ast.body.length}`);
  if (ast.body.length > 0) {
    const frame = ast.body[0];
    console.log(`Frame类型: ${JSON.stringify(frame, null, 2)}`);
  }
  
  console.log('\n--- 步骤3: 转换为内部数据结构 ---\n');
  
  // 转换
  const transformer = new FDFTransformer();
  const frames = transformer.transform(ast);
  
  console.log(`转换后Frame数量: ${frames.length}`);
  if (frames.length > 0) {
    const frame = frames[0];
    console.log('\n转换后的Frame数据:');
    console.log(JSON.stringify(frame, null, 2));
    
    // 检查关键属性
    console.log('\n--- 关键属性检查 ---\n');
    console.log(`名称: ${frame.name}`);
    console.log(`类型: ${frame.type}`);
    console.log(`宽度: ${frame.width}`);
    console.log(`高度: ${frame.height}`);
    console.log(`背景纹理 (wc3): ${frame.backWc3Texture}`);
    console.log(`背景纹理 (disk): ${frame.backDiskTexture}`);
    console.log(`边框纹理: ${frame.backdropEdgeFile}`);
    console.log(`边角大小: ${frame.backdropCornerSize}`);
    console.log(`背景大小: ${frame.backdropBackgroundSize}`);
    console.log(`背景边距: ${JSON.stringify(frame.backdropBackgroundInsets)}`);
    console.log(`边角标志: ${frame.backdropCornerFlags}`);
    console.log(`平铺背景: ${frame.backdropTileBackground}`);
    console.log(`混合所有: ${frame.backdropBlendAll}`);
    
    console.log('\n--- 步骤4: 导出回FDF格式 ---\n');
    
    // 导出
    const exportedFDF = exportToFDF(frames);
    console.log('导出的FDF内容:');
    console.log(exportedFDF);
    
    console.log('\n--- 步骤5: 再次解析导出的FDF ---\n');
    
    // 再次解析
    const lexer2 = new FDFLexer(exportedFDF);
    const tokens2 = lexer2.tokenize();
    const parser2 = new FDFParser(tokens2);
    const ast2 = parser2.parse();
    const transformer2 = new FDFTransformer();
    const frames2 = transformer2.transform(ast2);
    
    if (frames2.length > 0) {
      const frame2 = frames2[0];
      console.log('再次解析后的Frame数据:');
      console.log(JSON.stringify(frame2, null, 2));
      
      // 对比关键属性
      console.log('\n--- 数据一致性检查 ---\n');
      
      const checks = [
        ['名称', frame.name, frame2.name],
        ['类型', frame.type, frame2.type],
        ['宽度', frame.width, frame2.width],
        ['高度', frame.height, frame2.height],
        ['背景纹理(wc3)', frame.backWc3Texture, frame2.backWc3Texture],
        ['背景纹理(disk)', frame.backDiskTexture, frame2.backDiskTexture],
        ['边框纹理', frame.backdropEdgeFile, frame2.backdropEdgeFile],
        ['边角大小', frame.backdropCornerSize, frame2.backdropCornerSize],
        ['背景大小', frame.backdropBackgroundSize, frame2.backdropBackgroundSize],
        ['背景边距', JSON.stringify(frame.backdropBackgroundInsets), JSON.stringify(frame2.backdropBackgroundInsets)],
        ['边角标志', frame.backdropCornerFlags, frame2.backdropCornerFlags],
        ['平铺背景', frame.backdropTileBackground, frame2.backdropTileBackground],
        ['混合所有', frame.backdropBlendAll, frame2.backdropBlendAll],
      ];
      
      let allMatch = true;
      for (const [name, val1, val2] of checks) {
        const match = val1 === val2;
        const status = match ? '✓' : '✗';
        console.log(`${status} ${name}: ${val1} ${match ? '===' : '!=='} ${val2}`);
        if (!match) allMatch = false;
      }
      
      console.log(`\n${allMatch ? '✅ 所有属性匹配！' : '❌ 存在不匹配的属性！'}`);
      
      return allMatch;
    }
  }
  
  return false;
}

// 测试完整文件
function testFullFile() {
  console.log('\n\n=== 测试完整背包系统文件 ===\n');
  
  const filePath = path.join(process.cwd(), 'tests', 'test-inventory-system.fdf');
  const content = fs.readFileSync(filePath, 'utf-8');
  
  console.log('--- 步骤1: 解析原始文件 ---\n');
  
  const lexer = new FDFLexer(content);
  const tokens = lexer.tokenize();
  const parser = new FDFParser(tokens);
  const ast = parser.parse();
  const transformer = new FDFTransformer();
  const frames = transformer.transform(ast);
  
  console.log(`解析的Frame数量: ${frames.length}`);
  
  // 找到主面板
  const mainPanel = frames.find(f => f.name === 'InventoryMainPanel');
  if (mainPanel) {
    console.log('\nInventoryMainPanel 属性:');
    console.log(`  背景纹理: ${mainPanel.backWc3Texture || mainPanel.backDiskTexture}`);
    console.log(`  边框纹理: ${mainPanel.backdropEdgeFile}`);
    console.log(`  边角大小: ${mainPanel.backdropCornerSize}`);
    console.log(`  背景大小: ${mainPanel.backdropBackgroundSize}`);
    console.log(`  边角标志: ${mainPanel.backdropCornerFlags}`);
    console.log(`  平铺背景: ${mainPanel.backdropTileBackground}`);
    console.log(`  混合所有: ${mainPanel.backdropBlendAll}`);
  }
  
  console.log('\n--- 步骤2: 导出为FDF ---\n');
  
  const exportedFDF = exportToFDF(frames);
  
  // 保存导出的文件
  const exportPath = path.join(process.cwd(), 'tests', 'test-inventory-system-exported.fdf');
  fs.writeFileSync(exportPath, exportedFDF, 'utf-8');
  console.log(`已保存导出文件: ${exportPath}`);
  
  // 提取主面板部分
  const mainPanelMatch = exportedFDF.match(/Frame "BACKDROP" "InventoryMainPanel"[\s\S]*?\n}\n/);
  if (mainPanelMatch) {
    console.log('\n导出的 InventoryMainPanel:');
    console.log(mainPanelMatch[0]);
  }
  
  console.log('\n--- 步骤3: 对比原始和导出 ---\n');
  
  // 对比原始文件中的主面板
  const originalMainPanelMatch = content.match(/Frame "BACKDROP" "InventoryMainPanel"[\s\S]*?\n}\n/);
  if (originalMainPanelMatch && mainPanelMatch) {
    console.log('原始内容:');
    console.log(originalMainPanelMatch[0]);
    console.log('\n导出内容:');
    console.log(mainPanelMatch[0]);
    
    // 检查关键行
    const checkLines = [
      'BackdropTileBackground',
      'BackdropBackground',
      'BackdropCornerFlags',
      'BackdropCornerSize',
      'BackdropBackgroundSize',
      'BackdropBackgroundInsets',
      'BackdropEdgeFile',
      'BackdropBlendAll',
    ];
    
    console.log('\n关键行检查:');
    for (const line of checkLines) {
      const inOriginal = originalMainPanelMatch[0].includes(line);
      const inExported = mainPanelMatch[0].includes(line);
      const status = inOriginal === inExported && inOriginal ? '✓' : '✗';
      console.log(`${status} ${line}: 原始=${inOriginal}, 导出=${inExported}`);
    }
  }
}

// 主函数
function main() {
  console.log('========================================');
  console.log('   FDF 解析/导出往返测试');
  console.log('========================================\n');
  
  try {
    // 测试单个Frame
    const singleFramePass = testSingleFrame();
    
    // 测试完整文件
    testFullFile();
    
    console.log('\n========================================');
    console.log('测试完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    if (error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
