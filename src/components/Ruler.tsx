import React, { useState, useRef } from 'react';
import './Ruler.css';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // 标尺长度（像素），水平为 1440px (对应 0.8 WC3)，垂直为 1080px (对应 0.6 WC3)
  scale: number; // 缩放比例
  offset: number; // 偏移量（像素，未缩放）
  onCreateGuide?: (orientation: 'horizontal' | 'vertical', clientX: number, clientY: number) => void; // 创建参考线回调
}

export const Ruler: React.FC<RulerProps> = ({ 
  orientation, 
  length, 
  scale, 
  offset,
  onCreateGuide,
}) => {
  const RULER_SIZE = 30; // 标尺宽度/高度
  const isHorizontal = orientation === 'horizontal';
  const [isDraggingGuide, setIsDraggingGuide] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  // 处理从标尺拖拽创建参考线
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onCreateGuide) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggingGuide(true);
    
    const handleMouseMove = (_moveEvent: MouseEvent) => {
      // 暂时不实现预览功能
      // if (!svgRef.current) return;
      // const rect = svgRef.current.getBoundingClientRect();
      // const canvasPosition = isHorizontal
      //   ? (moveEvent.clientY - rect.top - offset) / scale
      //   : (moveEvent.clientX - rect.left - offset) / scale;
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDraggingGuide(false);
      
      if (!svgRef.current) return;
      
      const rect = svgRef.current.getBoundingClientRect();
      
      // 检查是否拖拽到画布区域
      const isInCanvas = isHorizontal
        ? upEvent.clientY > rect.bottom
        : upEvent.clientX > rect.right;
      
      if (isInCanvas) {
        // 直接传递鼠标的屏幕坐标给Canvas处理
        onCreateGuide(orientation, upEvent.clientX, upEvent.clientY);
      }
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // 计算刻度
  const generateTicks = () => {
    const ticks: { position: number; label?: string; major?: boolean }[] = [];
    
    // 根据缩放级别决定刻度间隔
    let interval = 0.05; // WC3单位
    let majorInterval = 0.1; // 主刻度间隔
    
    if (scale < 0.5) {
      interval = 0.1;
      majorInterval = 0.2;
    } else if (scale > 2) {
      interval = 0.025;
      majorInterval = 0.05;
    }

    // 标尺的长度对应的 WC3 单位范围（固定的）
    const maxWc3 = isHorizontal ? 0.8 : 0.6;
    
    // 每个 WC3 单位对应的像素数
    const pixelsPerUnit = length / maxWc3;

    // 计算当前视图范围对应的 WC3 坐标
    // offset 是画布的平移偏移（像素），正值表示向右/下平移
    const startWc3 = -offset * scale / pixelsPerUnit;
    const endWc3 = ((length - offset * scale) / pixelsPerUnit);

    // 生成刻度（限制在 0 到 maxWc3 范围内）
    const startTick = Math.max(0, Math.floor(startWc3 / interval) * interval);
    const endTick = Math.min(maxWc3, Math.ceil(endWc3 / interval) * interval);

    for (let wc3Coord = startTick; wc3Coord <= endTick; wc3Coord += interval) {
      // 计算刻度在标尺上的像素位置
      const pixelPos = wc3Coord * pixelsPerUnit + offset * scale;
      
      if (pixelPos >= 0 && pixelPos <= length) {
        // 修复浮点数精度问题：将坐标四舍五入到合理精度后再判断
        const roundedCoord = Math.round(wc3Coord / interval) * interval;
        const isMajor = Math.abs(roundedCoord % majorInterval) < 0.0001; // 主刻度显示数字
        ticks.push({
          position: pixelPos,
          label: isMajor ? roundedCoord.toFixed(2) : undefined,
          major: isMajor
        });
      }
    }

    return ticks;
  };

  const ticks = generateTicks();

  return (
    <div 
      className={`ruler ruler-${orientation}`}
      style={{
        width: isHorizontal ? `${length}px` : `${RULER_SIZE}px`,
        height: isHorizontal ? `${RULER_SIZE}px` : `${length}px`,
      }}
    >
      <svg
        ref={svgRef}
        width={isHorizontal ? length : RULER_SIZE}
        height={isHorizontal ? RULER_SIZE : length}
        style={{ 
          display: 'block',
          cursor: isDraggingGuide ? 'grabbing' : (onCreateGuide ? 'grab' : 'default'),
        }}
        onMouseDown={handleMouseDown}
      >
        {/* 背景 */}
        <rect
          x={0}
          y={0}
          width={isHorizontal ? length : RULER_SIZE}
          height={isHorizontal ? RULER_SIZE : length}
          fill="#2a2a2a"
        />

        {/* 刻度线和标签 */}
        {ticks.map((tick, index) => {
          const tickLength = tick.major ? 14 : 8;
          
          if (isHorizontal) {
            return (
              <g key={index}>
                {/* 刻度线 */}
                <line
                  x1={tick.position}
                  y1={RULER_SIZE - tickLength}
                  x2={tick.position}
                  y2={RULER_SIZE}
                  stroke={tick.major ? "#aaa" : "#777"}
                  strokeWidth={tick.major ? 2 : 1}
                />
                {/* 标签 */}
                {tick.label && (
                  <text
                    x={tick.position}
                    y={10}
                    fontSize="10"
                    fill="#ddd"
                    textAnchor="middle"
                    fontWeight="500"
                  >
                    {tick.label}
                  </text>
                )}
              </g>
            );
          } else {
            return (
              <g key={index}>
                {/* 刻度线 */}
                <line
                  x1={RULER_SIZE - tickLength}
                  y1={tick.position}
                  x2={RULER_SIZE}
                  y2={tick.position}
                  stroke={tick.major ? "#aaa" : "#777"}
                  strokeWidth={tick.major ? 2 : 1}
                />
                {/* 标签 */}
                {tick.label && (
                  <text
                    x={15}
                    y={tick.position + 3}
                    fontSize="10"
                    fill="#ddd"
                    textAnchor="middle"
                    fontWeight="500"
                    transform={`rotate(-90 15 ${tick.position})`}
                  >
                    {tick.label}
                  </text>
                )}
              </g>
            );
          }
        })}

        {/* 边框 */}
        <rect
          x={0}
          y={0}
          width={isHorizontal ? length : RULER_SIZE}
          height={isHorizontal ? RULER_SIZE : length}
          fill="none"
          stroke="#3a3a3a"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
};
