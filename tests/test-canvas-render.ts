/**
 * 测试 Canvas 渲染逻辑
 * 模拟从 w3ui 项目文件加载的数据
 */

import { calculatePositionFromAnchors } from '../src/utils/anchorUtils';
import { FrameData } from '../src/types';

// 从 myproject.w3ui 加载的实际数据
const frames: Record<string, FrameData> = {
  "frame_1762438326352_ap36bd2bs": {
    "id": "frame_1762438326352_ap36bd2bs",
    "name": "ConfirmQuitQuitButton",
    "type": 2,
    "x": 0,
    "y": 0,
    "width": 0.129,
    "height": 0.1,
    "z": 0,
    "parentId": null,
    "children": [],
    "tooltip": false,
    "isRelative": false,
    "anchors": [
      {
        "point": 6,
        "relativeTo": "frame_1762438326352_j74eyl3e3",
        "relativePoint": 6,
        "x": 0.035,
        "y": 0.03
      }
    ],
    "diskTexture": "",
    "wc3Texture": ""
  },
  "frame_1762438326352_t91jkb4x6": {
    "id": "frame_1762438326352_t91jkb4x6",
    "name": "ConfirmQuitCancelButton",
    "type": 2,
    "x": 0,
    "y": 0,
    "width": 0.129,
    "height": 0.1,
    "z": 0,
    "parentId": null,
    "children": [],
    "tooltip": false,
    "isRelative": false,
    "anchors": [
      {
        "point": 3,
        "relativeTo": "frame_1762438326352_ap36bd2bs",
        "relativePoint": 5,
        "x": 0.006,
        "y": 0
      }
    ],
    "diskTexture": "",
    "wc3Texture": ""
  },
  // 假设的 EscMenuMainPanel (作为参考点)
  "frame_1762438326352_j74eyl3e3": {
    "id": "frame_1762438326352_j74eyl3e3",
    "name": "EscMenuMainPanel",
    "type": 1,
    "x": 0,
    "y": 0,
    "width": 0.8,
    "height": 0.6,
    "z": 0,
    "parentId": null,
    "children": [],
    "tooltip": false,
    "isRelative": false,
    "anchors": [
      {
        "point": 4, // CENTER
        "x": 0.4,
        "y": 0.3
      }
    ],
    "diskTexture": "",
    "wc3Texture": ""
  }
};

console.log('='.repeat(60));
console.log('测试 Canvas 渲染逻辑');
console.log('='.repeat(60));

// 测试 QuitButton
const quitButton = frames["frame_1762438326352_ap36bd2bs"];
console.log('\n1. ConfirmQuitQuitButton:');
console.log('   原始位置:', { x: quitButton.x, y: quitButton.y });
console.log('   锚点:', quitButton.anchors);

const quitCalc = calculatePositionFromAnchors(quitButton, frames);
console.log('   计算结果:', quitCalc);

if (quitCalc) {
  console.log('   ✅ 应该渲染在:', { x: quitCalc.x, y: quitCalc.y });
} else {
  console.log('   ❌ 计算失败! 会使用原始位置:', { x: quitButton.x, y: quitButton.y });
}

// 测试 CancelButton
const cancelButton = frames["frame_1762438326352_t91jkb4x6"];
console.log('\n2. ConfirmQuitCancelButton:');
console.log('   原始位置:', { x: cancelButton.x, y: cancelButton.y });
console.log('   锚点:', cancelButton.anchors);

const cancelCalc = calculatePositionFromAnchors(cancelButton, frames);
console.log('   计算结果:', cancelCalc);

if (cancelCalc) {
  console.log('   ✅ 应该渲染在:', { x: cancelCalc.x, y: cancelCalc.y });
} else {
  console.log('   ❌ 计算失败! 会使用原始位置:', { x: cancelButton.x, y: cancelButton.y });
}

// 验证位置关系
console.log('\n' + '='.repeat(60));
console.log('位置关系验证:');
console.log('='.repeat(60));

if (quitCalc && cancelCalc) {
  const quitRight = quitCalc.x + quitCalc.width;
  const expectedCancelX = quitRight + 0.006;
  
  console.log(`QuitButton 右边缘: ${quitRight.toFixed(3)}`);
  console.log(`CancelButton 期望 x: ${expectedCancelX.toFixed(3)}`);
  console.log(`CancelButton 实际 x: ${cancelCalc.x.toFixed(3)}`);
  console.log(`Y 坐标对齐: Quit=${quitCalc.y.toFixed(3)}, Cancel=${cancelCalc.y.toFixed(3)}`);
  
  if (Math.abs(cancelCalc.x - expectedCancelX) < 0.001) {
    console.log('✅ X 位置正确!');
  } else {
    console.log('❌ X 位置错误!');
  }
  
  if (Math.abs(cancelCalc.y - quitCalc.y) < 0.001) {
    console.log('✅ Y 位置对齐正确!');
  } else {
    console.log(`❌ Y 位置不对齐! 差异: ${Math.abs(cancelCalc.y - quitCalc.y).toFixed(3)}`);
  }
} else {
  console.log('❌ 无法验证,因为计算返回了 null!');
  console.log('\n可能的原因:');
  console.log('1. relativeTo 的 Frame ID 不存在于 frames 对象中');
  console.log('2. calculatePositionFromAnchors 返回了 null');
}
