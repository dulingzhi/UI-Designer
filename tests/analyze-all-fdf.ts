/**
 * FDF 文件全面分析脚本
 * 
 * 分析 vendor/UI/FrameDef 下所有 FDF 文件的结构和属性模式
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseFDFToAST } from '../src/utils/fdf';
import { FDFNodeType, FDFProperty, FDFFrameDefinition, FDFNestedFrame } from '../src/utils/fdfAst';

interface PropertyStats {
  count: number;
  examples: Array<{ file: string; frame: string; value: string }>;
}

interface AnchorPattern {
  pattern: string;
  count: number;
  examples: Array<{ file: string; frame: string; code: string }>;
}

const propertyStats: Map<string, PropertyStats> = new Map();
const frameTypes: Map<string, number> = new Map();
const anchorPatterns: AnchorPattern[] = [];
const inheritanceUsage: Map<string, number> = new Map();

/**
 * 递归查找所有 .fdf 文件
 */
function findAllFDFFiles(dir: string): string[] {
  const files: string[] = [];
  
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...findAllFDFFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.fdf')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
  
  return files;
}

/**
 * 分析单个属性
 */
function analyzeProperty(prop: FDFProperty, fileName: string, frameName: string) {
  const propName = prop.name;
  
  if (!propertyStats.has(propName)) {
    propertyStats.set(propName, { count: 0, examples: [] });
  }
  
  const stats = propertyStats.get(propName)!;
  stats.count++;
  
  // 记录前几个示例
  if (stats.examples.length < 5) {
    let valueStr = '';
    if (prop.value.type === FDFNodeType.STRING_LITERAL) {
      valueStr = `"${prop.value.value}"`;
    } else if (prop.value.type === FDFNodeType.NUMBER_LITERAL) {
      valueStr = prop.value.value.toString();
    } else if (prop.value.type === FDFNodeType.IDENTIFIER) {
      valueStr = prop.value.name;
    } else if (prop.value.type === FDFNodeType.ARRAY_LITERAL) {
      valueStr = `[${prop.value.elements.map(e => {
        if (e.type === FDFNodeType.STRING_LITERAL) return `"${e.value}"`;
        if (e.type === FDFNodeType.NUMBER_LITERAL) return e.value;
        if (e.type === FDFNodeType.IDENTIFIER) return e.name;
        return '?';
      }).join(', ')}]`;
    }
    
    stats.examples.push({
      file: path.basename(fileName),
      frame: frameName,
      value: valueStr
    });
  }
}

/**
 * 检测锚点模式
 */
function detectAnchorPattern(frame: FDFFrameDefinition | FDFNestedFrame, fileName: string) {
  const properties = frame.properties;
  const frameName = frame.name || 'unnamed';
  
  // 检查 SetAllPoints
  const hasSetAllPoints = properties.some(p => 
    p.type === FDFNodeType.PROPERTY && p.name === 'SetAllPoints'
  );
  
  // 检查 SetPoint
  const setPoints = properties.filter(p => 
    p.type === FDFNodeType.PROPERTY && p.name === 'SetPoint'
  );
  
  // 检查 Anchor
  const anchors = properties.filter(p => 
    p.type === FDFNodeType.PROPERTY && p.name === 'Anchor'
  );
  
  // 检查 Width/Height
  const hasWidth = properties.some(p => 
    p.type === FDFNodeType.PROPERTY && p.name === 'Width'
  );
  const hasHeight = properties.some(p => 
    p.type === FDFNodeType.PROPERTY && p.name === 'Height'
  );
  
  let pattern = '';
  let codeExample = '';
  
  if (hasSetAllPoints) {
    pattern = 'SetAllPoints';
    const prop = properties.find(p => p.type === FDFNodeType.PROPERTY && p.name === 'SetAllPoints') as FDFProperty;
    if (prop.value.type === FDFNodeType.IDENTIFIER && prop.value.name === 'true') {
      codeExample = 'SetAllPoints,';
    } else if (prop.value.type === FDFNodeType.STRING_LITERAL) {
      codeExample = `SetAllPoints "${prop.value.value}",`;
    }
  } else if (setPoints.length > 0) {
    pattern = `SetPoint x ${setPoints.length}`;
    const firstSetPoint = setPoints[0] as FDFProperty;
    if (firstSetPoint.value.type === FDFNodeType.ARRAY_LITERAL) {
      const elements = firstSetPoint.value.elements;
      const values = elements.map(e => {
        if (e.type === FDFNodeType.IDENTIFIER) return e.name;
        if (e.type === FDFNodeType.STRING_LITERAL) return `"${e.value}"`;
        if (e.type === FDFNodeType.NUMBER_LITERAL) return e.value.toString();
        return '?';
      }).join(', ');
      codeExample = `SetPoint ${values},`;
    }
  } else if (anchors.length > 0) {
    pattern = `Anchor x ${anchors.length}`;
    const firstAnchor = anchors[0] as FDFProperty;
    if (firstAnchor.value.type === FDFNodeType.ARRAY_LITERAL) {
      const elements = firstAnchor.value.elements;
      const values = elements.map(e => {
        if (e.type === FDFNodeType.IDENTIFIER) return e.name;
        if (e.type === FDFNodeType.STRING_LITERAL) return `"${e.value}"`;
        if (e.type === FDFNodeType.NUMBER_LITERAL) return e.value.toString();
        return '?';
      }).join(', ');
      codeExample = `Anchor ${values},`;
    }
  } else if (hasWidth && hasHeight) {
    pattern = 'Width + Height (no anchor)';
    codeExample = 'Width X.XXX, Height X.XXX,';
  } else {
    pattern = 'No positioning';
    codeExample = '(no positioning properties)';
  }
  
  // 记录模式
  const existingPattern = anchorPatterns.find(p => p.pattern === pattern);
  if (existingPattern) {
    existingPattern.count++;
    if (existingPattern.examples.length < 10) {
      existingPattern.examples.push({
        file: path.basename(fileName),
        frame: frameName,
        code: codeExample
      });
    }
  } else {
    anchorPatterns.push({
      pattern,
      count: 1,
      examples: [{
        file: path.basename(fileName),
        frame: frameName,
        code: codeExample
      }]
    });
  }
}

