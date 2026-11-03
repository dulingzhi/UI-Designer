/**
 * FDF 工具统一入口
 * 
 * 提供完整的 FDF 解析、转换和导出功能
 */

import { FDFLexer } from './fdfLexer';
import { FDFParser } from './fdfParser';
import { FDFTransformer, TransformOptions } from './fdfTransformer';
import { FDFExporter, ExportOptions } from './fdfExporter';
import { FrameData } from '../types';
import { FDFProgram } from './fdfAst';
import { buildKernelLayoutFrameData } from './fdfKernelScene';

/**
 * 解析 FDF 文本为 FrameData 数组
 * 
 * @param fdfText FDF 文本内容
 * @param options 转换选项
 * @returns FrameData 数组
 */
export function parseFDF(fdfText: string, options?: TransformOptions & { useKernelLayout?: boolean }): FrameData[] {
  // 按需切链：useKernelLayout 走内核声明式 layout（root 锚点定位 + 内核解子树）。
  // 默认（未开启）仍走旧 transformer solver，保证现状与既有回归不变。
  if (options?.useKernelLayout) {
    return buildKernelLayoutFrameData(fdfText);
  }
  try {
    // 1. 词法分析
    const lexer = new FDFLexer(fdfText);
    const tokens = lexer.tokenize();
    
    // 2. 语法分析
    const parser = new FDFParser(tokens);
    const ast = parser.parse();
    
    // 3. 转换为 FrameData
    const transformer = new FDFTransformer(options);
    const frames = transformer.transform(ast);
    
    return frames;
  } catch (error) {
    console.error('FDF 解析错误:', error);
    throw error;
  }
}

/**
 * 解析 FDF 文本为 AST（抽象语法树）
 * 
 * @param fdfText FDF 文本内容
 * @returns FDF AST
 */
export function parseFDFToAST(fdfText: string): FDFProgram {
  try {
    const lexer = new FDFLexer(fdfText);
    const tokens = lexer.tokenize();
    
    const parser = new FDFParser(tokens);
    const ast = parser.parse();
    
    return ast;
  } catch (error) {
    console.error('FDF 解析错误:', error);
    throw error;
  }
}

/**
 * 导出 FrameData 数组为 FDF 文本
 * 
 * @param frames FrameData 数组
 * @param options 导出选项
 * @returns FDF 文本
 */
export function exportFDF(frames: FrameData[], options?: ExportOptions): string {
  try {
    const exporter = new FDFExporter(options);
    return exporter.export(frames);
  } catch (error) {
    console.error('FDF 导出错误:', error);
    throw error;
  }
}

/**
 * 验证 FDF 文本格式
 * 
 * @param fdfText FDF 文本内容
 * @returns 验证结果
 */
export function validateFDF(fdfText: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    const lexer = new FDFLexer(fdfText);
    const tokens = lexer.tokenize();
    
    // 引号配对预扫：对原文计数（token.value 已剥离引号字符串定界符，不能用于计数）；
    // 注释中的引号可能造成罕见误报——warning 非阻断，可接受。
    const quoteCount = (fdfText.match(/"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      warnings.push('引号数量为奇数——可能存在未闭合字符串（lexer 可能已容错截断）');
    }
    if (quoteCount % 2 !== 0) {
      warnings.push('引号数量为奇数——可能存在未闭合字符串（lexer 可能已容错截断）');
    }
    
    
    const parser = new FDFParser(tokens);
    parser.parse();
    
    return {
      valid: true,
      errors,
      warnings,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {
      valid: false,
      errors,
      warnings,
    };
  }
}


// 导出所有类型和工具
export * from './fdfAst';
export { FDFLexer } from './fdfLexer';
export { FDFParser } from './fdfParser';
export { FDFTransformer } from './fdfTransformer';
export { FDFExporter } from './fdfExporter';
