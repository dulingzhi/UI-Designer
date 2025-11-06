import React, { useState, useEffect } from 'react';
import { mpqManager } from '../utils/mpqManager';
import { textureLoader } from '../utils/textureLoader';
import './WC3TextureBrowser.css';

interface WC3TextureBrowserProps {
  onSelect: (path: string) => void;
  onClose: () => void;
  currentPath?: string;
}

interface TextureItem {
  path: string;
  name: string;
  isDirectory: boolean;
  preview?: string;
}

export const WC3TextureBrowser: React.FC<WC3TextureBrowserProps> = ({
  onSelect,
  onClose,
  currentPath = '',
}) => {
  const [currentDirectory, setCurrentDirectory] = useState('');
  const [items, setItems] = useState<TextureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPath, setSelectedPath] = useState(currentPath);
  const [previewCache, setPreviewCache] = useState<Map<string, string>>(new Map());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 常用纹理目录
  const commonDirectories = [
    'UI/Widgets/Console/Human/',
    'UI/Widgets/Glues/',
    'UI/Widgets/BattleNet/',
    'UI/Widgets/ToolTips/',
    'ReplaceableTextures/CommandButtons/',
    'UI/Feedback/',
    'Textures/',
  ];

  // 加载目录内容
  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    try {
      const normalizedDir = dirPath.replace(/\//g, '\\');
      const fileList = mpqManager.listDirectory(normalizedDir);
      
      // 过滤出纹理文件和子目录
      const textureExtensions = ['.blp', '.tga', '.dds', '.png', '.jpg'];
      const directories = new Set<string>();
      const files: TextureItem[] = [];

      fileList.forEach(fileInfo => {
        const fileName = fileInfo.fileName;
        const relativePath = fileName.replace(normalizedDir, '');
        const parts = relativePath.split(/[/\\]/).filter(Boolean);
        
        if (parts.length > 1) {
          // 这是一个子目录
          const subDir = parts[0];
          if (subDir && !directories.has(subDir)) {
            directories.add(subDir);
            files.push({
              path: normalizedDir + (normalizedDir.endsWith('\\') ? '' : '\\') + subDir + '\\',
              name: subDir,
              isDirectory: true,
            });
          }
        } else if (parts.length === 1 && parts[0]) {
          // 这是当前目录的文件
          const name = parts[0];
          const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
          if (textureExtensions.includes(ext)) {
            files.push({
              path: fileName,
              name: name,
              isDirectory: false,
            });
          }
        }
      });

      // 排序：目录在前，然后是文件
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      setItems(files);
    } catch (error) {
      console.error('Failed to load directory:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 搜索纹理
  const searchTextures = async (query: string) => {
    if (!query.trim()) {
      loadDirectory(currentDirectory);
      return;
    }

    setLoading(true);
    try {
      const results = mpqManager.searchFiles(`*${query}*.blp`);
      
      const files: TextureItem[] = results.map(fileInfo => ({
        path: fileInfo.fileName,
        name: fileInfo.fileName.split(/[/\\]/).pop() || fileInfo.fileName,
        isDirectory: false,
      }));

      setItems(files);
    } catch (error) {
      console.error('Failed to search textures:', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  // 预加载纹理预览
  const loadPreview = async (path: string) => {
    if (previewCache.has(path)) return;

    try {
      const dataUrl = await textureLoader.loadTexture(path);
      setPreviewCache(prev => new Map(prev).set(path, dataUrl));
    } catch (error) {
      console.error('Failed to load preview:', path, error);
    }
  };

  // 初始化：加载根目录或当前路径
  useEffect(() => {
    const initDir = currentPath 
      ? currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
      : commonDirectories[0];
    setCurrentDirectory(initDir);
    loadDirectory(initDir);
  }, []);

  // 预加载可见项的缩略图
  useEffect(() => {
    items
      .filter(item => !item.isDirectory)
      .slice(0, 20) // 只预加载前20个
      .forEach(item => loadPreview(item.path));
  }, [items]);

  const handleItemClick = (item: TextureItem) => {
    if (item.isDirectory) {
      setCurrentDirectory(item.path);
      loadDirectory(item.path);
      setSearchQuery('');
    } else {
      setSelectedPath(item.path);
    }
  };

  const handleItemDoubleClick = (item: TextureItem) => {
    if (!item.isDirectory) {
      onSelect(item.path);
      onClose();
    }
  };

  const handleGoBack = () => {
    const parentPath = currentDirectory.substring(0, currentDirectory.lastIndexOf('/', currentDirectory.length - 2) + 1);
    setCurrentDirectory(parentPath);
    loadDirectory(parentPath);
  };

  const handleSelectCurrent = () => {
    if (selectedPath) {
      onSelect(selectedPath);
      onClose();
    }
  };

  return (
    <div className="wc3-texture-browser-overlay" onClick={onClose}>
      <div className="wc3-texture-browser" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="browser-header">
          <h3>WC3 资源浏览器</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* 工具栏 */}
        <div className="browser-toolbar">
          <div className="navigation">
            <button 
              onClick={handleGoBack} 
              disabled={!currentDirectory || currentDirectory === ''}
              title="返回上级"
            >
              ⬅
            </button>
            <div className="current-path" title={currentDirectory}>
              {currentDirectory || '根目录'}
            </div>
          </div>

          <div className="search-container">
            <input
              type="text"
              placeholder="搜索纹理..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  searchTextures(searchQuery);
                }
              }}
            />
            <button onClick={() => searchTextures(searchQuery)}>🔍</button>
          </div>

          <div className="view-controls">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="网格视图"
            >
              ⊞
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="列表视图"
            >
              ☰
            </button>
          </div>
        </div>

        {/* 快捷目录 */}
        <div className="common-directories">
          <label>常用目录:</label>
          <div className="directory-buttons">
            {commonDirectories.map(dir => (
              <button
                key={dir}
                className={currentDirectory === dir ? 'active' : ''}
                onClick={() => {
                  setCurrentDirectory(dir);
                  loadDirectory(dir);
                  setSearchQuery('');
                }}
              >
                {dir.split('/').filter(Boolean).pop() || dir}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区域 */}
        <div className={`browser-content ${viewMode}`}>
          {loading ? (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <p>加载中...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <p>没有找到纹理文件</p>
              <small>尝试搜索或选择其他目录</small>
            </div>
          ) : (
            <div className={`items-container ${viewMode}`}>
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className={`texture-item ${item.isDirectory ? 'directory' : 'file'} ${
                    selectedPath === item.path ? 'selected' : ''
                  }`}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={() => handleItemDoubleClick(item)}
                  title={item.path}
                >
                  {item.isDirectory ? (
                    <div className="directory-icon">📁</div>
                  ) : (
                    <div className="texture-preview">
                      {previewCache.has(item.path) ? (
                        <img src={previewCache.get(item.path)} alt={item.name} />
                      ) : (
                        <div className="preview-placeholder">🖼️</div>
                      )}
                    </div>
                  )}
                  <div className="item-name" title={item.name}>
                    {item.name}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部操作栏 */}
        <div className="browser-footer">
          <div className="selected-info">
            {selectedPath ? (
              <>
                <strong>已选择:</strong> {selectedPath}
              </>
            ) : (
              <span style={{ color: '#888' }}>未选择任何文件</span>
            )}
          </div>
          <div className="action-buttons">
            <button onClick={onClose}>取消</button>
            <button
              className="primary"
              onClick={handleSelectCurrent}
              disabled={!selectedPath}
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
