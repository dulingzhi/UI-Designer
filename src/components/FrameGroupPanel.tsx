import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { FrameGroup } from '../types';
import { ConfirmDialog } from './ConfirmDialog';
import './FrameGroupPanel.css';

interface FrameGroupPanelProps {
  onClose: () => void;
}

export const FrameGroupPanel: React.FC<FrameGroupPanelProps> = ({ onClose }) => {
  const { 
    project, 
    createGroup,
    updateGroup,
    removeGroup,
  } = useProjectStore();
  const { selectedFrameIds, selectGroup } = useUIStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const groups = project.frameGroups || [];

  // 创建新组合
  const handleCreateGroup = () => {
    if (!newGroupName.trim() || selectedFrameIds.length === 0) return;
    
    createGroup(newGroupName, selectedFrameIds);
    setShowCreateDialog(false);
    setNewGroupName('');
  };

  // 删除组合
  const handleDeleteGroup = (groupId: string, groupName: string) => {
    setDeleteConfirm({ id: groupId, name: groupName });
  };

  // 确认删除
  const confirmDelete = () => {
    if (deleteConfirm) {
      removeGroup(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="frame-group-panel">
      <div className="frame-group-header">
        <h3>控件组合</h3>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {/* 操作按钮 */}
      <div className="group-actions">
        <button 
          className="create-group-btn"
          onClick={() => setShowCreateDialog(true)}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length === 0 ? '请先选择至少一个控件' : ''}
        >
          ➕ 创建组合
        </button>
      </div>

      {/* 创建组合对话框 */}
      {showCreateDialog && (
        <div className="create-dialog">
          <h4>创建控件组合</h4>
          <p className="dialog-info">
            将选中的 {selectedFrameIds.length} 个控件组合在一起
          </p>
          <div className="form-group">
            <label>组合名称</label>
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="输入组合名称..."
              autoFocus
            />
          </div>
          <div className="dialog-buttons">
            <button onClick={handleCreateGroup}>创建</button>
            <button onClick={() => setShowCreateDialog(false)}>取消</button>
          </div>
        </div>
      )}

      {/* 组合列表 */}
      <div className="group-list">
        {groups.length === 0 ? (
          <div className="empty-state">
            <p>暂无控件组合</p>
            <p style={{ fontSize: '12px', color: '#858585' }}>
              选择多个控件后点击"创建组合"
            </p>
          </div>
        ) : (
          groups.map(group => (
            <GroupCard
              key={group.id}
              group={group}
              onSelect={() => selectGroup(group.id)}
              onDelete={() => handleDeleteGroup(group.id, group.name)}
              onEdit={(updates) => updateGroup(group.id, updates)}
            />
          ))
        )}
      </div>

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除组合"${deleteConfirm.name}"吗？这不会删除组内的控件。`}
          confirmText="删除"
          cancelText="取消"
          type="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
};

interface GroupCardProps {
  group: FrameGroup;
  onSelect: () => void;
  onDelete: () => void;
  onEdit: (updates: Partial<FrameGroup>) => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onSelect, onDelete, onEdit }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const { project } = useProjectStore();

  const handleSaveEdit = () => {
    onEdit({ name: editName });
    setIsEditing(false);
  };

  // 获取组内有效的控件数量
  const validFrameCount = group.frameIds.filter(id => project.frames[id]).length;

  return (
    <div className="group-card">
      <div className="group-header">
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
            📦 {group.name}
          </h4>
        )}
      </div>

      {group.description && (
        <p className="group-description">{group.description}</p>
      )}

      {/* 组合信息 */}
      <div className="group-info">
        <div className="info-item">
          <span className="info-label">控件数量:</span>
          <span className="info-value">{validFrameCount}</span>
        </div>
        {group.locked && (
          <div className="info-item">
            <span className="lock-badge">🔒 已锁定</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="group-actions-btns">
        <button className="select-btn" onClick={onSelect}>
          选中全部
        </button>
        <button 
          className="lock-btn"
          onClick={() => onEdit({ locked: !group.locked })}
        >
          {group.locked ? '🔓' : '🔒'}
        </button>
        <button className="delete-btn" onClick={onDelete}>
          删除
        </button>
      </div>

      <div className="group-footer">
        <small>创建于 {new Date(group.createdAt).toLocaleString()}</small>
      </div>
    </div>
  );
};
