import React, { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { ConfirmDialog } from './ConfirmDialog';
import { useAlert } from '../hooks/useAlert';
import { join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import './PreferencesDialog.css';

interface PreferencesDialogProps {
  onClose: () => void;
}

interface Preferences {
  war3Path: string;
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  gridSize: number;
  showGrid: boolean;
  snapToGrid: boolean;
}

const DEFAULT_PREFERENCES: Preferences = {
  war3Path: '',
  theme: 'dark',
  language: 'zh-CN',
  gridSize: 8,
  showGrid: true,
  snapToGrid: true,
};

export const PreferencesDialog: React.FC<PreferencesDialogProps> = ({ onClose }) => {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [activeTab, setActiveTab] = useState<'general' | 'editor' | 'advanced'>('general');
  const [pathError, setPathError] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { showAlert, AlertComponent } = useAlert();

  // 加载保存的首选项
  useEffect(() => {
    const loadPreferences = () => {
      try {
        const saved = localStorage.getItem('preferences');
        if (saved) {
          const parsed = JSON.parse(saved);
          setPreferences({ ...DEFAULT_PREFERENCES, ...parsed });
        } else {
          // 尝试加载旧的 War3 路径
          const war3Path = localStorage.getItem('war3_install_path');
          if (war3Path) {
            setPreferences(prev => ({ ...prev, war3Path }));
          }
        }
      } catch (error) {
        console.error('加载首选项失败:', error);
      }
    };

    loadPreferences();
  }, []);

  // 选择 War3 安装目录
  const handleSelectWar3Path = async () => {
    try {
      setPathError('');
      
      const selected = await open({
        directory: true,
        title: '选择 Warcraft 3 安装目录',
      });

      if (!selected || Array.isArray(selected)) {
        return;
      }

      // 验证是否为有效的 War3 目录
      const war3ExePath = await join(selected, 'war3.exe');
      const isValid = await exists(war3ExePath);

      if (!isValid) {
        setPathError('所选目录不是有效的 Warcraft 3 安装目录（未找到 war3.exe）');
        return;
      }

      setPreferences(prev => ({ ...prev, war3Path: selected }));
      setPathError('');
    } catch (error) {
      console.error('选择目录失败:', error);
      setPathError('选择目录时发生错误');
    }
  };

  // 保存首选项
  const handleSave = () => {
    setSaving(true);
    try {
      // 保存到 localStorage
      localStorage.setItem('preferences', JSON.stringify(preferences));
      
      // 为了向后兼容，也保存 War3 路径
      if (preferences.war3Path) {
        localStorage.setItem('war3_install_path', preferences.war3Path);
      }

      // 触发全局事件，通知其他组件首选项已更新
      window.dispatchEvent(new CustomEvent('preferences-updated', { detail: preferences }));

      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 300);
    } catch (error) {
      console.error('保存首选项失败:', error);
      setSaving(false);
    }
  };

  // 重置为默认值
  const handleReset = () => {
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    setShowResetConfirm(false);
    setPreferences(DEFAULT_PREFERENCES);
  };

  return (
    <div className="preferences-overlay" onClick={onClose}>
      <div className="preferences-dialog" onClick={(e) => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="preferences-header">
          <h2>⚙️ 首选项</h2>
          <button className="close-button" onClick={onClose} title="关闭">
            ✕
          </button>
        </div>

        {/* 标签页导航 */}
        <div className="preferences-tabs">
          <button
            className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            通用
          </button>
          <button
            className={`tab-button ${activeTab === 'editor' ? 'active' : ''}`}
            onClick={() => setActiveTab('editor')}
          >
            编辑器
          </button>
          <button
            className={`tab-button ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            高级
          </button>
        </div>

        {/* 内容区域 */}
        <div className="preferences-content">
          {/* 通用设置 */}
          {activeTab === 'general' && (
            <div className="tab-content">
              <div className="setting-group">
                <h3>Warcraft 3 路径</h3>
                <div className="setting-item">
                  <label>安装目录:</label>
                  <div className="path-input-group">
                    <input
                      type="text"
                      value={preferences.war3Path}
                      readOnly
                      placeholder="未设置"
                      className={pathError ? 'error' : ''}
                    />
                    <button onClick={handleSelectWar3Path}>
                      📁 浏览...
                    </button>
                  </div>
                  {pathError && <p className="error-message">{pathError}</p>}
                  <p className="setting-hint">
                    请选择 Warcraft 3 的安装目录（包含 war3.exe 的文件夹）
                  </p>
                </div>
              </div>

              <div className="setting-group">
                <h3>外观</h3>
                <div className="setting-item">
                  <label>主题:</label>
                  <select
                    value={preferences.theme}
                    onChange={(e) => setPreferences(prev => ({ ...prev, theme: e.target.value as 'light' | 'dark' }))}
                  >
                    <option value="dark">深色</option>
                    <option value="light">浅色</option>
                  </select>
                </div>

                <div className="setting-item">
                  <label>语言:</label>
                  <select
                    value={preferences.language}
                    onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value as 'zh-CN' | 'en-US' }))}
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 编辑器设置 */}
          {activeTab === 'editor' && (
            <div className="tab-content">
              <div className="setting-group">
                <h3>网格设置</h3>
                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.showGrid}
                      onChange={(e) => setPreferences(prev => ({ ...prev, showGrid: e.target.checked }))}
                    />
                    显示网格
                  </label>
                </div>

                <div className="setting-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={preferences.snapToGrid}
                      onChange={(e) => setPreferences(prev => ({ ...prev, snapToGrid: e.target.checked }))}
                    />
                    吸附到网格
                  </label>
                </div>

                <div className="setting-item">
                  <label>网格大小:</label>
                  <div className="slider-group">
                    <input
                      type="range"
                      min="4"
                      max="32"
                      step="4"
                      value={preferences.gridSize}
                      onChange={(e) => setPreferences(prev => ({ ...prev, gridSize: parseInt(e.target.value) }))}
                    />
                    <span className="slider-value">{preferences.gridSize}px</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 高级设置 */}
          {activeTab === 'advanced' && (
            <div className="tab-content">
              <div className="setting-group">
                <h3>性能</h3>
                <div className="setting-item">
                  <p className="setting-hint">
                    💡 BLP 纹理解码使用 Rust 后端加速，性能提升 10-100 倍
                  </p>
                </div>
              </div>

              <div className="setting-group">
                <h3>调试</h3>
                <div className="setting-item">
                  <button 
                    onClick={() => {
                      console.log('当前首选项:', preferences);
                      showAlert({ title: '成功', message: '首选项已输出到控制台', type: 'info' });
                    }}
                    className="secondary-button"
                  >
                    📋 导出设置到控制台
                  </button>
                </div>

                <div className="setting-item">
                  <button 
                    onClick={() => {
                      localStorage.clear();
                      showAlert({ title: '成功', message: '所有本地数据已清除，请刷新页面', type: 'warning' });
                    }}
                    className="danger-button"
                  >
                    🗑️ 清除所有本地数据
                  </button>
                  <p className="setting-hint warning">
                    ⚠️ 此操作将清除所有保存的设置和缓存
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="preferences-footer">
          <button onClick={handleReset} className="secondary-button">
            重置默认值
          </button>
          <div className="button-group">
            <button onClick={onClose} className="cancel-button">
              取消
            </button>
            <button onClick={handleSave} className="save-button" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          title="重置设置"
          message="确定要重置所有设置为默认值吗？"
          confirmText="重置"
          cancelText="取消"
          type="warning"
          onConfirm={confirmReset}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}

      {AlertComponent}
    </div>
  );
};
