import React from 'react';
import { FrameData } from '../../types';
import { ColorPicker, Select, MultiSelect, Slider, FilePath, VectorEditor, TextArea } from '../PropertyEditors';

interface TextPropertiesProps {
  selectedFrame: FrameData;
  handleChange: (field: string, value: any) => void;
}

export const TextProperties: React.FC<TextPropertiesProps> = ({
  selectedFrame,
  handleChange,
}) => {
  return (
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
  );
};
