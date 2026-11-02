/**
 * 画布交互（拖拽 / 缩放）的纯几何计算 —— 从 `useCanvasDrag` / `useCanvasResize` 抽出，
 * 以便在无 DOM 环境下单测（本仓库未安装 jsdom / @testing-library，React hook 无法渲染）。
 *
 * 这两个 hook 原本各自内联了同一套"算新矩形 + 钳制到画布 + 栅格吸附"逻辑，
 * 抽取后既可测试、也消除了重复。
 *
 * 坐标约定：WC3 世界 = 0.8 × 0.6、y-up、左下原点；最小尺寸 0.01（引擎不接受 0 尺寸）。
 */
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

/** 帧允许的最小尺寸（与 resize hook 中的钳制保持一致）。 */
export const MIN_FRAME_SIZE = 0.01;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapOptions {
  snapToGrid: boolean;
  gridSize: number;
  snapValue: (v: number, size: number) => number;
}

/** 把矩形钳制在画布内，并保证最小尺寸。 */
export function clampRectToCanvas(rect: Rect): Rect {
  let x = Math.max(0, Math.min(WC3_MAX_X - rect.width, rect.x));
  let y = Math.max(0, Math.min(WC3_MAX_Y - rect.height, rect.y));
  let width = Math.max(MIN_FRAME_SIZE, Math.min(WC3_MAX_X - x, rect.width));
  let height = Math.max(MIN_FRAME_SIZE, Math.min(WC3_MAX_Y - y, rect.height));
  // 尺寸收紧后起点可能越界（例如 width 被抬到 MIN 时），再钳一次
  x = Math.max(0, Math.min(WC3_MAX_X - width, x));
  y = Math.max(0, Math.min(WC3_MAX_Y - height, y));
  return { x, y, width, height };
}

/** 对矩形做栅格吸附（先吸附再钳制，避免吸附后越界）。 */
export function snapRect(rect: Rect, opts: SnapOptions): Rect {
  if (!opts.snapToGrid) return rect;
  return {
    x: opts.snapValue(rect.x, opts.gridSize),
    y: opts.snapValue(rect.y, opts.gridSize),
    width: opts.snapValue(rect.width, opts.gridSize),
    height: opts.snapValue(rect.height, opts.gridSize),
  };
}

/**
 * 拖拽：由鼠标世界坐标 + 抓取偏移算出新矩形。
 *
 * @param mouseWc3 鼠标当前 WC3 坐标
 * @param dragOffset 按下点相对帧左下角的偏移（固定尺寸拖拽路径用）
 * @param size 帧的固定宽高（拖拽不改尺寸）
 */
export function computeDragRect(
  mouseWc3: { x: number; y: number },
  dragOffset: { x: number; y: number },
  size: { width: number; height: number },
  opts: SnapOptions,
): Rect {
  let x = mouseWc3.x - dragOffset.x;
  let y = mouseWc3.y - dragOffset.y;
  if (opts.snapToGrid) {
    x = opts.snapValue(x, opts.gridSize);
    y = opts.snapValue(y, opts.gridSize);
  }
  return clampRectToCanvas({ x, y, width: size.width, height: size.height });
}

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * 缩放：按方向 + 世界坐标增量算新矩形。
 *
 * **行为严格对齐 `useCanvasResize` 的现有实现**（不要反转语义）：
 * - `n` 只改高度（上边拉伸，起点 y 不变）
 * - `s` 改 y 且改高度（保持上边不动，下边跟随鼠标）
 * - `e` 只改宽度；`w` 改 x 且宽度（右边不动）
 * - Shift 按住时对角拖动保持纵横比
 */
export function computeResizeRect(
  start: Rect,
  direction: ResizeDirection,
  deltaWc3: { x: number; y: number },
  shift: boolean,
  opts: SnapOptions,
): Rect {
  let { x, y, width, height } = start;

  if (direction.includes('e')) {
    width = Math.max(MIN_FRAME_SIZE, start.width + deltaWc3.x);
  }
  if (direction.includes('w')) {
    const oldRight = start.x + start.width;
    x = Math.max(0, start.x + deltaWc3.x);
    width = Math.max(MIN_FRAME_SIZE, oldRight - x);
  }
  if (direction.includes('n')) {
    height = Math.max(MIN_FRAME_SIZE, start.height + deltaWc3.y);
  }
  if (direction.includes('s')) {
    const oldTop = start.y + start.height;
    y = Math.max(0, start.y + deltaWc3.y);
    height = Math.max(MIN_FRAME_SIZE, oldTop - y);
  }

  // Shift 保持纵横比（仅对角方向）
  if (shift && direction.length === 2) {
    const aspect = start.width / start.height;
    if (aspect > 0 && Number.isFinite(aspect)) {
      if (Math.abs(width - start.width) > Math.abs(height - start.height)) {
        height = width / aspect;
      } else {
        width = height * aspect;
      }
    }
  }

  let rect = clampRectToCanvas({ x, y, width, height });
  rect = snapRect(rect, opts);
  return clampRectToCanvas(rect);
}
