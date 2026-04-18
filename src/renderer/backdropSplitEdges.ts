// ============================================================
// backdropSplitEdges — Backdrop 拆分边缘 9-slice 规划 (纯函数)
// ============================================================
// 把 5 个拆分边缘字段 (BackdropCornerFile + Top/Bottom/Left/Right File)
// 映射成 EdgeFlag → { path, uv } 的布局表. 每条边单独一张 BLP, CornerFile
// 被 4 个角共享, 通过 UV 镜像差异化.

import type { EdgeFlag } from '../utils/textureAtlas';
import type { FrameData } from '../types';

export interface SplitEdgeUV {
  /** 贴图路径 (已 resolveTexturePath 过) */
  path: string;
  /** THREE.Texture.repeat.x */
  repeatX: number;
  /** THREE.Texture.repeat.y */
  repeatY: number;
  /** THREE.Texture.offset.x */
  offsetX: number;
  /** THREE.Texture.offset.y */
  offsetY: number;
  /** 是否需要 RepeatWrapping (vs ClampToEdge) */
  wrapRepeatX: boolean;
  wrapRepeatY: boolean;
}

/**
 * 为拆分边缘模式的 Backdrop 规划每个 EdgeFlag 的贴图 + UV.
 *
 * 输入: frame 的 5 个拆分字段 + 容器宽高 + cornerSizePx.
 * 输出: Map<EdgeFlag, SplitEdgeUV>. 未提供的 flag 不出现在 map 中.
 *
 * 角 UV 镜像:
 *   UL 原图, UR X 翻转, BL Y 翻转, BR XY 翻转
 *   (THREE 的翻转用 repeat = -1 + offset = 1 实现)
 *
 * 边平铺:
 *   T/B 沿 X 重复 (width - 2*cornerSize) / cornerSize 次 (最少 1)
 *   L/R 沿 Y 重复 (height - 2*cornerSize) / cornerSize 次
 */
export function planSplitEdges(
  frame: Pick<
    FrameData,
    'backdropCornerFile' | 'backdropTopFile' | 'backdropBottomFile' | 'backdropLeftFile' | 'backdropRightFile'
  >,
  resolvePath: (p: string | undefined) => string | undefined,
  widthPx: number,
  heightPx: number,
  cornerSizePx: number,
): Map<EdgeFlag, SplitEdgeUV> {
  const result = new Map<EdgeFlag, SplitEdgeUV>();
  if (cornerSizePx <= 0) return result;

  const cornerPath = resolvePath(frame.backdropCornerFile);
  const topPath = resolvePath(frame.backdropTopFile);
  const bottomPath = resolvePath(frame.backdropBottomFile);
  const leftPath = resolvePath(frame.backdropLeftFile);
  const rightPath = resolvePath(frame.backdropRightFile);

  const edgeRepeatX = Math.max(1, (widthPx - cornerSizePx * 2) / cornerSizePx);
  const edgeRepeatY = Math.max(1, (heightPx - cornerSizePx * 2) / cornerSizePx);

  if (cornerPath) {
    result.set('UL', { path: cornerPath, repeatX: 1, repeatY: 1, offsetX: 0, offsetY: 0, wrapRepeatX: false, wrapRepeatY: false });
    result.set('UR', { path: cornerPath, repeatX: -1, repeatY: 1, offsetX: 1, offsetY: 0, wrapRepeatX: false, wrapRepeatY: false });
    result.set('BL', { path: cornerPath, repeatX: 1, repeatY: -1, offsetX: 0, offsetY: 1, wrapRepeatX: false, wrapRepeatY: false });
    result.set('BR', { path: cornerPath, repeatX: -1, repeatY: -1, offsetX: 1, offsetY: 1, wrapRepeatX: false, wrapRepeatY: false });
  }
  if (topPath) {
    result.set('T', { path: topPath, repeatX: edgeRepeatX, repeatY: 1, offsetX: 0, offsetY: 0, wrapRepeatX: true, wrapRepeatY: false });
  }
  if (bottomPath) {
    result.set('B', { path: bottomPath, repeatX: edgeRepeatX, repeatY: 1, offsetX: 0, offsetY: 0, wrapRepeatX: true, wrapRepeatY: false });
  }
  if (leftPath) {
    result.set('L', { path: leftPath, repeatX: 1, repeatY: edgeRepeatY, offsetX: 0, offsetY: 0, wrapRepeatX: false, wrapRepeatY: true });
  }
  if (rightPath) {
    result.set('R', { path: rightPath, repeatX: 1, repeatY: edgeRepeatY, offsetX: 0, offsetY: 0, wrapRepeatX: false, wrapRepeatY: true });
  }

  return result;
}
