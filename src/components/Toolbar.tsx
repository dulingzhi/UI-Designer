import React from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { AlignCommand, DistributeCommand, EqualSpacingCommand } from '../commands/AlignCommands';
import { UnifySizeCommand } from '../commands/SizeCommands';
import { ZIndexCommand } from '../commands/ZIndexCommands';
import { AlignToCanvasCommand } from '../commands/AlignToCanvasCommands';
import { ExportLanguage } from '../types';
import { saveProject, loadProject, exportCode } from '../utils/fileOperations';
import { exportProject } from '../utils/codeExport';
import { ShortcutHelp } from './ShortcutHelp';
import { ConfirmDialog } from './ConfirmDialog';
import { useAlert } from '../hooks/useAlert';
import { WC3TextureBrowser } from './WC3TextureBrowser';
import { RaceSwitcher } from './RaceSwitcher';
import { detectKKWE, launchMapWithKKWE, type KKWEInfo } from '../utils/kkweDetector';
import { HotReloadExporter } from '../utils/hotReloadExporter';
import {
  NewFileIcon, OpenFileIcon, SaveIcon,
  UndoIcon, RedoIcon,
  AlignLeftIcon, AlignCenterHIcon, AlignRightIcon,
  AlignTopIcon, AlignCenterVIcon, AlignBottomIcon,
  DistributeHIcon, DistributeVIcon,
  SameWidthIcon, SameHeightIcon, SameSizeIcon,
  BringToFrontIcon, BringForwardIcon, SendBackwardIcon, SendToBackIcon,
  ExportIcon, HelpIcon, TextureBrowserIcon, LaunchGameIcon,
} from './icons/ToolbarIcons';
import './Toolbar.css';

