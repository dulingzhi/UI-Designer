import { FrameAnchor, FramePoint, FrameData } from '../types';

// ========== 性能优化：位置计算缓存 ==========
interface PositionCache {
  frameVersion: string; // 用于版本控制的哈希
  position: { x: number; y: number; width: number; height: number } | null;
}

const positionCache = new Map<string, PositionCache>();
let globalCacheVersion = 0;

/**
 * 清除所有缓存（在frames更新时调用）
 */
export function clearPositionCache(): void {
  positionCache.clear();
  globalCacheVersion++;
}

/**
 * 生成frame的版本哈希（用于判断frame是否变化）
 */
function getFrameVersion(frame: FrameData): string {
  return `${globalCacheVersion}-${frame.id}-${frame.x}-${frame.y}-${frame.width}-${frame.height}-${JSON.stringify(frame.anchors)}`;
}

/**
 * 从缓存获取位置，如果不存在或过期则返回null
 */
function getCachedPosition(frameId: string, currentVersion: string): { x: number; y: number; width: number; height: number } | null {
  const cached = positionCache.get(frameId);
  if (cached && cached.frameVersion === currentVersion) {
    return cached.position;
  }
  return null;
}

/**
 * 缓存计算的位置
 */
function setCachedPosition(frameId: string, version: string, position: { x: number; y: number; width: number; height: number } | null): void {
  positionCache.set(frameId, { frameVersion: version, position });
}

/**
 * 获取锚点在控件上的相对偏移（用于可视化，浏览器坐标系）
 */
export function getAnchorOffset(
  point: FramePoint,
  width: number,
  height: number
): { x: number; y: number } {
  const offsets: Record<FramePoint, { x: number; y: number }> = {
    [FramePoint.TOPLEFT]: { x: 0, y: 0 },
    [FramePoint.TOP]: { x: width / 2, y: 0 },
    [FramePoint.TOPRIGHT]: { x: width, y: 0 },
    [FramePoint.LEFT]: { x: 0, y: height / 2 },
    [FramePoint.CENTER]: { x: width / 2, y: height / 2 },
    [FramePoint.RIGHT]: { x: width, y: height / 2 },
    [FramePoint.BOTTOMLEFT]: { x: 0, y: height },
    [FramePoint.BOTTOM]: { x: width / 2, y: height },
    [FramePoint.BOTTOMRIGHT]: { x: width, y: height },
  };
  return offsets[point] || { x: 0, y: 0 };
}

/**
 * 获取锚点相对于控件左下角的偏移（WC3坐标系，用于拖动计算）
 */
export function getAnchorOffsetWc3(
  point: FramePoint,
  width: number,
  height: number
): { x: number; y: number } {
  const offsets: Record<FramePoint, { x: number; y: number }> = {
    [FramePoint.TOPLEFT]: { x: 0, y: height },
    [FramePoint.TOP]: { x: width / 2, y: height },
    [FramePoint.TOPRIGHT]: { x: width, y: height },
    [FramePoint.LEFT]: { x: 0, y: height / 2 },
    [FramePoint.CENTER]: { x: width / 2, y: height / 2 },
    [FramePoint.RIGHT]: { x: width, y: height / 2 },
    [FramePoint.BOTTOMLEFT]: { x: 0, y: 0 },
    [FramePoint.BOTTOM]: { x: width / 2, y: 0 },
    [FramePoint.BOTTOMRIGHT]: { x: width, y: 0 },
  };
  return offsets[point] || { x: 0, y: 0 };
}

/**
 * 获取指定锚点在 Frame 上的绝对坐标
 */
export function getAnchorPosition(
  frame: FrameData,
  point: FramePoint
): { x: number; y: number } {
  const { x, y, width, height } = frame;
  
  switch (point) {
    case FramePoint.TOPLEFT:
      return { x, y: y + height };
    case FramePoint.TOP:
      return { x: x + width / 2, y: y + height };
    case FramePoint.TOPRIGHT:
      return { x: x + width, y: y + height };
    case FramePoint.LEFT:
      return { x, y: y + height / 2 };
    case FramePoint.CENTER:
      return { x: x + width / 2, y: y + height / 2 };
    case FramePoint.RIGHT:
      return { x: x + width, y: y + height / 2 };
    case FramePoint.BOTTOMLEFT:
      return { x, y };
    case FramePoint.BOTTOM:
      return { x: x + width / 2, y };
    case FramePoint.BOTTOMRIGHT:
      return { x: x + width, y };
    default:
      return { x, y };
  }
}

