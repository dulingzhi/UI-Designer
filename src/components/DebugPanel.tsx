import React from 'react';
import './DebugPanel.css';

interface DebugPanelProps {
  mouseX: number;
  mouseY: number;
  mouseWc3X: number;
  mouseWc3Y: number;
  selectedFrame?: {
    id: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    type: string;
  } | null;
  scale: number;
  isVisible: boolean;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  mouseX,
  mouseY,
  mouseWc3X,
  mouseWc3Y,
  selectedFrame,
  scale,
  isVisible
}) => {
  if (!isVisible) return null;

  return (
    <div className="debug-panel">
      {/* 鼠标屏幕坐标 */}
      <div className="debug-item">
        <span className="debug-label">屏幕:</span>
        <span className="debug-value">{mouseX.toFixed(0)}, {mouseY.toFixed(0)}</span>
      </div>

      <div className="debug-separator"></div>

      {/* WC3 坐标 */}
      <div className="debug-item wc3-coords">
        <span className="debug-label">WC3:</span>
        <span className="debug-value">{mouseWc3X.toFixed(5)}, {mouseWc3Y.toFixed(5)}</span>
      </div>

      <div className="debug-separator"></div>

      {/* 缩放比例 */}
      <div className="debug-item zoom-info">
        <span className="debug-label">缩放:</span>
        <span className="debug-value">{(scale * 100).toFixed(0)}%</span>
      </div>

      {/* 选中控件信息 */}
      {selectedFrame && (
        <>
          <div className="debug-separator"></div>
          <div className="debug-item selected-frame">
            <span className="debug-label">✓</span>
            <span className="debug-value">
              {selectedFrame.name}
            </span>
          </div>

          <div className="debug-item wc3-coords">
            <span className="debug-label">位置:</span>
            <span className="debug-value">
              {selectedFrame.x.toFixed(3)}, {selectedFrame.y.toFixed(3)}
            </span>
          </div>

          <div className="debug-item wc3-coords">
            <span className="debug-label">尺寸:</span>
            <span className="debug-value">
              {selectedFrame.width.toFixed(3)} × {selectedFrame.height.toFixed(3)}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
