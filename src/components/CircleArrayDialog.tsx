import React, { useState } from 'react';
import './TableArrayDialog.css'; // 复用相同的样式
import { ConfirmDialog } from './ConfirmDialog';

interface CircleArrayDialogProps {
  frameName: string;
  onSubmit: (params: {
    centerX: number;
    centerY: number;
    radius: number;
    count: number;
    initialAngle: number;
  }) => void;
  onClose: () => void;
}

export const CircleArrayDialog: React.FC<CircleArrayDialogProps> = ({
  frameName,
  onSubmit,
  onClose,
}) => {
  const [centerX, setCenterX] = useState(0.4); // 画布中心
  const [centerY, setCenterY] = useState(0.3);
  const [radius, setRadius] = useState(0.1);
  const [count, setCount] = useState(8);
  const [initialAngle, setInitialAngle] = useState(0); // 度数
  const [showCountWarning, setShowCountWarning] = useState(false);
  const [showCountAlert, setShowCountAlert] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (count < 2) {
      setShowCountAlert(true);
      return;
    }
    
    if (count > 50) {
      setPendingSubmit({ centerX, centerY, radius, count, initialAngle: (initialAngle * Math.PI) / 180 });
      setShowCountWarning(true);
      return;
    }

    // 将角度转换为弧度
    const angleInRadians = (initialAngle * Math.PI) / 180;

    onSubmit({ 
      centerX, 
      centerY, 
      radius, 
      count, 
      initialAngle: angleInRadians 
    });
  };

  const confirmSubmit = () => {
    setShowCountWarning(false);
    if (pendingSubmit) {
      onSubmit(pendingSubmit);
      setPendingSubmit(null);
    }
  };

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>⭕ 创建环形数组</h3>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="dialog-body">
          <p className="dialog-info">
            基于控件 <strong>{frameName}</strong> 创建环形数组
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>中心 X (0.0 - 0.8)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.8"
                  value={centerX}
                  onChange={(e) => setCenterX(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>中心 Y (0.0 - 0.6)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.6"
                  value={centerY}
                  onChange={(e) => setCenterY(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>半径 (Radius)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.5"
                  value={radius}
                  onChange={(e) => setRadius(parseFloat(e.target.value) || 0.01)}
                />
              </div>
              <div className="form-group">
                <label>数量 (Count)</label>
                <input
                  type="number"
                  min="2"
                  max="50"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 2)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>起始角度 (度数, 0° = 正右方)</label>
              <input
                type="number"
                step="15"
                min="-360"
                max="360"
                value={initialAngle}
                onChange={(e) => setInitialAngle(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="form-info">
              <p>将创建 <strong>{count}</strong> 个控件，沿圆周均匀分布</p>
              <p className="form-hint">
                💡 控件命名: {frameName}[0], {frameName}[1], ...
              </p>
              <p className="form-hint">
                💡 角度间隔: {(360 / count).toFixed(1)}°
              </p>
            </div>

            <div className="dialog-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn-primary">
                创建
              </button>
            </div>
          </form>
        </div>
      </div>

      {showCountAlert && (
        <ConfirmDialog
          title="输入错误"
          message="数量必须大于等于 2"
          confirmText="确定"
          type="warning"
          onConfirm={() => setShowCountAlert(false)}
        />
      )}

      {showCountWarning && (
        <ConfirmDialog
          title="确认创建"
          message={`将创建 ${count} 个控件，是否继续？`}
          confirmText="继续"
          cancelText="取消"
          type="warning"
          onConfirm={confirmSubmit}
          onCancel={() => {
            setShowCountWarning(false);
            setPendingSubmit(null);
          }}
        />
      )}
    </div>
  );
};