/**
 * 递归分析 Frame
 */
function analyzeFrame(frame: FDFFrameDefinition | FDFNestedFrame, fileName: string) {
  const frameName = frame.name || 'unnamed';
  const frameType = frame.frameType;
  
  // 统计 Frame 类型
  const currentCount = frameTypes.get(frameType) || 0;
  frameTypes.set(frameType, currentCount + 1);
  
  // 统计继承使用
  if (frame.inherits) {
    const currentInheritCount = inheritanceUsage.get(frame.inherits) || 0;
    inheritanceUsage.set(frame.inherits, currentInheritCount + 1);
  }
  
  // 检测锚点模式
  detectAnchorPattern(frame, fileName);
  
  // 分析所有属性
  for (const prop of frame.properties) {
    if (prop.type === FDFNodeType.PROPERTY) {
      analyzeProperty(prop, fileName, frameName);
    } else if (prop.type === FDFNodeType.NESTED_FRAME) {
      // 递归分析嵌套 Frame
      analyzeFrame(prop, fileName);
    }
  }
}

/**
 * 分析单个 FDF 文件
 */
function analyzeFDFFile(filePath: string) {
  console.log(`\n分析文件: ${path.basename(filePath)}`);
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const ast = parseFDFToAST(content);
    
    // 分析所有 Frame 定义
    for (const node of ast.body) {
      if (node.type === FDFNodeType.FRAME_DEFINITION) {
        analyzeFrame(node, filePath);
      }
    }
  } catch (error) {
    console.error(`  ❌ 解析失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 主函数
 */
function main() {
  console.log('========================================');
  console.log('FDF 文件全面分析');
  console.log('========================================');
  
  const fdfDir = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef');
  
  if (!fs.existsSync(fdfDir)) {
    console.error(`错误: 目录不存在: ${fdfDir}`);
    process.exit(1);
  }
  
  // 查找所有 FDF 文件
  console.log(`\n搜索目录: ${fdfDir}`);
  const fdfFiles = findAllFDFFiles(fdfDir);
  console.log(`找到 ${fdfFiles.length} 个 FDF 文件`);
  
  // 分析所有文件
  for (const file of fdfFiles) {
    analyzeFDFFile(file);
  }
  
  // 打印统计结果
  console.log('\n\n========================================');
  console.log('Frame 类型统计');
  console.log('========================================');
  const sortedFrameTypes = Array.from(frameTypes.entries()).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedFrameTypes) {
    console.log(`${type.padEnd(20)} : ${count}`);
  }
  
  console.log('\n\n========================================');
  console.log('锚点/定位模式统计');
  console.log('========================================');
  const sortedPatterns = anchorPatterns.sort((a, b) => b.count - a.count);
  for (const pattern of sortedPatterns) {
    console.log(`\n${pattern.pattern} (使用次数: ${pattern.count})`);
    console.log('示例:');
    for (const example of pattern.examples.slice(0, 3)) {
      console.log(`  - ${example.file} / ${example.frame}`);
      console.log(`    ${example.code}`);
    }
  }
  
  console.log('\n\n========================================');
  console.log('最常用的属性 (Top 30)');
  console.log('========================================');
  const sortedProperties = Array.from(propertyStats.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 30);
  
  for (const [name, stats] of sortedProperties) {
    console.log(`\n${name} (使用次数: ${stats.count})`);
    if (stats.examples.length > 0) {
      console.log('  示例:');
      for (const example of stats.examples.slice(0, 2)) {
        console.log(`    ${example.file} / ${example.frame}: ${example.value}`);
      }
    }
  }
  
  console.log('\n\n========================================');
  console.log('模板继承统计 (Top 20)');
  console.log('========================================');
  const sortedInheritance = Array.from(inheritanceUsage.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);
  for (const [template, count] of sortedInheritance) {
    console.log(`${template.padEnd(40)} : ${count}`);
  }
  
  console.log('\n\n========================================');
  console.log('分析完成');
  console.log('========================================');
}

// 运行分析
main();
