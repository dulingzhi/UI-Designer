import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { StylePreset } from '../types';
import './StylePresetPanel.css';

interface StylePresetPanelProps {
  onClose: () => void;
}

export const StylePresetPanel: React.FC<StylePresetPanelProps> = ({ onClose }) => {
  const { 
    project, 
    selectedFrameId, 
    selectedFrameIds,
    updateStylePreset,
    removeStylePreset,
    applyStylePreset,
    saveFrameAsPreset,
  } = useProjectStore();

  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetCategory, setNewPresetCategory] = useState('默认');

  const presets = project.stylePresets || [];
  
  // 获取所有分类
  const categories = ['全部', ...Array.from(new Set(presets.map(p => p.category || '默认')))];
  
  // 按分类筛选
  const filteredPresets = selectedCategory === '全部' 
    ? presets 
    : presets.filter(p => (p.category || '默认') === selectedCategory);

  // 保存当前选中控件为预设
  const handleSaveAsPreset = () => {
    if (!selectedFrameId || !newPresetName.trim()) return;
    
    saveFrameAsPreset(selectedFrameId, newPresetName, newPresetCategory);
    setShowSaveDialog(false);
    setNewPresetName('');
  };

  // 应用预设到选中控件
  const handleApplyPreset = (presetId: string) => {
    const targetIds = selectedFrameIds.length > 0 ? selectedFrameIds : 
                     selectedFrameId ? [selectedFrameId] : [];
    
    if (targetIds.length === 0) {
      alert('请先选择要应用样式的控件');
      return;
    }

    applyStylePreset(presetId, targetIds);
  };

  // 删除预设
  const handleDeletePreset = (presetId: string) => {
    if (confirm('确定删除此样式预设？')) {
      removeStylePreset(presetId);
    }
  };

  return (
    <div className="style-preset-panel">
      <div className="style-preset-header">
        <h3>样式预设库</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {/* 操作按钮 */}
      <div className="preset-actions">
        <button 
          className="save-preset-btn"
          onClick={() => setShowSaveDialog(true)}
          disabled={!selectedFrameId}
          title={!selectedFrameId ? '请先选择一个控件' : ''}
        >
          💾 保存当前样式
        </button>
      </div>

      {/* 保存预设对话框 */}
      {showSaveDialog && (
        <div className="save-dialog">
          <h4>保存样式预设</h4>
          <div className="form-group">
            <label>预设名称</label>
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="输入预设名称..."
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>分类</label>
            <input
              type="text"
              value={newPresetCategory}
              onChange={(e) => setNewPresetCategory(e.target.value)}
              placeholder="输入分类名..."
            />
          </div>
          <div className="dialog-buttons">
            <button onClick={handleSaveAsPreset}>保存</button>
            <button onClick={() => setShowSaveDialog(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 分类筛选 */}
      <div className="category-filter">
        {categories.map(cat => (
          <button
            key={cat}
            className={selectedCategory === cat ? 'active' : ''}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat} ({cat === '全部' ? presets.length : presets.filter(p => (p.category || '默认') === cat).length})
          </button>
        ))}
      </div>

      {/* 预设列表 */}
      <div className="preset-list">
        {filteredPresets.length === 0 ? (
          <div className="empty-state">
            <p>暂无样式预设</p>
            <p style={{ fontSize: '12px', color: '#888' }}>
              选择一个控件后点击"保存当前样式"来创建预设
            </p>
          </div>
        ) : (
          filteredPresets.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              onApply={() => handleApplyPreset(preset.id)}
              onDelete={() => handleDeletePreset(preset.id)}
              onEdit={(updates) => updateStylePreset(preset.id, updates)}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface PresetCardProps {
  preset: StylePreset;
  onApply: () => void;
  onDelete: () => void;
  onEdit: (updates: Partial<StylePreset>) => void;
}

const PresetCard: React.FC<PresetCardProps> = ({ preset, onApply, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(preset.name);

  const handleSaveEdit = () => {
    onEdit({ name: editName });
    setIsEditing(false);
  };

  return (
    <div className="preset-card">
      <div className="preset-header">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveEdit}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
            autoFocus
          />
        ) : (
          <h4 onClick={() => setIsEditing(true)} title="点击编辑名称">
            {preset.name}
          </h4>
        )}
        <span className="category-tag">{preset.category || '默认'}</span>
      </div>

      {preset.description && (
        <p className="preset-description">{preset.description}</p>
      )}

      {/* 样式预览 */}
      <div className="style-preview">
        {preset.style.textColor && (
          <div className="preview-item">
            <span>颜色:</span>
            <div 
              className="color-box" 
              style={{ backgroundColor: preset.style.textColor }}
            />
          </div>
        )}
        {preset.style.textScale !== undefined && (
          <div className="preview-item">
            <span>文本缩放:</span>
            <span>{preset.style.textScale.toFixed(1)}</span>
          </div>
        )}
        {preset.style.width !== undefined && preset.style.height !== undefined && (
          <div className="preview-item">
            <span>尺寸:</span>
            <span>{preset.style.width} × {preset.style.height}</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="preset-actions">
        <button className="apply-btn" onClick={onApply}>应用</button>
        <button className="delete-btn" onClick={onDelete}>删除</button>
      </div>

      <div className="preset-footer">
        <small>创建于 {new Date(preset.createdAt).toLocaleString()}</small>
      </div>
    </div>
  );
};
