import React, { useState, useEffect } from 'react';
import { mpqManager } from '../utils/mpqManager';
import { textureLoader } from '../utils/textureLoader';
import { LazyTexturePreview } from './LazyTexturePreview';
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

interface DirectoryNode {
  name: string;
  path: string;
  children: DirectoryNode[];
  expanded: boolean;
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [war3Path, setWar3Path] = useState<string>('');
  const [showPathSetting, setShowPathSetting] = useState(false);
  const [directoryTree, setDirectoryTree] = useState<DirectoryNode[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewImageName, setPreviewImageName] = useState<string>('');
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [previewPosition, setPreviewPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // 检查 War3 路径是否已设置
  useEffect(() => {
    const savedPath = localStorage.getItem('war3_install_path');
    console.log('[WC3TextureBrowser] 初始化 - 保存的路径:', savedPath);
    if (savedPath) {
      setWar3Path(savedPath);
      console.log('[WC3TextureBrowser] 开始设置 War3 路径并加载 MPQ...');
      mpqManager.setWar3Path(savedPath).then(() => {
        console.log('[WC3TextureBrowser] MPQ 加载完成，开始构建目录树...');
        buildDirectoryTree();
      });
    } else {
      console.log('[WC3TextureBrowser] 未找到保存的路径，显示设置对话框');
      setShowPathSetting(true);
    }
  }, []);

  // 监听 ESC 键关闭预览
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewImage) {
        handleClosePreview();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  // 构建目录树 - 从 MPQ 中动态加载
  const buildDirectoryTree = async () => {
    try {
      console.log('[WC3TextureBrowser] buildDirectoryTree - 开始构建目录树...');
      
      // 等待 MPQ 加载完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('[WC3TextureBrowser] buildDirectoryTree - 获取根目录列表...');
      // 获取根目录列表
      const rootDirs = mpqManager.getRootDirectories();
      console.log('[WC3TextureBrowser] buildDirectoryTree - 根目录数量:', rootDirs.length);
      
      const tree: DirectoryNode[] = rootDirs.map(dir => ({
        name: dir.replace(/\\/g, ''),
        path: dir,
        children: [],
        expanded: false,
      }));

      setDirectoryTree(tree);
      console.log('[WC3TextureBrowser] 目录树已构建:', tree.length, '个根目录', tree.map(t => t.name));
    } catch (error) {
      console.error('[WC3TextureBrowser] 构建目录树失败:', error);
    }
  };

  // 切换目录展开状态
  const toggleDirectory = (node: DirectoryNode) => {
    setDirectoryTree(prevTree => {
      const updateTree = (nodes: DirectoryNode[]): DirectoryNode[] => {
        return nodes.map(n => {
          if (n.path === node.path) {
            const newNode = { ...n, expanded: !n.expanded };
            // 如果是首次展开且没有子节点，加载子目录
            if (newNode.expanded && newNode.children.length === 0) {
              // 使用 MPQManager 的新方法获取子目录
              const subDirs = mpqManager.getSubDirectories(node.path);
              
              newNode.children = subDirs.map(dirPath => {
                // 提取目录名称（去掉父路径和尾部的反斜杠）
                const name = dirPath
                  .substring(node.path.length)
                  .replace(/\\$/, '');
                
                return {
                  name,
                  path: dirPath,
                  children: [],
                  expanded: false,
                };
              });
              
              console.log(`[WC3TextureBrowser] 加载子目录: ${node.path}, 找到 ${newNode.children.length} 个子目录`);
            }
            return newNode;
          }
          if (n.children.length > 0) {
            return { ...n, children: updateTree(n.children) };
          }
          return n;
        });
      };
      return updateTree(prevTree);
    });
  };

  // 展开目录树到指定路径
  const expandTreeToPath = (targetPath: string) => {
    // 规范化路径
    const normalizedPath = targetPath.replace(/\//g, '\\');
    
    setDirectoryTree(prevTree => {
      const expandPath = (nodes: DirectoryNode[], path: string): DirectoryNode[] => {
        return nodes.map(node => {
          // 检查目标路径是否以当前节点路径开头
          if (path.startsWith(node.path)) {
            const newNode = { ...node, expanded: true };
            
            // 如果是首次展开且没有子节点，加载子目录
            if (newNode.children.length === 0) {
              const subDirs = mpqManager.getSubDirectories(node.path);
              
              newNode.children = subDirs.map(dirPath => {
                const name = dirPath
                  .substring(node.path.length)
                  .replace(/\\$/, '');
                
                return {
                  name,
                  path: dirPath,
                  children: [],
                  expanded: false,
                };
              });
            }
            
            // 递归展开子节点
            if (newNode.children.length > 0 && path !== node.path) {
              newNode.children = expandPath(newNode.children, path);
            }
            
            return newNode;
          }
          
          return node;
        });
      };
      
      const result = expandPath(prevTree, normalizedPath);
      
      // 延迟滚动，等待 DOM 更新
      setTimeout(() => {
        const activeNode = document.querySelector('.tree-node-content.active') as HTMLElement;
        const treeContent = document.querySelector('.tree-content') as HTMLElement;
        
        if (activeNode && treeContent) {
          // 计算节点相对于容器的位置
          const nodeRect = activeNode.getBoundingClientRect();
          const containerRect = treeContent.getBoundingClientRect();
          const relativeTop = nodeRect.top - containerRect.top + treeContent.scrollTop;
          
          // 滚动到节点位置，使其在容器中居中
          const scrollTo = relativeTop - (treeContent.clientHeight / 2) + (nodeRect.height / 2);
          
          treeContent.scrollTo({
            top: scrollTo,
            behavior: 'smooth'
          });
        }
      }, 100);
      
      return result;
    });
  };

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
      const files: TextureItem[] = [];
      
      // 1. 获取子目录（使用专门的方法）
      const subDirs = mpqManager.getSubDirectories(normalizedDir);
      subDirs.forEach(subDir => {
        const name = subDir.substring(normalizedDir.length).replace(/\\$/, '');
        files.push({
          path: subDir,
          name: name,
          isDirectory: true,
        });
      });
      
      // 2. 获取当前目录的文件
      const fileList = mpqManager.listDirectory(normalizedDir);
      
      fileList.forEach(fileInfo => {
        const fileName = fileInfo.fileName;
        // 使用小写进行比较以避免大小写问题
        const fileNameLower = fileName.toLowerCase();
        const normalizedDirLower = normalizedDir.toLowerCase();
        
        // 检查文件是否在当前目录下
        if (fileNameLower.startsWith(normalizedDirLower)) {
          const relativePath = fileName.substring(normalizedDir.length);
          const parts = relativePath.split(/[/\\]/).filter(Boolean);
          
          // 只要当前目录的直接文件（不包含子目录中的文件）
          if (parts.length === 1) {
            const name = parts[0];
            // 显示所有文件（不过滤扩展名）
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
      console.log(`[WC3TextureBrowser] 加载目录: ${normalizedDir}, 找到 ${files.length} 项`);
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
      // 搜索所有文件，不限制扩展名
      const results = mpqManager.searchFiles(`*${query}*`);
      
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

  // 初始化：加载根目录或当前路径
  useEffect(() => {
    const initDir = currentPath 
      ? currentPath.substring(0, currentPath.lastIndexOf('/') + 1)
      : commonDirectories[0];
    setCurrentDirectory(initDir);
    loadDirectory(initDir);
  }, []);

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

  // 判断文件是否为图片格式
  const isImageFile = (fileName: string): boolean => {
    const imageExtensions = ['.blp', '.tga', '.dds', '.png', '.jpg', '.jpeg', '.bmp'];
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    return imageExtensions.includes(ext);
  };

  // 获取文件图标
  const getFileIcon = (fileName: string): string => {
    const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
    if (ext === '.mdx' || ext === '.mdl') return '🎭'; // 3D 模型
    if (ext === '.fdf') return '📄'; // FDF 文件
    if (ext === '.txt') return '📝'; // 文本文件
    if (ext === '.slk') return '📊'; // 表格文件
    if (ext === '.mp3' || ext === '.wav') return '🎵'; // 音频文件
    return '📄'; // 默认文件图标
  };

  // 打开图片预览（异步加载）
  const handlePreviewImage = async (item: TextureItem) => {
    if (!item.isDirectory) {
      try {
        const dataUrl = await textureLoader.loadTexture(item.path);
        setPreviewImage(dataUrl);
        setPreviewImageName(item.name);
        setPreviewZoom(1);
        setPreviewPosition({ x: 0, y: 0 });
      } catch (error) {
        console.error('加载预览图失败:', error);
      }
    }
  };

  // 关闭图片预览
  const handleClosePreview = () => {
    setPreviewImage(null);
    setPreviewImageName('');
    setPreviewZoom(1);
    setPreviewPosition({ x: 0, y: 0 });
  };

  // 处理滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setPreviewZoom(prev => {
      const newZoom = Math.max(0.1, Math.min(10, prev + delta));
      return newZoom;
    });
  };

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (previewZoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - previewPosition.x, y: e.clientY - previewPosition.y });
    }
  };

