import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { FrameType, ProjectData } from '../types';
import { createDefaultAnchors, updateAnchorsFromBounds, calculatePositionFromAnchors } from '../utils/anchorUtils';
import { Slider, Switch } from './PropertyEditors';
import { AnchorEditor } from './properties/AnchorEditor';
import { TextProperties } from './properties/TextProperties';
import { TextureProperties } from './properties/TextureProperties';
import { TypeSpecificProperties } from './properties/TypeSpecificProperties';
import { BatchEditPanel } from './properties/BatchEditPanel';
import './PropertiesPanel.css';
import './PropertyEditors.css';

interface PropertiesPanelProps {
  onClose: () => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({ onClose }) => {
  const { project } = useProjectStore();
  const { selectedFrameId, selectedFrameIds } = useUIStore();
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
    return <BatchEditPanel onClose={onClose} />;
  }

  // 计算有效的位置和尺寸（考虑相对锚点）
  const calculatedPos = calculatePositionFromAnchors(selectedFrame, project.frames);
  const effectiveFrame = calculatedPos ? { ...selectedFrame, ...calculatedPos } : selectedFrame;
  
  // 检查是否有多个锚点决定尺寸
  const hasMultipleAnchors = selectedFrame.anchors && selectedFrame.anchors.length > 1;
  const hasDynamicSize = hasMultipleAnchors && calculatedPos !== null;

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

      <AnchorEditor
        selectedFrame={selectedFrame}
        project={project}
        handleChange={handleChange}
        handleNumberInputWheel={handleNumberInputWheel}
      />

      {/* 纹理 */}
      {shouldShowField(selectedFrame.type, 'texture') && (
        <TextureProperties selectedFrame={selectedFrame} handleChange={handleChange} />
      )}

      {/* 文本 */}
      {shouldShowField(selectedFrame.type, 'text') && (
        <TextProperties selectedFrame={selectedFrame} handleChange={handleChange} />
      )}

      {/* 类型特定属性 */}
      <TypeSpecificProperties selectedFrame={selectedFrame} handleChange={handleChange} />
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
