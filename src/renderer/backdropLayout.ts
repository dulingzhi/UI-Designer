// ============================================================
// backdropLayout — 九宫格几何计算（纯函数）
// ============================================================
// 逆向自 WC3 1.27a / WorldEditKKWE.exe sub_44D1A0
//   = CBackdropFrame::OnUpdateModels (0x44d1a0)
//
// 关键常量：
//   • 0.95 corner factor — 边缘条向 corner 内嵌入 5%（hexrays 0x44dd4f: v47 = 0.94999999 * cornerSize）
//   • 5% 重叠用于隐藏 corner 与 edge 的 alpha 衰减接缝
//   • 所有几何尺寸 round 到整数像素 (CSimpleFrame::SnapTexelsToPixels)
//
// 渲染顺序：先 4 corner，后 4 edge（edge 绘在 corner 之上）

import type { EdgeFlag } from '../utils/textureAtlas';
import { snapToPixel } from './pixelSnap';

export interface EdgePiecePlacement {
  /** mesh 中心 x（像素，Y-up 坐标系，原点在 frame 左下） */
  centerX: number;
  /** mesh 中心 y（像素，Y-up） */
  centerY: number;
  /** mesh scale x */
  scaleX: number;
  /** mesh scale y */
  scaleY: number;
  /** 是否可见（边长为 0 时不可见） */
  visible: boolean;
  /** 渲染顺序加成（corner=0.20，edge=0.21） */
  renderOrderOffset: number;
  /** 是否角块 */
  isCorner: boolean;
}

const CORNER_INSET_FACTOR = 0.95;

/**
 * 计算九宫格单个边/角的 placement。
 *
 * @param flag    EdgeFlag (UL/UR/BL/BR/T/B/L/R)
 * @param width   frame 宽（像素）
 * @param height  frame 高（像素）
 * @param cornerSize  cornerSize（像素，应当已经 snapToPixel）
 */
export function computeEdgePlacement(
  flag: EdgeFlag,
  width: number,
  height: number,
  cornerSize: number,
): EdgePiecePlacement {
  const cornerInset = snapToPixel(cornerSize * CORNER_INSET_FACTOR);
  const innerW = Math.max(0, snapToPixel(width - cornerInset * 2));
  const innerH = Math.max(0, snapToPixel(height - cornerInset * 2));
  const half = snapToPixel(cornerSize / 2);
  const rightX = snapToPixel(width - cornerSize / 2);
  const topY = snapToPixel(height - cornerSize / 2);
  const midX = snapToPixel(width / 2);
  const midY = snapToPixel(height / 2);

  const isCorner = flag === 'UL' || flag === 'UR' || flag === 'BL' || flag === 'BR';
  const renderOrderOffset = isCorner ? 0.20 : 0.21;

  switch (flag) {
    case 'UL':
      return { centerX: half, centerY: topY, scaleX: cornerSize, scaleY: cornerSize, visible: true, renderOrderOffset, isCorner };
    case 'UR':
      return { centerX: rightX, centerY: topY, scaleX: cornerSize, scaleY: cornerSize, visible: true, renderOrderOffset, isCorner };
    case 'BL':
      return { centerX: half, centerY: half, scaleX: cornerSize, scaleY: cornerSize, visible: true, renderOrderOffset, isCorner };
    case 'BR':
      return { centerX: rightX, centerY: half, scaleX: cornerSize, scaleY: cornerSize, visible: true, renderOrderOffset, isCorner };
    case 'T':
      return { centerX: midX, centerY: topY, scaleX: innerW, scaleY: cornerSize, visible: innerW > 0, renderOrderOffset, isCorner };
    case 'B':
      return { centerX: midX, centerY: half, scaleX: innerW, scaleY: cornerSize, visible: innerW > 0, renderOrderOffset, isCorner };
    case 'L':
      return { centerX: half, centerY: midY, scaleX: cornerSize, scaleY: innerH, visible: innerH > 0, renderOrderOffset, isCorner };
    case 'R':
      return { centerX: rightX, centerY: midY, scaleX: cornerSize, scaleY: innerH, visible: innerH > 0, renderOrderOffset, isCorner };
  }
}

export interface BackgroundPlacement {
  centerX: number;
  centerY: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
  innerWidth: number;
  innerHeight: number;
}

/**
 * 计算 backdrop background 的 placement（带 4 inset 像素对齐）。
 * insets 顺序与 FDF 一致：[left, top, right, bottom]
 */
export function computeBackgroundPlacement(
  width: number,
  height: number,
  insetsPx: readonly [number, number, number, number] | null,
): BackgroundPlacement {
  const left = insetsPx ? snapToPixel(insetsPx[0]) : 0;
  const top = insetsPx ? snapToPixel(insetsPx[1]) : 0;
  const right = insetsPx ? snapToPixel(insetsPx[2]) : 0;
  const bottom = insetsPx ? snapToPixel(insetsPx[3]) : 0;
  const innerWidth = Math.max(0, snapToPixel(width - left - right));
  const innerHeight = Math.max(0, snapToPixel(height - top - bottom));

  return {
    centerX: snapToPixel(left + innerWidth / 2),
    // Y-up：bottom inset 决定起点
    centerY: snapToPixel(bottom + innerHeight / 2),
    scaleX: innerWidth,
    scaleY: innerHeight,
    visible: innerWidth > 0 && innerHeight > 0,
    innerWidth,
    innerHeight,
  };
}
