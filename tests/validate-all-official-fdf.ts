/**
 * 验证所有官方FDF文件的往返解析
 * 测试：原始FDF → 解析(含Include) → 导出 → 再解析，检查数据一致性
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseFDFWithIncludes } from '../src/utils/fdfIncludeResolver';
import { exportToFDF } from '../src/utils/fdfExport';
import type { FrameData } from '../src/types';

interface ValidationResult {
  file: string;
  success: boolean;
  error?: string;
  originalFrameCount: number;
  exportedFrameCount: number;
  frameMismatches?: Array<{
    name: string;
    issue: string;
  }>;
}

class FDFValidator {
  private results: ValidationResult[] = [];
  private totalFiles = 0;
  private successCount = 0;
  private failureCount = 0;

  /**
   * 验证单个FDF文件
   */
  validateFile(filePath: string): ValidationResult {
    const relativePath = path.relative(process.cwd(), filePath);
    const result: ValidationResult = {
      file: relativePath,
      success: false,
      originalFrameCount: 0,
      exportedFrameCount: 0,
    };

    try {
      // 读取原始文件
      const content = fs.readFileSync(filePath, 'utf-8');

      // 第一次解析（启用Include解析）
      const basePath = path.join(process.cwd(), 'target', 'vendor');
      const parsed1 = parseFDFWithIncludes(content, { basePath });
      
      // 过滤掉模板Frame（isTemplate=true的不应该出现在最终结果中）
      const frames1 = parsed1.frames.filter(f => !f.fdfMetadata?.isTemplate);

      result.originalFrameCount = frames1.length;

      if (frames1.length === 0) {
        result.error = '未解析到任何Frame';
        return result;
      }

      // 导出为FDF
      const exportedFDF = exportToFDF(frames1);

      // 第二次解析（使用相同的模板注册表）
      const parsed2 = parseFDFWithIncludes(exportedFDF, { 
        basePath,
        existingTemplateRegistry: parsed1.templateRegistry 
      });
      const frames2 = parsed2.frames.filter(f => !f.fdfMetadata?.isTemplate);

      result.exportedFrameCount = frames2.length;

      // 比较Frame数量
      if (frames1.length !== frames2.length) {
        result.error = `Frame数量不匹配: ${frames1.length} → ${frames2.length}`;
        return result;
      }

      // 逐个比较Frame
      const mismatches: Array<{ name: string; issue: string }> = [];
      
      for (let i = 0; i < frames1.length; i++) {
        const f1 = frames1[i];
        const f2 = frames2.find(f => f.name === f1.name);

        if (!f2) {
          mismatches.push({
            name: f1.name,
            issue: `Frame未在导出中找到`,
          });
          continue;
        }

        // 比较所有关键属性
        const issues: string[] = [];

        // 基础属性
        if (f1.type !== f2.type) {
          issues.push(`类型: ${f1.type} → ${f2.type}`);
        }
        if (Math.abs(f1.width - f2.width) > 0.0001) {
          issues.push(`宽度: ${f1.width} → ${f2.width}`);
        }
        if (Math.abs(f1.height - f2.height) > 0.0001) {
          issues.push(`高度: ${f1.height} → ${f2.height}`);
        }

        // 纹理属性
        if (f1.diskTexture !== f2.diskTexture) {
          issues.push(`磁盘纹理: ${f1.diskTexture} → ${f2.diskTexture}`);
        }
        if (f1.wc3Texture !== f2.wc3Texture) {
          issues.push(`WC3纹理: ${f1.wc3Texture} → ${f2.wc3Texture}`);
        }
        if (f1.backDiskTexture !== f2.backDiskTexture) {
          issues.push(`背景磁盘纹理: ${f1.backDiskTexture} → ${f2.backDiskTexture}`);
        }
        if (f1.backWc3Texture !== f2.backWc3Texture) {
          issues.push(`背景WC3纹理: ${f1.backWc3Texture} → ${f2.backWc3Texture}`);
        }

        // Backdrop边框属性
        if (f1.backdropEdgeFile !== f2.backdropEdgeFile) {
          issues.push(`边框纹理: ${f1.backdropEdgeFile} → ${f2.backdropEdgeFile}`);
        }
        if (f1.backdropCornerFlags !== f2.backdropCornerFlags) {
          issues.push(`边角标志: ${f1.backdropCornerFlags} → ${f2.backdropCornerFlags}`);
        }
        if (f1.backdropCornerSize !== f2.backdropCornerSize) {
          issues.push(`边角大小: ${f1.backdropCornerSize} → ${f2.backdropCornerSize}`);
        }
        if (f1.backdropBackgroundSize !== f2.backdropBackgroundSize) {
          issues.push(`背景大小: ${f1.backdropBackgroundSize} → ${f2.backdropBackgroundSize}`);
        }
        if (JSON.stringify(f1.backdropBackgroundInsets) !== JSON.stringify(f2.backdropBackgroundInsets)) {
          issues.push(`背景边距: ${JSON.stringify(f1.backdropBackgroundInsets)} → ${JSON.stringify(f2.backdropBackgroundInsets)}`);
        }
        if (f1.backdropTileBackground !== f2.backdropTileBackground) {
          issues.push(`平铺背景: ${f1.backdropTileBackground} → ${f2.backdropTileBackground}`);
        }
        if (f1.backdropBlendAll !== f2.backdropBlendAll) {
          issues.push(`混合所有: ${f1.backdropBlendAll} → ${f2.backdropBlendAll}`);
        }

        // 文本属性
        if (f1.text !== f2.text) {
          issues.push(`文本: ${f1.text} → ${f2.text}`);
        }
        if (f1.font !== f2.font) {
          issues.push(`字体: ${f1.font} → ${f2.font}`);
        }
        if (f1.fontSize !== f2.fontSize) {
          issues.push(`字体大小: ${f1.fontSize} → ${f2.fontSize}`);
        }
        if (JSON.stringify(f1.fontColor) !== JSON.stringify(f2.fontColor)) {
          issues.push(`字体颜色: ${JSON.stringify(f1.fontColor)} → ${JSON.stringify(f2.fontColor)}`);
        }
        if (f1.fontJustificationH !== f2.fontJustificationH) {
          issues.push(`水平对齐: ${f1.fontJustificationH} → ${f2.fontJustificationH}`);
        }
        if (f1.fontJustificationV !== f2.fontJustificationV) {
          issues.push(`垂直对齐: ${f1.fontJustificationV} → ${f2.fontJustificationV}`);
        }

        // Button属性
        if (f1.controlStyle !== f2.controlStyle) {
          issues.push(`控件样式: ${f1.controlStyle} → ${f2.controlStyle}`);
        }
        if (f1.controlBackdrop !== f2.controlBackdrop) {
          issues.push(`控件背景: ${f1.controlBackdrop} → ${f2.controlBackdrop}`);
        }
        if (f1.controlPushedBackdrop !== f2.controlPushedBackdrop) {
          issues.push(`按下背景: ${f1.controlPushedBackdrop} → ${f2.controlPushedBackdrop}`);
        }
        if (f1.controlDisabledBackdrop !== f2.controlDisabledBackdrop) {
          issues.push(`禁用背景: ${f1.controlDisabledBackdrop} → ${f2.controlDisabledBackdrop}`);
        }

        // Highlight属性
        if (f1.highlightType !== f2.highlightType) {
          issues.push(`高亮类型: ${f1.highlightType} → ${f2.highlightType}`);
        }
        if (f1.highlightAlphaFile !== f2.highlightAlphaFile) {
          issues.push(`高亮Alpha文件: ${f1.highlightAlphaFile} → ${f2.highlightAlphaFile}`);
        }
        if (f1.highlightAlphaMode !== f2.highlightAlphaMode) {
          issues.push(`高亮混合模式: ${f1.highlightAlphaMode} → ${f2.highlightAlphaMode}`);
        }

        // Slider属性
        if (f1.minValue !== f2.minValue) {
          issues.push(`最小值: ${f1.minValue} → ${f2.minValue}`);
        }
        if (f1.maxValue !== f2.maxValue) {
          issues.push(`最大值: ${f1.maxValue} → ${f2.maxValue}`);
        }
        if (f1.stepSize !== f2.stepSize) {
          issues.push(`步进值: ${f1.stepSize} → ${f2.stepSize}`);
        }

        // 可见性和透明度
        if (f1.visible !== f2.visible) {
          issues.push(`可见性: ${f1.visible} → ${f2.visible}`);
        }
        if (f1.alpha !== f2.alpha) {
          issues.push(`透明度: ${f1.alpha} → ${f2.alpha}`);
        }

        // 锚点数量（简单比较）
        if (f1.anchors.length !== f2.anchors.length) {
          issues.push(`锚点数: ${f1.anchors.length} → ${f2.anchors.length}`);
        }

        if (issues.length > 0) {
          mismatches.push({
            name: f1.name,
            issue: issues.join('; '),
          });
        }
      }

      if (mismatches.length > 0) {
        result.frameMismatches = mismatches;
        result.error = `${mismatches.length}个Frame属性不匹配`;
        return result;
      }

      // 所有检查通过
      result.success = true;

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  /**
   * 验证目录中的所有FDF文件
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
        if (result.frameMismatches && result.frameMismatches.length <= 3) {
          // 只显示前3个不匹配
          result.frameMismatches.slice(0, 3).forEach(m => {
            console.log(`    - ${m.name}: ${m.issue}`);
          });
          if (result.frameMismatches.length > 3) {
            console.log(`    ... 还有 ${result.frameMismatches.length - 3} 个Frame不匹配`);
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
   * 生成验证报告
   */
  generateReport(): void {
    console.log('\n========================================');
    console.log('           验证报告');
    console.log('========================================\n');

    console.log(`总文件数: ${this.totalFiles}`);
    console.log(`成功: ${this.successCount} (${((this.successCount / this.totalFiles) * 100).toFixed(1)}%)`);
    console.log(`失败: ${this.failureCount} (${((this.failureCount / this.totalFiles) * 100).toFixed(1)}%)`);

    if (this.failureCount > 0) {
      console.log('\n失败文件详情:\n');

      const failures = this.results.filter(r => !r.success);
      failures.forEach((result, index) => {
        console.log(`${index + 1}. ${result.file}`);
        console.log(`   错误: ${result.error}`);
        console.log(`   Frame数: ${result.originalFrameCount} → ${result.exportedFrameCount}`);

        if (result.frameMismatches && result.frameMismatches.length > 0) {
          console.log(`   不匹配Frame数: ${result.frameMismatches.length}`);
          result.frameMismatches.slice(0, 5).forEach(m => {
            console.log(`     - ${m.name}: ${m.issue}`);
          });
          if (result.frameMismatches.length > 5) {
            console.log(`     ... 还有 ${result.frameMismatches.length - 5} 个`);
          }
        }
        console.log('');
      });
    }

    // 保存详细报告
    const reportPath = path.join(process.cwd(), 'tests', 'fdf-validation-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      summary: {
        totalFiles: this.totalFiles,
        successCount: this.successCount,
        failureCount: this.failureCount,
        successRate: ((this.successCount / this.totalFiles) * 100).toFixed(2) + '%',
      },
      results: this.results,
    }, null, 2), 'utf-8');

    console.log(`详细报告已保存: ${reportPath}`);
  }

  /**
   * 生成错误统计
   */
  analyzeErrors(): void {
    const errorTypes = new Map<string, number>();
    const propertyIssues = new Map<string, number>();

    this.results.filter(r => !r.success).forEach(result => {
      if (result.error) {
        const errorKey = result.error.split(':')[0];
        errorTypes.set(errorKey, (errorTypes.get(errorKey) || 0) + 1);
      }

      if (result.frameMismatches) {
        result.frameMismatches.forEach(m => {
          const props = m.issue.split(';');
          props.forEach(prop => {
            const propName = prop.split(':')[0].trim();
            propertyIssues.set(propName, (propertyIssues.get(propName) || 0) + 1);
          });
        });
      }
    });

    if (errorTypes.size > 0) {
      console.log('\n错误类型统计:');
      Array.from(errorTypes.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`  ${type}: ${count} 次`);
        });
    }

    if (propertyIssues.size > 0) {
      console.log('\n属性不匹配统计:');
      Array.from(propertyIssues.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([prop, count]) => {
          console.log(`  ${prop}: ${count} 次`);
        });
    }
  }
}

// 主函数
async function main() {
  console.log('========================================');
  console.log('   官方FDF文件往返验证');
  console.log('========================================\n');

  const validator = new FDFValidator();

  // 验证目录
  const fdfDir = path.join(process.cwd(), 'target', 'vendor', 'UI', 'FrameDef');

  console.log(`验证目录: ${fdfDir}\n`);

  validator.validateDirectory(fdfDir);

  // 生成报告
  validator.generateReport();

  // 错误分析
  validator.analyzeErrors();

  console.log('\n========================================');
  console.log('验证完成！');
  console.log('========================================');
}

main().catch(console.error);
