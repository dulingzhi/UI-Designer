import React from 'react';
import { FrameData } from '../../types';
import { Select, Switch, FilePath, VectorEditor } from '../PropertyEditors';

interface TexturePropertiesProps {
  selectedFrame: FrameData;
  handleChange: (field: string, value: any) => void;
}

export const TextureProperties: React.FC<TexturePropertiesProps> = ({
  selectedFrame,
  handleChange,
}) => {
  return (
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
  );
};
