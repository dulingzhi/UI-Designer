/**
 * 分析所有官方FDF文件，提取Frame类型和属性字段
 * 生成完整的属性参考文档
 */

import * as fs from 'fs';
import * as path from 'path';
import { FDFLexer } from '../src/utils/fdfLexer';
import { FDFParser } from '../src/utils/fdfParser';
import type { 
  FDFFrameDefinition, 
  FDFProperty, 
  FDFNodeType,
  FDFNestedFrame,
  FDFProgram,
  FDFInclude,
  FDFTextureDefinition,
  FDFStringDefinition,
  FDFComment
} from '../src/utils/fdfAst';

interface FrameTypeInfo {
  type: string;
  properties: Map<string, PropertyInfo>;
  count: number;
  files: Set<string>;
}

interface PropertyInfo {
  valueTypes: Set<string>; // string, number, identifier, array
  examples: string[];
  count: number;
}

interface AnalysisResult {
  frameTypes: Map<string, FrameTypeInfo>;
  totalFrames: number;
  totalFiles: number;
  errors: Array<{ file: string; error: string }>;
}

class FDFAnalyzer {
  private result: AnalysisResult = {
    frameTypes: new Map(),
    totalFrames: 0,
    totalFiles: 0,
    errors: [],
  };

  /**
   * 扫描目录中的所有FDF文件
   */
  async scanDirectory(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      console.error(`目录不存在: ${dirPath}`);
      return;
    }

    const files = this.getAllFDFFiles(dirPath);
    console.log(`找到 ${files.length} 个FDF文件`);