  // 处理拖拽移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && previewZoom > 1) {
      setPreviewPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  // 处理拖拽结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 重置缩放
  const handleResetZoom = () => {
    setPreviewZoom(1);
    setPreviewPosition({ x: 0, y: 0 });
  };

  // 渲染目录树节点
  const renderDirectoryNode = (node: DirectoryNode, level: number) => {
    return (
      <div key={node.path} className="tree-node" style={{ paddingLeft: `${level * 16}px` }}>
        <div 
          className={`tree-node-content ${currentDirectory === node.path ? 'active' : ''}`}
          onClick={() => {
            setCurrentDirectory(node.path);
            loadDirectory(node.path);
            setSearchQuery('');
          }}
        >
          <span 
            className="tree-node-toggle"
            onClick={(e) => {
              e.stopPropagation();
              toggleDirectory(node);
            }}
          >
            {node.children.length > 0 || !node.expanded ? (node.expanded ? '▼' : '▶') : '·'}
          </span>
          <span className="tree-node-icon">📁</span>
          <span className="tree-node-label">{node.name}</span>
        </div>
        {node.expanded && node.children.length > 0 && (
          <div className="tree-node-children">
            {node.children.map(child => renderDirectoryNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="wc3-texture-browser-overlay" onClick={onClose}>
      <div className="wc3-texture-browser" onClick={(e) => e.stopPropagation()}>
        {/* 头部 */}
        <div className="browser-header">
          <h3>WC3 资源浏览器</h3>
          <div className="header-actions">
            <button 
              className="settings-button" 
              onClick={() => setShowPathSetting(true)}
              title="设置 War3 路径"
            >
              ⚙
            </button>
            <button className="close-button" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* War3 路径设置对话框 */}
        {showPathSetting && (
          <div className="path-setting-overlay" onClick={() => setShowPathSetting(false)}>
            <div className="path-setting-dialog" onClick={(e) => e.stopPropagation()}>
              <h4>设置 Warcraft 3 安装路径</h4>
              <div className="path-input-group">
                <input
                  type="text"
                  value={war3Path}
                  onChange={(e) => setWar3Path(e.target.value)}
                  placeholder="例如: C:\Program Files\Warcraft III"
                  readOnly
                />
                <button onClick={async () => {
                  const selectedPath = await mpqManager.selectWar3Directory();
                  if (selectedPath) {
                    setWar3Path(selectedPath);
                    await mpqManager.setWar3Path(selectedPath);
                    localStorage.setItem('war3_install_path', selectedPath);
                    // 重新构建目录树
                    await buildDirectoryTree();
                  }
                }}>
                  浏览...
                </button>
              </div>
              <div className="dialog-actions">
                <button 
                  className="btn-primary"
                  onClick={async () => {
                    if (war3Path) {
                      await mpqManager.setWar3Path(war3Path);
                      localStorage.setItem('war3_install_path', war3Path);
                      setShowPathSetting(false);
                      // 重新构建目录树
                      await buildDirectoryTree();
                    }
                  }}
                  disabled={!war3Path}
                >
                  确定
                </button>
                <button onClick={() => setShowPathSetting(false)}>取消</button>
              </div>
              <p className="path-hint">
                请选择包含 war3.exe 的 Warcraft 3 安装目录
              </p>
            </div>
          </div>
        )}

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
              placeholder="搜索文件..."
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
                  // 展开目录树到该路径
                  expandTreeToPath(dir);
                }}
              >
                {dir.split('/').filter(Boolean).pop() || dir}
              </button>
            ))}
          </div>
        </div>

