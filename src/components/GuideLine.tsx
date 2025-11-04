import React, { useState, useRef } from 'react';
import { GuideLine as GuideLineType } from '../types';
import './GuideLine.css';

interface GuideLineProps {
  guide: GuideLineType;
  scale: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;
  onUpdate: (id: string, updates: Partial<GuideLineType>) => void;
  onRemove: (id: string) => void;
  onHover?: (id: string | null) => void;
}

export const GuideLine: React.FC<GuideLineProps> = ({
  guide,
  scale,
  canvasWidth,
  canvasHeight,
  onUpdate,
  onRemove,
  onHover,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, guidePos: 0 });

  const isHorizontal = guide.orientation === 'horizontal';
  const color = guide.color || '#00aaff';

  // 计算参考线在画布中的位置（像素）
  // 参考线的position现在直接是画布坐标（0表示画布左边缘/顶边缘）
  // 因为参考线在canvas内部渲染，canvas-wrapper的transform会处理缩放
  const canvasPosition = guide.position;

  // 处理鼠标按下 - 开始拖拽
  const handleMouseDown = (e: React.MouseEvent) => {
    if (guide.locked) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    setIsDragging(true);
    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      guidePos: guide.position,
    };
  };

  // 处理鼠标移动
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      // 鼠标移动的像素距离
      const delta = isHorizontal
        ? e.clientY - dragStartPos.current.y
        : e.clientX - dragStartPos.current.x;
      
      // 由于canvas-wrapper有缩放，需要将鼠标移动距离除以scale
      // 才能得到在画布坐标系中的移动距离
      const newPosition = dragStartPos.current.guidePos + delta / scale;
      
      // 限制范围（相对于内容区域）
      const maxPosition = isHorizontal ? canvasHeight : canvasWidth;
      const clampedPosition = Math.max(0, Math.min(maxPosition, newPosition));
      
      onUpdate(guide.id, { position: clampedPosition });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, guide.id, guide.position, scale, isHorizontal, canvasWidth, canvasHeight, onUpdate]);

  // 处理双击删除
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (guide.locked) return;
    
    e.stopPropagation();
    e.preventDefault();
    onRemove(guide.id);
  };

  // 处理右键删除
  const handleContextMenu = (e: React.MouseEvent) => {
    if (guide.locked) return;
    
    e.preventDefault();
    e.stopPropagation();
    onRemove(guide.id);
  };

  // 处理鼠标悬停
  const handleMouseEnter = () => {
    setIsHovered(true);
    onHover?.(guide.id);
  };

  const handleMouseLeave = () => {
    if (!isDragging) {
      setIsHovered(false);
      onHover?.(null);
    }
  };

  const lineStyle: React.CSSProperties = isHorizontal
    ? {
        position: 'absolute',
        left: 0,
        top: `${canvasPosition}px`,
        width: '100%',
        height: '1px',
        backgroundColor: color,
        pointerEvents: 'none',
        zIndex: 999,
      }
    : {
        position: 'absolute',
        left: `${canvasPosition}px`,
        top: 0,
        width: '1px',
        height: '100%',
        backgroundColor: color,
        pointerEvents: 'none',
        zIndex: 999,
      };

  const hitAreaStyle: React.CSSProperties = isHorizontal
    ? {
        position: 'absolute',
        left: 0,
        top: `${canvasPosition - 3}px`,
        width: '100%',
        height: '7px',
        cursor: guide.locked ? 'not-allowed' : 'ns-resize',
        zIndex: 1000,
      }
    : {
        position: 'absolute',
        left: `${canvasPosition - 3}px`,
        top: 0,
        width: '7px',
        height: '100%',
        cursor: guide.locked ? 'not-allowed' : 'ew-resize',
        zIndex: 1000,
      };

  return (
    <>
      {/* 可见的参考线 */}
      <div
        className={`guide-line ${isHovered || isDragging ? 'guide-line-active' : ''} ${guide.locked ? 'guide-line-locked' : ''}`}
        style={lineStyle}
      />
      
      {/* 可交互的热区 */}
      <div
        className="guide-line-hit-area"
        style={hitAreaStyle}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      />
      
      {/* 位置提示（悬停或拖拽时显示） */}
      {(isHovered || isDragging) && (
        <div
          className="guide-line-tooltip"
          style={{
            position: 'absolute',
            left: isHorizontal ? '50%' : `${canvasPosition + 10}px`,
            top: isHorizontal ? `${canvasPosition + 10}px` : '50%',
            transform: isHorizontal ? 'translateX(-50%)' : 'translateY(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            pointerEvents: 'none',
            zIndex: 1001,
            whiteSpace: 'nowrap',
          }}
        >
          {guide.position.toFixed(1)}px
          {guide.wc3Position !== undefined && ` (${guide.wc3Position.toFixed(3)})`}
          {guide.locked && ' 🔒'}
        </div>
      )}
    </>
  );
};
