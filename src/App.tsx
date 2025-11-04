import React from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { MenuBar } from './components/MenuBar';
import { ProjectTree } from './components/ProjectTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SidePanel } from './components/SidePanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useCommandStore } from './store/commandStore';
import { RemoveFrameCommand, BatchRemoveFrameCommand } from './commands/FrameCommands';
import './App.css';

function App() {
  const [currentFilePath, setCurrentFilePath] = React.useState<string | null>(null);
  const [showProjectTree, setShowProjectTree] = React.useState(true);
  const [showPropertiesPanel, setShowPropertiesPanel] = React.useState(true);
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ targets: string[] } | null>(null);
  const executeCommand = useCommandStore(state => state.executeCommand);
  
  const canvasRef = React.useRef<{ 
    setScale: (s: number | ((prev: number) => number)) => void; 
    centerCanvas: () => void;
    toggleGrid: () => void;
    toggleAnchors: () => void;
    getScale: () => number;
  } | null>(null);

  // 全局删除请求处理函数
  const handleDeleteRequest = React.useCallback((targets: string[]) => {
    if (targets.length > 0) {
      setDeleteConfirm({ targets });
    }
  }, []);

  // 确认删除
  const confirmDelete = React.useCallback(() => {
    if (!deleteConfirm) return;
    
    const { targets } = deleteConfirm;
    if (targets.length === 1) {
      executeCommand(new RemoveFrameCommand(targets[0]));
    } else {
      executeCommand(new BatchRemoveFrameCommand(targets));
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, executeCommand]);

  // 取消删除
  const cancelDelete = React.useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  // 注册全局快捷键
  useKeyboardShortcuts(
    currentFilePath,
    setCurrentFilePath,
    (scale) => canvasRef.current?.setScale(typeof scale === 'function' ? scale(1) : scale),
    () => canvasRef.current?.centerCanvas(),
    handleDeleteRequest // 传递删除请求处理函数
  );

  return (
    <div className="app">
      <MenuBar 
        currentFilePath={currentFilePath} 
        setCurrentFilePath={setCurrentFilePath}
        canvasRef={canvasRef}
        onToggleGrid={() => canvasRef.current?.toggleGrid()}
        onToggleAnchors={() => canvasRef.current?.toggleAnchors()}
        showProjectTree={showProjectTree}
        setShowProjectTree={setShowProjectTree}
        showPropertiesPanel={showPropertiesPanel}
        setShowPropertiesPanel={setShowPropertiesPanel}
        onDeleteRequest={handleDeleteRequest}
      />
      <Toolbar currentFilePath={currentFilePath} setCurrentFilePath={setCurrentFilePath} />
      <div className="app-content">
        {showProjectTree && <ProjectTree onClose={() => setShowProjectTree(false)} onDeleteRequest={handleDeleteRequest} />}
        <Canvas ref={canvasRef as any} />
        {showPropertiesPanel && <PropertiesPanel onClose={() => setShowPropertiesPanel(false)} />}
        <SidePanel />
      </div>

      {/* 全局删除确认框 */}
      {deleteConfirm && (
        <ConfirmDialog
          title="确认删除"
          message={`确定要删除 ${deleteConfirm.targets.length} 个控件吗？此操作可以撤销。`}
          confirmText="删除"
          cancelText="取消"
          type="danger"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
}

export default App;
