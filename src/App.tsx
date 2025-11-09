import React from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { MenuBar } from './components/MenuBar';
import { ProjectTree } from './components/ProjectTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StylePresetPanel } from './components/StylePresetPanel';
import { FrameGroupPanel } from './components/FrameGroupPanel';
import { SidePanel } from './components/SidePanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DebugPanel } from './components/DebugPanel';
import { UpdateChecker } from './components/UpdateChecker';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAlert } from './hooks/useAlert';
import { useCommandStore } from './store/commandStore';
import { useProjectStore } from './store/projectStore';
import { RemoveFrameCommand, BatchRemoveFrameCommand } from './commands/FrameCommands';
import { mpqManager } from './utils/mpqManager';
import { ProjectProvider, useProjectContext } from './contexts/ProjectContext';
import './App.css';

function AppContent() {
  const { currentFilePath, setCurrentFilePath } = useProjectContext();
  const [showProjectTree, setShowProjectTree] = React.useState(true);
  const [showPropertiesPanel, setShowPropertiesPanel] = React.useState(true);
  const [showStylePresetPanel, setShowStylePresetPanel] = React.useState(false);
  const [showFrameGroupPanel, setShowFrameGroupPanel] = React.useState(false);
  const [showDebugPanel, setShowDebugPanel] = React.useState(true); // 状态栏默认显示
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ targets: string[] } | null>(null);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0, wc3X: 0, wc3Y: 0 });
  const [canvasScale, setCanvasScale] = React.useState(1);
  const { showAlert, AlertComponent } = useAlert();
  const executeCommand = useCommandStore(state => state.executeCommand);
  const { project, selectedFrameId } = useProjectStore();
  
  const canvasRef = React.useRef<{ 
    setScale: (s: number | ((prev: number) => number)) => void; 
    centerCanvas: () => void;
    toggleGrid: () => void;
    toggleAnchors: () => void;
    toggleRulers: () => void;
    getScale: () => number;
    getMousePosition: () => { x: number; y: number; wc3X: number; wc3Y: number };
  } | null>(null);

  // 初始化 MPQ 管理器 - 自动加载用户设置的 WC3 路径
  React.useEffect(() => {
    const initMPQ = async () => {
      const savedPath = localStorage.getItem('war3_install_path');
      if (savedPath) {
        console.log('[App] 自动加载 WC3 MPQ 档案:', savedPath);
        try {
          await mpqManager.setWar3Path(savedPath);
          console.log('[App] MPQ 档案加载完成');
        } catch (error) {
          console.error('[App] MPQ 档案加载失败:', error);
        }
      } else {
        console.log('[App] 未找到 WC3 安装路径,跳过 MPQ 加载');
      }
    };

    initMPQ();
  }, []);

  // 全局删除请求处理函数
  const handleDeleteRequest = React.useCallback((targets: string[]) => {
    if (targets.length > 0) {
      setDeleteConfirm({ targets });
    }
  }, []);

  // 全局新建项目请求处理函数
  const handleNewProjectRequest = React.useCallback(() => {
    setShowNewProjectConfirm(true);
  }, []);

  // 确认新建项目
  const confirmNewProject = React.useCallback(() => {
    setShowNewProjectConfirm(false);
    useProjectStore.getState().resetProject();
    setCurrentFilePath(null);
    console.log('✅ 新项目已创建');
  }, [setCurrentFilePath]);

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

  // Debug 面板快捷键 (Ctrl+Shift+D)
  React.useEffect(() => {
    const handleDebugToggle = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowDebugPanel(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleDebugToggle);
    return () => window.removeEventListener('keydown', handleDebugToggle);
  }, []);

  // 实时更新调试面板数据
  React.useEffect(() => {
    if (!showDebugPanel) return;

    const updateDebugInfo = () => {
      if (canvasRef.current?.getMousePosition) {
        const pos = canvasRef.current.getMousePosition();
        setMousePosition(pos);
      }
      if (canvasRef.current?.getScale) {
        setCanvasScale(canvasRef.current.getScale());
      }
    };

    // 使用 requestAnimationFrame 来实时更新
    let animationId: number;
    const animate = () => {
      updateDebugInfo();
      animationId = requestAnimationFrame(animate);
    };
    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [showDebugPanel]);

  // 注册全局快捷键
  useKeyboardShortcuts(
    currentFilePath,
    setCurrentFilePath,
    (scale) => canvasRef.current?.setScale(typeof scale === 'function' ? scale(1) : scale),
    () => canvasRef.current?.centerCanvas(),
    handleDeleteRequest, // 传递删除请求处理函数
    handleNewProjectRequest, // 传递新建项目请求处理函数
    showAlert // 传递 alert 显示函数
  );

  return (
    <div className="app">
      <MenuBar 
        currentFilePath={currentFilePath} 
        setCurrentFilePath={setCurrentFilePath}
        canvasRef={canvasRef}
        onToggleGrid={() => canvasRef.current?.toggleGrid()}
        onToggleAnchors={() => canvasRef.current?.toggleAnchors()}
        onToggleRulers={() => canvasRef.current?.toggleRulers()}
        showProjectTree={showProjectTree}
        setShowProjectTree={setShowProjectTree}
        showPropertiesPanel={showPropertiesPanel}
        setShowPropertiesPanel={setShowPropertiesPanel}
        showStylePresetPanel={showStylePresetPanel}
        setShowStylePresetPanel={setShowStylePresetPanel}
        showFrameGroupPanel={showFrameGroupPanel}
        setShowFrameGroupPanel={setShowFrameGroupPanel}
        showDebugPanel={showDebugPanel}
        setShowDebugPanel={setShowDebugPanel}
        onDeleteRequest={handleDeleteRequest}
      />
      <Toolbar currentFilePath={currentFilePath} setCurrentFilePath={setCurrentFilePath} />
      <div className={`app-content ${showDebugPanel ? '' : 'no-status-bar'}`}>
        {showProjectTree && <ProjectTree onClose={() => setShowProjectTree(false)} onDeleteRequest={handleDeleteRequest} />}
        <Canvas ref={canvasRef as any} />
        {showPropertiesPanel && <PropertiesPanel onClose={() => setShowPropertiesPanel(false)} />}
        {showStylePresetPanel && <StylePresetPanel onClose={() => setShowStylePresetPanel(false)} />}
        {showFrameGroupPanel && <FrameGroupPanel onClose={() => setShowFrameGroupPanel(false)} />}
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

      {showNewProjectConfirm && (
        <ConfirmDialog
          title="新建项目"
          message="创建新项目将丢失未保存的更改。是否继续？"
          confirmText="继续"
          cancelText="取消"
          type="warning"
          onConfirm={confirmNewProject}
          onCancel={() => setShowNewProjectConfirm(false)}
        />
      )}

      {/* Debug 面板 */}
      <DebugPanel
        mouseX={mousePosition.x}
        mouseY={mousePosition.y}
        mouseWc3X={mousePosition.wc3X}
        mouseWc3Y={mousePosition.wc3Y}
        selectedFrame={
          selectedFrameId && project.frames[selectedFrameId]
            ? {
                ...project.frames[selectedFrameId],
                type: String(project.frames[selectedFrameId].type),
              }
            : null
        }
        scale={canvasScale}
        isVisible={showDebugPanel}
      />

      {/* 更新检查器 */}
      <UpdateChecker checkOnMount={true} />

      {/* Alert 组件 */}
      {AlertComponent}
    </div>
  );
}

function App() {
  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

export default App;
