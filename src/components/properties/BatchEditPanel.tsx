import React from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useCommandStore } from '../../store/commandStore';
import { UpdateFrameCommand } from '../../commands/FrameCommands';
import { FrameType } from '../../types';

interface BatchEditPanelProps {
  onClose: () => void;
}

export const BatchEditPanel: React.FC<BatchEditPanelProps> = ({ onClose }) => {
  const { project } = useProjectStore();
  const { selectedFrameIds } = useUIStore();
  const { executeCommand } = useCommandStore();

  const handleNumberInputWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (document.activeElement !== e.currentTarget) {
      e.preventDefault();
    }
  };

  const handleBatchChange = (field: string, value: any) => {
    selectedFrameIds.forEach(id => {
      executeCommand(new UpdateFrameCommand(id, { [field]: value }));
    });
  };

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
};
