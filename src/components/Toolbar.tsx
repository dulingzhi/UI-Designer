import React from 'react';
import { nanoid } from 'nanoid';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { CreateFrameCommand } from '../commands/FrameCommands';
import { AlignCommand, DistributeCommand } from '../commands/AlignCommands';
import { UnifySizeCommand } from '../commands/SizeCommands';
import { FrameType, FrameData, ExportLanguage } from '../types';
import { saveProject, loadProject, exportCode } from '../utils/fileOperations';
import { exportProject } from '../utils/codeExport';
import { createDefaultAnchors } from '../utils/anchorUtils';
import { ShortcutHelp } from './ShortcutHelp';
import './Toolbar.css';

interface ToolbarProps {
  currentFilePath: string | null;
  setCurrentFilePath: (path: string | null) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ currentFilePath, setCurrentFilePath }) => {
  const { selectedFrameId, selectedFrameIds, project, setProject } = useProjectStore();
  const { executeCommand, undo, redo, canUndo, canRedo } = useCommandStore();
  const [showShortcutHelp, setShowShortcutHelp] = React.useState(false);

  // 监听 F1 快捷键事件
  React.useEffect(() => {
    const handleOpenHelp = () => setShowShortcutHelp(true);
    window.addEventListener('openShortcutHelp', handleOpenHelp);
    return () => window.removeEventListener('openShortcutHelp', handleOpenHelp);
  }, []);

  const createFrame = (type: FrameType, name: string) => {
    const parentId = selectedFrameId || null;
    const parent = parentId ? project.frames[parentId] : null;
    
    const x = 0.1;
    const y = 0.1;
    const width = 0.1;
    const height = 0.1;
    
    const newFrame: FrameData = {
      id: nanoid(),
      name: name + nanoid(4),
      type,
      x,
      y,
      width,
      height,
      z: parent ? parent.z + 1 : 1,
      parentId,
      children: [],
      tooltip: false,
      isRelative: false,
      anchors: createDefaultAnchors(x, y, width, height),
      diskTexture: '',
      wc3Texture: '',
      text: type === FrameType.TEXT_FRAME ? 'Text' : undefined,
      textScale: 1,
      textColor: '#FFFFFF',
      horAlign: 'left',
      verAlign: 'start',
    };

    const command = new CreateFrameCommand(newFrame);
    executeCommand(command);
  };

  const handleNewProject = () => {
    if (confirm('创建新项目将清除当前项目，是否继续？')) {
      setProject({
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
      });
      setCurrentFilePath(null);
    }
  };

  const handleSave = async () => {
    try {
      const path = await saveProject(project, currentFilePath || undefined);
      if (path) {
        setCurrentFilePath(path);
        alert('项目保存成功！');
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
        alert('项目保存成功！');
      }
    } catch (error) {
      alert('保存失败: ' + error);
    }
  };

  const handleLoad = async () => {
    try {
      const result = await loadProject();
      if (result) {
        setProject(result.project);
        setCurrentFilePath(result.path);
        alert('项目加载成功！');
      }
    } catch (error) {
      alert('加载失败: ' + error);
    }
  };

  const handleExport = async (language: ExportLanguage) => {
    try {
      const code = exportProject(project, language);
      const path = await exportCode(code, language);
      if (path) {
        alert(`代码导出成功！\n路径: ${path}`);
      }
    } catch (error) {
      alert('导出失败: ' + error);
    }
  };

  return (
    <div className="toolbar">
      {/* 文件操作 */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={handleNewProject} title="新建">
          <span>📄</span> 新建
        </button>
        <button className="toolbar-btn" onClick={handleLoad} title="打开">
          <span>📂</span> 打开
        </button>
        <button className="toolbar-btn" onClick={handleSave} disabled={!currentFilePath} title="保存">
          <span>💾</span> 保存
        </button>
        <button className="toolbar-btn" onClick={handleSaveAs} title="另存为">
          <span>💾</span> 另存为
        </button>
      </div>

      {/* 编辑操作 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn" 
          onClick={undo}
          disabled={!canUndo()}
          title="撤销 (Ctrl+Z)"
        >
          <span>↶</span> 撤销
        </button>
        <button 
          className="toolbar-btn"
          onClick={redo}
          disabled={!canRedo()}
          title="重做 (Ctrl+Y)"
        >
          <span>↷</span> 重做
        </button>
      </div>

      {/* 对齐工具 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'left'))}
          disabled={selectedFrameIds.length < 2}
          title="左对齐"
        >
          <span>⊣</span> 左对齐
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'centerH'))}
          disabled={selectedFrameIds.length < 2}
          title="水平居中"
        >
          <span>⊢</span> 居中
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'right'))}
          disabled={selectedFrameIds.length < 2}
          title="右对齐"
        >
          <span>⊢</span> 右对齐
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'top'))}
          disabled={selectedFrameIds.length < 2}
          title="顶部对齐"
        >
          <span>⊤</span> 顶对齐
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'centerV'))}
          disabled={selectedFrameIds.length < 2}
          title="垂直居中"
        >
          <span>⊥</span> 居中
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new AlignCommand(selectedFrameIds, 'bottom'))}
          disabled={selectedFrameIds.length < 2}
          title="底部对齐"
        >
          <span>⊥</span> 底对齐
        </button>
      </div>

      {/* 分布工具 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new DistributeCommand(selectedFrameIds, 'horizontal'))}
          disabled={selectedFrameIds.length < 3}
          title="水平分布"
        >
          <span>↔</span> 水平分布
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new DistributeCommand(selectedFrameIds, 'vertical'))}
          disabled={selectedFrameIds.length < 3}
          title="垂直分布"
        >
          <span>↕</span> 垂直分布
        </button>
      </div>

      {/* 统一大小 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new UnifySizeCommand(selectedFrameIds, 'width'))}
          disabled={selectedFrameIds.length < 2}
          title="统一宽度"
        >
          <span>↔</span> 同宽
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new UnifySizeCommand(selectedFrameIds, 'height'))}
          disabled={selectedFrameIds.length < 2}
          title="统一高度"
        >
          <span>↕</span> 同高
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => executeCommand(new UnifySizeCommand(selectedFrameIds, 'both'))}
          disabled={selectedFrameIds.length < 2}
          title="统一大小"
        >
          <span>⊡</span> 同大小
        </button>
      </div>

      {/* 插入元素 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn"
          onClick={() => createFrame(FrameType.BACKDROP, 'Backdrop')}
          title="插入Backdrop"
        >
          <span>▭</span> Backdrop
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => createFrame(FrameType.BUTTON, 'Button')}
          title="插入Button"
        >
          <span>🔘</span> Button
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => createFrame(FrameType.TEXT_FRAME, 'Text')}
          title="插入Text"
        >
          <span>T</span> Text
        </button>
        <button 
          className="toolbar-btn"
          onClick={() => createFrame(FrameType.CHECKBOX, 'Checkbox')}
          title="插入Checkbox"
        >
          <span>☑</span> Checkbox
        </button>
      </div>

      {/* 导出 */}
      <div className="toolbar-group">
        <button className="toolbar-btn" onClick={() => handleExport('jass')} title="导出为 JASS">
          <span>📤</span> JASS
        </button>
        <button className="toolbar-btn" onClick={() => handleExport('lua')} title="导出为 Lua">
          <span>📤</span> Lua
        </button>
        <button className="toolbar-btn" onClick={() => handleExport('ts')} title="导出为 TypeScript">
          <span>📤</span> TS
        </button>
      </div>

      {/* 帮助 */}
      <div className="toolbar-group">
        <button 
          className="toolbar-btn" 
          onClick={() => setShowShortcutHelp(true)}
          title="查看快捷键 (F1)"
        >
          <span>❓</span> 帮助
        </button>
      </div>

      <ShortcutHelp isOpen={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
    </div>
  );
};
