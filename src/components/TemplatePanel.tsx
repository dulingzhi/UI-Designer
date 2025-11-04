import React, { useState } from 'react';
import { useCommandStore } from '../store/commandStore';
import { CreateFrameCommand } from '../commands/FrameCommands';
import { templates, compositeTemplates, getCategories, getTemplatesByCategory, FrameTemplate, CompositeTemplate } from '../data/templates';
import { FrameData } from '../types';
import './TemplatePanel.css';

// 调试：立即检查导入
console.log('=== TemplatePanel 导入检查 [v2] ===');
console.log('compositeTemplates 是否存在:', !!compositeTemplates);
console.log('compositeTemplates 类型:', typeof compositeTemplates);
console.log('compositeTemplates 长度:', compositeTemplates?.length);
console.log('compositeTemplates 内容:', compositeTemplates);
console.log('templates 长度:', templates?.length);
console.log('强制刷新时间:', new Date().toISOString());

export const TemplatePanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const categories = getCategories();

  // 处理单个控件模板
  const handleCreateFromTemplate = (template: FrameTemplate) => {
    const { executeCommand } = useCommandStore.getState();
    
    // 生成唯一ID
    const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // 从模板创建完整的 FrameData
    const templateData = template.createFrame();
    const frameData: FrameData = {
      id: frameId,
      parentId: null, // 模板创建的控件都是根控件
      z: 0,
      tooltip: false,
      isRelative: false,
      visible: true,
      diskTexture: '',
      wc3Texture: '',
      ...templateData,
    } as FrameData;
    
    const command = new CreateFrameCommand(frameData);
    executeCommand(command);
    
    console.log(`从模板创建控件: ${template.name}`, frameData);
  };

  // 处理组合模板（多控件）
  const handleCreateFromCompositeTemplate = (template: CompositeTemplate) => {
    const { executeCommand } = useCommandStore.getState();
    
    const framesData = template.createFrames();
    
    framesData.forEach((templateData) => {
      const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const frameData: FrameData = {
        id: frameId,
        parentId: null,
        z: 0,
        tooltip: false,
        isRelative: false,
        visible: true,
        diskTexture: '',
        wc3Texture: '',
        ...templateData,
      } as FrameData;
      
      const command = new CreateFrameCommand(frameData);
      executeCommand(command);
    });
    
    console.log(`从组合模板创建控件: ${template.name}`);
  };

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : selectedCategory === 'layout'
    ? []  // 布局组合分类下不显示单个模板
    : getTemplatesByCategory(selectedCategory);

  const filteredCompositeTemplates = selectedCategory === 'all' || selectedCategory === 'layout'
    ? compositeTemplates
    : [];

  // 调试：检查筛选结果
  console.log('=== 筛选结果 ===');
  console.log('当前分类:', selectedCategory);
  console.log('filteredTemplates:', filteredTemplates.length);
  console.log('filteredCompositeTemplates:', filteredCompositeTemplates);
  console.log('filteredCompositeTemplates 长度:', filteredCompositeTemplates?.length);

  return (
    <div className={`template-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="template-panel-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="template-panel-toggle-icon">
          {isExpanded ? '◀' : '▶'}
        </span>
        <span className="template-panel-toggle-text">模板</span>
      </div>

      {isExpanded && (
        <div className="template-panel-content">
          <div className="template-panel-header">
            <h3>📦 控件模板 ({filteredTemplates.length + filteredCompositeTemplates.length})</h3>
            <div style={{fontSize: '11px', color: '#888', marginTop: '4px'}}>
              基础: {filteredTemplates.length} | 组合: {filteredCompositeTemplates.length}
            </div>
          </div>

          <div className="template-categories">
            <button
              className={`template-category ${selectedCategory === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('all')}
            >
              全部
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`template-category ${selectedCategory === cat.id ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.id)}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <div className="template-list">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                className="template-item"
                onClick={() => handleCreateFromTemplate(template)}
                title={template.description}
              >
                <div className="template-item-icon">{template.icon}</div>
                <div className="template-item-info">
                  <div className="template-item-name">{template.name}</div>
                  <div className="template-item-desc">{template.description}</div>
                </div>
              </div>
            ))}

            {/* 组合模板分隔标题 */}
            {filteredCompositeTemplates.length > 0 && selectedCategory === 'all' && (
              <div className="template-section-header">
                📦 布局组合
              </div>
            )}

            {/* 组合模板 */}
            {filteredCompositeTemplates.map(template => (
              <div
                key={template.id}
                className="template-item composite"
                onClick={() => handleCreateFromCompositeTemplate(template)}
                title={template.description}
              >
                <div className="template-item-icon">{template.icon}</div>
                <div className="template-item-info">
                  <div className="template-item-name">{template.name}</div>
                  <div className="template-item-desc">{template.description}</div>
                </div>
              </div>
            ))}
          </div>

          {(filteredTemplates.length === 0 && filteredCompositeTemplates.length === 0) && (
            <div className="template-empty">
              暂无模板
            </div>
          )}
        </div>
      )}
    </div>
  );
};
