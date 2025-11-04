/**
 * 对齐辅助线系统
 * 提供拖动时的智能参考线和吸附功能
 */

import { GuideLine as CustomGuideLine } from '../types';

export interface GuideLine {
  type: 'vertical' | 'horizontal';
  position: number;  // x 或 y 坐标
  source: 'edge' | 'center';  // 来源：边缘或中心
}

export interface SnapResult {
  x: number;
  y: number;
  snapped: boolean;
  guidelines: GuideLine[];
}

const SNAP_THRESHOLD = 5; // 吸附阈值（像素）

/**
 * 计算吸附位置和辅助线
 */
export function calculateSnap(
  dragX: number,
  dragY: number,
  dragWidth: number,
  dragHeight: number,
  otherFrames: Array<{ x: number; y: number; width: number; height: number }>,
  snapEnabled: boolean = true,
  customGuides?: CustomGuideLine[]  // 添加自定义参考线参数
): SnapResult {
  if (!snapEnabled) {
    return {
      x: dragX,
      y: dragY,
      snapped: false,
      guidelines: [],
    };
  }

  let snapX = dragX;
  let snapY = dragY;
  const guidelines: GuideLine[] = [];

  // 当前Frame的关键点
  const dragLeft = dragX;
  const dragRight = dragX + dragWidth;
  const dragCenterX = dragX + dragWidth / 2;
  const dragTop = dragY;
  const dragBottom = dragY + dragHeight;
  const dragCenterY = dragY + dragHeight / 2;

  let snappedX = false;
  let snappedY = false;

  // 检测与其他Frame的对齐
  for (const other of otherFrames) {
    const otherLeft = other.x;
    const otherRight = other.x + other.width;
    const otherCenterX = other.x + other.width / 2;
    const otherTop = other.y;
    const otherBottom = other.y + other.height;
    const otherCenterY = other.y + other.height / 2;

    // 垂直对齐检测（X轴）
    if (!snappedX) {
      // 左边缘对齐
      if (Math.abs(dragLeft - otherLeft) < SNAP_THRESHOLD) {
        snapX = otherLeft;
        snappedX = true;
        guidelines.push({
          type: 'vertical',
          position: otherLeft,
          source: 'edge',
        });
      }
      // 右边缘对齐
      else if (Math.abs(dragRight - otherRight) < SNAP_THRESHOLD) {
        snapX = otherRight - dragWidth;
        snappedX = true;
        guidelines.push({
          type: 'vertical',
          position: otherRight,
          source: 'edge',
        });
      }
      // 中心对齐
      else if (Math.abs(dragCenterX - otherCenterX) < SNAP_THRESHOLD) {
        snapX = otherCenterX - dragWidth / 2;
        snappedX = true;
        guidelines.push({
          type: 'vertical',
          position: otherCenterX,
          source: 'center',
        });
      }
      // 左边缘对齐到右边缘（相邻放置）
      else if (Math.abs(dragLeft - otherRight) < SNAP_THRESHOLD) {
        snapX = otherRight;
        snappedX = true;
        guidelines.push({
          type: 'vertical',
          position: otherRight,
          source: 'edge',
        });
      }
      // 右边缘对齐到左边缘（相邻放置）
      else if (Math.abs(dragRight - otherLeft) < SNAP_THRESHOLD) {
        snapX = otherLeft - dragWidth;
        snappedX = true;
        guidelines.push({
          type: 'vertical',
          position: otherLeft,
          source: 'edge',
        });
      }
    }

    // 水平对齐检测（Y轴）
    if (!snappedY) {
      // 上边缘对齐
      if (Math.abs(dragTop - otherTop) < SNAP_THRESHOLD) {
        snapY = otherTop;
        snappedY = true;
        guidelines.push({
          type: 'horizontal',
          position: otherTop,
          source: 'edge',
        });
      }
      // 下边缘对齐
      else if (Math.abs(dragBottom - otherBottom) < SNAP_THRESHOLD) {
        snapY = otherBottom - dragHeight;
        snappedY = true;
        guidelines.push({
          type: 'horizontal',
          position: otherBottom,
          source: 'edge',
        });
      }
      // 中心对齐
      else if (Math.abs(dragCenterY - otherCenterY) < SNAP_THRESHOLD) {
        snapY = otherCenterY - dragHeight / 2;
        snappedY = true;
        guidelines.push({
          type: 'horizontal',
          position: otherCenterY,
          source: 'center',
        });
      }
      // 上边缘对齐到下边缘（相邻放置）
      else if (Math.abs(dragTop - otherBottom) < SNAP_THRESHOLD) {
        snapY = otherBottom;
        snappedY = true;
        guidelines.push({
          type: 'horizontal',
          position: otherBottom,
          source: 'edge',
        });
      }
      // 下边缘对齐到上边缘（相邻放置）
      else if (Math.abs(dragBottom - otherTop) < SNAP_THRESHOLD) {
        snapY = otherTop - dragHeight;
        snappedY = true;
        guidelines.push({
          type: 'horizontal',
          position: otherTop,
          source: 'edge',
        });
      }
    }

    if (snappedX && snappedY) break;
  }

  // 检测与自定义参考线的吸附
  if (customGuides && customGuides.length > 0) {
    const dragLeft = snapX;
    const dragRight = snapX + dragWidth;
    const dragCenterX = snapX + dragWidth / 2;
    const dragTop = snapY;
    const dragBottom = snapY + dragHeight;
    const dragCenterY = snapY + dragHeight / 2;

    for (const guide of customGuides) {
      if (guide.orientation === 'vertical' && !snappedX) {
        const guidePos = guide.position;
        
        // 左边缘吸附
        if (Math.abs(dragLeft - guidePos) < SNAP_THRESHOLD) {
          snapX = guidePos;
          snappedX = true;
          guidelines.push({
            type: 'vertical',
            position: guidePos,
            source: 'edge',
          });
        }
        // 右边缘吸附
        else if (Math.abs(dragRight - guidePos) < SNAP_THRESHOLD) {
          snapX = guidePos - dragWidth;
          snappedX = true;
          guidelines.push({
            type: 'vertical',
            position: guidePos,
            source: 'edge',
          });
        }
        // 中心吸附
        else if (Math.abs(dragCenterX - guidePos) < SNAP_THRESHOLD) {
          snapX = guidePos - dragWidth / 2;
          snappedX = true;
          guidelines.push({
            type: 'vertical',
            position: guidePos,
            source: 'center',
          });
        }
      } else if (guide.orientation === 'horizontal' && !snappedY) {
        const guidePos = guide.position;
        
        // 上边缘吸附
        if (Math.abs(dragTop - guidePos) < SNAP_THRESHOLD) {
          snapY = guidePos;
          snappedY = true;
          guidelines.push({
            type: 'horizontal',
            position: guidePos,
            source: 'edge',
          });
        }
        // 下边缘吸附
        else if (Math.abs(dragBottom - guidePos) < SNAP_THRESHOLD) {
          snapY = guidePos - dragHeight;
          snappedY = true;
          guidelines.push({
            type: 'horizontal',
            position: guidePos,
            source: 'edge',
          });
        }
        // 中心吸附
        else if (Math.abs(dragCenterY - guidePos) < SNAP_THRESHOLD) {
          snapY = guidePos - dragHeight / 2;
          snappedY = true;
          guidelines.push({
            type: 'horizontal',
            position: guidePos,
            source: 'center',
          });
        }
      }

      if (snappedX && snappedY) break;
    }
  }

  return {
    x: snapX,
    y: snapY,
    snapped: snappedX || snappedY,
    guidelines,
  };
}

