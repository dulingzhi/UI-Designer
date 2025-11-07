/**
 * FDF Include 文件解析器
 * 
 * 负责解析 IncludeFile 指令，加载模板定义
 */

import { FDFLexer } from './fdfLexer';
import { FDFParser } from './fdfParser';
import { FDFTransformer } from './fdfTransformer';
import { FDFProgram, FDFInclude, FDFNodeType } from './fdfAst';
import { FrameData } from '../types';
import * as fs from 'fs';
import * as path from 'path';

export interface IncludeResolverOptions {
  /** 基础路径，用于解析相对路径 */
  basePath?: string;
  /** 最大递归深度，防止循环引用 */
  maxDepth?: number;
  /** 已加载的文件缓存 */
  loadedFiles?: Set<string>;
  /** 现有的模板注册表（跳过Include加载） */
  existingTemplateRegistry?: Map<string, FrameData>;
}

/**
 * FDF Include 解析器
 */
export class FDFIncludeResolver {
  private basePath: string;
  private maxDepth: number;
  private loadedFiles: Set<string>;
  private templateRegistry: Map<string, FrameData>;
  
  constructor(options: IncludeResolverOptions = {}) {
    this.basePath = options.basePath || process.cwd();
    this.maxDepth = options.maxDepth || 10;
    this.loadedFiles = options.loadedFiles || new Set();
    this.templateRegistry = new Map();
  }
  
  /**
   * 获取模板注册表
   */
  getTemplateRegistry(): Map<string, FrameData> {
    return this.templateRegistry;
  }
  
  /**
   * 解析 AST 中的 Include 指令
   */
  resolveIncludes(ast: FDFProgram, depth: number = 0): void {
    if (depth >= this.maxDepth) {
      console.warn(`[FDFIncludeResolver] 达到最大递归深度 ${this.maxDepth}`);
      return;
    }
    
    // 遍历所有节点，查找 Include
    for (const node of ast.body) {
      if (node.type === FDFNodeType.INCLUDE) {
        this.loadIncludeFile(node as FDFInclude, depth);
      }
    }
  }
  
  /**
   * 加载单个 Include 文件
   */
  private loadIncludeFile(includeNode: FDFInclude, depth: number): void {
    try {
      // 规范化路径（WC3 使用反斜杠）
      const includePath = includeNode.path.replace(/\\/g, '/');
      
      // 构建完整路径
      const fullPath = this.resolveIncludePath(includePath);
      
      // 检查是否已加载
      if (this.loadedFiles.has(fullPath)) {
        return;
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(fullPath)) {
        console.warn(`[FDFIncludeResolver] Include 文件不存在: ${fullPath}`);
        return;
      }
      
      // 标记为已加载
      this.loadedFiles.add(fullPath);
      
      // 读取并解析文件
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lexer = new FDFLexer(content);
      const tokens = lexer.tokenize();
      const parser = new FDFParser(tokens);
      const ast = parser.parse();
      
      // 递归处理嵌套的 Include
      this.resolveIncludes(ast, depth + 1);
      
      // 转换为 FrameData 并注册模板
      const transformer = new FDFTransformer({
        resolveInheritance: false, // 第一遍不解析继承，只收集模板
        templateRegistry: this.templateRegistry,
      });
      
      const frames = transformer.transform(ast);
      
      // 将所有 Frame 注册为模板
      for (const frame of frames) {
        // 标记为模板
        frame.fdfMetadata = {
          ...frame.fdfMetadata,
          isTemplate: true,
          includeFile: includePath,
        };
        
        this.templateRegistry.set(frame.name, frame);
      }
      
      console.log(`[FDFIncludeResolver] 已加载模板文件: ${includePath}，注册了 ${frames.length} 个模板`);
      
    } catch (error) {
      console.error(`[FDFIncludeResolver] 加载 Include 文件失败: ${includeNode.path}`, error);
    }
  }
  
  /**
   * 解析 Include 路径
   */
  private resolveIncludePath(includePath: string): string {
    // WC3 的路径通常相对于 UI 目录
    // 例如：UI\FrameDef\Glue\StandardTemplates.fdf
    
    // 尝试多个可能的基础路径
    const possiblePaths = [
      // 1. 直接拼接 basePath
      path.join(this.basePath, includePath),
      // 2. 假设 basePath 已经包含 vendor/UI
      path.join(this.basePath, 'vendor', includePath),
      // 3. 假设 basePath 是项目根目录
      path.join(this.basePath, 'target', 'vendor', includePath),
    ];
    
    for (const fullPath of possiblePaths) {
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
    
    // 如果都找不到，返回第一个尝试的路径（让后续错误处理）
    return possiblePaths[0];
  }
}

/**
 * 便捷函数：解析 FDF 文件并加载所有 Include
 */
export function parseFDFWithIncludes(
  fdfContent: string,
  options: IncludeResolverOptions = {}
): { frames: FrameData[]; templateRegistry: Map<string, FrameData> } {
  // 第一步：解析主文件
  const lexer = new FDFLexer(fdfContent);
  const tokens = lexer.tokenize();
  const parser = new FDFParser(tokens);
  const ast = parser.parse();
  
  // 第二步：获取或构建模板注册表
  let templateRegistry: Map<string, FrameData>;
  
  if (options.existingTemplateRegistry) {
    // 使用已有的模板注册表（roundtrip测试时使用）
    templateRegistry = options.existingTemplateRegistry;
  } else {
    // 解析所有 Include 文件，构建模板注册表
    const includeResolver = new FDFIncludeResolver(options);
    includeResolver.resolveIncludes(ast);
    templateRegistry = includeResolver.getTemplateRegistry();
  }
  
  // 第三步：使用模板注册表转换主文件
  const transformer = new FDFTransformer({
    resolveInheritance: true,
    templateRegistry,
  });
  
  const frames = transformer.transform(ast);
  
  return { frames, templateRegistry };
}