/**
 * 计算相对偏移量
 * 当设置锚点相对于另一个控件时，计算相对偏移以保持控件位置不变
 * 
 * @param currentFrame 当前控件
 * @param currentAnchor 当前锚点
 * @param relativeFrame 相对的目标控件
 * @param relativePoint 相对锚点在目标控件上的位置
 * @returns 相对偏移量 { x, y }
 */
export function calculateRelativeOffset(
  currentFrame: FrameData,
  currentAnchor: FrameAnchor,
  relativeFrame: FrameData,
  relativePoint: FramePoint
): { x: number; y: number } {
  // 获取当前锚点在当前控件上的绝对位置
  const currentAnchorPos = getAnchorPosition(currentFrame, currentAnchor.point);
  
  // 获取目标锚点在目标控件上的绝对位置
  const relativeAnchorPos = getAnchorPosition(relativeFrame, relativePoint);
  
  // 计算相对偏移量
  return {
    x: currentAnchorPos.x - relativeAnchorPos.x,
    y: currentAnchorPos.y - relativeAnchorPos.y
  };
}

/**
 * 从 x, y, width, height 创建默认的单锚点（TOPLEFT）+ 宽高
 * 这是最常用的方式，只需要一个锚点定位
 */
export function createDefaultAnchors(
  x: number,
  y: number,
  _width: number,
  height: number
): FrameAnchor[] {
  // WC3坐标系：左下角为原点，Y轴向上
  // x, y 是左下角坐标
  const topLeftX = x;
  const topLeftY = y + height;

  return [
    {
      point: FramePoint.TOPLEFT,
      x: topLeftX,
      y: topLeftY,
    },
  ];
}

/**
 * 从锚点数组计算 x, y, width, height（用于编辑器显示）
 * 支持单锚点或双锚点系统：
 * - 单锚点：使用 frame.width/height 属性
 * - 双锚点：使用 TOPLEFT 和 BOTTOMRIGHT 计算
 */
export function calculateBoundsFromAnchors(
  anchors: FrameAnchor[],
  frame: FrameData
): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const topLeft = anchors.find(a => a.point === FramePoint.TOPLEFT);
  const bottomRight = anchors.find(a => a.point === FramePoint.BOTTOMRIGHT);

  // 如果有双锚点系统（TOPLEFT + BOTTOMRIGHT），使用锚点计算
  if (topLeft && bottomRight) {
    const x = topLeft.x;
    const y = bottomRight.y;
    const width = bottomRight.x - topLeft.x;
    const height = topLeft.y - bottomRight.y;
    return { x, y, width, height };
  }

  // 单锚点系统：使用第一个锚点 + frame.width/height
  if (anchors.length > 0) {
    const anchor = anchors[0];
    const anchorPos = getAnchorPosition(frame, anchor.point);
    
    // 根据锚点类型反向计算左下角坐标
    let x = frame.x;
    let y = frame.y;
    
    switch (anchor.point) {
      case FramePoint.TOPLEFT:
        x = anchorPos.x;
        y = anchorPos.y - frame.height;
        break;
      case FramePoint.TOP:
        x = anchorPos.x - frame.width / 2;
        y = anchorPos.y - frame.height;
        break;
      case FramePoint.TOPRIGHT:
        x = anchorPos.x - frame.width;
        y = anchorPos.y - frame.height;
        break;
      case FramePoint.LEFT:
        x = anchorPos.x;
        y = anchorPos.y - frame.height / 2;
        break;
      case FramePoint.CENTER:
        x = anchorPos.x - frame.width / 2;
        y = anchorPos.y - frame.height / 2;
        break;
      case FramePoint.RIGHT:
        x = anchorPos.x - frame.width;
        y = anchorPos.y - frame.height / 2;
        break;
      case FramePoint.BOTTOMLEFT:
        x = anchorPos.x;
        y = anchorPos.y;
        break;
      case FramePoint.BOTTOM:
        x = anchorPos.x - frame.width / 2;
        y = anchorPos.y;
        break;
      case FramePoint.BOTTOMRIGHT:
        x = anchorPos.x - frame.width;
        y = anchorPos.y;
        break;
    }
    
    return { x, y, width: frame.width, height: frame.height };
  }

  // 没有锚点，返回 frame 的原始值
  return { x: frame.x, y: frame.y, width: frame.width, height: frame.height };
}

