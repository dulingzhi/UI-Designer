import React from 'react';
import { Canvas } from './components/Canvas';
import { Toolbar } from './components/Toolbar';
import { MenuBar } from './components/MenuBar';
import { ProjectTree } from './components/ProjectTree';
import { PropertiesPanel } from './components/PropertiesPanel';
import { SidePanel } from './components/SidePanel';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import './App.css';

function App() {
  const [currentFilePath, setCurrentFilePath] = React.useState<string | null>(null);
  const [showProjectTree, setShowProjectTree] = React.useState(true);
  const [showPropertiesPanel, setShowPropertiesPanel] = React.useState(true);
  const canvasRef = React.useRef<{ 
    setScale: (s: number | ((prev: number) => number)) => void; 
    centerCanvas: () => void;
    toggleGrid: () => void;
    toggleAnchors: () => void;
    getScale: () => number;
  } | null>(null);

  // 注册全局快捷键
  useKeyboardShortcuts(
    currentFilePath,
    setCurrentFilePath,
    (scale) => canvasRef.current?.setScale(typeof scale === 'function' ? scale(1) : scale),
    () => canvasRef.current?.centerCanvas()
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
      />
      <Toolbar currentFilePath={currentFilePath} setCurrentFilePath={setCurrentFilePath} />
      <div className="app-content">
        {showProjectTree && <ProjectTree onClose={() => setShowProjectTree(false)} />}
        <Canvas ref={canvasRef as any} />
        {showPropertiesPanel && <PropertiesPanel onClose={() => setShowPropertiesPanel(false)} />}
        <SidePanel />
      </div>
    </div>
  );
}

export default App;
