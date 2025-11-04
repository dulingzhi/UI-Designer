import React, { useState } from 'react';
import { useCommandStore } from '../store/commandStore';
import { CreateFrameCommand } from '../commands/FrameCommands';
import { templates, compositeTemplates, getCategories, getTemplatesByCategory, FrameTemplate, CompositeTemplate } from '../data/templates';
import { FrameData } from '../types';
import './SidePanel.css';

type TabType = 'templates' | 'history';

export const SidePanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('templates');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  const { undoStack, redoStack, undo, redo } = useCommandStore();
  const categories = getCategories();

  // 模板相关
  const handleCreateFromTemplate = (template: FrameTemplate) => {
    const { executeCommand } = useCommandStore.getState();
    
    const frameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const templateData = template.createFrame();
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

  // 历史记录相关
  const getCommandName = (command: any): string => {
    const className = command.constructor.name;
    
    const nameMap: Record<string, string> = {
      'CreateFrameCommand': '创建控件',
      'RemoveFrameCommand': '删除控件',
      'UpdateFrameCommand': '更新属性',
      'MoveFrameCommand': '移动控件',
      'ChangeParentCommand': '改变父级',
      'CopyFrameCommand': '复制',
      'PasteFrameCommand': '粘贴',
      'AlignCommand': '对齐',
      'DistributeCommand': '分布',
      'EqualSpacingCommand': '等间距',
      'UnifySizeCommand': '统一大小',
      'ZIndexCommand': '层级调整',
      'AlignToCanvasCommand': '画布对齐',
      'DuplicateCommand': '重复',
      'DuplicateFrameCommand': '复制控件',
      'CreateTableArrayCommand': '表格阵列',
      'CreateCircleArrayCommand': '圆形阵列',
    };

    return nameMap[className] || className;
  };

  const getCommandDetails = (command: any): string => {
    if (command.frame?.name) {
      return command.frame.name;
    }
    if (command.frameId) {
      return `ID: ${command.frameId.substring(0, 8)}...`;
    }
    return '';
  };

  const goToHistoryState = (index: number) => {
    const currentIndex = undoStack.length - 1;
    
    if (index < currentIndex) {
      const steps = currentIndex - index;
      for (let i = 0; i < steps; i++) {
        undo();
      }
    } else if (index > currentIndex) {
      const steps = index - currentIndex;
      for (let i = 0; i < steps; i++) {
        redo();
      }
    }
  };

  const currentIndex = undoStack.length - 1;
  const fullHistory = [...undoStack, ...redoStack.slice().reverse()];

  return (
    <div className={`side-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="side-panel-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="side-panel-toggle-icon">
          {isExpanded ? '◀' : '▶'}
        </span>
        <span className="side-panel-toggle-text">
          {activeTab === 'templates' ? '模板' : '历史'}
        </span>
      </div>

      {isExpanded && (
        <div className="side-panel-content">
          {/* 标签页切换 */}
          <div className="side-panel-tabs">
            <button
              className={`side-panel-tab ${activeTab === 'templates' ? 'active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              📦 模板
            </button>
            <button
              className={`side-panel-tab ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              📜 历史
            </button>
          </div>

          {/* 模板标签页 */}
          {activeTab === 'templates' && (
            <>
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

              {filteredTemplates.length === 0 && filteredCompositeTemplates.length === 0 && (
                <div className="side-panel-empty">
                  暂无模板
                </div>
              )}
            </>
          )}

          {/* 历史记录标签页 */}
          {activeTab === 'history' && (
            <>
              <div className="history-list">
                {/* 初始状态 */}
                <div 
                  className={`history-item ${currentIndex === -1 ? 'current' : ''}`}
                  onClick={() => goToHistoryState(-1)}
                >
                  <div className="history-item-icon">📄</div>
                  <div className="history-item-content">
                    <div className="history-item-name">初始状态</div>
                  </div>
                </div>

                {/* 历史记录列表 */}
                {fullHistory.map((command, index) => {
                  const isCurrent = index === currentIndex;
                  const isPast = index <= currentIndex;
                  
                  return (
                    <div
                      key={index}
                      className={`history-item ${isCurrent ? 'current' : ''} ${isPast ? 'past' : 'future'}`}
                      onClick={() => goToHistoryState(index)}
                    >
                      <div className="history-item-icon">
                        {isCurrent ? '▶️' : isPast ? '✅' : '⏺️'}
                      </div>
                      <div className="history-item-content">
                        <div className="history-item-name">{getCommandName(command)}</div>
                        {getCommandDetails(command) && (
                          <div className="history-item-details">{getCommandDetails(command)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="history-footer">
                <div className="history-stats">
                  共 {fullHistory.length} 个操作
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