/**
 * 更新锚点以反映新的位置和大小
 * 注意：对于相对锚点，保持其相对偏移量不变
 * 支持单锚点或多锚点系统
 * 
 * 特殊处理：如果检测到有双锚点系统（会自动计算尺寸），在手动调整尺寸时会移除第二个锚点
 */
export function updateAnchorsFromBounds(
  anchors: FrameAnchor[],
  x: number,
  y: number,
  width: number,
  height: number
): FrameAnchor[] {
  if (anchors.length === 0) {
    return createDefaultAnchors(x, y, width, height);
  }

  // 检查是否有会产生动态尺寸的锚点组合
  const hasTopLeft = anchors.some(a => a.point === FramePoint.TOPLEFT);
  const hasBottomRight = anchors.some(a => a.point === FramePoint.BOTTOMRIGHT);
  const hasTopRight = anchors.some(a => a.point === FramePoint.TOPRIGHT);
  const hasBottomLeft = anchors.some(a => a.point === FramePoint.BOTTOMLEFT);
  const hasLeft = anchors.some(a => a.point === FramePoint.LEFT);
  const hasRight = anchors.some(a => a.point === FramePoint.RIGHT);
  const hasTop = anchors.some(a => a.point === FramePoint.TOP);
  const hasBottom = anchors.some(a => a.point === FramePoint.BOTTOM);
  
  const hasDynamicSizeAnchors = 
    (hasTopLeft && hasBottomRight) ||
    (hasTopRight && hasBottomLeft) ||
    (hasLeft && hasRight) ||
    (hasTop && hasBottom);
  
  // 如果有动态尺寸锚点组合，只保留第一个锚点，移除其他锚点
  // 这样用户手动调整尺寸时，不会与锚点系统冲突
  if (hasDynamicSizeAnchors && anchors.length > 1) {
    console.log(`[updateAnchorsFromBounds] Detected dynamic size anchors, keeping only first anchor to allow manual resize`);
    const firstAnchor = anchors[0];
    
    // 更新第一个锚点的位置
    if (firstAnchor.relativeTo) {
      // 相对锚点保持偏移不变
      return [firstAnchor];
    } else {
      // 绝对锚点更新位置
      const newPos = getAnchorPositionFromBounds(firstAnchor.point, x, y, width, height);
      return [{
        ...firstAnchor,
        x: newPos.x,
        y: newPos.y,
      }];
    }
  }

  // 对每个锚点进行更新
  return anchors.map(anchor => {
    // 如果是相对锚点，保持原有的偏移量不变（x, y 是相对偏移）
    if (anchor.relativeTo) {
      return anchor;
    }

    // 绝对锚点，根据锚点类型计算新的绝对坐标
    const newPos = getAnchorPositionFromBounds(anchor.point, x, y, width, height);
    
    return {
      ...anchor,
      x: newPos.x,
      y: newPos.y,
    };
  });
}

/**
 * 根据锚点类型和边界计算锚点的绝对位置
 */
function getAnchorPositionFromBounds(
  point: FramePoint,
  x: number,
  y: number,
  width: number,
  height: number
): { x: number; y: number } {
  switch (point) {
    case FramePoint.TOPLEFT:
      return { x, y: y + height };
    case FramePoint.TOP:
      return { x: x + width / 2, y: y + height };
    case FramePoint.TOPRIGHT:
      return { x: x + width, y: y + height };
    case FramePoint.LEFT:
      return { x, y: y + height / 2 };
    case FramePoint.CENTER:
      return { x: x + width / 2, y: y + height / 2 };
    case FramePoint.RIGHT:
      return { x: x + width, y: y + height / 2 };
    case FramePoint.BOTTOMLEFT:
      return { x, y };
    case FramePoint.BOTTOM:
      return { x: x + width / 2, y };
    case FramePoint.BOTTOMRIGHT:
      return { x: x + width, y };
    default:
      return { x, y };
  }
}

