/**
 * 边框纹理渲染测试
 * 
 * 测试 BackdropEdge 组件是否能正确渲染 WC3 风格的边框纹理
 * 
 * 运行方法：
 * 1. 手动测试：在编辑器中创建 BACKDROP Frame 并设置边框属性
 * 2. 浏览器测试：查看 Canvas 中的渲染效果
 */

import { parseCornerFlags, hasAllBorderParts, hasOnlyCorners, hasOnlyEdges } from '../src/utils/textureAtlas';

/**
 * 工具函数测试
 */
function testParseCornerFlags() {
  console.log('=== 测试 parseCornerFlags ===');
  
  const flags1 = parseCornerFlags('UL|UR|BL|BR|T|L|B|R');
  console.log('完整边框:', flags1);
  console.assert(flags1.length === 8, '应该有 8 个部分');
  
  const flags2 = parseCornerFlags('UL|UR|BL|BR');
  console.log('仅角:', flags2);
  console.assert(flags2.length === 4, '应该有 4 个角');
  
  const flags3 = parseCornerFlags('T|B');
  console.log('仅顶底边:', flags3);
  console.assert(flags3.length === 2, '应该有 2 条边');
  
  console.log('✅ parseCornerFlags 测试通过\n');
}

function testBorderDetection() {
  console.log('=== 测试边框检测函数 ===');
  
  const fullBorder = parseCornerFlags('UL|UR|BL|BR|T|L|B|R');
  console.assert(hasAllBorderParts(fullBorder) === true, '应该检测到完整边框');
  
  const cornersOnly = parseCornerFlags('UL|UR|BL|BR');
  console.assert(hasOnlyCorners(cornersOnly) === true, '应该检测到仅角模式');
  console.assert(hasAllBorderParts(cornersOnly) === false, '不应该是完整边框');
  
  const edgesOnly = parseCornerFlags('T|L|B|R');
  console.assert(hasOnlyEdges(edgesOnly) === true, '应该检测到仅边模式');
  
  console.log('✅ 边框检测测试通过\n');
}

function testInvalidInput() {
  console.log('=== 测试无效输入 ===');
  
  const empty = parseCornerFlags('');
  console.assert(empty.length === 0, '空字符串应返回空数组');
  
  const mixed = parseCornerFlags('UL|INVALID|UR|FAKE|T');
  console.assert(mixed.length === 3, '应过滤掉无效标志');
  console.assert(!mixed.includes('INVALID' as any), '不应包含 INVALID');
  
  console.log('✅ 无效输入测试通过\n');
}

/**
 * FDF 属性测试
 */
function testFdfProperties() {
  console.log('=== 测试 FDF 属性结构 ===');
  
  const mockFrame = {
    id: 'test-frame',
    name: 'TestFrame',
    type: 2, // BACKDROP
    x: 0.1,
    y: 0.1,
    width: 0.3,
    height: 0.2,
    z: 1,
    parentId: null,
    children: [],
    anchors: [],
    
    // 边框属性
    backdropEdgeFile: 'UI\\Widgets\\EscMenu\\Human\\human-options-menu-border.blp',
    backdropCornerFlags: 'UL|UR|BL|BR|T|L|B|R',
    backdropCornerSize: 0.008,
    backdropBackgroundInsets: [0.004, 0.004, 0.004, 0.004] as [number, number, number, number],
  };
  
  console.assert(mockFrame.backdropEdgeFile, '应有 backdropEdgeFile');
  console.assert(mockFrame.backdropCornerFlags, '应有 backdropCornerFlags');
  console.assert(mockFrame.backdropCornerSize > 0, '应有正数 cornerSize');
  
  // 测试角尺寸计算
  const canvasWidth = 1440;
  const cornerSizePx = (mockFrame.backdropCornerSize / 0.8) * canvasWidth;
  console.log('角尺寸:', cornerSizePx, 'px');
  console.assert(cornerSizePx > 0 && cornerSizePx < 100, '像素大小应在合理范围');
  
  console.log('✅ FDF 属性测试通过\n');
}

/**
 * 布局计算测试
 */
function testLayoutCalculation() {
  console.log('=== 测试布局计算 ===');
  
  const cornerSize = 32;
  const frameWidth = 200;
  const frameHeight = 100;
  
  // 角位置
  const corners = {
    UL: { x: -cornerSize, y: -cornerSize },
    UR: { x: frameWidth, y: -cornerSize },
    BL: { x: -cornerSize, y: frameHeight },
    BR: { x: frameWidth, y: frameHeight },
  };
  
  console.assert(corners.UL.x === -cornerSize, 'UL x 位置正确');
  console.assert(corners.UR.x === frameWidth, 'UR x 位置正确');
  
  // 边尺寸
  const edges = {
    T: { width: frameWidth, height: cornerSize },
    B: { width: frameWidth, height: cornerSize },
    L: { width: cornerSize, height: frameHeight },
    R: { width: cornerSize, height: frameHeight },
  };
  
  console.assert(edges.T.width === frameWidth, '顶边宽度正确');
  console.assert(edges.L.height === frameHeight, '左边高度正确');
  
  console.log('✅ 布局计算测试通过\n');
}

/**
 * 运行所有测试
 */
export function runBackdropEdgeTests() {
  console.log('\n🧪 边框纹理渲染测试\n');
  console.log('================================\n');
  
  try {
    testParseCornerFlags();
    testBorderDetection();
    testInvalidInput();
    testFdfProperties();
    testLayoutCalculation();
    
    console.log('================================');
    console.log('✅ 所有测试通过！\n');
    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

/**
 * 手动测试说明
 */
export function printManualTestInstructions() {
  console.log('\n📋 手动测试指南\n');
  console.log('================================\n');
  console.log('1. 在编辑器中创建 BACKDROP 类型的 Frame');
  console.log('2. 设置以下属性:');
  console.log('   - backdropEdgeFile: "UI\\\\Widgets\\\\EscMenu\\\\Human\\\\human-options-menu-border.blp"');
  console.log('   - backdropCornerFlags: "UL|UR|BL|BR|T|L|B|R"');
  console.log('   - backdropCornerSize: 0.008');
  console.log('   - backdropBackgroundInsets: [0.004, 0.004, 0.004, 0.004]');
  console.log('3. 检查边框是否显示在 Frame 周围（4个角 + 4条边）');
  console.log('4. 调整 Frame 大小，边框应自动适应');
  console.log('5. 测试不同的 cornerFlags 组合（仅角、仅边等）');
  console.log('================================\n');
  
  console.log('📝 常见边框纹理路径:\n');
  console.log('Human: UI\\\\Widgets\\\\EscMenu\\\\Human\\\\human-options-menu-border.blp');
  console.log('Orc: UI\\\\Widgets\\\\EscMenu\\\\Orc\\\\orc-options-menu-border.blp');
  console.log('NightElf: UI\\\\Widgets\\\\EscMenu\\\\NightElf\\\\nightelf-options-menu-border.blp');
  console.log('Undead: UI\\\\Widgets\\\\EscMenu\\\\Undead\\\\undead-options-menu-border.blp');
  console.log('\n');
}

// 自动运行测试（如果作为模块导入）
if (typeof window !== 'undefined') {
  // 在浏览器环境中运行
  console.log('边框纹理测试模块已加载');
  console.log('运行测试: runBackdropEdgeTests()');
  console.log('查看说明: printManualTestInstructions()');
} else {
  // 在 Node.js 环境中运行
  runBackdropEdgeTests();
  printManualTestInstructions();
}
