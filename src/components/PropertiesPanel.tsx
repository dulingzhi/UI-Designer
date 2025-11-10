import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { FrameType, FramePoint, ProjectData, FrameAnchor } from '../types';
import { createDefaultAnchors, updateAnchorsFromBounds, calculateRelativeOffset, calculatePositionFromAnchors, detectAnchorConflicts } from '../utils/anchorUtils';
import { ColorPicker, Select, MultiSelect, Slider, Switch, FilePath, VectorEditor, TextArea } from './PropertyEditors';
import './PropertiesPanel.css';
import './PropertyEditors.css';

interface PropertiesPanelProps {
  onClose: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ onClose }) => {
  const { project, selectedFrameId, selectedFrameIds } = useProjectStore();
  const { executeCommand } = useCommandStore();
  const selectedFrame = selectedFrameId ? project.frames[selectedFrameId] : null;
  
  // 多选模式
  const isMultiSelect = selectedFrameIds.length > 1;

  // 阻止number输入框的滚轮事件冒泡，避免滚动属性面板
  const handleNumberInputWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.stopPropagation();
    // 可选：如果输入框没有焦点，也阻止默认行为
    if (document.activeElement !== e.currentTarget) {
      e.preventDefault();
    }
  };

  // 批量更新多个控件
  const handleBatchChange = (field: string, value: any) => {
    selectedFrameIds.forEach(id => {
      executeCommand(new UpdateFrameCommand(id, { [field]: value }));
    });
  };

  if (!selectedFrame) {
    return (
      <div className="properties-panel">
        <div className="properties-panel-header">
          <h3>通用设置</h3>
          <button 
            className="properties-panel-close"
            onClick={onClose}
            title="关闭属性面板"
          >
            ✕
          </button>
        </div>
        <GeneralSettings />
      </div>
    );
  }

  // 多选模式：显示批量编辑面板
  if (isMultiSelect) {
    return (
      <div className="properties-panel">
        <div className="properties-panel-header">
          <h3>批量编辑 ({selectedFrameIds.length} 个控件)</h3>
          <button 
            className="properties-panel-close"
            onClick={onClose}
            title="关闭属性面板"
          >
            ✕
          </button>
        </div>
        
        {/* 批量操作区域 */}
        <section>
          <h4>批量属性设置</h4>
          <p style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>
            以下设置将应用到所有选中的控件
          </p>

          {/* 批量设置类型 */}
          <div className="form-group">
            <label>批量设置类型</label>
            <select onChange={(e) => {
              const type = parseInt(e.target.value);
              if (type >= 0) {
                handleBatchChange('type', type);
              }
            }}>
              <option value="-1">- 选择类型 -</option>
              <optgroup label="基础容器">
                <option value={FrameType.ORIGIN}>Origin</option>
                <option value={FrameType.FRAME}>Frame</option>
                <option value={FrameType.BACKDROP}>Backdrop</option>
                <option value={FrameType.SIMPLEFRAME}>SimpleFrame</option>
              </optgroup>
              <optgroup label="文本控件">
                <option value={FrameType.TEXT_FRAME}>Text Frame</option>
                <option value={FrameType.SIMPLEFONTSTRING}>SimpleFontString</option>
                <option value={FrameType.TEXTAREA}>TextArea</option>
              </optgroup>
              <optgroup label="按钮控件">
                <option value={FrameType.BUTTON}>Button</option>
                <option value={FrameType.GLUETEXTBUTTON}>GlueTextButton</option>
                <option value={FrameType.GLUEBUTTON}>GlueButton</option>
                <option value={FrameType.SIMPLEBUTTON}>SimpleButton</option>
                <option value={FrameType.SCRIPT_DIALOG_BUTTON}>ScriptDialogButton</option>
                <option value={FrameType.BROWSER_BUTTON}>BrowserButton</option>
                <option value={FrameType.INVIS_BUTTON}>InvisButton</option>
              </optgroup>
              <optgroup label="交互控件">
                <option value={FrameType.CHECKBOX}>Checkbox</option>
                <option value={FrameType.EDITBOX}>EditBox</option>
                <option value={FrameType.SLIDER}>Slider</option>
                <option value={FrameType.SCROLLBAR}>ScrollBar</option>
                <option value={FrameType.LISTBOX}>ListBox</option>
                <option value={FrameType.MENU}>Menu</option>
                <option value={FrameType.POPUPMENU}>PopupMenu</option>
              </optgroup>
              <optgroup label="图形控件">
                <option value={FrameType.SPRITE}>Sprite</option>
                <option value={FrameType.MODEL}>Model</option>
                <option value={FrameType.HIGHLIGHT}>Highlight</option>
              </optgroup>
              <optgroup label="状态栏">
                <option value={FrameType.SIMPLESTATUSBAR}>SimpleStatusBar</option>
                <option value={FrameType.STATUSBAR}>StatusBar</option>
              </optgroup>
              <optgroup label="其他控件">
                <option value={FrameType.CONTROL}>Control</option>
                <option value={FrameType.DIALOG}>Dialog</option>
                <option value={FrameType.TIMERTEXT}>TimerText</option>
              </optgroup>
              <optgroup label="兼容(旧)">
                <option value={FrameType.HORIZONTAL_BAR}>Horizontal Bar</option>
              </optgroup>
            </select>
          </div>

          {/* 批量设置纹理 */}
          <div className="form-group">
            <label>批量设置纹理路径</label>
            <input
              type="text"
              placeholder="输入纹理路径后按回车应用"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = e.currentTarget.value;
                  if (value) {
                    handleBatchChange('texture', value);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>

          {/* 批量设置文本颜色 */}
          <div className="form-group">
            <label>批量设置文本颜色</label>
            <input
              type="color"
              onChange={(e) => handleBatchChange('textColor', e.target.value)}
            />
          </div>

          {/* 批量设置文本缩放 */}
          <div className="form-group">
            <label>批量设置文本缩放</label>
            <input
              type="number"
              step="0.1"
              placeholder="输入数值后按回车应用"
              onWheel={handleNumberInputWheel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = parseFloat(e.currentTarget.value);
                  if (!isNaN(value)) {
                    handleBatchChange('textScale', value);
                    e.currentTarget.value = '';
                  }
                }
              }}
            />
          </div>

          {/* 批量设置相对定位 */}
          <div className="form-group checkbox">
            <label>
              <input
                type="checkbox"
                onChange={(e) => handleBatchChange('isRelative', e.target.checked)}
              />
              批量启用相对定位
            </label>
          </div>
        </section>

        {/* 批量尺寸调整 */}
        <section>
          <h4>批量尺寸调整</h4>
          
          <div className="form-row">
            <div className="form-group">
              <label>统一宽度</label>
              <input
                type="number"
                step="1"
                placeholder="输入后按回车"
                onWheel={handleNumberInputWheel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseFloat(e.currentTarget.value);
                    if (!isNaN(value)) {
                      handleBatchChange('width', value);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
            <div className="form-group">
              <label>统一高度</label>
              <input
                type="number"
                step="1"
                placeholder="输入后按回车"
                onWheel={handleNumberInputWheel}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const value = parseFloat(e.currentTarget.value);
                    if (!isNaN(value)) {
                      handleBatchChange('height', value);
                      e.currentTarget.value = '';
                    }
                  }
                }}
              />
            </div>
          </div>
        </section>

        {/* 已选控件列表 */}
        <section>
          <h4>已选控件</h4>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {selectedFrameIds.map(id => {
              const frame = project.frames[id];
              return frame ? (
                <div key={id} style={{ 
                  padding: '4px 8px', 
                  fontSize: '12px',
                  borderBottom: '1px solid #333'
                }}>
                  {frame.name} ({frame.id})
                </div>
              ) : null;
            })}
          </div>
        </section>
      </div>
    );
  }

  // 计算有效的位置和尺寸（考虑相对锚点）
  const calculatedPos = calculatePositionFromAnchors(selectedFrame, project.frames);
  const effectiveFrame = calculatedPos ? { ...selectedFrame, ...calculatedPos } : selectedFrame;
  
  // 检查是否有多个锚点决定尺寸
  const hasMultipleAnchors = selectedFrame.anchors && selectedFrame.anchors.length > 1;
  const hasDynamicSize = hasMultipleAnchors && calculatedPos !== null;

  // 检测锚点冲突
  const anchorConflicts = selectedFrame.anchors ? detectAnchorConflicts(selectedFrame.anchors) : 
    { conflictingAnchors: [], conflictType: 'none' as const, description: '' };

  const handleChange = (field: string, value: any) => {
    if (!selectedFrameId) return;
    
    // 调试：打印更新信息
    if (field === 'backdropBackgroundInsets') {
      console.log('[PropertiesPanel] 更新 backdropBackgroundInsets:', value);
    }
    
    // 使用命令模式更新字段，支持 undo/redo
    executeCommand(new UpdateFrameCommand(selectedFrameId, { [field]: value }));
  };

  return (
    <div className="properties-panel">
      <div className="properties-panel-header">
        <h3>属性面板</h3>
        <button 
          className="properties-panel-close"
          onClick={onClose}
          title="关闭属性面板"
        >
          ✕
        </button>
      </div>
      
      {/* 继承信息提示 */}
      {(() => {
        const parentFrame = selectedFrame.parentId ? project.frames[selectedFrame.parentId] : null;
        const isInheritedChild = selectedFrameId && parentFrame?.fdfMetadata?.inheritedChildrenIds?.includes(selectedFrameId) || false;
        
        if (isInheritedChild) {
          return (
            <div style={{
              margin: '8px',
              padding: '8px 12px',
              background: '#3a3a3a',
              border: '1px solid #555',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#ffa500'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔗</span>
                <div>
                  <strong>继承的子控件（只读）</strong>
                  <div style={{ fontSize: '11px', color: '#aaa', marginTop: '2px' }}>
                    此控件从模板 "{parentFrame?.fdfMetadata?.inherits}" 继承，不可编辑或删除
                  </div>
                </div>
              </div>
            </div>
          );
        }
        
        if (selectedFrame.fdfMetadata?.inherits) {
          return (
            <div style={{
              margin: '8px',
              padding: '8px 12px',
              background: '#2d3748',
              border: '1px solid #4a5568',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#90cdf4'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>🔗</span>
                <div>
                  <strong>继承自模板: {selectedFrame.fdfMetadata.inherits}</strong>
                  {selectedFrame.fdfMetadata.inheritedChildrenIds && selectedFrame.fdfMetadata.inheritedChildrenIds.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#cbd5e0', marginTop: '2px' }}>
                      包含 {selectedFrame.fdfMetadata.inheritedChildrenIds.length} 个继承的子控件
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }
        
        return null;
      })()}
      
      {/* 基本信息 */}
      <section>
        <h4>详细信息</h4>
        <div className="form-group">
          <label>名称</label>
          <input
            type="text"
            value={selectedFrame.name}
            onChange={(e) => handleChange('name', e.target.value)}
          />
        </div>
        
        <div className="form-group">
          <label>类型</label>
          <select
            value={selectedFrame.type}
            onChange={(e) => handleChange('type', parseInt(e.target.value))}
          >
            <optgroup label="基础容器">
              <option value={FrameType.ORIGIN}>Origin</option>
              <option value={FrameType.FRAME}>Frame</option>
              <option value={FrameType.BACKDROP}>Backdrop</option>
              <option value={FrameType.SIMPLEFRAME}>SimpleFrame</option>
            </optgroup>
            <optgroup label="文本控件">
              <option value={FrameType.TEXT_FRAME}>Text Frame</option>
              <option value={FrameType.SIMPLEFONTSTRING}>SimpleFontString</option>
              <option value={FrameType.TEXTAREA}>TextArea</option>
            </optgroup>
            <optgroup label="按钮控件">
              <option value={FrameType.BUTTON}>Button</option>
              <option value={FrameType.GLUETEXTBUTTON}>GlueTextButton</option>
              <option value={FrameType.GLUEBUTTON}>GlueButton</option>
              <option value={FrameType.SIMPLEBUTTON}>SimpleButton</option>
              <option value={FrameType.SCRIPT_DIALOG_BUTTON}>ScriptDialogButton</option>
              <option value={FrameType.BROWSER_BUTTON}>BrowserButton</option>
              <option value={FrameType.INVIS_BUTTON}>InvisButton</option>
            </optgroup>
            <optgroup label="交互控件">
              <option value={FrameType.CHECKBOX}>Checkbox</option>
              <option value={FrameType.EDITBOX}>EditBox</option>
              <option value={FrameType.SLIDER}>Slider</option>
              <option value={FrameType.SCROLLBAR}>ScrollBar</option>
              <option value={FrameType.LISTBOX}>ListBox</option>
              <option value={FrameType.MENU}>Menu</option>
              <option value={FrameType.POPUPMENU}>PopupMenu</option>
            </optgroup>
            <optgroup label="图形控件">
              <option value={FrameType.SPRITE}>Sprite</option>
              <option value={FrameType.MODEL}>Model</option>
              <option value={FrameType.HIGHLIGHT}>Highlight</option>
            </optgroup>
            <optgroup label="状态栏">
              <option value={FrameType.SIMPLESTATUSBAR}>SimpleStatusBar</option>
              <option value={FrameType.STATUSBAR}>StatusBar</option>
            </optgroup>
            <optgroup label="其他控件">
              <option value={FrameType.CONTROL}>Control</option>
              <option value={FrameType.DIALOG}>Dialog</option>
              <option value={FrameType.TIMERTEXT}>TimerText</option>
            </optgroup>
            <optgroup label="兼容(旧)">
              <option value={FrameType.HORIZONTAL_BAR}>Horizontal Bar</option>
            </optgroup>
          </select>
        </div>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={typeof selectedFrame.tooltip === 'boolean' ? selectedFrame.tooltip : false}
              onChange={(e) => handleChange('tooltip', e.target.checked)}
            />
            作为父级的Tooltip
          </label>
        </div>
      </section>

      {/* 显示控制 */}
      <section>
        <h4>显示控制</h4>
        
        <Slider
          label="透明度 (Alpha)"
          value={selectedFrame.alpha ?? 1}
          onChange={(value) => handleChange('alpha', value)}
          min={0}
          max={1}
          step={0.01}
          unit="%"
          showInput={true}
        />

        <Switch
          label="可见"
          value={selectedFrame.visible ?? true}
          onChange={(value) => handleChange('visible', value)}
        />

        <Switch
          label="锁定（不可编辑）"
          value={selectedFrame.locked ?? false}
          onChange={(value) => handleChange('locked', value)}
        />
      </section>

      {/* 坐标和大小 */}
      <section>
        <h4>坐标</h4>
        
        <div className="form-row">
          <div className="form-group">
            <label>X</label>
            <input
              type="number"
              step="0.01"
              value={effectiveFrame.x}
              onWheel={handleNumberInputWheel}
              onChange={(e) => {
                const newX = parseFloat(e.target.value);
                handleChange('x', newX);
                handleChange('anchors', updateAnchorsFromBounds(
                  selectedFrame.anchors || createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height),
                  newX,
                  selectedFrame.y,
                  selectedFrame.width,
                  selectedFrame.height
                ));
              }}
              disabled={hasDynamicSize}
              title={hasDynamicSize ? "位置由锚点自动计算" : ""}
            />
          </div>
          <div className="form-group">
            <label>Y</label>
            <input
              type="number"
              step="0.01"
              value={effectiveFrame.y}
              onWheel={handleNumberInputWheel}
              onChange={(e) => {
                const newY = parseFloat(e.target.value);
                handleChange('y', newY);
                handleChange('anchors', updateAnchorsFromBounds(
                  selectedFrame.anchors || createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height),
                  selectedFrame.x,
                  newY,
                  selectedFrame.width,
                  selectedFrame.height
                ));
              }}
              disabled={hasDynamicSize}
              title={hasDynamicSize ? "位置由锚点自动计算" : ""}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>宽度</label>
            <input
              type="number"
              step="0.01"
              value={effectiveFrame.width}
              onWheel={handleNumberInputWheel}
              onChange={(e) => {
                const newWidth = parseFloat(e.target.value);
                handleChange('width', newWidth);
                handleChange('anchors', updateAnchorsFromBounds(
                  selectedFrame.anchors || createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height),
                  selectedFrame.x,
                  selectedFrame.y,
                  newWidth,
                  selectedFrame.height
                ));
              }}
              disabled={hasDynamicSize}
              title={hasDynamicSize ? "尺寸由锚点自动计算" : ""}
            />
          </div>
          <div className="form-group">
            <label>高度</label>
            <input
              type="number"
              step="0.01"
              value={effectiveFrame.height}
              onWheel={handleNumberInputWheel}
              onChange={(e) => {
                const newHeight = parseFloat(e.target.value);
                handleChange('height', newHeight);
                handleChange('anchors', updateAnchorsFromBounds(
                  selectedFrame.anchors || createDefaultAnchors(selectedFrame.x, selectedFrame.y, selectedFrame.width, selectedFrame.height),
                  selectedFrame.x,
                  selectedFrame.y,
                  selectedFrame.width,
                  newHeight
                ));
              }}
              disabled={hasDynamicSize}
              title={hasDynamicSize ? "尺寸由锚点自动计算" : ""}
            />
          </div>
        </div>

        <div className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={selectedFrame.isRelative}
              onChange={(e) => handleChange('isRelative', e.target.checked)}
            />
            相对于父级定位
          </label>
        </div>
      </section>

      {/* 锚点管理 */}
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
                    const wasAbsolute = !anchor.relativeTo; // 判断是否从绝对定位转换而来
                    
                    if (relativeToValue) {
                      // 获取相对的目标控件
                      const relativeFrame = project.frames[relativeToValue];
                      if (relativeFrame) {
                        // 默认相对锚点为 TOPLEFT
                        const relativePoint = anchor.relativePoint !== undefined 
                          ? anchor.relativePoint 
                          : FramePoint.TOPLEFT;
                        
                        // 只在首次设置相对控件时自动计算偏移量
                        if (wasAbsolute) {
                          // 从绝对定位转换为相对定位，计算偏移量保持位置不变
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
                          // 只是切换相对的目标控件，保持当前偏移量不变
                          newAnchors[index] = { 
                            ...anchor, 
                            relativeTo: relativeToValue,
                            relativePoint: relativePoint
                          };
                          
                          console.log(`[Anchor] Switching relative target, keeping offset=(${anchor.x.toFixed(3)}, ${anchor.y.toFixed(3)})`);
                        }
                      }
                    } else {
                      // 清空相对控件，保持当前的 x, y 值
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
                    .filter(f => f.id !== selectedFrame.id) // 排除自己
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
                      
                      // 只更新相对锚点类型，保持用户设置的偏移量不变
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
                        // 重新计算相对偏移量，保持控件位置不变
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

      {/* 纹理 */}
      {shouldShowField(selectedFrame.type, 'texture') && (
        <section>
          <h4>纹理</h4>
          <FilePath
            label="纹理路径"
            value={selectedFrame.texture || ''}
            onChange={(value) => handleChange('texture', value)}
            suggestions={[
              'UI/Widgets/Console/Human/',
              'UI/Widgets/Glues/Human/',
              'UI/Widgets/BattleNet/',
              'UI/Widgets/ToolTips/',
              'ReplaceableTextures/CommandButtons/',
              'war3mapImported/',
            ]}
          />
          
          <details style={{ marginBottom: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
              高级纹理设置
            </summary>
            
            <FilePath
              label="纹理文件 (textureFile)"
              value={selectedFrame.textureFile || ''}
              onChange={(value) => handleChange('textureFile', value)}
              placeholder="纹理路径"
              suggestions={[
                'UI/Widgets/',
                'ReplaceableTextures/',
                'war3mapImported/',
              ]}
            />

            <VectorEditor
              label="纹理坐标 (UVs: minU, minV, maxU, maxV)"
              value={selectedFrame.texCoord || [0, 0, 1, 1]}
              onChange={(value) => handleChange('texCoord', value)}
              dimensions={4}
              labels={['minU', 'minV', 'maxU', 'maxV']}
              step={0.01}
            />

            <Select
              label="Alpha模式"
              value={selectedFrame.alphaMode || ''}
              onChange={(value) => handleChange('alphaMode', value || undefined)}
              options={[
                { value: '', label: '默认' },
                { value: 'BLEND', label: 'BLEND' },
                { value: 'ALPHAKEY', label: 'ALPHAKEY' },
                { value: 'ADD', label: 'ADD' },
                { value: 'MOD', label: 'MOD' },
              ]}
              allowClear
            />

            <Switch
              label="装饰文件名"
              value={selectedFrame.decorateFileNames ?? false}
              onChange={(value) => handleChange('decorateFileNames', value)}
            />
          </details>
        </section>
      )}

      {/* 文本 */}
      {shouldShowField(selectedFrame.type, 'text') && (
        <section>
          <h4>文本属性</h4>
          <TextArea
            label="文本内容"
            value={selectedFrame.text || ''}
            onChange={(value) => handleChange('text', value)}
            rows={3}
            placeholder="输入文本内容..."
          />
          
          <Slider
            label="文本缩放"
            value={selectedFrame.textScale ?? 1}
            onChange={(value) => handleChange('textScale', value)}
            min={0.1}
            max={5}
            step={0.1}
            showInput={true}
          />

          <div className="property-editor">
            <label>文本颜色</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={selectedFrame.textColor || '#FFFFFF'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                style={{ width: '60px', height: '32px' }}
              />
              <input
                type="text"
                value={selectedFrame.textColor || '#FFFFFF'}
                onChange={(e) => handleChange('textColor', e.target.value)}
                placeholder="#FFFFFF"
                style={{ flex: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}
              />
            </div>
          </div>

          <div className="form-row">
            <Select
              label="水平对齐"
              value={selectedFrame.horAlign || 'left'}
              onChange={(value) => handleChange('horAlign', value)}
              options={[
                { value: 'left', label: '左对齐' },
                { value: 'center', label: '居中' },
                { value: 'right', label: '右对齐' },
              ]}
            />
            <Select
              label="垂直对齐"
              value={selectedFrame.verAlign || 'start'}
              onChange={(value) => handleChange('verAlign', value)}
              options={[
                { value: 'start', label: '顶部' },
                { value: 'center', label: '居中' },
                { value: 'flex-end', label: '底部' },
              ]}
            />
          </div>

          <FilePath
            label="字体"
            value={selectedFrame.font || ''}
            onChange={(value) => handleChange('font', value)}
            placeholder="例如: Fonts\\FZKATJW.TTF"
            suggestions={[
              'Fonts\\FZKATJW.TTF',
              'Fonts\\FZCHENGJW.TTF',
              'Fonts\\FZYOUJW.TTF',
              'Fonts\\DFPShaoNvW5-GB.ttf',
            ]}
          />

          <Slider
            label="字体大小"
            value={selectedFrame.fontSize ?? 12}
            onChange={(value) => handleChange('fontSize', value)}
            min={8}
            max={72}
            step={1}
            showInput={true}
            unit="px"
          />

          <MultiSelect
            label="字体标记"
            value={selectedFrame.fontFlags || []}
            onChange={(value) => handleChange('fontFlags', value && value.length > 0 ? value : undefined)}
            options={[
              { value: 'BOLD', label: 'BOLD (粗体)' },
              { value: 'ITALIC', label: 'ITALIC (斜体)' },
              { value: 'UNDERLINE', label: 'UNDERLINE (下划线)' },
              { value: 'STRIKEOUT', label: 'STRIKEOUT (删除线)' },
            ]}
            placeholder="选择字体样式"
          />

          <details style={{ marginBottom: '12px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
              高级文本颜色设置
            </summary>
            
            <ColorPicker
              label="高亮颜色 (RGBA)"
              value={selectedFrame.fontHighlightColor || [1, 1, 1, 1]}
              onChange={(value) => handleChange('fontHighlightColor', value)}
            />

            <ColorPicker
              label="禁用状态颜色 (RGBA)"
              value={selectedFrame.fontDisabledColor || [0.5, 0.5, 0.5, 1]}
              onChange={(value) => handleChange('fontDisabledColor', value)}
            />

            <VectorEditor
              label="阴影偏移 (X, Y)"
              value={selectedFrame.fontShadowOffset || [0, 0]}
              onChange={(value) => handleChange('fontShadowOffset', value)}
              dimensions={2}
              labels={['X', 'Y']}
              step={0.001}
            />

            <ColorPicker
              label="阴影颜色 (RGBA)"
              value={selectedFrame.fontShadowColor || [0, 0, 0, 1]}
              onChange={(value) => handleChange('fontShadowColor', value)}
            />
          </details>
        </section>
      )}

      {/* 功能 */}
      {shouldShowField(selectedFrame.type, 'trigger') && (
        <section>
          <h4>功能</h4>
          <div className="form-group">
            <label>触发变量</label>
            <input
              type="text"
              value={selectedFrame.trigVar || ''}
              onChange={(e) => handleChange('trigVar', e.target.value)}
              placeholder="udg_"
            />
          </div>
        </section>
      )}

      {/* EDITBOX 特定属性 */}
      {selectedFrame.type === FrameType.EDITBOX && (
        <section>
          <h4>编辑框设置</h4>
          <Switch
            label="多行编辑"
            value={selectedFrame.multiline ?? false}
            onChange={(value) => handleChange('multiline', value)}
          />
        </section>
      )}

      {/* SLIDER 特定属性 */}
      {selectedFrame.type === FrameType.SLIDER && (
        <section>
          <h4>滑块设置</h4>
          <Slider
            label="最小值"
            value={selectedFrame.minValue ?? 0}
            onChange={(value) => handleChange('minValue', value)}
            min={-1000}
            max={1000}
            step={0.1}
            showInput={true}
          />
          <Slider
            label="最大值"
            value={selectedFrame.maxValue ?? 100}
            onChange={(value) => handleChange('maxValue', value)}
            min={-1000}
            max={1000}
            step={0.1}
            showInput={true}
          />
          <Slider
            label="步长"
            value={selectedFrame.stepSize ?? 1}
            onChange={(value) => handleChange('stepSize', value)}
            min={0.01}
            max={100}
            step={0.01}
            showInput={true}
          />
        </section>
      )}

      {/* CHECKBOX 特定属性 */}
      {selectedFrame.type === FrameType.CHECKBOX && (
        <section>
          <h4>复选框设置</h4>
          <Switch
            label="默认选中"
            value={selectedFrame.checked ?? false}
            onChange={(value) => handleChange('checked', value)}
          />
        </section>
      )}

      {/* BACKDROP 特定属性 */}
      {selectedFrame.type === FrameType.BACKDROP && (
        <section>
          <h4>BACKDROP设置</h4>
          
          <FilePath
            label="背景纹理"
            value={selectedFrame.backdropBackground || ''}
            onChange={(value) => handleChange('backdropBackground', value || undefined)}
            placeholder="背景纹理路径"
            suggestions={[
              'UI/Widgets/Glues/',
              'UI/Widgets/Console/Human/',
            ]}
          />

          <Switch
            label="平铺背景"
            value={selectedFrame.backdropTileBackground ?? false}
            onChange={(value) => handleChange('backdropTileBackground', value)}
          />

          <Slider
            label="背景尺寸"
            value={selectedFrame.backdropBackgroundSize ?? 0.032}
            onChange={(value) => handleChange('backdropBackgroundSize', value)}
            min={0}
            max={0.5}
            step={0.001}
            showInput={true}
          />

          <VectorEditor
            label="背景内边距 (左, 上, 右, 下)"
            value={selectedFrame.backdropBackgroundInsets || [0, 0, 0, 0]}
            onChange={(value) => handleChange('backdropBackgroundInsets', value)}
            dimensions={4}
            labels={['左', '上', '右', '下']}
            step={0.001}
            min={0}
            max={0.5}
            tooltip="背景纹理的内边距，范围 0.000 ~ 0.500（WC3 坐标单位）"
          />

          <FilePath
            label="边框纹理"
            value={selectedFrame.backdropEdgeFile || ''}
            onChange={(value) => handleChange('backdropEdgeFile', value || undefined)}
            placeholder="边框纹理路径"
            suggestions={[
              'UI/Widgets/Glues/',
            ]}
          />

          <Slider
            label="边角尺寸"
            value={selectedFrame.backdropCornerSize ?? 0.008}
            onChange={(value) => handleChange('backdropCornerSize', value)}
            min={0}
            max={0.2}
            step={0.001}
            showInput={true}
          />

          <MultiSelect
            label="边角标志"
            value={selectedFrame.backdropCornerFlags?.split('|').filter(Boolean) || []}
            onChange={(values) => handleChange('backdropCornerFlags', values?.join('|') || undefined)}
            options={[
              { value: 'UL', label: 'UL (左上角)' },
              { value: 'UR', label: 'UR (右上角)' },
              { value: 'BL', label: 'BL (左下角)' },
              { value: 'BR', label: 'BR (右下角)' },
              { value: 'T', label: 'T (上边)' },
              { value: 'B', label: 'B (下边)' },
              { value: 'L', label: 'L (左边)' },
              { value: 'R', label: 'R (右边)' },
            ]}
            placeholder="选择边角和边框"
          />

          <Switch
            label="全部混合"
            value={selectedFrame.backdropBlendAll ?? false}
            onChange={(value) => handleChange('backdropBlendAll', value)}
          />
        </section>
      )}

      {/* BUTTON 特定属性 */}
      {(selectedFrame.type === FrameType.BUTTON || 
        selectedFrame.type === FrameType.GLUETEXTBUTTON ||
        selectedFrame.type === FrameType.GLUEBUTTON ||
        selectedFrame.type === FrameType.SIMPLEBUTTON ||
        selectedFrame.type === FrameType.SCRIPT_DIALOG_BUTTON ||
        selectedFrame.type === FrameType.BROWSER_BUTTON) && (
        <section>
          <h4>按钮状态设置</h4>
          
          <Select
            label="控件样式"
            value={selectedFrame.controlStyle || ''}
            onChange={(value) => handleChange('controlStyle', value || undefined)}
            options={[
              { value: '', label: '默认' },
              { value: 'AUTOCAST', label: 'AUTOCAST' },
              { value: 'AUTOTARGET', label: 'AUTOTARGET' },
              { value: 'MENU', label: 'MENU' },
              { value: 'CHECKBOX', label: 'CHECKBOX' },
            ]}
            allowClear
          />

          <FilePath
            label="正常状态背景"
            value={selectedFrame.controlBackdrop || ''}
            onChange={(value) => handleChange('controlBackdrop', value || undefined)}
            placeholder="正常状态纹理路径"
            suggestions={[
              'UI/Widgets/Console/Human/CommandButton/',
              'UI/Widgets/Glues/GlueScreen-Button',
            ]}
          />

          <FilePath
            label="按下状态背景"
            value={selectedFrame.controlPushedBackdrop || ''}
            onChange={(value) => handleChange('controlPushedBackdrop', value || undefined)}
            placeholder="按下状态纹理路径"
            suggestions={[
              'UI/Widgets/Console/Human/CommandButton/',
            ]}
          />

          <FilePath
            label="禁用状态背景"
            value={selectedFrame.controlDisabledBackdrop || ''}
            onChange={(value) => handleChange('controlDisabledBackdrop', value || undefined)}
            placeholder="禁用状态纹理路径"
            suggestions={[
              'UI/Widgets/Console/Human/CommandButton/',
            ]}
          />

          <FilePath
            label="鼠标悬停高亮"
            value={selectedFrame.controlMouseOverHighlight || ''}
            onChange={(value) => handleChange('controlMouseOverHighlight', value || undefined)}
            placeholder="悬停高亮控件名称"
          />

          <VectorEditor
            label="按下文本偏移 (X, Y)"
            value={selectedFrame.buttonPushedTextOffset || [0, 0]}
            onChange={(value) => handleChange('buttonPushedTextOffset', value)}
            dimensions={2}
            labels={['X偏移', 'Y偏移']}
            step={0.001}
          />
        </section>
      )}

      {/* EDITBOX 额外属性 */}
      {selectedFrame.type === FrameType.EDITBOX && (
        <section>
          <h4>编辑框颜色设置</h4>
          
          <ColorPicker
            label="编辑文本颜色 (RGBA)"
            value={selectedFrame.editTextColor || [1, 1, 1, 1]}
            onChange={(value) => handleChange('editTextColor', value)}
          />

          <ColorPicker
            label="光标颜色 (RGBA)"
            value={selectedFrame.editCursorColor || [1, 1, 1, 1]}
            onChange={(value) => handleChange('editCursorColor', value)}
          />

          <ColorPicker
            label="边框颜色 (RGBA)"
            value={selectedFrame.editBorderColor || [0.5, 0.5, 0.5, 1]}
            onChange={(value) => handleChange('editBorderColor', value)}
          />

          <Slider
            label="最大字符数"
            value={selectedFrame.maxChars ?? 256}
            onChange={(value) => handleChange('maxChars', Math.round(value))}
            min={1}
            max={2048}
            step={1}
            showInput={true}
          />
        </section>
      )}

      {/* SLIDER 额外属性 */}
      {selectedFrame.type === FrameType.SLIDER && (
        <section>
          <h4>滑块布局</h4>
          
          <Slider
            label="初始值"
            value={selectedFrame.sliderInitialValue ?? 0}
            onChange={(value) => handleChange('sliderInitialValue', value)}
            min={selectedFrame.minValue ?? 0}
            max={selectedFrame.maxValue ?? 100}
            step={selectedFrame.stepSize ?? 1}
            showInput={true}
          />

          <TextArea
            label="水平布局"
            value={typeof selectedFrame.sliderLayoutHorizontal === 'string' ? selectedFrame.sliderLayoutHorizontal : ''}
            onChange={(value) => handleChange('sliderLayoutHorizontal', value || undefined)}
            rows={2}
            placeholder="水平布局设置"
          />

          <TextArea
            label="垂直布局"
            value={typeof selectedFrame.sliderLayoutVertical === 'string' ? selectedFrame.sliderLayoutVertical : ''}
            onChange={(value) => handleChange('sliderLayoutVertical', value || undefined)}
            rows={2}
            placeholder="垂直布局设置"
          />
        </section>
      )}

      {/* LISTBOX 特定属性 */}
      {selectedFrame.type === FrameType.LISTBOX && (
        <section>
          <h4>列表框设置</h4>
          
          <TextArea
            label="列表项（每行一项）"
            value={selectedFrame.listBoxItems?.join('\n') || ''}
            onChange={(value) => {
              const items = value.split('\n').filter(line => line.trim());
              handleChange('listBoxItems', items.length > 0 ? items : undefined);
            }}
            rows={5}
            placeholder="项目1&#10;项目2&#10;项目3"
          />
        </section>
      )}

      {/* HIGHLIGHT 特定属性 */}
      {selectedFrame.type === FrameType.HIGHLIGHT && (
        <section>
          <h4>高亮设置</h4>
          
          <Select
            label="高亮类型"
            value={selectedFrame.highlightType || ''}
            onChange={(value) => handleChange('highlightType', value || undefined)}
            options={[
              { value: '', label: '默认' },
              { value: 'FILETEXTURE', label: 'FILETEXTURE (文件纹理)' },
              { value: 'GOLDICON', label: 'GOLDICON (金币图标)' },
              { value: 'LUMBERICON', label: 'LUMBERICON (木材图标)' },
            ]}
            allowClear
          />

          <FilePath
            label="Alpha文件"
            value={selectedFrame.highlightAlphaFile || ''}
            onChange={(value) => handleChange('highlightAlphaFile', value || undefined)}
            placeholder="Alpha纹理路径"
            suggestions={[
              'UI/Widgets/',
            ]}
          />

          <Select
            label="Alpha模式"
            value={selectedFrame.highlightAlphaMode || ''}
            onChange={(value) => handleChange('highlightAlphaMode', value || undefined)}
            options={[
              { value: '', label: '默认' },
              { value: 'BLEND', label: 'BLEND' },
              { value: 'ALPHAKEY', label: 'ALPHAKEY' },
              { value: 'ADD', label: 'ADD' },
            ]}
            allowClear
          />
        </section>
      )}

      {/* SPRITE / MODEL 特定属性 */}
      {(selectedFrame.type === FrameType.SPRITE || selectedFrame.type === FrameType.MODEL) && (
        <section>
          <h4>{selectedFrame.type === FrameType.SPRITE ? 'Sprite' : 'Model'} 设置</h4>
          
          <FilePath
            label="模型文件 (MDX/MDL)"
            value={selectedFrame.backgroundArt || ''}
            onChange={(value) => handleChange('backgroundArt', value || undefined)}
            placeholder="模型文件路径 (如: UI/Glues/..."
            suggestions={[
              'UI/Glues/',
              'UI/Glues/ScoreScreen/',
              'UI/Glues/BattleNet/',
              'Units/',
              'Buildings/',
              'Doodads/',
            ]}
          />

          <Select
            label="图层样式"
            value={selectedFrame.layerStyle || ''}
            onChange={(value) => handleChange('layerStyle', value || undefined)}
            options={[
              { value: '', label: '默认' },
              { value: 'NOSHADING', label: 'NOSHADING (无阴影)' },
              { value: 'IGNORETRACKEVENTS', label: 'IGNORETRACKEVENTS (忽略追踪)' },
              { value: 'NOSHADING|IGNORETRACKEVENTS', label: '两者都启用' },
            ]}
            allowClear
          />

          {/* MODEL 相机设置 */}
          {selectedFrame.type === FrameType.MODEL && (
            <>
              <Slider
                label="水平旋转 (Yaw)"
                value={selectedFrame.cameraYaw !== undefined ? selectedFrame.cameraYaw * 180 / Math.PI : 0}
                onChange={(value) => handleChange('cameraYaw', value * Math.PI / 180)}
                min={-180}
                max={180}
                step={5}
                unit="°"
                tooltip="相机水平旋转角度: 0° = 正前方, 90° = 右侧, 180° = 背后, -90° = 左侧"
              />

              <Slider
                label="俯仰角 (Pitch)"
                value={selectedFrame.cameraPitch !== undefined ? selectedFrame.cameraPitch * 180 / Math.PI : 17}
                onChange={(value) => handleChange('cameraPitch', value * Math.PI / 180)}
                min={-30}
                max={89}
                step={5}
                unit="°"
                tooltip="相机俯仰角度: 0° = 平视, 正值 = 俯视, 负值 = 仰视"
              />

              <Slider
                label="相机距离"
                value={selectedFrame.cameraDistance || 300}
                onChange={(value) => handleChange('cameraDistance', value)}
                min={50}
                max={1000}
                step={10}
                tooltip="相机与模型的距离"
              />
            </>
          )}

          <p style={{ fontSize: '12px', color: '#888', marginTop: '8px' }}>
            💡 提示：<br/>
            • Sprite 用于 2D 动画模型<br/>
            • Model 用于 3D 模型显示<br/>
            • 支持 .mdx 和 .mdl 格式<br/>
            • 常见路径：UI/Glues/ScoreScreen/...<br/>
            {selectedFrame.type === FrameType.MODEL && '• 相机角度可调整模型朝向'}
          </p>
        </section>
      )}
    </div>
  );
};

const GeneralSettings: React.FC = () => {
  const { project, updateGeneralSettings } = useProjectStore();

  // 预设背景图列表
  const backgroundOptions = [
    { value: '', label: '无背景 (棋盘格)' },
    { value: '/backgrounds/wc3-with-ui.png', label: 'WC3 1920x1080 (带UI)' },
    { value: '/backgrounds/wc3-no-ui.png', label: 'WC3 1920x1080 (无UI)' },
  ];

  return (
    <div>
      <div className="form-group">
        <label>库名称</label>
        <input
          type="text"
          value={project.libraryName}
          onChange={(e) => updateGeneralSettings({ libraryName: e.target.value })}
        />
      </div>

      <div className="form-group">
        <label>Origin模式</label>
        <select
          value={project.originMode}
          onChange={(e) => updateGeneralSettings({ originMode: e.target.value as any })}
        >
          <option value="gameui">Game UI</option>
          <option value="worldframe">World Frame</option>
          <option value="consoleui">Console UI</option>
        </select>
      </div>

      <div className="form-group">
        <label>导出版本</label>
        <select
          value={project.exportVersion || 'reforged'}
          onChange={(e) => updateGeneralSettings({ exportVersion: e.target.value as any })}
        >
          <option value="reforged">重制版 (Blz API)</option>
          <option value="1.27">1.27 版本 (Dz API)</option>
        </select>
      </div>

      <div className="form-group">
        <label>画布背景图</label>
        <select
          value={project.backgroundImage || ''}
          onChange={(e) => updateGeneralSettings({ backgroundImage: e.target.value || undefined })}
        >
          {backgroundOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <h4>隐藏默认游戏UI</h4>
      {[
        { key: 'hideGameUI', label: '隐藏所有游戏UI' },
        { key: 'hideHeroBar', label: '隐藏英雄栏' },
        { key: 'hideMiniMap', label: '隐藏小地图' },
        { key: 'hideResources', label: '隐藏资源栏' },
        { key: 'hideButtonBar', label: '隐藏按钮栏' },
        { key: 'hidePortrait', label: '隐藏头像' },
        { key: 'hideChat', label: '隐藏聊天' },
      ].map(({ key, label }) => (
        <div key={key} className="form-group checkbox">
          <label>
            <input
              type="checkbox"
              checked={project[key as keyof ProjectData] as boolean}
              onChange={(e) => updateGeneralSettings({ [key]: e.target.checked })}
            />
            {label}
          </label>
        </div>
      ))}
    </div>
  );
};

// 辅助函数：判断是否显示某个字段
function shouldShowField(type: FrameType, field: string): boolean {
  const textTypes = [
    FrameType.TEXT_FRAME,
    FrameType.SIMPLEFONTSTRING,
    FrameType.TEXTAREA,
    FrameType.BROWSER_BUTTON,
    FrameType.GLUETEXTBUTTON,
    FrameType.SCRIPT_DIALOG_BUTTON,
    FrameType.EDITBOX,
    FrameType.TIMERTEXT,
  ];

  const textureTypes = [
    FrameType.BACKDROP,
    FrameType.BUTTON,
    FrameType.GLUEBUTTON,
    FrameType.SIMPLEBUTTON,
    FrameType.GLUETEXTBUTTON,
    FrameType.BROWSER_BUTTON,
    FrameType.SCRIPT_DIALOG_BUTTON,
    FrameType.HORIZONTAL_BAR,
    FrameType.SPRITE,
    FrameType.MODEL,
    FrameType.SIMPLESTATUSBAR,
    FrameType.STATUSBAR,
  ];

  const triggerTypes = [
    FrameType.BUTTON,
    FrameType.GLUEBUTTON,
    FrameType.GLUETEXTBUTTON,
    FrameType.SIMPLEBUTTON,
    FrameType.BROWSER_BUTTON,
    FrameType.SCRIPT_DIALOG_BUTTON,
    FrameType.INVIS_BUTTON,
    FrameType.CHECKBOX,
  ];

  switch (field) {
    case 'text':
      return textTypes.includes(type);
    case 'texture':
      return textureTypes.includes(type);
    case 'trigger':
      return triggerTypes.includes(type);
    default:
      return false;
  }
}
