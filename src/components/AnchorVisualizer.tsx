import React from 'react';
import { FrameData, FrameAnchor, FramePoint } from '../types';
import { calculatePositionFromAnchors } from '../utils/anchorUtils';
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

interface AnchorVisualizerProps {
  frames: Record<string, FrameData>;
  selectedFrameId: string | null;
  canvasWidth: number;
  canvasHeight: number;
  margin: number;
}

// 将 WC3 坐标转换为画布像素坐标
const wc3ToCanvas = (wc3X: number, wc3Y: number, canvasWidth: number, canvasHeight: number, margin: number) => {
  const effectiveWidth = canvasWidth - 2 * margin;
  const x = margin + (wc3X / WC3_MAX_X) * effectiveWidth;
  const y = canvasHeight - (wc3Y / WC3_MAX_Y) * canvasHeight;
  return { x, y };
};

// 获取锚点在控件上的相对位置
const getAnchorOffset = (point: FramePoint, width: number, height: number): { x: number; y: number } => {
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
};

// 获取锚点名称
const getAnchorName = (point: FramePoint): string => {
  const names = ['TL', 'T', 'TR', 'L', 'C', 'R', 'BL', 'B', 'BR'];
  return names[point] || '';
};

export const AnchorVisualizer: React.FC<AnchorVisualizerProps> = ({
  frames,
  selectedFrameId,
  canvasWidth,
  canvasHeight,
  margin,
}) => {
  if (!selectedFrameId) return null;

  const selectedFrame = frames[selectedFrameId];
  if (!selectedFrame || !selectedFrame.anchors || selectedFrame.anchors.length === 0) return null;

  // 如果控件已隐藏，不渲染锚点
  if (selectedFrame.visible === false) return null;

  // 获取控件的实际位置（考虑相对锚点）
  const calculatedPos = calculatePositionFromAnchors(selectedFrame, frames);
  const actualX = calculatedPos ? calculatedPos.x : selectedFrame.x;
  const actualY = calculatedPos ? calculatedPos.y : selectedFrame.y;
  const actualWidth = calculatedPos ? calculatedPos.width : selectedFrame.width;
  const actualHeight = calculatedPos ? calculatedPos.height : selectedFrame.height;

  // 计算选中控件的画布位置（原始坐标，不需要应用变换）
  const frameCanvasPos = wc3ToCanvas(
    actualX,
    actualY,
    canvasWidth,
    canvasHeight,
    margin
  );
  const framePixelWidth = (actualWidth / WC3_MAX_X) * (canvasWidth - 2 * margin);
  const framePixelHeight = (actualHeight / WC3_MAX_Y) * canvasHeight;

  return (
    <svg
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        pointerEvents: 'none',
        zIndex: 1000,
        overflow: 'visible',
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth={10}
          markerHeight={7}
          refX={9}
          refY={3.5}
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#4CAF50" />
        </marker>
      </defs>

      {selectedFrame.anchors.map((anchor: FrameAnchor, index: number) => {
        // 当前锚点在控件上的位置
        const anchorOffset = getAnchorOffset(anchor.point, framePixelWidth, framePixelHeight);
        const anchorX = frameCanvasPos.x + anchorOffset.x;
        const anchorY = frameCanvasPos.y - framePixelHeight + anchorOffset.y;

        // 绘制锚点标记
        const anchorElements = [
          // 锚点圆圈
          <circle
            key={`anchor-${index}`}
            cx={anchorX}
            cy={anchorY}
            r={5}
            fill="#4CAF50"
            stroke="#ffffff"
            strokeWidth={2}
          />,
          // 锚点名称
          <text
            key={`anchor-text-${index}`}
            x={anchorX + 10}
            y={anchorY - 10}
            fill="#4CAF50"
            fontSize={12}
            fontWeight="bold"
          >
            {getAnchorName(anchor.point)}
          </text>,
        ];

        // 如果是相对定位，绘制连线
        if (anchor.relativePoint !== undefined) {
          let targetX: number;
          let targetY: number;
          
          // 检查是否锚定到其他控件
          const targetFrame = anchor.relativeTo ? frames[anchor.relativeTo] : null;
          
          if (targetFrame) {
            // 锚定到其他控件 - 使用实际位置
            const targetCalculatedPos = calculatePositionFromAnchors(targetFrame, frames);
            const targetActualX = targetCalculatedPos ? targetCalculatedPos.x : targetFrame.x;
            const targetActualY = targetCalculatedPos ? targetCalculatedPos.y : targetFrame.y;
            const targetActualWidth = targetCalculatedPos ? targetCalculatedPos.width : targetFrame.width;
            const targetActualHeight = targetCalculatedPos ? targetCalculatedPos.height : targetFrame.height;
            
            const targetCanvasPos = wc3ToCanvas(
              targetActualX,
              targetActualY,
              canvasWidth,
              canvasHeight,
              margin
            );
            const targetPixelWidth = (targetActualWidth / WC3_MAX_X) * (canvasWidth - 2 * margin);
            const targetPixelHeight = (targetActualHeight / WC3_MAX_Y) * canvasHeight;

            const targetAnchorOffset = getAnchorOffset(
              anchor.relativePoint,
              targetPixelWidth,
              targetPixelHeight
            );
            
            // 目标锚点位置(不包含offset,只是目标控件上的锚点)
            targetX = targetCanvasPos.x + targetAnchorOffset.x;
            targetY = targetCanvasPos.y - targetPixelHeight + targetAnchorOffset.y;
          } else {
            // 锚定到GameUI(画布)
            const gameUIWidth = canvasWidth - 2 * margin;
            const gameUIHeight = canvasHeight;
            
            // GameUI锚点在浏览器坐标系中的位置(从左上角开始)
            const gameUIAnchorOffset = getAnchorOffset(
              anchor.relativePoint,
              gameUIWidth,
              gameUIHeight
            );
            
            // 目标点 = GameUI锚点位置(不包含offset)
            targetX = margin + gameUIAnchorOffset.x;
            targetY = gameUIAnchorOffset.y;
          }

          anchorElements.push(
              // 连线：从当前锚点到目标点（箭头指向目标控件）
              <line
                key={`anchor-line-${index}`}
                x1={anchorX}
                y1={anchorY}
                x2={targetX}
                y2={targetY}
                stroke="#4CAF50"
                strokeWidth={2}
                strokeDasharray="5,5"
                markerEnd="url(#arrowhead)"
              />,
              // 目标锚点圆圈
              <circle
                key={`target-anchor-${index}`}
                cx={targetX}
                cy={targetY}
                r={4}
                fill="#2196F3"
                stroke="#ffffff"
                strokeWidth={2}
              />,
              // 目标锚点标签
              <text
                key={`target-anchor-text-${index}`}
                x={targetX + 10}
                y={targetY - 10}
                fill="#2196F3"
                fontSize={12}
                fontWeight="bold"
              >
                {getAnchorName(anchor.relativePoint)}
              </text>,
              // 偏移量标注
              <text
                key={`offset-text-${index}`}
                x={(anchorX + targetX) / 2}
                y={(anchorY + targetY) / 2 - 5}
                fill="#FFD700"
                fontSize={11}
                fontWeight="bold"
                textAnchor="middle"
              >
                {`(${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`}
              </text>
            );
        } else {
          // 绝对定位，显示绝对坐标
          anchorElements.push(
            <text
              key={`abs-coord-${index}`}
              x={anchorX}
              y={anchorY + 20}
              fill="#FFD700"
              fontSize={11}
              fontWeight="bold"
              textAnchor="middle"
            >
              {`(${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`}
            </text>
          );
        }

        return anchorElements;
      })}
    </svg>
  );
};