/**
 * 检测画布边缘吸附
 */
export function snapToCanvasEdges(
  x: number,
  y: number,
  width: number,
  height: number,
  canvasWidth: number,
  canvasHeight: number,
  margin: number = 0
): { x: number; y: number; guidelines: GuideLine[] } {
  let snapX = x;
  let snapY = y;
  const guidelines: GuideLine[] = [];

  // 左边缘
  if (Math.abs(x - margin) < SNAP_THRESHOLD) {
    snapX = margin;
    guidelines.push({ type: 'vertical', position: margin, source: 'edge' });
  }

  // 右边缘
  if (Math.abs(x + width - (canvasWidth - margin)) < SNAP_THRESHOLD) {
    snapX = canvasWidth - margin - width;
    guidelines.push({
      type: 'vertical',
      position: canvasWidth - margin,
      source: 'edge',
    });
  }

  // 上边缘
  if (Math.abs(y - margin) < SNAP_THRESHOLD) {
    snapY = margin;
    guidelines.push({ type: 'horizontal', position: margin, source: 'edge' });
  }

  // 下边缘
  if (Math.abs(y + height - (canvasHeight - margin)) < SNAP_THRESHOLD) {
    snapY = canvasHeight - margin - height;
    guidelines.push({
      type: 'horizontal',
      position: canvasHeight - margin,
      source: 'edge',
    });
  }

  // 画布中心
  const canvasCenterX = canvasWidth / 2;
  const canvasCenterY = canvasHeight / 2;
  const frameCenterX = x + width / 2;
  const frameCenterY = y + height / 2;

  if (Math.abs(frameCenterX - canvasCenterX) < SNAP_THRESHOLD) {
    snapX = canvasCenterX - width / 2;
    guidelines.push({
      type: 'vertical',
      position: canvasCenterX,
      source: 'center',
    });
  }

  if (Math.abs(frameCenterY - canvasCenterY) < SNAP_THRESHOLD) {
    snapY = canvasCenterY - height / 2;
    guidelines.push({
      type: 'horizontal',
      position: canvasCenterY,
      source: 'center',
    });
  }

  return { x: snapX, y: snapY, guidelines };
}
