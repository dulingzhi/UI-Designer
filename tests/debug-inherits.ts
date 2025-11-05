import { parseFDFToAST } from './src/utils/fdf';
import { FDFTransformer } from './src/utils/fdfTransformer';
import { FDFExporter } from './src/utils/fdfExporter';

const originalFdf = `Frame "BUTTON" "BaseButton" {
  Width 0.1,
  Height 0.05,
}
Frame "BUTTON" "MyButton" INHERITS "BaseButton" {
  Width 0.15,
}`;

console.log('📝 原始 FDF:');
console.log(originalFdf);
console.log('\n============================================================\n');

// 解析
const ast1 = parseFDFToAST(originalFdf);
console.log('🔍 解析后的 AST:');
console.log(JSON.stringify(ast1, null, 2));
console.log('\n============================================================\n');

// 转换
const transformer = new FDFTransformer();
const frames1 = transformer.transform(ast1);
console.log('🔄 转换后的 FrameData:');
console.log(JSON.stringify(frames1, null, 2));
console.log('\n============================================================\n');

// 导出
const exporter = new FDFExporter();
const exportedFdf = exporter.export(frames1);
console.log('📤 导出的 FDF:');
console.log(exportedFdf);
console.log('\n============================================================\n');

// 再次解析
const ast2 = parseFDFToAST(exportedFdf);
const frames2 = ast2.body.filter((item: any) => item.type === 'FrameDefinition');
console.log('🔍 再次解析的 AST:');
frames2.forEach((f: any) => {
  console.log(`  - ${f.name}: inherits = ${f.inherits}`);
});
