/**
 * FDF文本级别比较验证
 * 测试：原始FDF → 解析 → 导出 → 文本比较
 * 发现解析/导出过程中的细微差异
 */

import * as fs from 'fs';
import * as path from 'path';
import { FDFLexer } from '../src/utils/fdfLexer';
import { FDFParser } from '../src/utils/fdfParser';
import { FDFTransformer } from '../src/utils/fdfTransformer';
import { exportToFDF } from '../src/utils/fdfExport';

interface TextComparisonResult {
  file: string;
  success: boolean;
  error?: string;
  differences?: {
    originalLines: number;
    exportedLines: number;
    lineDifferences?: Array<{
      lineNumber: number;
      original: string;
      exported: string;
    }>;
  };
}

class FDFTextValidator {
  private results: TextComparisonResult[] = [];
  private totalFiles = 0;
  private successCount = 0;
  private failureCount = 0;

  /**
   * 标准化FDF文本（用于比较）
   */
  private normalizeFDFText(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => {
        // 移除空行和注释
        if (line === '') return false;
        if (line.startsWith('//')) return false;
        return true;
      });
  }

  /**
   * 比较两个FDF文本
   */
  private compareTexts(original: string, exported: string): {
    identical: boolean;
    differences?: {
      originalLines: number;
      exportedLines: number;
      lineDifferences: Array<{
        lineNumber: number;
        original: string;
        exported: string;
      }>;
    };
  } {
    const originalLines = this.normalizeFDFText(original);
    const exportedLines = this.normalizeFDFText(exported);

    // 完全一致
    if (originalLines.join('\n') === exportedLines.join('\n')) {
      return { identical: true };
    }

    // 找出差异
    const lineDifferences: Array<{ lineNumber: number; original: string; exported: string }> = [];
    const maxLines = Math.max(originalLines.length, exportedLines.length);

    for (let i = 0; i < maxLines; i++) {
      const origLine = originalLines[i] || '';
      const expLine = exportedLines[i] || '';

      if (origLine !== expLine) {
        lineDifferences.push({
          lineNumber: i + 1,
          original: origLine,
          exported: expLine,
        });
      }
    }

    return {
      identical: false,
      differences: {
        originalLines: originalLines.length,
        exportedLines: exportedLines.length,
        lineDifferences: lineDifferences.slice(0, 20), // 只保留前20个差异
      },
    };
  }

  /**
   * 验证单个文件
   */
  validateFile(filePath: string): TextComparisonResult {
    const relativePath = path.relative(process.cwd(), filePath);
    const result: TextComparisonResult = {
      file: relativePath,
      success: false,
    };

    try {
      // 读取原始文件
      const originalContent = fs.readFileSync(filePath, 'utf-8');

      // 解析
      const lexer = new FDFLexer(originalContent);
      const tokens = lexer.tokenize();
      const parser = new FDFParser(tokens);
      const ast = parser.parse();
      const transformer = new FDFTransformer();
      const frames = transformer.transform(ast);

      if (frames.length === 0) {
        result.error = '未解析到任何Frame（可能是StringList文件）';
        return result;
      }

      // 导出
      const exportedContent = exportToFDF(frames);

      // 文本比较
      const comparison = this.compareTexts(originalContent, exportedContent);

      if (comparison.identical) {
        result.success = true;
      } else {
        result.error = '文本不完全一致';
        result.differences = comparison.differences;
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * 验证目录
   */
  validateDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      console.error(`目录不存在: ${dirPath}`);
      return;
    }

    const files = this.getAllFDFFiles(dirPath);
    console.log(`找到 ${files.length} 个FDF文件\n`);

    this.totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = this.validateFile(file);
      this.results.push(result);

      if (result.success) {
        this.successCount++;
        console.log(`✓ [${i + 1}/${files.length}] ${result.file}`);
      } else {
        this.failureCount++;
        console.log(`✗ [${i + 1}/${files.length}] ${result.file}`);
        console.log(`  错误: ${result.error}`);

        if (result.differences && result.differences.lineDifferences) {
          const diffs = result.differences.lineDifferences;
          console.log(`  行数: ${result.differences.originalLines} → ${result.differences.exportedLines}`);
          console.log(`  差异行数: ${diffs.length}${diffs.length === 20 ? '+' : ''}`);
          
          // 显示前5个差异
          diffs.slice(0, 5).forEach(diff => {
            console.log(`    行 ${diff.lineNumber}:`);
            console.log(`      原始: ${diff.original.substring(0, 80)}`);
            console.log(`      导出: ${diff.exported.substring(0, 80)}`);
          });

          if (diffs.length > 5) {
            console.log(`    ... 还有 ${diffs.length - 5} 行差异`);
          }
        }
      }
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
   * 生成报告
   */
  generateReport(): void {
    console.log('\n========================================');
    console.log('        文本比较验证报告');
    console.log('========================================\n');

    console.log(`总文件数: ${this.totalFiles}`);
    console.log(`完全一致: ${this.successCount} (${((this.successCount / this.totalFiles) * 100).toFixed(1)}%)`);
    console.log(`有差异: ${this.failureCount} (${((this.failureCount / this.totalFiles) * 100).toFixed(1)}%)`);

    if (this.failureCount > 0) {
      console.log('\n差异文件分类:\n');

      // 按错误类型分组
      const noFrames = this.results.filter(r => r.error?.includes('未解析到任何Frame'));
      const textDiff = this.results.filter(r => r.error === '文本不完全一致');
      const parseError = this.results.filter(r => !r.success && r.error && !r.error.includes('未解析') && r.error !== '文本不完全一致');

      if (noFrames.length > 0) {
        console.log(`StringList文件 (无Frame): ${noFrames.length} 个`);
      }

      if (textDiff.length > 0) {
        console.log(`\n文本差异文件: ${textDiff.length} 个\n`);
        textDiff.forEach((result, index) => {
          console.log(`${index + 1}. ${result.file}`);
          if (result.differences) {
            console.log(`   行数: ${result.differences.originalLines} → ${result.differences.exportedLines}`);
            const diffs = result.differences.lineDifferences || [];
            console.log(`   差异: ${diffs.length}${diffs.length === 20 ? '+' : ''} 行`);
            
            // 分析差异模式
            const patterns = this.analyzeDifferencePatterns(diffs);
            if (patterns.length > 0) {
              console.log(`   模式: ${patterns.join(', ')}`);
            }
          }
        });
      }

      if (parseError.length > 0) {
        console.log(`\n解析错误文件: ${parseError.length} 个`);
        parseError.forEach((result, index) => {
          console.log(`${index + 1}. ${result.file}: ${result.error}`);
        });
      }
    }

    // 保存详细报告
    const reportPath = path.join(process.cwd(), 'tests', 'fdf-text-comparison-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalFiles: this.totalFiles,
        successCount: this.successCount,
        failureCount: this.failureCount,
        successRate: ((this.successCount / this.totalFiles) * 100).toFixed(2) + '%',
      },
      results: this.results,
    }, null, 2), 'utf-8');

    console.log(`\n详细报告已保存: ${reportPath}`);
  }

  /**
   * 分析差异模式
   */
  private analyzeDifferencePatterns(diffs: Array<{ lineNumber: number; original: string; exported: string }>): string[] {
    const patterns: Set<string> = new Set();

    diffs.forEach(diff => {
      const orig = diff.original;
      const exp = diff.exported;

      // 检查各种模式
      if (orig.includes('Include') && !exp.includes('Include')) {
        patterns.add('Include丢失');
      }
      if (orig.includes('Frame') && exp === '') {
        patterns.add('Frame块丢失');
      }
      if (orig.includes('{') && !exp.includes('{')) {
        patterns.add('大括号差异');
      }
      if (orig.includes('SetPoint') && exp.includes('SetAllPoints')) {
        patterns.add('锚点简化');
      }
      if (orig.includes('SetAllPoints') && exp.includes('SetPoint')) {
        patterns.add('锚点展开');
      }
      if (orig.includes('//') && exp === '') {
        patterns.add('注释丢失');
      }
      if (orig.match(/\d+\.\d+/) && exp.match(/\d+\.\d+/)) {
        const origNum = parseFloat(orig.match(/\d+\.\d+/)?.[0] || '0');
        const expNum = parseFloat(exp.match(/\d+\.\d+/)?.[0] || '0');
        if (Math.abs(origNum - expNum) > 0.0001) {
          patterns.add('数值精度差异');
        }
      }
      if (orig.includes('"') && exp.includes('"')) {
        const origStr = orig.match(/"([^"]*)"/)?.[1];
        const expStr = exp.match(/"([^"]*)"/)?.[1];
        if (origStr !== expStr) {
          patterns.add('字符串内容差异');
        }
      }
      if (orig !== '' && exp === '') {
        patterns.add('行缺失');
      }
      if (orig === '' && exp !== '') {
        patterns.add('多余行');
      }
      if (orig.toLowerCase() === exp.toLowerCase() && orig !== exp) {
        patterns.add('大小写差异');
      }
    });

    return Array.from(patterns);
  }

  /**
   * 统计差异类型
   */
  analyzeCommonDifferences(): void {
    console.log('\n========================================');
    console.log('        差异模式统计');
    console.log('========================================\n');

    const allPatterns = new Map<string, number>();

    this.results
      .filter(r => r.differences?.lineDifferences)
      .forEach(result => {
        const patterns = this.analyzeDifferencePatterns(result.differences!.lineDifferences!);
        patterns.forEach(pattern => {
          allPatterns.set(pattern, (allPatterns.get(pattern) || 0) + 1);
        });
      });

    if (allPatterns.size > 0) {
      console.log('常见差异模式:\n');
      Array.from(allPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([pattern, count]) => {
          console.log(`  ${pattern}: ${count} 个文件`);
        });
    } else {
      console.log('未发现系统性差异模式');
    }
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('   FDF文本级别比较验证');
  console.log('========================================\n');

  const validator = new FDFTextValidator();

  // 验证目录
  const fdfDir = path.join(process.cwd(), 'target', 'vendor', 'UI', 'FrameDef');

  console.log(`验证目录: ${fdfDir}\n`);

  validator.validateDirectory(fdfDir);

  // 生成报告
  validator.generateReport();

  // 差异分析
  validator.analyzeCommonDifferences();

  console.log('\n========================================');
  console.log('验证完成！');
  console.log('========================================');
}

main().catch(console.error);
