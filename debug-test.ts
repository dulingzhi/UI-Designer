#!/usr/bin/env bun
/**
 * 调试基础测试
 */

import { parseFDFToAST } from './src/utils/fdf';
import { FDFTransformer } from './src/utils/fdfTransformer';
import { importFromFDFText } from './src/utils/fdfImport';

console.log('🔍 调试测试 3: 解析数组属性');
const fdf3 = `
  Frame "FRAME" "Test" {
    FrameVertex TopLeft, {
      Offset 0.1, 0.2,
    }
  }
`;
const ast3 = parseFDFToAST(fdf3);
console.log('AST:', JSON.stringify(ast3, null, 2));
const frames3 = ast3.body.filter((item: any) => item.type === 'FrameDefinition');
console.log('Frame:', JSON.stringify(frames3[0], null, 2));
const vertex = (frames3[0] as any).properties.find((p: any) => p.name === 'FrameVertex');
console.log('Vertex 属性:', JSON.stringify(vertex, null, 2));

console.log('\n🔍 调试测试 4: AST 转换为 FrameData');
const fdf4 = `
  Frame "FRAME" "Test" {
    Width 0.5,
    Height 0.3,
  }
`;
const ast4 = parseFDFToAST(fdf4);
const transformer = new FDFTransformer();
const frames4 = transformer.transform(ast4);
console.log('转换结果:', JSON.stringify(frames4, null, 2));

console.log('\n🔍 调试测试 5: 保留 FDF 元数据');
const fdf5 = `Frame "BUTTON" "Test" { UseActiveContext true, }`;
const result5 = importFromFDFText(fdf5);
console.log('导入结果:', JSON.stringify(result5, null, 2));
console.log('元数据:', (result5[0] as any).fdfMetadata);

console.log('\n🔍 调试测试 6: 提取 Texture 数据');
const fdf6 = `
  Frame "BACKDROP" "Test" {
    BackdropBackground "MyTexture",
    BackdropCornerFlags "UL|UR|BL|BR",
  }
`;
const result6 = importFromFDFText(fdf6);
console.log('导入结果:', JSON.stringify(result6, null, 2));
console.log('元数据:', (result6[0] as any).fdfMetadata);
