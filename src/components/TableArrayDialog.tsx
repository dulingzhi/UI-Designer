import React, { useState } from 'react';
import './TableArrayDialog.css';
import { ConfirmDialog } from './ConfirmDialog';

interface TableArrayDialogProps {
  frameId: string;
  frameName: string;
  onSubmit: (params: {
    rows: number;
    cols: number;
    xGap: number;
    yGap: number;
  }) => void;
  onClose: () => void;
}

export const TableArrayDialog: React.FC<TableArrayDialogProps> = ({
  frameName,
  onSubmit,
  onClose,
}) => {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [xGap, setXGap] = useState(0.01);
  const [yGap, setYGap] = useState(0.01);
  const [showCountWarning, setShowCountWarning] = useState(false);
  const [showCountAlert, setShowCountAlert] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<any>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rows < 1 || cols < 1) {
      setShowCountAlert(true);
      return;
    }
    
    if (rows * cols > 100) {
      setPendingSubmit({ rows, cols, xGap, yGap });
      setShowCountWarning(true);
      return;
    }

    onSubmit({ rows, cols, xGap, yGap });
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
          <h3>📊 创建表格数组</h3>
          <button className="dialog-close" onClick={onClose}>×</button>
        </div>
        
        <div className="dialog-body">
          <p className="dialog-info">
            基于控件 <strong>{frameName}</strong> 创建表格数组
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>行数 (Rows)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={rows}
                  onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="form-group">
                <label>列数 (Columns)</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={cols}
                  onChange={(e) => setCols(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>水平间距 (X Gap)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.5"
                  value={xGap}
                  onChange={(e) => setXGap(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label>垂直间距 (Y Gap)</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  max="0.5"
                  value={yGap}
                  onChange={(e) => setYGap(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            <div className="form-info">
              <p>将创建 <strong>{rows} × {cols} = {rows * cols}</strong> 个控件</p>
              <p className="form-hint">
                💡 控件命名: {frameName}[0], {frameName}[1], ...
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
          message="行数和列数必须大于 0"
          confirmText="确定"
          type="warning"
          onConfirm={() => setShowCountAlert(false)}
        />
      )}

      {showCountWarning && (
        <ConfirmDialog
          title="确认创建"
          message={`将创建 ${rows * cols} 个控件，是否继续？`}
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
