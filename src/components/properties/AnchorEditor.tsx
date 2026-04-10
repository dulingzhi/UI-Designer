import React from 'react';
import { FrameData, FramePoint, FrameAnchor, ProjectData } from '../../types';
import { createDefaultAnchors, calculateRelativeOffset, detectAnchorConflicts } from '../../utils/anchorUtils';

interface AnchorEditorProps {
  selectedFrame: FrameData;
  project: ProjectData;
  handleChange: (field: string, value: any) => void;
  handleNumberInputWheel: (e: React.WheelEvent<HTMLInputElement>) => void;
}

export const AnchorEditor: React.FC<AnchorEditorProps> = ({
  selectedFrame,
  project,
  handleChange,
  handleNumberInputWheel,
}) => {
  const anchorConflicts = selectedFrame.anchors ? detectAnchorConflicts(selectedFrame.anchors) : 
    { conflictingAnchors: [], conflictType: 'none' as const, description: '' };

  return (
    <section>
      <h4>锚点</h4>
      
      {/* 锚点冲突警告 */}
      {anchorConflicts.conflictType !== 'none' && (
        <div className="anchor-conflict-warning" style={{
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          padding: '8px',
          marginBottom: '12px',
          color: '#856404'
        }}>
          <strong>⚠️ 锚点冲突:</strong> {anchorConflicts.description}
        </div>
      )}
      
      <div className="anchors-list">
        {(selectedFrame.anchors || createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height)).map((anchor, index) => {
          // 检查当前锚点是否在冲突列表中
          const isConflicting = anchorConflicts.conflictingAnchors.includes(index);
          
          return (
            <div 
              key={index} 
              className="anchor-item"
              style={{
                backgroundColor: isConflicting ? '#ffebee' : undefined,
                border: isConflicting ? '1px solid #f44336' : undefined,
                borderRadius: '4px',
                padding: '8px'
              }}
            >
              <div className="anchor-header">
                <strong style={{ color: isConflicting ? '#d32f2f' : undefined }}>
                  锚点 {index + 1} {isConflicting && '⚠️'}
                </strong>
                {selectedFrame.anchors && selectedFrame.anchors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newAnchors = selectedFrame.anchors!.filter((_, i) => i !== index);
                      handleChange('anchors', newAnchors);
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            
            <div className="form-group">
              <label>锚点类型</label>
              <select
                value={anchor.point}
                onChange={(e) => {
                  const newAnchors = [...(selectedFrame.anchors || [])];
                  newAnchors[index] = { ...anchor, point: parseInt(e.target.value) };
                  handleChange('anchors', newAnchors);
                }}
                style={{ borderColor: isConflicting ? '#f44336' : undefined }}
              >
                <option value={FramePoint.TOPLEFT}>左上角</option>
                <option value={FramePoint.TOP}>顶部中心</option>
                <option value={FramePoint.TOPRIGHT}>右上角</option>
                <option value={FramePoint.LEFT}>左侧中心</option>
                <option value={FramePoint.CENTER}>中心</option>
                <option value={FramePoint.RIGHT}>右侧中心</option>
                <option value={FramePoint.BOTTOMLEFT}>左下角</option>
                <option value={FramePoint.BOTTOM}>底部中心</option>
                <option value={FramePoint.BOTTOMRIGHT}>右下角</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>X</label>
                <input
                  type="number"
                  step="0.01"
                  value={anchor.x}
                  onWheel={handleNumberInputWheel}
                  onChange={(e) => {
                    const newAnchors = [...(selectedFrame.anchors || [])];
                    newAnchors[index] = { ...anchor, x: parseFloat(e.target.value) };
                    handleChange('anchors', newAnchors);
                  }}
                  style={{ borderColor: isConflicting ? '#f44336' : undefined }}
                />
              </div>
              <div className="form-group">
                <label>Y</label>
                <input
                  type="number"
                  step="0.01"
                  value={anchor.y}
                  onWheel={handleNumberInputWheel}
                  onChange={(e) => {
                    const newAnchors = [...(selectedFrame.anchors || [])];
                    newAnchors[index] = { ...anchor, y: parseFloat(e.target.value) };
                    handleChange('anchors', newAnchors);
                  }}
                  style={{ borderColor: isConflicting ? '#f44336' : undefined }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>相对于控件 (可选)</label>
              <select
                value={anchor.relativeTo || ''}
                onChange={(e) => {
                  const newAnchors = [...(selectedFrame.anchors || [])];
                  const relativeToValue = e.target.value || undefined;
                  const wasAbsolute = !anchor.relativeTo;
                  
                  if (relativeToValue) {
                    const relativeFrame = project.frames[relativeToValue];
                    if (relativeFrame) {
                      const relativePoint = anchor.relativePoint !== undefined 
                        ? anchor.relativePoint 
                        : FramePoint.TOPLEFT;
                      
                      if (wasAbsolute) {
                        const offset = calculateRelativeOffset(
                          selectedFrame,
                          anchor,
                          relativeFrame,
                          relativePoint
                        );
                        
                        newAnchors[index] = { 
                          ...anchor, 
                          relativeTo: relativeToValue,
                          relativePoint: relativePoint,
                          x: offset.x,
                          y: offset.y
                        };
                        
                        console.log(`[Anchor] Converting to relative: offset=(${offset.x.toFixed(3)}, ${offset.y.toFixed(3)})`);
                      } else {
                        newAnchors[index] = { 
                          ...anchor, 
                          relativeTo: relativeToValue,
                          relativePoint: relativePoint
                        };
                        
                        console.log(`[Anchor] Switching relative target, keeping offset=(${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`);
                      }
                    }
                  } else {
                    newAnchors[index] = { 
                      ...anchor, 
                      relativeTo: undefined,
                      relativePoint: undefined
                    };
                  }
                  
                  handleChange('anchors', newAnchors);
                }}
                style={{ borderColor: isConflicting ? '#f44336' : undefined }}
              >
                <option value="">绝对定位</option>
                {Object.values(project.frames)
                  .filter(f => f.id !== selectedFrame.id)
                  .map(f => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.id})
                    </option>
                  ))}
              </select>
            </div>

            {anchor.relativeTo && (
              <div className="form-group">
                <label>相对锚点</label>
                <select
                  value={anchor.relativePoint ?? FramePoint.TOPLEFT}
                  onChange={(e) => {
                    const newAnchors = [...(selectedFrame.anchors || [])];
                    const newRelativePoint = parseInt(e.target.value);
                    
                    newAnchors[index] = { 
                      ...anchor, 
                      relativePoint: newRelativePoint
                    };
                    
                    console.log(`[Anchor] Changing relative point to ${FramePoint[newRelativePoint]}, keeping offset=(${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`);
                    handleChange('anchors', newAnchors);
                  }}
                  style={{ borderColor: isConflicting ? '#f44336' : undefined }}
                >
                  <option value={FramePoint.TOPLEFT}>左上角</option>
                  <option value={FramePoint.TOP}>顶部中心</option>
                  <option value={FramePoint.TOPRIGHT}>右上角</option>
                  <option value={FramePoint.LEFT}>左侧中心</option>
                  <option value={FramePoint.CENTER}>中心</option>
                  <option value={FramePoint.RIGHT}>右侧中心</option>
                  <option value={FramePoint.BOTTOMLEFT}>左下角</option>
                  <option value={FramePoint.BOTTOM}>底部中心</option>
                  <option value={FramePoint.BOTTOMRIGHT}>右下角</option>
                </select>
                
                <button
                  type="button"
                  style={{ marginTop: '8px', fontSize: '12px' }}
                  onClick={() => {
                    const newAnchors = [...(selectedFrame.anchors || [])];
                    const relativeFrame = project.frames[anchor.relativeTo!];
                    
                    if (relativeFrame && anchor.relativePoint !== undefined) {
                      const offset = calculateRelativeOffset(
                        selectedFrame,
                        anchor,
                        relativeFrame,
                        anchor.relativePoint
                      );
                      
                      newAnchors[index] = { 
                        ...anchor, 
                        x: offset.x,
                        y: offset.y
                      };
                      
                      console.log(`[Anchor] Recalculating offset: (${offset.x.toFixed(3)}, ${offset.y.toFixed(3)})`);
                      handleChange('anchors', newAnchors);
                    }
                  }}
                >
                  🔄 重新计算偏移
                </button>
              </div>
            )}
          </div>
        );
      })}
      </div>

      <button
        type="button"
        onClick={() => {
          const newAnchor: FrameAnchor = {
            point: FramePoint.TOPLEFT,
            x: selectedFrame.x,
            y: selectedFrame.y
          };
          const newAnchors = [...(selectedFrame.anchors || createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height)), newAnchor];
          handleChange('anchors', newAnchors);
        }}
      >
        添加锚点
      </button>
    </section>
  );
};
