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
      <div className="debug-section">
        <div className="debug-title">🖱️ 鼠标位置</div>
        <div className="debug-row">
          <span className="debug-label">屏幕坐标:</span>
          <span className="debug-value">X: {mouseX.toFixed(0)}, Y: {mouseY.toFixed(0)}</span>
        </div>
        <div className="debug-row">
          <span className="debug-label">WC3坐标:</span>
          <span className="debug-value wc3-coords">
            X: {mouseWc3X.toFixed(5)}, Y: {mouseWc3Y.toFixed(5)}
          </span>
        </div>
      </div>

      <div className="debug-divider"></div>

      <div className="debug-section">
        <div className="debug-title">🔍 画布状态</div>
        <div className="debug-row">
          <span className="debug-label">缩放比例:</span>
          <span className="debug-value">{(scale * 100).toFixed(0)}%</span>
        </div>
      </div>

      {selectedFrame && (
        <>
          <div className="debug-divider"></div>
          <div className="debug-section">
            <div className="debug-title">📦 选中控件</div>
            <div className="debug-row">
              <span className="debug-label">名称:</span>
              <span className="debug-value">{selectedFrame.name}</span>
            </div>
            <div className="debug-row">
              <span className="debug-label">类型:</span>
              <span className="debug-value">{selectedFrame.type}</span>
            </div>
            <div className="debug-row">
              <span className="debug-label">位置:</span>
              <span className="debug-value wc3-coords">
                ({selectedFrame.x.toFixed(5)}, {selectedFrame.y.toFixed(5)})
              </span>
            </div>
            <div className="debug-row">
              <span className="debug-label">尺寸:</span>
              <span className="debug-value wc3-coords">
                {selectedFrame.width.toFixed(5)} × {selectedFrame.height.toFixed(5)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
