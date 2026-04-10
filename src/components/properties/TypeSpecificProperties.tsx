import React from 'react';
import { FrameData, FrameType } from '../../types';
import { ColorPicker, Select, MultiSelect, Slider, Switch, FilePath, VectorEditor, TextArea } from '../PropertyEditors';

interface TypeSpecificPropertiesProps {
  selectedFrame: FrameData;
  handleChange: (field: string, value: any) => void;
}

export const TypeSpecificProperties: React.FC<TypeSpecificPropertiesProps> = ({
  selectedFrame,
  handleChange,
}) => {
  return (
    <>
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
    </>
  );
};

function shouldShowField(type: FrameType, field: string): boolean {
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
    case 'trigger':
      return triggerTypes.includes(type);
    default:
      return false;
  }
}
