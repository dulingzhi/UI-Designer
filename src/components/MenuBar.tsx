import React, { useState, useRef, useEffect } from 'react';
import './MenuBar.css';
import { AboutDialog } from './AboutDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { saveProject, loadProject, loadProjectFromPath, importFromFDF } from '../utils/fileOperations';
import { importFromFDFEnhanced, importFDFFolder } from '../utils/fdfImportExport';
import { exportToFDF, exportToJSON, exportToPNG } from '../utils/exportUtils';
import { AlignCommand, DistributeCommand } from '../commands/AlignCommands';
import { ZIndexCommand } from '../commands/ZIndexCommands';
import { RemoveFrameCommand, BatchRemoveFrameCommand, CopyStyleCommand, PasteStyleCommand } from '../commands/FrameCommands';

interface MenuBarProps {
  currentFilePath: string | null;
  setCurrentFilePath: (path: string | null) => void;
  canvasRef?: React.RefObject<{ 
    setScale: (s: number | ((prev: number) => number)) => void; 
    centerCanvas: () => void;
    toggleGrid: () => void;
    toggleAnchors: () => void;
    toggleRulers: () => void;
    getScale: () => number;
  } | null>;
  onToggleGrid?: () => void;
  onToggleAnchors?: () => void;
  onToggleRulers?: () => void;
  showProjectTree: boolean;
  setShowProjectTree: (show: boolean) => void;
  showPropertiesPanel: boolean;
  setShowPropertiesPanel: (show: boolean) => void;
  showStylePresetPanel?: boolean;
  setShowStylePresetPanel?: (show: boolean) => void;
  showFrameGroupPanel?: boolean;
  setShowFrameGroupPanel?: (show: boolean) => void;
  showDebugPanel?: boolean;
  setShowDebugPanel?: (show: boolean) => void;
  onDeleteRequest?: (targets: string[]) => void;
}

interface MenuItem {
  label?: string;
  shortcut?: string;
  action?: () => void;
  separator?: boolean;
  disabled?: boolean;
  submenu?: MenuItem[];
}

