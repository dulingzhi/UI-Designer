/**
 * FDF 解析器测试示例
 */

import { parseFDF, exportFDF, validateFDF, formatFDF } from '../utils/fdf';

// 测试 FDF 文本
const testFDF = `
// 测试注释
IncludeFile "UI\\FrameDef\\UI\\EscMenuTemplates.fdf"

Frame "BACKDROP" "TestBackdrop" {
  Width 0.256
  Height 0.032
  SetPoint TOPLEFT, "UIParent", TOPLEFT, 0.0, 0.0
  
  Texture {
    File "EscMenuBackground"
    TexCoord 0.0, 1.0, 0.0, 1.0
    AlphaMode "BLEND"
  }
}

Frame "TEXT" "TestText" INHERITS "EscMenuButtonTextTemplate" {
  Width 0.2
  Height 0.03
  Text "Hello World"
  FontColor 1.0 1.0 1.0 1.0
  FontJustificationH JUSTIFYCENTER
  FontJustificationV JUSTIFYMIDDLE
  
  String {
    Text "COLON_ARMOR"
  }
}

Frame "BUTTON" "TestButton" {
  Width 0.15
  Height 0.04
  Anchor TOPLEFT, 0.1, 0.1
  
  ControlBackdrop "EscMenuButtonBackdrop"
  ControlPushedBackdrop "EscMenuButtonPushedBackdrop"
  
  Texture {
    File "UI\\Widgets\\EscMenu\\Human\\editbox-background.blp"
  }
}
`;

// 测试函数
export function testFDFParser() {
  console.log('========== FDF 解析器测试 ==========\n');
  
  // 1. 验证 FDF 格式
  console.log('1. 验证 FDF 格式:');
  const validation = validateFDF(testFDF);
  console.log('  有效:', validation.valid);
  console.log('  错误:', validation.errors);
  console.log('  警告:', validation.warnings);
  console.log('');
  
  // 2. 解析 FDF
  console.log('2. 解析 FDF:');
  try {
    const frames = parseFDF(testFDF, {
      baseWidth: 800,
      baseHeight: 600,
      resolveInheritance: false, // 暂不解析继承
    });
    
    console.log(`  解析成功! 找到 ${frames.length} 个 Frame:`);
    frames.forEach((frame, index) => {
      console.log(`  Frame ${index + 1}:`);
      console.log(`    名称: ${frame.name}`);
      console.log(`    类型: ${frame.type}`);
      console.log(`    尺寸: ${frame.width} x ${frame.height}`);
      console.log(`    锚点数: ${frame.anchors.length}`);
      if (frame.text) {
        console.log(`    文本: ${frame.text}`);
      }
      if (frame.texture) {
        console.log(`    纹理: ${frame.texture}`);
      }
    });
    console.log('');
    
    // 3. 导出为 FDF
    console.log('3. 导出为 FDF:');
    const exportedFDF = exportFDF(frames, {
      indent: '  ',
      includeComments: true,
    });
    console.log(exportedFDF);
    console.log('');
    
    // 4. 格式化 FDF
    console.log('4. 格式化 FDF:');
    const formattedFDF = formatFDF(testFDF, {
      indent: '\t',
      includeComments: true,
    });
    console.log(formattedFDF);
    
  } catch (error) {
    console.error('  解析失败:', error);
  }
  
  console.log('\n========== 测试完成 ==========');
}

// 在开发环境下自动运行测试
if (import.meta.env.DEV) {
  // testFDFParser(); // 取消注释以运行测试
}