        {/* 主内容区域 */}
        <div className="browser-main">
          {/* 左侧目录树 */}
          <div className="directory-tree">
            <div className="tree-header">目录</div>
            <div className="tree-content">
              {directoryTree.map(node => renderDirectoryNode(node, 0))}
            </div>
          </div>

          {/* 右侧文件列表 */}
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
                {items.map((item) => (
                  <div
                    key={item.path} // round 185: 索引 key 复用 LazyTexturePreview 实例——hasLoadedRef 锁旧图(切换目录缩略图残留); path 唯一作 key
                    className={`texture-item ${item.isDirectory ? 'directory' : 'file'} ${
                      selectedPath === item.path ? 'selected' : ''
                    }`}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    title={item.path}
                  >
                    {item.isDirectory ? (
                      <div className="directory-icon">📁</div>
                    ) : isImageFile(item.name) ? (
                      <div onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewImage(item);
                      }}>
                        <LazyTexturePreview
                          path={item.path}
                          name={item.name}
                        />
                      </div>
                    ) : (
                      <div className="file-icon-large">
                        {getFileIcon(item.name)}
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

        {/* 图片预览对话框 */}
        {previewImage && (
          <div className="image-preview-overlay" onClick={handleClosePreview}>
            <div className="image-preview-container" onClick={(e) => e.stopPropagation()}>
              <div className="image-preview-header">
                <h4>{previewImageName}</h4>
                <div className="preview-controls">
                  <span className="zoom-info">{Math.round(previewZoom * 100)}%</span>
                  <button 
                    className="control-button" 
                    onClick={() => setPreviewZoom(prev => Math.max(0.1, prev - 0.2))}
                    title="缩小"
                  >
                    −
                  </button>
                  <button 
                    className="control-button" 
                    onClick={handleResetZoom}
                    title="重置缩放"
                  >
                    ⟲
                  </button>
                  <button 
                    className="control-button" 
                    onClick={() => setPreviewZoom(prev => Math.min(10, prev + 0.2))}
                    title="放大"
                  >
                    +
                  </button>
                  <button className="close-button" onClick={handleClosePreview}>✕</button>
                </div>
              </div>
              <div 
                className="image-preview-content"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? 'grabbing' : (previewZoom > 1 ? 'grab' : 'default') }}
              >
                <img 
                  src={previewImage} 
                  alt={previewImageName}
                  style={{
                    transform: `scale(${previewZoom}) translate(${previewPosition.x / previewZoom}px, ${previewPosition.y / previewZoom}px)`,
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                  draggable={false}
                />
              </div>
              <div className="image-preview-footer">
                <span>滚轮缩放 · 拖拽移动 · ESC或点击外部关闭</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