/**
 * 从旧数据迁移：将 anchorPoint + x/y/width/height 转换为双锚点系统
 */
export function migrateFromLegacyAnchor(
  x: number,
  y: number,
  width: number,
  height: number,
  _anchorPoint?: number
): FrameAnchor[] {
  // 如果已经使用双锚点系统，直接返回
  // 否则使用默认的 TOPLEFT 和 BOTTOMRIGHT
  return createDefaultAnchors(x, y, width, height);
}

/**
 * 计算使用相对锚点的 Frame 的实际位置
 * 当被引用的 Frame 移动时，需要重新计算引用它的所有 Frame 的位置
 * 支持任意数量的锚点（1个或多个）
 * 
 * 锚点规则：
 * - 单锚点：使用锚点位置 + frame.width/height（固定尺寸）
 * - 双锚点或多锚点：根据锚点位置计算尺寸（动态拉伸）
 */
export function calculatePositionFromAnchors(
  frame: FrameData,
  allFrames: Record<string, FrameData>
): { x: number; y: number; width: number; height: number } | null {
  // 检查缓存
  const frameVersion = getFrameVersion(frame);
  const cached = getCachedPosition(frame.id, frameVersion);
  if (cached !== null) {
    return cached;
  }
  
  // 检查锚点数组是否存在
  if (!frame.anchors || frame.anchors.length === 0) {
    if (frame.name === 'ConfirmQuitQuitButton' || frame.name === 'ConfirmQuitCancelButton') {
      console.warn(`[calculatePositionFromAnchors] ${frame.name} has NO anchors!`);
    }
    setCachedPosition(frame.id, frameVersion, null);
    return null;
  }

  // 检查是否有相对锚点
  const hasRelativeAnchors = frame.anchors.some(a => a.relativeTo);
  
  if (!hasRelativeAnchors) {
    // 没有相对锚点，使用绝对位置
    if (frame.name === 'ConfirmQuitQuitButton' || frame.name === 'ConfirmQuitCancelButton') {
      console.warn(`[calculatePositionFromAnchors] ${frame.name} has NO relative anchors!`, frame.anchors);
    }
    setCachedPosition(frame.id, frameVersion, null);
    return null;
  }

  // 计算每个锚点的绝对位置（包括相对和绝对锚点）
  const calculateAnchorPos = (anchor: FrameAnchor | undefined): { x: number; y: number } | null => {
    if (!anchor) return null;
    
    if (anchor.relativeTo) {
      const relativeFrame = allFrames[anchor.relativeTo];
      if (relativeFrame) {
        // 如果 relativePoint 未定义，默认使用 TOPLEFT
        const relativePoint = anchor.relativePoint !== undefined ? anchor.relativePoint : FramePoint.TOPLEFT;
        
        // ⚠️ 关键修复: 如果 relativeFrame 也有相对锚点,需要先递归计算它的位置
        let relativeFrameWithPos = relativeFrame;
        if (relativeFrame.anchors && relativeFrame.anchors.some(a => a.relativeTo)) {
          const calculatedRelativePos = calculatePositionFromAnchors(relativeFrame, allFrames);
          if (calculatedRelativePos) {
            // 使用计算后的位置创建新的 Frame 对象(避免修改原始数据)
            relativeFrameWithPos = { ...relativeFrame, ...calculatedRelativePos };
          }
        }
        
        const relativePos = getAnchorPosition(relativeFrameWithPos, relativePoint);
        const absX = relativePos.x + anchor.x;
        const absY = relativePos.y + anchor.y;
        console.log(`[Anchor] ${frame.name} ${FramePoint[anchor.point]}: relative to ${relativeFrame.name} at ${FramePoint[relativePoint]}, offset (${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)}), result (${absX.toFixed(3)}, ${absY.toFixed(3)})`);
        return { x: absX, y: absY };
      } else {
        console.warn(`[Anchor] Cannot find relative frame: ${anchor.relativeTo}`);
        return { x: anchor.x, y: anchor.y };
      }
    }
    
    // 绝对锚点直接返回其坐标
    return { x: anchor.x, y: anchor.y };
  };

  // 查找特定位置的锚点
  const topLeft = frame.anchors.find(a => a.point === FramePoint.TOPLEFT);
  const bottomRight = frame.anchors.find(a => a.point === FramePoint.BOTTOMRIGHT);
  const topRight = frame.anchors.find(a => a.point === FramePoint.TOPRIGHT);
  const bottomLeft = frame.anchors.find(a => a.point === FramePoint.BOTTOMLEFT);
  const top = frame.anchors.find(a => a.point === FramePoint.TOP);
  const bottom = frame.anchors.find(a => a.point === FramePoint.BOTTOM);
  const left = frame.anchors.find(a => a.point === FramePoint.LEFT);
  const right = frame.anchors.find(a => a.point === FramePoint.RIGHT);
  const center = frame.anchors.find(a => a.point === FramePoint.CENTER);

  // 计算所有锚点的位置
  const topLeftPos = calculateAnchorPos(topLeft);
  const bottomRightPos = calculateAnchorPos(bottomRight);
  const topRightPos = calculateAnchorPos(topRight);
  const bottomLeftPos = calculateAnchorPos(bottomLeft);
  const topPos = calculateAnchorPos(top);
  const bottomPos = calculateAnchorPos(bottom);
  const leftPos = calculateAnchorPos(left);
  const rightPos = calculateAnchorPos(right);
  const centerPos = calculateAnchorPos(center);

  // 根据可用的锚点组合计算位置和大小
  let x: number, y: number, width: number, height: number;

  // 策略1: 使用对角锚点 (TOPLEFT + BOTTOMRIGHT) - 最常用
  if (topLeftPos && bottomRightPos) {
    x = topLeftPos.x;
    y = bottomRightPos.y;
    width = bottomRightPos.x - topLeftPos.x;
    height = topLeftPos.y - bottomRightPos.y;
    console.log(`[Anchor] ${frame.name}: Using TOPLEFT + BOTTOMRIGHT, dynamic size`);
  }
  // 策略2: 使用对角锚点 (TOPRIGHT + BOTTOMLEFT)
  else if (topRightPos && bottomLeftPos) {
    x = bottomLeftPos.x;
    y = bottomLeftPos.y;
    width = topRightPos.x - bottomLeftPos.x;
    height = topRightPos.y - bottomLeftPos.y;
    console.log(`[Anchor] ${frame.name}: Using TOPRIGHT + BOTTOMLEFT, dynamic size`);
  }
  // 策略3: 使用左右锚点 + 上下锚点
  else if (leftPos && rightPos && topPos && bottomPos) {
    x = leftPos.x;
    y = bottomPos.y;
    width = rightPos.x - leftPos.x;
    height = topPos.y - bottomPos.y;
    console.log(`[Anchor] ${frame.name}: Using LEFT + RIGHT + TOP + BOTTOM, dynamic size`);
  }
  // 策略4: 使用顶部两个锚点 (TOPLEFT + TOPRIGHT) - 动态宽度
  else if (topLeftPos && topRightPos) {
    x = topLeftPos.x;
    // 使用两个锚点的Y坐标平均值,保持Y坐标稳定
    const avgY = (topLeftPos.y + topRightPos.y) / 2;
    y = avgY - frame.height;
    width = topRightPos.x - topLeftPos.x;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using TOPLEFT + TOPRIGHT, dynamic width, fixed height`);
  }
  // 策略5: 使用底部两个锚点 (BOTTOMLEFT + BOTTOMRIGHT) - 动态宽度
  else if (bottomLeftPos && bottomRightPos) {
    x = bottomLeftPos.x;
    // 使用两个锚点的Y坐标平均值,保持Y坐标稳定
    const avgY = (bottomLeftPos.y + bottomRightPos.y) / 2;
    y = avgY;
    width = bottomRightPos.x - bottomLeftPos.x;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using BOTTOMLEFT + BOTTOMRIGHT, dynamic width, fixed height`);
  }
  // 策略5.1: 使用左侧两个锚点 (TOPLEFT + BOTTOMLEFT) - 动态高度
  else if (topLeftPos && bottomLeftPos) {
    x = topLeftPos.x;
    y = bottomLeftPos.y;
    width = frame.width;
    height = topLeftPos.y - bottomLeftPos.y;
    console.log(`[Anchor] ${frame.name}: Using TOPLEFT + BOTTOMLEFT, dynamic height, fixed width`);
  }
  // 策略5.2: 使用右侧两个锚点 (TOPRIGHT + BOTTOMRIGHT) - 动态高度
  else if (topRightPos && bottomRightPos) {
    x = topRightPos.x - frame.width;
    y = bottomRightPos.y;
    width = frame.width;
    height = topRightPos.y - bottomRightPos.y;
    console.log(`[Anchor] ${frame.name}: Using TOPRIGHT + BOTTOMRIGHT, dynamic height, fixed width`);
  }
  // 策略6: 使用左右锚点（宽度动态，高度固定）
  else if (leftPos && rightPos) {
    width = rightPos.x - leftPos.x;
    height = frame.height;
    x = leftPos.x;
    y = (leftPos.y + rightPos.y) / 2 - height / 2; // 中心对齐
    console.log(`[Anchor] ${frame.name}: Using LEFT + RIGHT, dynamic width, fixed height`);
  }
  // 策略7: 使用上下锚点（高度动态，宽度固定）
  else if (topPos && bottomPos) {
    width = frame.width;
    height = topPos.y - bottomPos.y;
    x = (topPos.x + bottomPos.x) / 2 - width / 2; // 中心对齐
    y = bottomPos.y;
    console.log(`[Anchor] ${frame.name}: Using TOP + BOTTOM, dynamic height, fixed width`);
  }
  // 策略8: 单锚点 TOPLEFT（固定尺寸）
  else if (topLeftPos) {
    x = topLeftPos.x;
    y = topLeftPos.y - frame.height;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using TOPLEFT only, fixed size`);
  }
  // 策略9: 单锚点 BOTTOMRIGHT（固定尺寸）
  else if (bottomRightPos) {
    x = bottomRightPos.x - frame.width;
    y = bottomRightPos.y;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using BOTTOMRIGHT only, fixed size`);
  }
  // 策略8: 单锚点 CENTER（固定尺寸）
  else if (centerPos) {
    x = centerPos.x - frame.width / 2;
    y = centerPos.y - frame.height / 2;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using CENTER only, fixed size`);
  }
  // 策略9: 单锚点 TOP（固定尺寸）
  else if (topPos) {
    x = topPos.x - frame.width / 2;
    y = topPos.y - frame.height;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using TOP only, fixed size`);
  }
  // 策略10: 单锚点 TOPRIGHT（固定尺寸）
  else if (topRightPos) {
    x = topRightPos.x - frame.width;
    y = topRightPos.y - frame.height;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using TOPRIGHT only, fixed size`);
  }
  // 策略11: 单锚点 LEFT（固定尺寸）
  else if (leftPos) {
    x = leftPos.x;
    y = leftPos.y - frame.height / 2;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using LEFT only, fixed size`);
  }
  // 策略12: 单锚点 RIGHT（固定尺寸）
  else if (rightPos) {
    x = rightPos.x - frame.width;
    y = rightPos.y - frame.height / 2;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using RIGHT only, fixed size`);
  }
  // 策略13: 单锚点 BOTTOMLEFT（固定尺寸）
  else if (bottomLeftPos) {
    x = bottomLeftPos.x;
    y = bottomLeftPos.y;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using BOTTOMLEFT only, fixed size`);
  }
  // 策略14: 单锚点 BOTTOM（固定尺寸）
  else if (bottomPos) {
    x = bottomPos.x - frame.width / 2;
    y = bottomPos.y;
    width = frame.width;
    height = frame.height;
    console.log(`[Anchor] ${frame.name}: Using BOTTOM only, fixed size`);
  }
  // 策略15: 其他情况（不应该到达这里）
  else {
    console.warn(`[Anchor] ${frame.name}: No anchor strategy matched!`);
    return null;
  }

  // 安全检查：确保所有值都是有效的数字
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number' ||
      isNaN(x) || isNaN(y) || isNaN(width) || isNaN(height)) {
    console.error(`[Anchor] Invalid calculation for ${frame.name}: x=${x}, y=${y}, width=${width}, height=${height}`);
    setCachedPosition(frame.id, frameVersion, null);
    return null;
  }

  console.log(`[Anchor] Calculated position for ${frame.name}: (${x.toFixed(3)}, ${y.toFixed(3)}), size: (${width.toFixed(3)}, ${height.toFixed(3)})`);
  
  const result = { x, y, width, height };
  setCachedPosition(frame.id, frameVersion, result);
  return result;
}

