/**
 * 批量导入测试 - 测试所有FDF文件的导入功能
 */

import fs from 'fs';
import path from 'path';
import { parseFDF } from '../src/utils/fdf';
import { FrameData } from '../src/types';

const FDF_DIR = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef', 'UI');

interface TestResult {
  file: string;
  success: boolean;
  frameCount: number;
  error?: string;
  warnings: string[];
}

class BatchImportTester {
  private results: TestResult[] = [];
  
  async testAllFDFs() {
    console.log('🔍 扫描FDF文件...\n');
    
    const files = this.getAllFDFFiles(FDF_DIR);
    console.log(`找到 ${files.length} 个FDF文件\n`);
    
    for (const file of files) {
      await this.testFile(file);
    }
    
    this.printSummary();
  }
  
  private getAllFDFFiles(dir: string): string[] {
    const files: string[] = [];
    
    const scanDir = (currentDir: string) => {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDir(fullPath);
        } else if (item.endsWith('.fdf')) {
          files.push(fullPath);
        }
      }
    };
    
    scanDir(dir);
    return files;
  }
  
  private async testFile(filePath: string) {
    const relativePath = path.relative(process.cwd(), filePath);
    const warnings: string[] = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const frames = parseFDF(content);
      
      // 检查是否有帧
      if (frames.length === 0) {
        warnings.push('没有解析到任何Frame');
      }
      
      // 检查嵌套Frame
      let nestedCount = 0;
      frames.forEach((frame: FrameData) => {
        if (frame.children && frame.children.length > 0) {
          nestedCount += frame.children.length;
        }
      });
      
      // 检查锚点
      let anchorCount = 0;
      let relativeAnchorCount = 0;
      frames.forEach((frame: FrameData) => {
        if (frame.anchors && frame.anchors.length > 0) {
          anchorCount++;
          if (frame.anchors.some(a => a.relativeTo)) {
            relativeAnchorCount++;
          }
        }
      });
      
      // 检查无位置信息的Frame
      let noPositionCount = 0;
      frames.forEach((frame: FrameData) => {
        if (!frame.anchors || frame.anchors.length === 0) {
          if (frame.width && frame.height) {
            noPositionCount++;
          }
        }
      });
      
      if (noPositionCount > 0) {
        warnings.push(`${noPositionCount}个Frame只有Width+Height没有锚点`);
      }
      
      this.results.push({
        file: relativePath,
        success: true,
        frameCount: frames.length,
        warnings
      });
      
      console.log(`✅ ${relativePath}`);
      console.log(`   帧数: ${frames.length} (嵌套: ${nestedCount}, 锚点: ${anchorCount}, 相对锚点: ${relativeAnchorCount})`);
      if (warnings.length > 0) {
        warnings.forEach(w => console.log(`   ⚠️  ${w}`));
      }
      console.log();
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.results.push({
        file: relativePath,
        success: false,
        frameCount: 0,
        error: errorMsg,
        warnings
      });
      
      console.log(`❌ ${relativePath}`);
      console.log(`   错误: ${errorMsg}`);
      console.log();
    }
  }
  
  private printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 批量导入测试汇总');
    console.log('='.repeat(80));
    
    const successCount = this.results.filter(r => r.success).length;
    const failCount = this.results.filter(r => !r.success).length;
    const totalFrames = this.results.reduce((sum, r) => sum + r.frameCount, 0);
    const warningCount = this.results.reduce((sum, r) => sum + r.warnings.length, 0);
    
    console.log(`\n总文件数: ${this.results.length}`);
    console.log(`✅ 成功: ${successCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`📦 总帧数: ${totalFrames}`);
    console.log(`⚠️  警告数: ${warningCount}`);
    
    if (failCount > 0) {
      console.log('\n失败的文件:');
      this.results.filter(r => !r.success).forEach(r => {
        console.log(`  ❌ ${r.file}`);
        console.log(`     ${r.error}`);
      });
    }
    
    if (warningCount > 0) {
      console.log('\n有警告的文件:');
      this.results.filter(r => r.warnings.length > 0).forEach(r => {
        console.log(`  ⚠️  ${r.file}`);
        r.warnings.forEach(w => console.log(`     - ${w}`));
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
    if (failCount === 0) {
      console.log('🎉 所有FDF文件导入成功!');
    } else {
      console.log(`⚠️  ${failCount} 个文件导入失败`);
    }
    
    console.log('='.repeat(80));
  }
}

// 运行测试
const tester = new BatchImportTester();
tester.testAllFDFs();
