/**
 * 测试 ConfirmQuitQuitButton 和 ConfirmQuitCancelButton 的位置计算
 */

import { parseFDF } from '../src/utils/fdf';
import { calculatePositionFromAnchors } from '../src/utils/anchorUtils';
import * as fs from 'fs';
import * as path from 'path';

const fdfPath = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef', 'UI', 'EscMenuMainPanel.fdf');
const content = fs.readFileSync(fdfPath, 'utf-8');

console.log('解析 EscMenuMainPanel.fdf...\n');
const frames = parseFDF(content);

// 构建 framesMap
const framesMap: Record<string, any> = {};
for (const frame of frames) {
  framesMap[frame.id] = frame;
}

// 计算所有Frame的位置
console.log('计算所有Frame的位置...\n');
for (const frame of frames) {
  const calculatedPos = calculatePositionFromAnchors(frame, framesMap);
  if (calculatedPos) {
    Object.assign(frame, calculatedPos);
  }
}

// 查找关键Frame
const escMenu = frames.find(f => f.name === 'EscMenuMainPanel');
const confirmQuitPanel = frames.find(f => f.name === 'ConfirmQuitPanel');
const quitBtn = frames.find(f => f.name === 'ConfirmQuitQuitButton');
const cancelBtn = frames.find(f => f.name === 'ConfirmQuitCancelButton');

console.log('='.repeat(80));
console.log('EscMenuMainPanel');
console.log('='.repeat(80));
console.log(`位置: (${escMenu?.x.toFixed(3)}, ${escMenu?.y.toFixed(3)})`);
console.log(`尺寸: ${escMenu?.width.toFixed(3)} × ${escMenu?.height.toFixed(3)}`);
console.log(`BOTTOMLEFT: (${escMenu?.x.toFixed(3)}, ${escMenu?.y.toFixed(3)})`);

console.log('\n' + '='.repeat(80));
console.log('ConfirmQuitPanel');
console.log('='.repeat(80));
console.log(`位置: (${confirmQuitPanel?.x.toFixed(3)}, ${confirmQuitPanel?.y.toFixed(3)})`);
console.log(`尺寸: ${confirmQuitPanel?.width.toFixed(3)} × ${confirmQuitPanel?.height.toFixed(3)}`);

console.log('\n' + '='.repeat(80));
console.log('ConfirmQuitQuitButton');
console.log('='.repeat(80));
console.log(`位置: (${quitBtn?.x.toFixed(3)}, ${quitBtn?.y.toFixed(3)})`);
console.log(`尺寸: ${quitBtn?.width.toFixed(3)} × ${quitBtn?.height.toFixed(3)}`);
console.log(`RIGHT边界: ${(quitBtn!.x + quitBtn!.width).toFixed(3)}`);
console.log('\n锚点:');
console.log(`  point: ${quitBtn?.anchors[0].point} (BOTTOMLEFT)`);
console.log(`  relativeTo: EscMenuMainPanel`);
console.log(`  relativePoint: ${quitBtn?.anchors[0].relativePoint} (BOTTOMLEFT)`);
console.log(`  offset: (${quitBtn?.anchors[0].x}, ${quitBtn?.anchors[0].y})`);

console.log('\n' + '='.repeat(80));
console.log('ConfirmQuitCancelButton');
console.log('='.repeat(80));
console.log(`位置: (${cancelBtn?.x.toFixed(3)}, ${cancelBtn?.y.toFixed(3)})`);
console.log(`尺寸: ${cancelBtn?.width.toFixed(3)} × ${cancelBtn?.height.toFixed(3)}`);
console.log(`RIGHT边界: ${(cancelBtn!.x + cancelBtn!.width).toFixed(3)}`);
console.log('\n锚点:');
console.log(`  point: ${cancelBtn?.anchors[0].point} (LEFT)`);
console.log(`  relativeTo: ConfirmQuitQuitButton`);
console.log(`  relativePoint: ${cancelBtn?.anchors[0].relativePoint} (RIGHT)`);
console.log(`  offset: (${cancelBtn?.anchors[0].x}, ${cancelBtn?.anchors[0].y})`);

console.log('\n' + '='.repeat(80));
console.log('位置验证');
console.log('='.repeat(80));
const quitBtnRight = quitBtn!.x + quitBtn!.width;
const expectedCancelX = quitBtnRight + cancelBtn!.anchors[0].x;
console.log(`QuitButton RIGHT边界: ${quitBtnRight.toFixed(3)}`);
console.log(`预期 CancelButton.x = ${quitBtnRight.toFixed(3)} + ${cancelBtn?.anchors[0].x.toFixed(3)} = ${expectedCancelX.toFixed(3)}`);
console.log(`实际 CancelButton.x = ${cancelBtn?.x.toFixed(3)}`);
console.log(`差值: ${Math.abs(expectedCancelX - cancelBtn!.x).toFixed(6)}`);

if (Math.abs(expectedCancelX - cancelBtn!.x) < 0.001) {
  console.log('\n✅ CancelButton 位置正确!');
} else {
  console.log('\n❌ CancelButton 位置不正确!');
}

console.log('\n' + '='.repeat(80));
console.log('水平布局');
console.log('='.repeat(80));
console.log(`QuitButton:   [${quitBtn?.x.toFixed(3)} ──→ ${quitBtnRight.toFixed(3)}] (宽度: ${quitBtn?.width.toFixed(3)})`);
console.log(`CancelButton: [${cancelBtn?.x.toFixed(3)} ──→ ${(cancelBtn!.x + cancelBtn!.width).toFixed(3)}] (宽度: ${cancelBtn?.width.toFixed(3)})`);
console.log(`间距: ${(cancelBtn!.x - quitBtnRight).toFixed(3)}`);