interface ToolbarProps {
  currentFilePath: string | null;
  setCurrentFilePath: (path: string | null) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ currentFilePath, setCurrentFilePath }) => {
  const { selectedFrameId, selectedFrameIds, project, setProject } = useProjectStore();
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandStore();
  const [showShortcutHelp, setShowShortcutHelp] = React.useState(false);
  const [showTextureBrowser, setShowTextureBrowser] = React.useState(false);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = React.useState(false);
  const [isLaunching, setIsLaunching] = React.useState(false);
  const { showAlert, AlertComponent } = useAlert();

  // 监听 F1 快捷键事件
  React.useEffect(() => {
    const handleOpenHelp = () => setShowShortcutHelp(true);
    window.addEventListener('openShortcutHelp', handleOpenHelp);
    return () => window.removeEventListener('openShortcutHelp', handleOpenHelp);
  }, []);

  // 层级管理
  const handleZIndex = (action: 'moveUp' | 'moveDown' | 'bringToFront' | 'sendToBack') => {
    if (selectedFrameId) {
      executeCommand(new ZIndexCommand(selectedFrameId, action));
    }
  };

  const handleNewProject = () => {
    setShowNewProjectConfirm(true);
  };

  const confirmNewProject = () => {
    setShowNewProjectConfirm(false);
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
      tableArrays: [],
      circleArrays: [],
      exportVersion: 'reforged', // 添加默认导出版本
    });
    setCurrentFilePath(null);
  };

  const handleSave = async () => {
    try {
      const path = await saveProject(project, currentFilePath || undefined);
      if (path) {
        setCurrentFilePath(path);
        showAlert({ title: '成功', message: '项目保存成功！', type: 'info' });
      }
    } catch (error) {
      showAlert({ title: '错误', message: '保存失败: ' + error, type: 'danger' });
    }
  };

  const handleSaveAs = async () => {
    try {
      const path = await saveProject(project);
      if (path) {
        setCurrentFilePath(path);
        showAlert({ title: '成功', message: '项目保存成功！', type: 'info' });
      }
    } catch (error) {
      showAlert({ title: '错误', message: '保存失败: ' + error, type: 'danger' });
    }
  };

  const handleLoad = async () => {
    try {
      const result = await loadProject();
      if (result) {
        setProject(result.project);
        setCurrentFilePath(result.path);
        showAlert({ title: '成功', message: '项目加载成功！', type: 'info' });
      }
    } catch (error) {
      showAlert({ title: '错误', message: '加载失败: ' + error, type: 'danger' });
    }
  };

  const handleExport = async (language: ExportLanguage) => {
    try {
      const code = exportProject(project, language);
      const path = await exportCode(code, language);
      if (path) {
        showAlert({ title: '成功', message: `代码导出成功！\n路径: ${path}`, type: 'info' });
      }
    } catch (error) {
      showAlert({ title: '错误', message: '导出失败: ' + error, type: 'danger' });
    }
  };

  // 启动War3测试
  const handleLaunchWar3 = async () => {
    if (isLaunching) return;
    
    try {
      setIsLaunching(true);
      showAlert({ title: '提示', message: '正在检测 KKWE 环境...', type: 'info' });

      // 检测 KKWE
      const kkweInfo: KKWEInfo | null = await detectKKWE();
      if (!kkweInfo) {
        showAlert({ 
          title: '错误', 
          message: '未检测到 KKWE 环境！\n请确保已安装 KKWE 并正确配置 War3 路径。', 
          type: 'danger' 
        });
        return;
      }

      // 获取热重载配置
      const hotReloadConfigStr = localStorage.getItem('hotReloadConfig');
      if (!hotReloadConfigStr) {
        showAlert({ 
          title: '错误', 
          message: '未找到热重载配置！\n请先打开"热重载"面板进行配置。', 
          type: 'danger' 
        });
        return;
      }

      const config = JSON.parse(hotReloadConfigStr);
      
      // 导出Lua文件
      showAlert({ title: '提示', message: '正在导出 Lua 脚本...', type: 'info' });
      const exporter = new HotReloadExporter(config);
      await exporter.export(project, true);

      // 启动War3
      showAlert({ title: '提示', message: '正在启动 War3...', type: 'info' });
      await launchMapWithKKWE(config.testMapPath, kkweInfo);
      showAlert({ title: '成功', message: 'War3 启动成功！', type: 'info' });
    } catch (error) {
      console.error('启动War3失败:', error);
      showAlert({ title: '错误', message: '启动失败: ' + error, type: 'danger' });
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <div className="toolbar">
      {/* 文件操作 */}
      <div className="toolbar-group">
        <button className="toolbar-btn-icon" onClick={handleNewProject} title="新建 (Ctrl+N)">
          <NewFileIcon />
        </button>
        <button className="toolbar-btn-icon" onClick={handleLoad} title="打开 (Ctrl+O)">
          <OpenFileIcon />
        </button>
        <button className="toolbar-btn-icon" onClick={handleSave} disabled={!currentFilePath} title="保存 (Ctrl+S)">
          <SaveIcon />
        </button>
        <button className="toolbar-btn-icon" onClick={handleSaveAs} title="另存为 (Ctrl+Shift+S)">
          <SaveIcon />
        </button>
      </div>

      {/* 编辑操作 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon" 
          onClick={undo}
          disabled={!canUndo()}
          title="撤销 (Ctrl+Z)"
        >
          <UndoIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={redo}
          disabled={!canRedo()}
          title="重做 (Ctrl+Y)"
        >
          <RedoIcon />
        </button>
      </div>

      {/* 对齐工具 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'left'))}
          disabled={selectedFrameIds.length < 2}
          title="左对齐"
        >
          <AlignLeftIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'centerH'))}
          disabled={selectedFrameIds.length < 2}
          title="水平居中"
        >
          <AlignCenterHIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'right'))}
          disabled={selectedFrameIds.length < 2}
          title="右对齐"
        >
          <AlignRightIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'top'))}
          disabled={selectedFrameIds.length < 2}
          title="顶部对齐"
        >
          <AlignTopIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'centerV'))}
          disabled={selectedFrameIds.length < 2}
          title="垂直居中"
        >
          <AlignCenterVIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'bottom'))}
          disabled={selectedFrameIds.length < 2}
          title="底部对齐"
        >
          <AlignBottomIcon />
        </button>
      </div>

      {/* 分布工具 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new DistributeCommand(selectedFrameIds, 'horizontal'))}
          disabled={selectedFrameIds.length < 3}
          title="水平分布"
        >
          <DistributeHIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new DistributeCommand(selectedFrameIds, 'vertical'))}
          disabled={selectedFrameIds.length < 3}
          title="垂直分布"
        >
          <DistributeVIcon />
        </button>
      </div>

      {/* 统一大小 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new UnifySizeCommand(selectedFrameIds, 'width'))}
          disabled={selectedFrameIds.length < 2}
          title="统一宽度"
        >
          <SameWidthIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new UnifySizeCommand(selectedFrameIds, 'height'))}
          disabled={selectedFrameIds.length < 2}
          title="统一高度"
        >
          <SameHeightIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new UnifySizeCommand(selectedFrameIds, 'both'))}
          disabled={selectedFrameIds.length < 2}
          title="统一大小"
        >
          <SameSizeIcon />
        </button>
      </div>

      {/* 等间距 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new EqualSpacingCommand(selectedFrameIds, 'horizontal'))}
          disabled={selectedFrameIds.length < 3}
          title="水平等间距"
        >
          <DistributeHIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => executeCommand(new EqualSpacingCommand(selectedFrameIds, 'vertical'))}
          disabled={selectedFrameIds.length < 3}
          title="垂直等间距"
        >
          <DistributeVIcon />
        </button>
      </div>

      {/* 层级管理 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon"
          onClick={() => handleZIndex('bringToFront')}
          disabled={!selectedFrameId}
          title="置顶"
        >
          <BringToFrontIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => handleZIndex('moveUp')}
          disabled={!selectedFrameId}
          title="上移一层"
        >
          <BringForwardIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => handleZIndex('moveDown')}
          disabled={!selectedFrameId}
          title="下移一层"
        >
          <SendBackwardIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => handleZIndex('sendToBack')}
          disabled={!selectedFrameId}
          title="置底"
        >
          <SendToBackIcon />
        </button>
      </div>

      {/* 对齐到画布 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon"
          onClick={() => {
            if (selectedFrameIds.length > 0) {
              selectedFrameIds.forEach(id => 
                executeCommand(new AlignToCanvasCommand(id, 'left'))
              );
            }
          }}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length > 1 ? "批量对齐到画布左边" : "对齐到画布左边"}
        >
          <AlignLeftIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => {
            if (selectedFrameIds.length > 0) {
              selectedFrameIds.forEach(id => 
                executeCommand(new AlignToCanvasCommand(id, 'centerH'))
              );
            }
          }}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length > 1 ? "批量对齐到画布水平中心" : "对齐到画布水平中心"}
        >
          <AlignCenterHIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => {
            if (selectedFrameIds.length > 0) {
              selectedFrameIds.forEach(id => 
                executeCommand(new AlignToCanvasCommand(id, 'right'))
              );
            }
          }}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length > 1 ? "批量对齐到画布右边" : "对齐到画布右边"}
        >
          <AlignRightIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => {
            if (selectedFrameIds.length > 0) {
              selectedFrameIds.forEach(id => 
                executeCommand(new AlignToCanvasCommand(id, 'top'))
              );
            }
          }}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length > 1 ? "批量对齐到画布顶部" : "对齐到画布顶部"}
        >
          <AlignTopIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => {
            if (selectedFrameIds.length > 0) {
              selectedFrameIds.forEach(id => 
                executeCommand(new AlignToCanvasCommand(id, 'centerV'))
              );
            }
          }}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length > 1 ? "批量对齐到画布垂直中心" : "对齐到画布垂直中心"}
        >
          <AlignCenterVIcon />
        </button>
        <button 
          className="toolbar-btn-icon"
          onClick={() => {
            if (selectedFrameIds.length > 0) {
              selectedFrameIds.forEach(id => 
                executeCommand(new AlignToCanvasCommand(id, 'bottom'))
              );
            }
          }}
          disabled={selectedFrameIds.length === 0}
          title={selectedFrameIds.length > 1 ? "批量对齐到画布底部" : "对齐到画布底部"}
        >
          <AlignBottomIcon />
        </button>
      </div>

      {/* 导出 */}
      <div className="toolbar-group">
        <button className="toolbar-btn-text" onClick={() => handleExport('jass')} title="导出为 JASS">
          <ExportIcon /> JASS
        </button>
        <button className="toolbar-btn-text" onClick={() => handleExport('lua')} title="导出为 Lua">
          <ExportIcon /> Lua
        </button>
        <button className="toolbar-btn-text" onClick={() => handleExport('ts')} title="导出为 TypeScript">
          <ExportIcon /> TS
        </button>
      </div>

      {/* 启动测试 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon" 
          onClick={handleLaunchWar3}
          disabled={isLaunching}
          title="启动 War3 测试 (自动导出Lua并启动)"
          style={{ color: isLaunching ? '#888' : '#4CAF50' }}
        >
          <LaunchGameIcon size={18} />
        </button>
      </div>

      {/* WC3 资源浏览器 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon" 
          onClick={() => setShowTextureBrowser(true)}
          title="WC3 资源浏览器"
        >
          <TextureBrowserIcon />
        </button>
      </div>

      {/* 种族切换器 */}
      <div className="toolbar-group">
        <RaceSwitcher />
      </div>

      {/* 帮助 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn-icon" 
          onClick={() => setShowShortcutHelp(true)}
          title="查看快捷键 (F1)"
        >
          <HelpIcon />
        </button>
      </div>

      <ShortcutHelp isOpen={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
      
      {showTextureBrowser && (
        <WC3TextureBrowser
          onSelect={(path) => {
            // 复制路径到剪贴板
            navigator.clipboard.writeText(path).then(() => {
              console.log('已复制路径:', path);
            });
          }}
          onClose={() => setShowTextureBrowser(false)}
        />
      )}

      {showNewProjectConfirm && (
        <ConfirmDialog
          title="新建项目"
          message="创建新项目将清除当前项目，是否继续？"
          confirmText="继续"
          cancelText="取消"
          type="warning"
          onConfirm={confirmNewProject}
          onCancel={() => setShowNewProjectConfirm(false)}
        />
      )}

      {AlertComponent}
    </div>
  );
};
