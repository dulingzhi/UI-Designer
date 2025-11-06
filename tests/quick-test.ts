/**
 * 快速测试 - 检查 parseFDF 返回的 Frame 数量
 */

import { parseFDF } from '../src/utils/fdf';
import * as fs from 'fs';
import * as path from 'path';

const fdfPath = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef', 'UI', 'EscMenuMainPanel.fdf');
const content = fs.readFileSync(fdfPath, 'utf-8');

console.log('解析 EscMenuMainPanel.fdf...\n');
const frames = parseFDF(content);

console.log(`顶层 frames.length: ${frames.length}`);
console.log('\n顶层 Frame列表:');
for (const frame of frames) {
  console.log(`  - ${frame.name} (id: ${frame.id})`);
  console.log(`    type: ${frame.type}, children: [${frame.children.join(', ')}]`);
  
  if (frame.anchors && frame.anchors.length > 0) {
    console.log(`    anchors: ${frame.anchors.length}`);
    for (const anchor of frame.anchors) {
      console.log(`      - point ${anchor.point}, relativeTo: ${anchor.relativeTo || '(absolute)'}`);
    }
  }
}

// 尝试通过children ID查找嵌套Frame
console.log('\n\n尝试在顶层frames中查找children...');
const escMenu = frames.find(f => f.name === 'EscMenuMainPanel');
if (escMenu && escMenu.children.length > 0) {
  console.log(`EscMenuMainPanel 有 ${escMenu.children.length} 个children:`, escMenu.children);
  
  for (const childId of escMenu.children) {
    const childFrame = frames.find(f => f.id === childId);
    if (childFrame) {
      console.log(`  ✅ 找到 child: ${childFrame.name} (${childId})`);
    } else {
      console.log(`  ❌ 未找到 child ID: ${childId}`);
    }
  }
}

console.log('\n\n查找特定Frame:');
const testNames = ['MainPanel', 'PauseButton', 'SaveGameButton', 'EndGamePanel', 'ConfirmQuitPanel'];
for (const name of testNames) {
  const found = frames.find(f => f.name === name);
  if (found) {
    console.log(`  ✅ ${name} - ID: ${found.id}, parentId: ${found.parentId || '(top-level)'}`);
  } else {
    console.log(`  ❌ ${name} - 未找到`);
  }
}
