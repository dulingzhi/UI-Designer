import React from 'react';
import './Ruler.css';

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // 标尺长度（像素）
  scale: number; // 缩放比例
  offset: number; // 偏移量（像素）
  wc3UnitSize: number; // WC3单位对应的像素数（例如：0.8宽度对应的像素）
}

export const Ruler: React.FC<RulerProps> = ({ 
  orientation, 
  length, 
  scale, 
  offset,
  wc3UnitSize 
}) => {
  const RULER_SIZE = 30; // 标尺宽度/高度
  const isHorizontal = orientation === 'horizontal';

  // 计算刻度
  const generateTicks = () => {
    const ticks: { position: number; label?: string; major?: boolean }[] = [];
    
    // 根据缩放级别决定刻度间隔
    let interval = 0.05; // WC3单位
    if (scale < 0.5) {
      interval = 0.1;
    } else if (scale > 2) {
      interval = 0.025;
    }

    // 计算起始和结束的WC3坐标
    const pixelsPerUnit = isHorizontal 
      ? wc3UnitSize / 0.8  // 水平方向：0.8单位对应整个宽度
      : wc3UnitSize / 0.6; // 垂直方向：0.6单位对应整个高度

    const startWc3 = -offset / (pixelsPerUnit * scale);
    const endWc3 = (length - offset) / (pixelsPerUnit * scale);

    // 生成刻度
    const startTick = Math.floor(startWc3 / interval) * interval;
    const endTick = Math.ceil(endWc3 / interval) * interval;

    for (let wc3Coord = startTick; wc3Coord <= endTick; wc3Coord += interval) {
      const pixelPos = wc3Coord * pixelsPerUnit * scale + offset;
      
      if (pixelPos >= 0 && pixelPos <= length) {
        const isMajor = Math.abs(wc3Coord % 0.1) < 0.001; // 每0.1显示数字
        ticks.push({
          position: pixelPos,
          label: isMajor ? wc3Coord.toFixed(2) : undefined,
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
        width={isHorizontal ? length : RULER_SIZE}
        height={isHorizontal ? RULER_SIZE : length}
        style={{ display: 'block' }}
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
          const tickLength = tick.major ? 12 : 6;
          
          if (isHorizontal) {
            return (
              <g key={index}>
                {/* 刻度线 */}
                <line
                  x1={tick.position}
                  y1={RULER_SIZE - tickLength}
                  x2={tick.position}
                  y2={RULER_SIZE}
                  stroke="#888"
                  strokeWidth={tick.major ? 1.5 : 0.5}
                />
                {/* 标签 */}
                {tick.label && (
                  <text
                    x={tick.position}
                    y={12}
                    fontSize="9"
                    fill="#ccc"
                    textAnchor="middle"
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
                  stroke="#888"
                  strokeWidth={tick.major ? 1.5 : 0.5}
                />
                {/* 标签 */}
                {tick.label && (
                  <text
                    x={15}
                    y={tick.position + 3}
                    fontSize="9"
                    fill="#ccc"
                    textAnchor="middle"
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