/**
 * 检测锚点组合是否存在冲突
 * 返回冲突的锚点索引数组和冲突类型
 */
export function detectAnchorConflicts(anchors: FrameAnchor[]): {
  conflictingAnchors: number[];
  conflictType: 'none' | 'overConstrained' | 'logicalConflict' | 'invalidCombination';
  description: string;
} {
  if (!anchors || anchors.length <= 1) {
    return { conflictingAnchors: [], conflictType: 'none', description: '' };
  }

  // 统计每种锚点类型的数量
  const anchorCounts = new Map<FramePoint, number[]>();
  anchors.forEach((anchor, index) => {
    if (!anchorCounts.has(anchor.point)) {
      anchorCounts.set(anchor.point, []);
    }
    anchorCounts.get(anchor.point)!.push(index);
  });

  // 检查1: 相同位置的多个锚点
  for (const [point, indices] of anchorCounts) {
    if (indices.length > 1) {
      return {
        conflictingAnchors: indices,
        conflictType: 'logicalConflict',
        description: `重复的锚点类型: ${getAnchorPointName(point)}`
      };
    }
  }

  // 获取存在的锚点类型
  const hasPoint = (point: FramePoint) => anchorCounts.has(point);

  // 检查2: 过度约束的组合
  const cornerPoints = [FramePoint.TOPLEFT, FramePoint.TOPRIGHT, FramePoint.BOTTOMLEFT, FramePoint.BOTTOMRIGHT];
  const cornerCount = cornerPoints.filter(hasPoint).length;
  
  // 如果有3个或4个角锚点，检查是否是有效的四边组合
  if (cornerCount >= 3) {
    const hasAllEdges = hasPoint(FramePoint.LEFT) && hasPoint(FramePoint.RIGHT) && 
                       hasPoint(FramePoint.TOP) && hasPoint(FramePoint.BOTTOM);
    
    if (cornerCount === 4 && !hasAllEdges) {
      // 四个角锚点但没有四边组合
      return {
        conflictingAnchors: cornerPoints.map(p => anchorCounts.get(p)?.[0]).filter(i => i !== undefined) as number[],
        conflictType: 'overConstrained',
        description: '四个角锚点会过度约束，建议使用对角组合或添加边缘锚点'
      };
    }
    
    if (cornerCount === 3) {
      // 三个角锚点总是冲突的
      return {
        conflictingAnchors: cornerPoints.map(p => anchorCounts.get(p)?.[0]).filter(i => i !== undefined) as number[],
        conflictType: 'overConstrained',
        description: '三个角锚点会产生冲突，建议使用两个对角锚点'
      };
    }
  }

  // 检查3: 混合水平和垂直对的无效组合
  const hasHorizontalPair = (hasPoint(FramePoint.TOPLEFT) && hasPoint(FramePoint.TOPRIGHT)) ||
                           (hasPoint(FramePoint.BOTTOMLEFT) && hasPoint(FramePoint.BOTTOMRIGHT));
  const hasVerticalPair = (hasPoint(FramePoint.TOPLEFT) && hasPoint(FramePoint.BOTTOMLEFT)) ||
                         (hasPoint(FramePoint.TOPRIGHT) && hasPoint(FramePoint.BOTTOMRIGHT));
  
  if (hasHorizontalPair && hasVerticalPair && cornerCount > 2) {
    // 同时有水平对和垂直对，且角锚点超过2个
    const conflictingIndices: number[] = [];
    
    // 添加所有相关的角锚点索引
    [FramePoint.TOPLEFT, FramePoint.TOPRIGHT, FramePoint.BOTTOMLEFT, FramePoint.BOTTOMRIGHT]
      .forEach(p => {
        const index = anchorCounts.get(p)?.[0];
        if (index !== undefined) conflictingIndices.push(index);
      });
    
    return {
      conflictingAnchors: conflictingIndices,
      conflictType: 'invalidCombination',
      description: '混合水平对和垂直对会产生冲突，建议选择一种布局方式'
    };
  }

  // 检查4: 边缘锚点的逻辑冲突（如左右锚点位置颠倒）
  if (hasPoint(FramePoint.LEFT) && hasPoint(FramePoint.RIGHT)) {
    // 这里可以添加位置检查逻辑，但需要计算实际位置
    // 暂时跳过，因为需要相对位置计算
  }

  // 检查5: 无效的边缘+角锚点组合
  const edgePoints = [FramePoint.LEFT, FramePoint.RIGHT, FramePoint.TOP, FramePoint.BOTTOM];
  const edgeCount = edgePoints.filter(hasPoint).length;
  
  if (edgeCount > 0 && cornerCount > 0) {
    // 有边缘锚点又有角锚点，检查是否是有效组合
    const isValidEdgeCornerCombo = 
      // LEFT+RIGHT 可以配合任意角锚点
      (hasPoint(FramePoint.LEFT) && hasPoint(FramePoint.RIGHT) && cornerCount <= 2) ||
      // TOP+BOTTOM 可以配合任意角锚点  
      (hasPoint(FramePoint.TOP) && hasPoint(FramePoint.BOTTOM) && cornerCount <= 2) ||
      // 四边+四角的完整组合
      (edgeCount === 4 && cornerCount === 4);
    
    if (!isValidEdgeCornerCombo && edgeCount < 4) {
      const conflictingIndices: number[] = [];
      
      // 添加冲突的边缘和角锚点索引
      [...edgePoints, ...cornerPoints].forEach(p => {
        const index = anchorCounts.get(p)?.[0];
        if (index !== undefined) conflictingIndices.push(index);
      });
      
      return {
        conflictingAnchors: conflictingIndices,
        conflictType: 'invalidCombination',
        description: '边缘锚点和角锚点的组合无效，建议使用纯角锚点或完整的边缘锚点'
      };
    }
  }

  return { conflictingAnchors: [], conflictType: 'none', description: '' };
}

