/**
 * FDF 布局调试脚本
 * 显示 EscMenuMainPanel.fdf 导入后的布局信息
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFDF } from '../src/utils/fdf.ts';
import { calculatePositionFromAnchors } from '../src/utils/anchorUtils.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fdfPath = path.join(__dirname, '../vendor/UI/FrameDef/UI/EscMenuMainPanel.fdf');
const fdfContent = fs.readFileSync(fdfPath, 'utf-8');

console.log('🔍 解析 EscMenuMainPanel.fdf...\n');

const frames = parseFDF(fdfContent);

console.log(`📊 共解析 ${frames.length} 个 Frame\n`);

// 将 frames 数组转换为 Record<string, FrameData> 格式
const framesMap: Record<string, any> = {};
for (const frame of frames) {
  framesMap[frame.id] = frame;
}

// 为所有 Frame 计算实际位置
console.log('🔧 计算所有 Frame 的实际位置...\n');
for (const frame of frames) {
  const calculatedPos = calculatePositionFromAnchors(frame, framesMap);
  Object.assign(frame, calculatedPos);
}

// 显示关键 Frame 的布局信息
const keyFrames = [
  'EscMenuMainPanel',
  'MainPanel',
  'WouldTheRealOptionsTitleTextPleaseStandUp',
  'PauseButton',
  'SaveGameButton',
  'LoadGameButton',
];

console.log('=' .repeat(80));
console.log('关键 Frame 布局信息');
console.log('='.repeat(80));

for (const frameName of keyFrames) {
  const frame = frames.find(f => f.name === frameName);
  if (!frame) {
    console.log(`❌ 未找到 ${frameName}\n`);
    continue;
  }
  
  console.log(`\n📦 ${frameName}`);
  console.log(`   类型: ${frame.type}`);
  console.log(`   位置: (${frame.x.toFixed(3)}, ${frame.y.toFixed(3)})`);
  console.log(`   尺寸: ${frame.width.toFixed(3)} × ${frame.height.toFixed(3)}`);
  console.log(`   父元素: ${frame.parentId || '(顶层)'}`);
  console.log(`   子元素数量: ${frame.children.length}`);
  
  if (frame.anchors && frame.anchors.length > 0) {
    console.log(`   锚点 (${frame.anchors.length}):`);
    for (const anchor of frame.anchors) {
      const pointNames = ['TOPLEFT', 'TOP', 'TOPRIGHT', 'LEFT', 'CENTER', 'RIGHT', 'BOTTOMLEFT', 'BOTTOM', 'BOTTOMRIGHT'];
      const pointName = pointNames[anchor.point] || `Point${anchor.point}`;
      const relativeToName = anchor.relativeTo 
        ? frames.find(f => f.id === anchor.relativeTo)?.name || anchor.relativeTo
        : '(绝对)';
      const relativePointName = anchor.relativePoint !== undefined 
        ? pointNames[anchor.relativePoint] || `Point${anchor.relativePoint}`
        : '';
      
      if (anchor.relativeTo) {
        console.log(`     - ${pointName} → ${relativeToName}.${relativePointName} + (${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`);
      } else {
        console.log(`     - ${pointName} @ (${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`);
      }
    }
  } else {
    console.log(`   锚点: (无)`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('画布布局检查');
console.log('='.repeat(80));

// 检查 MainPanel 是否在画布中央
const escMenuMainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
const mainPanel = frames.find(f => f.name === 'MainPanel');

if (escMenuMainPanel && mainPanel) {
  const canvasWidth = 0.8;
  const canvasHeight = 0.6;
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  
  const mainPanelCenterX = mainPanel.x + mainPanel.width / 2;
  const mainPanelCenterY = mainPanel.y + mainPanel.height / 2;
  
  console.log(`\n画布尺寸: ${canvasWidth} × ${canvasHeight}`);
  console.log(`画布中心: (${canvasCenterX.toFixed(3)}, ${canvasCenterY.toFixed(3)})`);
  console.log(`\nMainPanel 尺寸: ${mainPanel.width.toFixed(3)} × ${mainPanel.height.toFixed(3)}`);
  console.log(`MainPanel 中心: (${mainPanelCenterX.toFixed(3)}, ${mainPanelCenterY.toFixed(3)})`);
  
  const offsetX = Math.abs(mainPanelCenterX - canvasCenterX);
  const offsetY = Math.abs(mainPanelCenterY - canvasCenterY);
  
  console.log(`\n居中偏移: X=${offsetX.toFixed(3)}, Y=${offsetY.toFixed(3)}`);
  
  if (offsetX < 0.001 && offsetY < 0.001) {
    console.log('✅ MainPanel 正确居中于画布');
  } else {
    console.log('⚠️  MainPanel 未居中，可能存在布局问题');
  }
}

console.log('\n' + '='.repeat(80));
console.log('按钮垂直布局检查');
console.log('='.repeat(80));

const buttons = [
  'PauseButton',
  'SaveGameButton',
  'LoadGameButton',
  'OptionsButton',
  'HelpButton',
  'TipsButton',
];

console.log('\n按钮垂直位置 (Y 坐标，从上到下递减):');
for (const buttonName of buttons) {
  const button = frames.find(f => f.name === buttonName);
  if (button) {
    const topY = button.y + button.height;
    const bottomY = button.y;
    console.log(`  ${buttonName.padEnd(20)} Top: ${topY.toFixed(3)}, Bottom: ${bottomY.toFixed(3)}`);
  }
}

console.log('\n');