export const MenuBar: React.FC<MenuBarProps> = ({
  currentFilePath,
  setCurrentFilePath,
  canvasRef,
  onToggleGrid,
  onToggleAnchors,
  onToggleRulers,
  showProjectTree,
  setShowProjectTree,
  showPropertiesPanel,
  setShowPropertiesPanel,
  showStylePresetPanel = false,
  setShowStylePresetPanel = () => {},
  showFrameGroupPanel = false,
  setShowFrameGroupPanel = () => {},
  showDebugPanel = false,
  setShowDebugPanel = () => {},
  onDeleteRequest
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargets, setDeleteTargets] = useState<string[]>([]);
  const [recentFiles, setRecentFiles] = useState<string[]>([]);
  const [showTestResult, setShowTestResult] = useState(false);
  const [testResultMessage, setTestResultMessage] = useState('');
  const menuBarRef = useRef<HTMLDivElement>(null);
  
  const { project, setProject, selectedFrameId, selectedFrameIds, clipboard, styleClipboard, copyToClipboard, clearGuides, addFrames } = useProjectStore();
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandStore();

  // FDF导入处理函数
  const handleImportFDF = async () => {
    try {
      const frames = await importFromFDF();
      if (frames && frames.length > 0) {
        addFrames(frames);
        alert(`成功导入 ${frames.length} 个控件`);
      }
    } catch (error) {
      console.error('导入FDF失败:', error);
      alert(`导入FDF失败: ${error}`);
    }
  };

  // 增强的 FDF 导入（保留元数据）
  const handleImportFDFEnhanced = async () => {
    try {
      const frames = await importFromFDFEnhanced();
      if (frames && frames.length > 0) {
        addFrames(frames);
        alert(`成功导入 ${frames.length} 个控件（含 FDF 元数据）`);
      }
    } catch (error) {
      console.error('增强导入失败:', error);
      alert(`增强导入失败: ${error}`);
    }
  };

  // 批量导入 FDF 模板库
  const handleImportFDFTemplates = async () => {
    try {
      const count = await importFDFFolder();
      if (count > 0) {
        alert(`成功加载 ${count} 个 FDF 模板`);
      }
    } catch (error) {
      console.error('导入模板库失败:', error);
      alert(`导入模板库失败: ${error}`);
    }
  };

  // 导出处理函数
  const handleExportFDF = () => {
    exportToFDF(project);
  };

  const handleExportJSON = () => {
    exportToJSON(project);
  };

  const handleExportPNG = () => {
    // 需要从 Canvas 组件获取 canvas 元素
    // 暂时使用简化方案
    const canvas = document.querySelector('canvas');
    exportToPNG(canvas);
  };

  // 加载最近打开的文件
  useEffect(() => {
    const loadRecentFiles = async () => {
      try {
        const stored = localStorage.getItem('recentFiles');
        if (stored) {
          setRecentFiles(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load recent files:', error);
      }
    };
    loadRecentFiles();
  }, []);

  // 添加到最近文件列表
  const addToRecentFiles = (filePath: string) => {
    const updatedRecent = [
      filePath,
      ...recentFiles.filter(f => f !== filePath)
    ].slice(0, 10); // 保留最近10个
    setRecentFiles(updatedRecent);
    localStorage.setItem('recentFiles', JSON.stringify(updatedRecent));
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    if (activeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [activeMenu]);

  // 快捷键：Ctrl+1 切换项目树，Ctrl+2 切换属性面板
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '1') {
        e.preventDefault();
        setShowProjectTree(!showProjectTree);
      } else if (e.ctrlKey && e.key === '2') {
        e.preventDefault();
        setShowPropertiesPanel(!showPropertiesPanel);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showProjectTree, showPropertiesPanel, setShowProjectTree, setShowPropertiesPanel]);

  const handleMenuClick = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleMenuItemClick = (action?: () => void) => {
    if (action) {
      action();
    }
    setActiveMenu(null);
  };

  const handleOpenRecent = async (filePath: string) => {
    try {
      const result = await loadProjectFromPath(filePath);
      if (result) {
        setProject(result.project);
        setCurrentFilePath(result.path);
        addToRecentFiles(result.path);
      }
    } catch (error) {
      alert(`加载文件失败: ${error}\n文件路径: ${filePath}`);
      // 从最近列表中移除失败的文件
      setRecentFiles((prev) => {
        const updated = prev.filter((f) => f !== filePath);
        localStorage.setItem('recentFiles', JSON.stringify(updated));
        return updated;
      });
    } finally {
      setActiveMenu(null);
    }
  };

  const handleClearRecent = () => {
    setRecentFiles([]);
    localStorage.removeItem('recentFiles');
    setActiveMenu(null);
  };

  // 文件操作
  const handleNewProject = () => {
    if (confirm('创建新项目将清除当前项目，是否继续？')) {
      setProject({
        version: 2,
        libraryName: 'UILib',
        originMode: 'gameui',
        hideGameUI: false,
        hideHeroBar: false,
        hideMiniMap: false,
        hideResources: false,
        hideButtonBar: false,
        hidePortrait: false,
        hideChat: false,
        appInterface: '',
        frames: {},
        rootFrameIds: [],
        fdfTemplates: {},
        tableArrays: [],
        circleArrays: [],
        exportVersion: 'reforged',
      });
      setCurrentFilePath(null);
    }
  };

  const handleOpen = async () => {
    try {
      const result = await loadProject();
      if (result) {
        setProject(result.project);
        setCurrentFilePath(result.path);
        addToRecentFiles(result.path);
      }
    } catch (error) {
      alert('加载失败: ' + error);
    }
  };

  const handleSave = async () => {
    try {
      const path = await saveProject(project, currentFilePath || undefined);
      if (path) {
        setCurrentFilePath(path);
        addToRecentFiles(path);
      }
    } catch (error) {
      alert('保存失败: ' + error);
    }
  };

  const handleSaveAs = async () => {
    try {
      const path = await saveProject(project);
      if (path) {
        setCurrentFilePath(path);
        addToRecentFiles(path);
      }
    } catch (error) {
      alert('保存失败: ' + error);
    }
  };

  // 编辑操作
  const handleCopy = () => {
    if (selectedFrameId) {
      copyToClipboard(selectedFrameId);
    }
  };

  const handlePaste = () => {
    if (clipboard) {
      // 生成新的ID并粘贴控件
      const generateNewId = (baseName: string): string => {
        let counter = 1;
        let newId = baseName;
        while (project.frames[newId]) {
          newId = `${baseName}_copy${counter}`;
          counter++;
        }
        return newId;
      };

      const pasteFrameRecursive = (frame: any, parentId?: string): string => {
        const newId = generateNewId(frame.name);
        const newFrame = {
          ...frame,
          name: newId,
          parentId: parentId,
          // 偏移位置，避免完全重叠
          x: frame.x + 0.02,
          y: frame.y + 0.02,
          children: [] as string[],
        };

        // 先添加当前frame
        project.frames[newId] = newFrame;

        // 递归处理子控件
        if (frame.children && Array.isArray(frame.children)) {
          const childIds = frame.children.map((child: any) => 
            pasteFrameRecursive(child, newId)
          );
          newFrame.children = childIds;
        }

        return newId;
      };

      const newRootId = pasteFrameRecursive(clipboard);
      if (!clipboard.parentId) {
        project.rootFrameIds.push(newRootId);
      }
      
      setProject({ ...project });
      // 选中新粘贴的控件
      const { selectFrame } = useProjectStore.getState();
      selectFrame(newRootId);
    }
  };

  const handleCopyStyle = () => {
    if (selectedFrameId) {
      executeCommand(new CopyStyleCommand(selectedFrameId));
    }
  };

  const handlePasteStyle = () => {
    if (selectedFrameIds.length > 0) {
      executeCommand(new PasteStyleCommand(selectedFrameIds));
    }
  };

  const handleDelete = () => {
    if (selectedFrameIds.length > 0) {
      // 过滤掉锁定的控件
      const targets = selectedFrameIds.filter(id => {
        const frame = project.frames[id];
        return frame && !frame.locked;
      });
      
      if (targets.length === 0) {
        return; // 所有控件都被锁定
      }
      
      // 如果提供了全局删除请求回调，使用它
      if (onDeleteRequest) {
        onDeleteRequest(targets);
      } else {
        // 否则使用本地确认框
        setDeleteTargets(targets);
        setShowDeleteConfirm(true);
      }
    }
  };

  const confirmDelete = () => {
    if (deleteTargets.length === 1) {
      // 单个删除
      executeCommand(new RemoveFrameCommand(deleteTargets[0]));
    } else {
      // 批量删除（一次 undo 就能全部恢复）
      executeCommand(new BatchRemoveFrameCommand(deleteTargets));
    }
    setShowDeleteConfirm(false);
    setDeleteTargets([]);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeleteTargets([]);
  };

  // 视图操作
  const handleZoomIn = () => {
    canvasRef?.current?.setScale((prev) => Math.min(5, prev * 1.2));
  };

  const handleZoomOut = () => {
    canvasRef?.current?.setScale((prev) => Math.max(0.1, prev / 1.2));
  };

  const handleResetZoom = () => {
    canvasRef?.current?.setScale(1);
  };

  const handleCenterCanvas = () => {
    canvasRef?.current?.centerCanvas();
  };

  // 对齐操作
  const handleAlign = (type: 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV') => {
    if (selectedFrameIds.length > 0) {
      executeCommand(new AlignCommand(selectedFrameIds, type));
    }
  };

  const handleDistribute = (direction: 'horizontal' | 'vertical') => {
    if (selectedFrameIds.length > 1) {
      executeCommand(new DistributeCommand(selectedFrameIds, direction));
    }
  };

  // 层级操作
  const handleZIndex = (action: 'moveUp' | 'moveDown' | 'bringToFront' | 'sendToBack') => {
    if (selectedFrameId) {
      executeCommand(new ZIndexCommand(selectedFrameId, action));
    }
  };


  // 菜单定义
  const menus: Record<string, MenuItem[]> = {
    file: [
      {
        label: '新建',
        shortcut: 'Ctrl+N',
        action: handleNewProject
      },
      {
        label: '打开',
        shortcut: 'Ctrl+O',
        action: handleOpen
      },
      {
        label: '最近打开',
        submenu: recentFiles.length > 0 ? [
          ...recentFiles.map(filePath => ({
            label: filePath.split(/[\\/]/).pop() || filePath,
            action: () => handleOpenRecent(filePath)
          })),
          { separator: true },
          {
            label: '清空列表',
            action: handleClearRecent
          }
        ] : [
          { label: '无最近文件', disabled: true }
        ]
      },
      { separator: true },
      {
        label: '保存',
        shortcut: 'Ctrl+S',
        action: handleSave,
        disabled: !currentFilePath
      },
      {
        label: '另存为',
        shortcut: 'Ctrl+Shift+S',
        action: handleSaveAs
      },
      { separator: true },
      {
        label: '导入',
        submenu: [
          { label: '导入 FDF (基础)', action: handleImportFDF },
          { label: '导入 FDF (增强)', action: handleImportFDFEnhanced },
          { separator: true },
          { label: '导入 FDF 模板库', action: handleImportFDFTemplates }
        ]
      },
      {
        label: '导出',
        submenu: [
          { label: '导出为 FDF', action: handleExportFDF },
          { label: '导出为 PNG', action: handleExportPNG },
          { label: '导出为 JSON', action: handleExportJSON }
        ]
      },
      { separator: true },
      {
        label: '退出',
        shortcut: 'Alt+F4',
        action: () => window.close()
      }
    ],
    edit: [
      {
        label: '撤销',
        shortcut: 'Ctrl+Z',
        action: undo,
        disabled: !canUndo
      },
      {
        label: '重做',
        shortcut: 'Ctrl+Y',
        action: redo,
        disabled: !canRedo
      },
      { separator: true },
      {
        label: '剪切',
        shortcut: 'Ctrl+X',
        action: () => {
          handleCopy();
          handleDelete();
        },
        disabled: !selectedFrameId
      },
      {
        label: '复制',
        shortcut: 'Ctrl+C',
        action: handleCopy,
        disabled: !selectedFrameId
      },
      {
        label: '粘贴',
        shortcut: 'Ctrl+V',
        action: handlePaste,
        disabled: !clipboard
      },
      { separator: true },
      {
        label: '复制样式',
        shortcut: 'Ctrl+Shift+C',
        action: handleCopyStyle,
        disabled: !selectedFrameId
      },
      {
        label: '粘贴样式',
        shortcut: 'Ctrl+Shift+V',
        action: handlePasteStyle,
        disabled: !styleClipboard || selectedFrameIds.length === 0
      },
      { separator: true },
      {
        label: '删除',
        shortcut: 'Delete',
        action: handleDelete,
        disabled: selectedFrameIds.length === 0
      },
      { separator: true },
      {
        label: '全选',
        shortcut: 'Ctrl+A',
        action: () => {
          // TODO: 实现全选
          console.log('Select All');
        }
      }
    ],
    view: [
      {
        label: '缩放',
        submenu: [
          { label: '放大', shortcut: 'Ctrl++', action: handleZoomIn },
          { label: '缩小', shortcut: 'Ctrl+-', action: handleZoomOut },
          { label: '重置缩放', shortcut: 'Ctrl+0', action: handleResetZoom },
          { separator: true },
          { label: '适应窗口', shortcut: 'Ctrl+9', action: handleCenterCanvas }
        ]
      },
      { separator: true },
      {
        label: '显示网格',
        action: onToggleGrid
      },
      {
        label: '显示锚点',
        action: onToggleAnchors
      },
      {
        label: '显示标尺',
        action: onToggleRulers
      },
      {
        label: '清除参考线',
        shortcut: 'Ctrl+;',
        action: clearGuides,
        disabled: !project.guides || project.guides.length === 0
      },
      { separator: true },
      {
        label: showProjectTree ? '✓ 项目树' : '项目树',
        shortcut: 'Ctrl+1',
        action: () => setShowProjectTree(!showProjectTree)
      },
      {
        label: showPropertiesPanel ? '✓ 属性面板' : '属性面板',
        shortcut: 'Ctrl+2',
        action: () => setShowPropertiesPanel(!showPropertiesPanel)
      },
      {
        label: showStylePresetPanel ? '✓ 样式预设' : '样式预设',
        shortcut: 'Ctrl+3',
        action: () => setShowStylePresetPanel(!showStylePresetPanel)
      },
      {
        label: showFrameGroupPanel ? '✓ 分组管理' : '分组管理',
        shortcut: 'Ctrl+4',
        action: () => setShowFrameGroupPanel(!showFrameGroupPanel)
      },
      { separator: true },
      {
        label: showDebugPanel ? '✓ 调试面板' : '调试面板',
        shortcut: 'Ctrl+Shift+D',
        action: () => setShowDebugPanel(!showDebugPanel)
      }
    ],
    tools: [
      {
        label: '选择工具',
        shortcut: 'V',
        action: () => console.log('Select tool')
      },
      {
        label: '手形工具',
        shortcut: 'H',
        action: () => console.log('Hand tool')
      },
      { separator: true },
      {
        label: '对齐',
        submenu: [
          { label: '左对齐', action: () => handleAlign('left'), disabled: selectedFrameIds.length === 0 },
          { label: '水平居中', action: () => handleAlign('centerH'), disabled: selectedFrameIds.length === 0 },
          { label: '右对齐', action: () => handleAlign('right'), disabled: selectedFrameIds.length === 0 },
          { separator: true },
          { label: '顶部对齐', action: () => handleAlign('top'), disabled: selectedFrameIds.length === 0 },
          { label: '垂直居中', action: () => handleAlign('centerV'), disabled: selectedFrameIds.length === 0 },
          { label: '底部对齐', action: () => handleAlign('bottom'), disabled: selectedFrameIds.length === 0 }
        ]
      },
      {
        label: '分布',
        submenu: [
          { label: '水平分布', action: () => handleDistribute('horizontal'), disabled: selectedFrameIds.length < 2 },
          { label: '垂直分布', action: () => handleDistribute('vertical'), disabled: selectedFrameIds.length < 2 }
        ]
      },
      { separator: true },
      {
        label: '层级',
        submenu: [
          { label: '置于顶层', action: () => handleZIndex('bringToFront'), disabled: !selectedFrameId },
          { label: '上移一层', action: () => handleZIndex('moveUp'), disabled: !selectedFrameId },
          { label: '下移一层', action: () => handleZIndex('moveDown'), disabled: !selectedFrameId },
          { label: '置于底层', action: () => handleZIndex('sendToBack'), disabled: !selectedFrameId }
        ]
      },
      { separator: true },
      {
        label: '首选项',
        shortcut: 'Ctrl+,',
        action: () => console.log('Preferences')
      }
    ],
    help: [
      {
        label: '文档',
        shortcut: 'F1',
        action: () => window.open('https://github.com/warcraft-iii/UI-Designer', '_blank')
      },
      {
        label: '快捷键',
        shortcut: 'Ctrl+/',
        action: () => {
          // 触发快捷键帮助
          window.dispatchEvent(new Event('openShortcutHelp'));
        }
      },
      { separator: true },
      {
        label: '开发者工具',
        submenu: [
          {
            label: '运行 FDF 解析器测试',
            action: async () => {
              try {
                const { runAllTests } = await import('../utils/fdfTestRunner');
                console.log('开始运行 FDF 解析器测试...');
                const results = await runAllTests();
                console.log('测试完成！', results);
                
                const message = `📊 FDF 解析器测试完成\n\n✅ 基础测试: ${results.basic.passed}/${results.basic.passed + results.basic.failed} 通过\n\n${results.wc3.total > 0 ? `📁 WC3 文件: ${results.wc3.successCount}/${results.wc3.total} 通过 (${Math.round(results.wc3.successCount / results.wc3.total * 100)}%)\n\n` : '⚠️ WC3 文件: 未找到测试文件\n\n'}📈 统计分析:\n  • Frame 类型: ${Object.keys(results.stats.frameTypes).length} 种\n  • 总模板数: ${results.stats.templates.length}\n  • 继承深度: ${results.stats.maxDepth}\n\n详情请查看控制台（F12）`;
                
                setTestResultMessage(message);
                setShowTestResult(true);
              } catch (error) {
                console.error('测试失败:', error);
                setTestResultMessage(`❌ 测试失败\n\n错误信息:\n${error}\n\n请查看控制台获取详细信息`);
                setShowTestResult(true);
              }
            }
          },
          {
            label: '基础功能测试',
            action: async () => {
              try {
                const { runBasicTests } = await import('../utils/fdfTestRunner');
                const result = await runBasicTests();
                setTestResultMessage(`✅ 基础功能测试完成\n\n通过: ${result.passed}\n失败: ${result.failed}\n\n详情请查看控制台`);
                setShowTestResult(true);
              } catch (error) {
                console.error('测试失败:', error);
                setTestResultMessage(`❌ 测试失败: ${error}`);
                setShowTestResult(true);
              }
            }
          },
          {
            label: 'WC3 文件测试',
            action: async () => {
              try {
                const { runWC3Tests } = await import('../utils/fdfTestRunner');
                const result = await runWC3Tests();
                const passRate = result.total > 0 ? Math.round(result.successCount / result.total * 100) : 0;
                setTestResultMessage(`📁 WC3 文件测试完成\n\n通过: ${result.successCount}/${result.total} (${passRate}%)\n失败: ${result.failCount}\n\n详情请查看控制台`);
                setShowTestResult(true);
              } catch (error) {
                console.error('测试失败:', error);
                setTestResultMessage(`❌ 测试失败: ${error}`);
                setShowTestResult(true);
              }
            }
          },
          {
            label: '统计分析',
            action: async () => {
              try {
                const { analyzeWC3FDF } = await import('../utils/fdfTestRunner');
                const stats = await analyzeWC3FDF();
                const topTypes = Object.entries(stats.frameTypes)
                  .sort((a, b) => (b[1] as number) - (a[1] as number))
                  .slice(0, 5)
                  .map(([type, count]) => `  • ${type}: ${count}`)
                  .join('\n');
                
                setTestResultMessage(`📊 WC3 FDF 统计分析\n\n📈 Frame 类型统计 (Top 5):\n${topTypes}\n\n📦 模板统计:\n  • 总模板数: ${stats.templates.length}\n  • 总 Frame 数: ${stats.totalFrames}\n  • 最大继承深度: ${stats.maxDepth}\n\n详情请查看控制台`);
                setShowTestResult(true);
              } catch (error) {
                console.error('分析失败:', error);
                setTestResultMessage(`❌ 分析失败: ${error}`);
                setShowTestResult(true);
              }
            }
          },
        ]
      },
      { separator: true },
      {
        label: '检查更新',
        action: () => console.log('Check updates')
      },
      { separator: true },
      {
        label: '关于',
        action: () => setShowAbout(true)
      }
    ]
  };

  const renderMenuItem = (item: MenuItem, index: number) => {
    if (item.separator) {
      return <div key={index} className="menu-separator" />;
    }

    return (
      <div
        key={index}
        className={`menu-item ${item.disabled ? 'disabled' : ''} ${item.submenu ? 'has-submenu' : ''}`}
        onClick={() => !item.disabled && handleMenuItemClick(item.action)}
      >
        <span className="menu-item-label">{item.label}</span>
        {item.shortcut && <span className="menu-item-shortcut">{item.shortcut}</span>}
        {item.submenu && <span className="menu-item-arrow">▶</span>}
        {item.submenu && (
          <div className="submenu">
            {item.submenu.map((subItem, subIndex) => renderMenuItem(subItem, subIndex))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="menu-bar" ref={menuBarRef}>
        <div
          className={`menu-bar-item ${activeMenu === 'file' ? 'active' : ''}`}
          onClick={() => handleMenuClick('file')}
        >
          文件
          {activeMenu === 'file' && (
            <div className="menu-dropdown">
              {menus.file.map((item, index) => renderMenuItem(item, index))}
            </div>
          )}
        </div>

        <div
          className={`menu-bar-item ${activeMenu === 'edit' ? 'active' : ''}`}
          onClick={() => handleMenuClick('edit')}
        >
          编辑
          {activeMenu === 'edit' && (
            <div className="menu-dropdown">
              {menus.edit.map((item, index) => renderMenuItem(item, index))}
            </div>
          )}
        </div>

        <div
          className={`menu-bar-item ${activeMenu === 'view' ? 'active' : ''}`}
          onClick={() => handleMenuClick('view')}
        >
          视图
          {activeMenu === 'view' && (
            <div className="menu-dropdown">
              {menus.view.map((item, index) => renderMenuItem(item, index))}
            </div>
          )}
        </div>

        <div
          className={`menu-bar-item ${activeMenu === 'tools' ? 'active' : ''}`}
          onClick={() => handleMenuClick('tools')}
        >
          工具
          {activeMenu === 'tools' && (
            <div className="menu-dropdown">
              {menus.tools.map((item, index) => renderMenuItem(item, index))}
            </div>
          )}
        </div>

        <div
          className={`menu-bar-item ${activeMenu === 'help' ? 'active' : ''}`}
          onClick={() => handleMenuClick('help')}
        >
          帮助
          {activeMenu === 'help' && (
            <div className="menu-dropdown">
              {menus.help.map((item, index) => renderMenuItem(item, index))}
            </div>
          )}
        </div>

        {currentFilePath && (
          <div className="menu-bar-file-info">
            {currentFilePath.split(/[\\/]/).pop()}
          </div>
        )}
      </div>

      {showAbout && <AboutDialog onClose={() => setShowAbout(false)} />}
      
      {showDeleteConfirm && (
        <ConfirmDialog
          title="删除确认"
          message={`确定要删除选中的 ${deleteTargets.length} 个控件吗？${deleteTargets.length > 1 ? '\n（可以通过撤销一次性恢复）' : ''}`}
          confirmText="删除"
          cancelText="取消"
          type="danger"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}

      {showTestResult && (
        <ConfirmDialog
          title="测试结果"
          message={testResultMessage}
          confirmText="确定"
          onConfirm={() => setShowTestResult(false)}
          onCancel={() => setShowTestResult(false)}
        />
      )}
    </>
  );
};
