/**
 * 平移/缩放纯逻辑（从 useCanvasPan 抽出，可单测）
 *
 * 与 frameTransforms（拖拽/缩放几何）同模式：hook 保留状态与事件接线，
 * 数值计算抽为纯函数锁定语义。抽自 useCanvasPan.ts 原实现，不得反转：
 * - 缩放：滚轮 delta>0 缩小 ×0.9、否则放大 ×1.1，钳制 0.1..5
 * - 平移：start 记录"指针相对视口减去当前 offset"的锚点；
 *   update 用 clientX - anchor 恢复 offset（拖动期间 offset 跟随指针位移）
 */
import { clampRectToCanvas } from './frameTransforms';

/** 滚轮缩放：返回新 scale。 */
export function computeWheelScale(current: number, deltaY: number): number {
  const delta = deltaY > 0 ? 0.9 : 1.1;
  return Math.max(0.1, Math.min(5, current * delta));
}

/** 开始平移：记录锚点（指针位置减当前 offset）。 */
export function startPanAnchor(
  clientX: number,
  clientY: number,
  offset: { x: number; y: number },
): { x: number; y: number } {
  return { x: clientX - offset.x, y: clientY - offset.y };
}

/** 平移中：由锚点与当前指针位置恢复 offset。 */
export function computePanOffset(
  clientX: number,
  clientY: number,
  anchor: { x: number; y: number },
): { x: number; y: number } {
  return { x: clientX - anchor.x, y: clientY - anchor.y };
}

// clampRectToCanvas re-export 保持单一几何工具入口（帧拖拽也在 frameTransforms）。
export { clampRectToCanvas };

/** 滚轮缩放锚定（round 159）：保持鼠标下世界点屏幕位置不动。
 *  数学：w=(s-offset)/scale；offset' = s - w*scale' = offset + w*(scale-scale')。
 *  这是 VS Code/Figma 同款行为；原 computeWheelScale 仅改 scale（原点缩放）保留给工具栏按钮。 */
export function computeWheelZoomAt(
  current: number,
  deltaY: number,
  pointer: { x: number; y: number },
  offset: { x: number; y: number },
): { scale: number; offset: { x: number; y: number } } {
  const scale = computeWheelScale(current, deltaY);
  const wx = (pointer.x - offset.x) / current;
  const wy = (pointer.y - offset.y) / current;
  return {
    scale,
    offset: {
      x: offset.x + wx * (current - scale),
      y: offset.y + wy * (current - scale),
    },
  };
}