    for (const file of files) {
      await this.analyzeFile(file);
    }
  }

  /**
   * 递归获取所有FDF文件
   */
  private getAllFDFFiles(dirPath: string): string[] {
    const files: string[] = [];
    
    const scan = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.fdf')) {
          files.push(fullPath);
        }
      }
    };

    scan(dirPath);
    return files;
  }

  /**
   * 分析单个FDF文件
   */
  private async analyzeFile(filePath: string): Promise<void> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(process.cwd(), filePath);
      
      // 词法分析
      const lexer = new FDFLexer(content);
      const tokens = lexer.tokenize();
      
      // 语法分析
      const parser = new FDFParser(tokens);
      const ast = parser.parse();
      
      // 分析Frame - 遍历body中的Frame定义
      for (const node of ast.body) {
        if (node.type === 'FrameDefinition') {
          this.analyzeFrame(node as FDFFrameDefinition, relativePath);
        }
      }
      
      this.result.totalFiles++;
      
      if (this.result.totalFiles % 10 === 0) {
        console.log(`已处理 ${this.result.totalFiles} 个文件...`);
      }
    } catch (error) {
      this.result.errors.push({
        file: filePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 分析Frame定义
   */
  private analyzeFrame(frame: FDFFrameDefinition | FDFNestedFrame, sourceFile: string): void {
    this.result.totalFrames++;
    
    const frameType = frame.frameType.toUpperCase();
    
    // 获取或创建FrameTypeInfo
    let typeInfo = this.result.frameTypes.get(frameType);
    if (!typeInfo) {
      typeInfo = {
        type: frameType,
        properties: new Map(),
        count: 0,
        files: new Set(),
      };
      this.result.frameTypes.set(frameType, typeInfo);
    }
    
    typeInfo.count++;
    typeInfo.files.add(sourceFile);
    
    // 分析属性
    for (const prop of frame.properties) {
      if (prop.type === 'Property') {
        this.analyzeProperty(prop as FDFProperty, typeInfo);
      } else if (prop.type === 'NestedFrame') {
        // 递归分析嵌套Frame
        this.analyzeFrame(prop as FDFNestedFrame, sourceFile);
      }
    }
  }

  /**
   * 分析属性
   */
  private analyzeProperty(prop: FDFProperty, typeInfo: FrameTypeInfo): void {
    const propName = prop.name;
    
    // 获取或创建PropertyInfo
    let propInfo = typeInfo.properties.get(propName);
    if (!propInfo) {
      propInfo = {
        valueTypes: new Set(),
        examples: [],
        count: 0,
      };
      typeInfo.properties.set(propName, propInfo);
    }
    
    propInfo.count++;
    
    // 分析值类型
    const valueType = this.getValueType(prop.value);
    propInfo.valueTypes.add(valueType);
    
    // 添加示例（最多保留10个）
    if (propInfo.examples.length < 10) {
      const exampleValue = this.formatValue(prop.value);
      if (!propInfo.examples.includes(exampleValue)) {
        propInfo.examples.push(exampleValue);
      }
    }
  }

  /**
   * 获取值类型
   */
  private getValueType(value: any): string {
    if (!value || !value.type) return 'unknown';
    
    const typeStr = String(value.type);
    
    if (typeStr.includes('STRING')) return 'string';
    if (typeStr.includes('NUMBER')) return 'number';
    if (typeStr.includes('IDENTIFIER')) return 'identifier';
    if (typeStr.includes('ARRAY')) return 'array';
    
    return typeStr;
  }

  /**
   * 格式化值用于示例
   */
  private formatValue(value: any): string {
    if (!value) return '';
    
    const typeStr = String(value.type);
    
    if (typeStr.includes('STRING')) {
      return `"${value.value}"`;
    }
    if (typeStr.includes('NUMBER')) {
      return String(value.value);
    }
    if (typeStr.includes('IDENTIFIER')) {
      return value.name || String(value.value);
    }
    if (typeStr.includes('ARRAY') && value.elements) {
      const elements = value.elements.map((e: any) => this.formatValue(e));
      return elements.join(' ');
    }
    
    return JSON.stringify(value).substring(0, 100);
  }

  /**
   * 生成分析报告
   */
  generateReport(): string {
    let report = '';
    
    // 头部信息
    report += '# WC3 FDF 完整属性参考\n\n';
    report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    report += `## 统计信息\n\n`;
    report += `- 扫描文件数: ${this.result.totalFiles}\n`;
    report += `- Frame总数: ${this.result.totalFrames}\n`;
    report += `- Frame类型数: ${this.result.frameTypes.size}\n`;
    report += `- 错误数: ${this.result.errors.length}\n\n`;
    
    // 错误列表
    if (this.result.errors.length > 0) {
      report += `## 解析错误\n\n`;
      for (const error of this.result.errors.slice(0, 20)) {
        report += `- ${error.file}: ${error.error}\n`;
      }
      if (this.result.errors.length > 20) {
        report += `- ... 还有 ${this.result.errors.length - 20} 个错误\n`;
      }
      report += '\n';
    }
    
    // Frame类型列表
    report += `## Frame 类型总览\n\n`;
    report += `| Frame Type | 数量 | 属性数 | 出现文件数 |\n`;
    report += `|------------|------|--------|------------|\n`;
    
    const sortedTypes = Array.from(this.result.frameTypes.values())
      .sort((a, b) => b.count - a.count);
    
    for (const typeInfo of sortedTypes) {
      report += `| ${typeInfo.type} | ${typeInfo.count} | ${typeInfo.properties.size} | ${typeInfo.files.size} |\n`;
    }
    report += '\n';
    
    // 详细属性列表
    report += `## Frame 类型详细属性\n\n`;
    
    for (const typeInfo of sortedTypes) {
      report += `### ${typeInfo.type}\n\n`;
      report += `使用次数: ${typeInfo.count}，属性数: ${typeInfo.properties.size}\n\n`;
      
      // 属性表格
      report += `| 属性名 | 值类型 | 使用次数 | 示例值 |\n`;
      report += `|--------|--------|----------|--------|\n`;
      
      const sortedProps = Array.from(typeInfo.properties.entries())
        .sort((a, b) => b[1].count - a[1].count);
      
      for (const [propName, propInfo] of sortedProps) {
        const valueTypes = Array.from(propInfo.valueTypes).join(', ');
        const examples = propInfo.examples.slice(0, 3).join(', ');
        report += `| ${propName} | ${valueTypes} | ${propInfo.count} | ${examples} |\n`;
      }
      
      report += '\n';
      
      // 出现的文件
      if (typeInfo.files.size <= 10) {
        report += `**出现在文件:**\n`;
        for (const file of Array.from(typeInfo.files).sort()) {
          report += `- ${file}\n`;
        }
        report += '\n';
      } else {
        report += `**出现在 ${typeInfo.files.size} 个文件中**\n\n`;
      }
    }
    
    return report;
  }

  /**
   * 生成JSON格式的结果
   */
  generateJSON(): string {
    const jsonData: any = {
      metadata: {
        generatedAt: new Date().toISOString(),
        totalFiles: this.result.totalFiles,
        totalFrames: this.result.totalFrames,
        frameTypeCount: this.result.frameTypes.size,
        errorCount: this.result.errors.length,
      },
      errors: this.result.errors,
      frameTypes: {},
    };
    
    for (const [type, info] of this.result.frameTypes) {
      const properties: any = {};
      
      for (const [propName, propInfo] of info.properties) {
        properties[propName] = {
          valueTypes: Array.from(propInfo.valueTypes),
          count: propInfo.count,
          examples: propInfo.examples,
        };
      }
      
      jsonData.frameTypes[type] = {
        count: info.count,
        fileCount: info.files.size,
        files: Array.from(info.files),
        properties,
      };
    }
    
    return JSON.stringify(jsonData, null, 2);
  }

  getResult(): AnalysisResult {
    return this.result;
  }
}

// 主函数
async function main() {
  const analyzer = new FDFAnalyzer();
  
  // 扫描目录
  const fdfDir = path.join(process.cwd(), 'target', 'vendor', 'UI', 'FrameDef');
  
  console.log('开始扫描FDF文件...');
  console.log(`目录: ${fdfDir}\n`);
  
  await analyzer.scanDirectory(fdfDir);
  
  console.log('\n扫描完成！生成报告...\n');
  
  // 生成Markdown报告
  const markdownReport = analyzer.generateReport();
  const mdPath = path.join(process.cwd(), 'docs', 'FDF_COMPLETE_PROPERTIES_REFERENCE.md');
  fs.writeFileSync(mdPath, markdownReport, 'utf-8');
  console.log(`Markdown报告已保存: ${mdPath}`);
  
  // 生成JSON报告
  const jsonReport = analyzer.generateJSON();
  const jsonPath = path.join(process.cwd(), 'docs', 'fdf-properties-reference.json');
  fs.writeFileSync(jsonPath, jsonReport, 'utf-8');
  console.log(`JSON报告已保存: ${jsonPath}`);
  
  // 输出摘要
  const result = analyzer.getResult();
  console.log('\n=== 分析摘要 ===');
  console.log(`文件数: ${result.totalFiles}`);
  console.log(`Frame总数: ${result.totalFrames}`);
  console.log(`Frame类型: ${result.frameTypes.size}`);
  console.log(`错误数: ${result.errors.length}`);
  
  console.log('\nFrame类型 (按使用频率):');
  const sortedTypes = Array.from(result.frameTypes.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
  
  for (const typeInfo of sortedTypes) {
    console.log(`  ${typeInfo.type.padEnd(20)} - ${typeInfo.count} 个实例, ${typeInfo.properties.size} 个属性`);
  }
}

main().catch(console.error);