/**
 * 获取锚点类型的中文名称
 */
function getAnchorPointName(point: FramePoint): string {
  const names: Record<FramePoint, string> = {
    [FramePoint.TOPLEFT]: '左上角',
    [FramePoint.TOP]: '顶部中心',
    [FramePoint.TOPRIGHT]: '右上角',
    [FramePoint.LEFT]: '左侧中心',
    [FramePoint.CENTER]: '中心',
    [FramePoint.RIGHT]: '右侧中心',
    [FramePoint.BOTTOMLEFT]: '左下角',
    [FramePoint.BOTTOM]: '底部中心',
    [FramePoint.BOTTOMRIGHT]: '右下角'
  };
  return names[point] || '未知';
}

/**
 * 根据锚点类型计算到左下角的偏移量
 * @deprecated 不再使用,保留以备将来参考
 */
function getOffsetFromAnchorPoint(
  point: FramePoint,
  width: number,
  height: number
): { x: number; y: number } {
  switch (point) {
    case FramePoint.TOPLEFT:
      return { x: 0, y: -height };
    case FramePoint.TOP:
      return { x: -width / 2, y: -height };
    case FramePoint.TOPRIGHT:
      return { x: -width, y: -height };
    case FramePoint.LEFT:
      return { x: 0, y: -height / 2 };
    case FramePoint.CENTER:
      return { x: -width / 2, y: -height / 2 };
    case FramePoint.RIGHT:
      return { x: -width, y: -height / 2 };
    case FramePoint.BOTTOMLEFT:
      return { x: 0, y: 0 };
    case FramePoint.BOTTOM:
      return { x: -width / 2, y: 0 };
    case FramePoint.BOTTOMRIGHT:
      return { x: -width, y: 0 };
    default:
      return { x: 0, y: 0 };
  }
}

