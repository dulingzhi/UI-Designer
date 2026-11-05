import React from 'react';
// 决策项 4：启动即解析系统用户名，消除热重载默认路径的个人硬编码回落
import { invoke } from '@tauri-apps/api/core';
import { isBrowserRuntime } from './utils/platformBridge';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { MenuBar } from './components/MenuBar';
import { ProjectTree } from './components/ProjectTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { StylePresetPanel } from './components/StylePresetPanel';
import { FrameGroupPanel } from './components/FrameGroupPanel';
import { HotReloadPanel } from './components/HotReloadPanel';
import { SidePanel } from './components/SidePanel';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DebugPanel } from './components/DebugPanel';
import { UpdateChecker } from './components/UpdateChecker';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAlert } from './hooks/useAlert';
import { useCommandStore } from './store/commandStore';
import { useProjectStore } from './store/projectStore';
import { useUIStore } from './store/uiStore';
import { RemoveFrameCommand, BatchRemoveFrameCommand } from './commands/FrameCommands';
import { mpqManager } from './utils/mpqManager';
import { war3ProcessManager } from './utils/war3ProcessManager';
import { ProjectProvider, useProjectContext } from './contexts/ProjectContext';
import './App.css';

function AppContent() {
  const { currentFilePath, setCurrentFilePath } = useProjectContext();
  const [showProjectTree, setShowProjectTree] = React.useState(true);
  const [showPropertiesPanel, setShowPropertiesPanel] = React.useState(true);
  const [showStylePresetPanel, setShowStylePresetPanel] = React.useState(false);
  const [showFrameGroupPanel, setShowFrameGroupPanel] = React.useState(false);
  const [showHotReloadPanel, setShowHotReloadPanel] = React.useState(false);
  const [showDebugPanel, setShowDebugPanel] = React.useState(true); // 状态栏默认显示
  const [deleteConfirm, setDeleteConfirm] = React.useState<{ targets: string[] } | null>(null);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = React.useState(false);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0, wc3X: 0, wc3Y: 0 });
  const [canvasScale, setCanvasScale] = React.useState(1);
  const { showAlert, AlertComponent } = useAlert();

  // 决策项 4：启动即填充 system_username（Tauri 环境；浏览器 dev 无 Tauri 静默跳过）。
  // HotReloadPanel 打开时 getDefaultHotReloadConfig() 已能读到正确用户名。
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const username = await invoke<string>('get_username');
        if (!cancelled && username && !localStorage.getItem('system_username')) {
          localStorage.setItem('system_username', username);
        }
      } catch {
        // 非 Tauri 环境（浏览器 dev/测试）无此命令——静默跳过
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const executeCommand = useCommandStore(state => state.executeCommand);
  const { project } = useProjectStore();
  const { selectedFrameId } = useUIStore();
  
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

  // 恢复偏好设置中的画布项（round 97：此前 preferences 的画布项保存后零消费）
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('preferences');
      if (!saved) return;
      const prefs = JSON.parse(saved);
      const ui = useUIStore.getState();
      if (typeof prefs.showGrid === 'boolean') ui.setShowGrid(prefs.showGrid);
      if (typeof prefs.snapToGrid === 'boolean') ui.setSnapToGrid(prefs.snapToGrid);
      if (typeof prefs.gridSize === 'number' && prefs.gridSize > 0) ui.setGridSize(prefs.gridSize);
    } catch (error) {
      console.error('[App] 恢复偏好设置失败:', error);
    }
  }, []);

  // 初始化 War3 进程管理器 - 恢复上次的进程监听
  React.useEffect(() => {
    const initProcessManager = async () => {
      try {
        await war3ProcessManager.restoreFromStorage();
      } catch (error) {
        console.error('[App] War3进程管理器初始化失败:', error);
      }
    };

    initProcessManager();
  }, []);

  // round 131：未保存修改防护——project 变化置 dirty（load/save/new 由 MenuBar 广播 project-state-reset 清除）。
  // beforeunload 在 dirty 时拦截关闭/刷新，防未保存修改静默丢失（编辑器经典缺口）。
  const firstProjectRef = React.useRef(true);
  React.useEffect(() => {
    if (firstProjectRef.current) { firstProjectRef.current = false; return; }
    useUIStore.getState().setDirty(true);
  }, [project]);
  React.useEffect(() => {
    const onReset = () => { useUIStore.getState().setDirty(false); };
    window.addEventListener('project-state-reset', onReset);
    return () => window.removeEventListener('project-state-reset', onReset);
  }, []);
  React.useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!useUIStore.getState().dirty) return;
      e.preventDefault();
      e.returnValue = ''; // Chrome 要求 returnValue 才弹原生确认
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
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

  // 视图面板快捷键 (Ctrl+3/4/5)
  React.useEffect(() => {
    const handleViewToggle = (e: KeyboardEvent) => {
      // 忽略在输入框中的按键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key) {
          case '1':
            e.preventDefault();
            setShowProjectTree(prev => !prev);
            break;
          case '2':
            e.preventDefault();
            setShowPropertiesPanel(prev => !prev);
            break;
          case '3':
            e.preventDefault();
            setShowStylePresetPanel(prev => !prev);
            break;
          case '4':
            e.preventDefault();
            setShowFrameGroupPanel(prev => !prev);
            break;
          case '5':
            e.preventDefault();
            setShowHotReloadPanel(prev => !prev);
            break;
          case '9':
            // 适应窗口（MenuBar 同款）
            e.preventDefault();
            canvasRef.current?.centerCanvas();
            break;
          case '/':
            // 快捷键帮助（F1 同款）
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('openShortcutHelp'));
            break;
        }
      }
    };

    window.addEventListener('keydown', handleViewToggle);
    return () => window.removeEventListener('keydown', handleViewToggle);
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
        showHotReloadPanel={showHotReloadPanel}
        setShowHotReloadPanel={setShowHotReloadPanel}
        showDebugPanel={showDebugPanel}
        setShowDebugPanel={setShowDebugPanel}
        onDeleteRequest={handleDeleteRequest}
      />
      <Toolbar currentFilePath={currentFilePath} setCurrentFilePath={setCurrentFilePath} />

      {/* 浏览器路径 B/A：无 Tauri 时明确提示能力边界，避免"点了没反应"的困惑。
          r255 起 MPQ 纹理库由 WASM 内核支持（用户在纹理浏览器中**选择 War3 安装目录**，
          自动载入其中的 MPQ），故不再列为不可用项。 */}
      {isBrowserRuntime() && (
        <div className="browser-mode-banner" role="status">
          🌐 浏览器模式：FDF 导入导出、可视化编辑、MPQ 纹理库可用（需在纹理浏览器中选择 War3 安装目录）；
          热重载、启动 War3、更新检查需桌面版（不可用项点击会提示）。
        </div>
      )}
      <div className={`app-content ${showDebugPanel ? '' : 'no-status-bar'}`}>
        {showProjectTree && <ProjectTree onClose={() => setShowProjectTree(false)} onDeleteRequest={handleDeleteRequest} />}
        <Canvas ref={canvasRef as any} />
        {showPropertiesPanel && <PropertiesPanel onClose={() => setShowPropertiesPanel(false)} />}
        {showStylePresetPanel && <StylePresetPanel onClose={() => setShowStylePresetPanel(false)} />}
        {showFrameGroupPanel && <FrameGroupPanel onClose={() => setShowFrameGroupPanel(false)} />}
        {showHotReloadPanel && <HotReloadPanel onClose={() => setShowHotReloadPanel(false)} />}
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
