import React, { forwardRef, useImperativeHandle } from 'react';
import ReactDOM from 'react-dom';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { useUIStore } from '../store/uiStore';
import { UpdateFrameCommand, RemoveFrameCommand, CopyFrameCommand, PasteFrameCommand, CopyStyleCommand, PasteStyleCommand } from '../commands/FrameCommands';
import { DuplicateFrameCommand } from '../commands/DuplicateFrameCommand';
import { FrameType, FrameData } from '../types';
import { ResizeHandles } from './ResizeHandles';
import { calculatePositionFromAnchors } from '../utils/anchorUtils';
import { AnchorVisualizer } from './AnchorVisualizer';
import { Ruler } from './Ruler';
import { GuideLine } from './GuideLine';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { MDXModelViewer } from './MDXModelViewer';
import { useProjectContext } from '../contexts/ProjectContext';
import { useCanvasPan } from '../hooks/useCanvasPan';
import { useCanvasDrag } from '../hooks/useCanvasDrag';
import { useCanvasResize } from '../hooks/useCanvasResize';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_MARGIN } from '../constants';
import { pixelToWc3X, pixelToWc3Y, wc3ToPixelX, wc3ToPixelYBottom, wc3ToPixelW, wc3ToPixelH } from '../utils/coordinateService';
import { SceneGraphManager } from '../renderer/SceneGraphManager';
import { ensureWar3FontLoaded, setFontResolverContext } from '../renderer/fontResolver';
import { hitTest } from '../renderer/hitTest';
import { hasLayerStyleFlag } from '../renderer/layerStyle';
import './Canvas.css';

// 保留旧名兼容: MARGIN -> CANVAS_MARGIN
const MARGIN = CANVAS_MARGIN;


export interface CanvasHandle {
  setScale: (scale: number | ((prev: number) => number)) => void;
  centerCanvas: () => void;
  toggleGrid: () => void;
  toggleAnchors: () => void;
  toggleRulers: () => void;
  getScale: () => number;
  getMousePosition: () => { x: number; y: number; wc3X: number; wc3Y: number };
}

export const Canvas = forwardRef<CanvasHandle>((_, ref) => {
  const { project, addGuide, updateGuide, removeGuide } = useProjectStore();
  const { selectedFrameId, selectedFrameIds, selectFrame, toggleSelectFrame, highlightedFrameIds,
    showGrid, setShowGrid, showAnchors, setShowAnchors, showRulers,
    snapToGrid, setSnapToGrid, gridSize, setGridSize } = useUIStore();
  const { executeCommand } = useCommandStore();
  const { projectDir } = useProjectContext(); // 获取项目目录
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const webglCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const sceneGraphRef = React.useRef<SceneGraphManager | null>(null);
  const [isWebGLReady, setIsWebGLReady] = React.useState(false);

  // ===== 显示控制状态 =====
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0, wc3X: 0, wc3Y: 0 });
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; frameId: string | null } | null>(null);

  // ===== 框选状态 =====
  const [isBoxSelecting, setIsBoxSelecting] = React.useState(false);
  const [boxSelectStart, setBoxSelectStart] = React.useState({ x: 0, y: 0 });
  const [boxSelectEnd, setBoxSelectEnd] = React.useState({ x: 0, y: 0 });

  // ===== 提取的 Hooks =====
  const {
    scale, setScale, offset, setOffset,
    isPanning, containerSize,
    startPan, updatePan, endPan,
  } = useCanvasPan({ canvasRef, containerRef, showRulers });

  const snapValue = (value: number, gs: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gs) * gs;
  };

  const {
    isDragging: isDraggingFrame,
    startDrag, updateDrag, endDrag,
  } = useCanvasDrag({ canvasRef, scale, offset, snapValue, snapToGrid, gridSize });

  const {
    isResizing,
    startResize: handleResizeStart, updateResize, endResize,
  } = useCanvasResize({ scale, snapValue, snapToGrid, gridSize });

  const getBuiltinTextureFallback = React.useCallback((key: string): string | undefined => {
    const race = project.currentRace || 'Human';
    const raceName = race === 'Default' ? 'Human' : race;
    const lowerRace = raceName.toLowerCase();

    const builtin: Record<string, string> = {
      EscMenuBorder: `UI\\Widgets\\EscMenu\\${raceName}\\${lowerRace}-options-menu-border.blp`,
      EscMenuBackground: `UI\\Widgets\\EscMenu\\${raceName}\\${lowerRace}-options-menu-background.blp`,
    };

    const relative = builtin[key];
    if (!relative) return undefined;

    if (!projectDir) {
      return relative;
    }

    const normalizedDir = projectDir.replace(/[\\/]+$/, '');
    const relForFs = relative.replace(/\//g, '\\');

    // 优先尝试当前工程目录中的 vendor（例如 ...\\target\\vendor\\UI\\...）
    const inProjectVendor = `${normalizedDir}\\vendor\\${relForFs}`;
    // 兼容项目目录在根目录时（例如 ...\\target\\vendor\\UI\\...）
    const inTargetVendor = `${normalizedDir}\\target\\vendor\\${relForFs}`;

    // 如果当前目录已是 target，第一条路径通常可用；否则走第二条。
    return /[\\/]target$/i.test(normalizedDir) ? inProjectVendor : inTargetVendor;
  }, [project.currentRace, projectDir]);
  
  // 辅助函数：将纹理键名解析为实际路径
  const resolveTexturePath = React.useCallback((textureValue: string | undefined): string | undefined => {
    if (!textureValue) return undefined;
    
    // 如果已经是路径（包含反斜杠或斜杠），直接使用
    if (textureValue.includes('\\') || textureValue.includes('/')) {
      return textureValue;
    }
    
    // 如果是键名且有 war3Skins 配置，尝试解析
    if (project.war3Skins && project.currentRace) {
      const raceConfig = project.war3Skins[project.currentRace];
      if (raceConfig && raceConfig[textureValue]) {
        return raceConfig[textureValue];
      }
      // 回退到默认配置
      const defaultConfig = project.war3Skins.Default;
      if (defaultConfig && defaultConfig[textureValue]) {
        return defaultConfig[textureValue];
      }
    }

    // war3Skins 未加载或缺失键名时，使用常见内置键名回退
    const fallback = getBuiltinTextureFallback(textureValue);
    if (fallback) {
      return fallback;
    }
    
    // 如果无法解析，返回原值
    return textureValue;
  }, [project.war3Skins, project.currentRace, getBuiltinTextureFallback]);

  const usedFontNames = React.useMemo(() => {
    const names = new Set<string>();
    for (const frame of Object.values(project.frames)) {
      if (frame.font) {
        names.add(frame.font);
      }
    }
    return Array.from(names).sort();
  }, [project.frames]);

  // ===== WebGL 渲染层 =====
  React.useEffect(() => {
    const canvas = webglCanvasRef.current;
    if (!canvas) return;

    let sg: SceneGraphManager | null = null;
    let cancelled = false;

    (async () => {
      try {
        const created = await SceneGraphManager.create(canvas, { resolveTexturePath });
        if (cancelled) {
          created.dispose();
          return;
        }
        sg = created;
        sceneGraphRef.current = sg;
        setIsWebGLReady(true);
      } catch (err) {
        console.error('[Canvas] 渲染器初始化失败:', err);
      }
    })();

    return () => {
      cancelled = true;
      setIsWebGLReady(false);
      sg?.dispose();
      sceneGraphRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    sceneGraphRef.current?.setResolveTexturePath(resolveTexturePath);
  }, [resolveTexturePath]);

  React.useEffect(() => {
    setFontResolverContext({
      projectDir: projectDir || undefined,
      war3Skins: project.war3Skins,
      race: project.currentRace,
    });

    if (!projectDir || !project.war3Skins || usedFontNames.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.all(usedFontNames.map((fontName) => ensureWar3FontLoaded(fontName)))
      .then((loaded) => {
        if (cancelled) return;
        if (!loaded.some(Boolean)) return;
        sceneGraphRef.current?.sync(project.frames, project.rootFrameIds);
      });

    return () => {
      cancelled = true;
    };
  }, [projectDir, project.war3Skins, project.currentRace, usedFontNames, project.frames, project.rootFrameIds]);

  React.useEffect(() => {
    const sg = sceneGraphRef.current;
    if (!sg) return;
    sg.sync(project.frames, project.rootFrameIds);
  }, [project.frames, project.rootFrameIds, resolveTexturePath]);

  // Button/Checkbox 预览态: uiStore.buttonPreviewState 变化时通知 SceneGraphManager
  // 重新解析多态 backdrop (controlPushedBackdrop / controlDisabledBackdrop / ...).
  const buttonPreviewState = useUIStore((s) => s.buttonPreviewState);
  React.useEffect(() => {
    sceneGraphRef.current?.setButtonPreviewState(buttonPreviewState);
  }, [buttonPreviewState, isWebGLReady]);


  // 处理从标尺创建参考线
  const handleCreateGuide = (orientation: 'horizontal' | 'vertical', clientX: number, clientY: number) => {
    // 获取canvas元素的位置
    if (!canvasRef.current) return;
    
    const canvasBounds = canvasRef.current.getBoundingClientRect();
    
    // 计算鼠标在canvas内的位置（考虑缩放和偏移）
    let position: number;
    
    if (orientation === 'horizontal') {
      // 水平参考线：计算相对于canvas顶部的Y坐标
      // clientY - canvasBounds.top 得到在缩放后的canvas中的位置
      // 除以scale得到实际的canvas坐标
      position = (clientY - canvasBounds.top) / scale;
    } else {
      // 垂直参考线：计算相对于画布左边缘的X坐标
      // 允许在整个画布范围内（0-1920），不限制在内容区域
      position = (clientX - canvasBounds.left) / scale;
    }
    
    // 确保位置有效（在画布范围内）
    if (position < 0) return;
    if (orientation === 'vertical' && position > CANVAS_WIDTH) return;
    if (orientation === 'horizontal' && position > CANVAS_HEIGHT) return;
    
    const guideId = `guide-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    addGuide({
      id: guideId,
      orientation,
      position,
      color: '#00aaff',
    });
  };

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    setScale: (newScale: number | ((prev: number) => number)) => {
      if (typeof newScale === 'function') {
        setScale(prev => newScale(prev));
      } else {
        setScale(newScale);
      }
    },
    centerCanvas: () => {
      setOffset({ x: 0, y: 0 });
      setScale(1);
    },
    toggleGrid: () => { const s = useUIStore.getState(); s.setShowGrid(!s.showGrid); },
    toggleAnchors: () => { const s = useUIStore.getState(); s.setShowAnchors(!s.showAnchors); },
    toggleRulers: () => { const s = useUIStore.getState(); s.setShowRulers(!s.showRulers); },
    getScale: () => scale,
    getMousePosition: () => mousePosition,
  }));

  // 处理画布拖拽（平移）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.altKey || e.button === 1) { // Alt键或中键拖拽画布
      startPan(e);
      e.preventDefault();
    } else if (e.shiftKey && e.button === 0) {
      // Shift+左键：开始框选
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;
      
      // 存储相对于画布容器的坐标（getBoundingClientRect 已包含 transform 位移，无需再减 offset）
      const relativeX = (e.clientX - canvasBounds.left) / scale;
      const relativeY = (e.clientY - canvasBounds.top) / scale;
      
      setIsBoxSelecting(true);
      setBoxSelectStart({ x: relativeX, y: relativeY });
      setBoxSelectEnd({ x: relativeX, y: relativeY });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 更新鼠标坐标（用于调试面板）
    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (canvasBounds) {
      const mouseX = (e.clientX - canvasBounds.left) / scale;
      const mouseY = (canvasBounds.bottom - e.clientY) / scale;
      const mouseWc3X = pixelToWc3X(mouseX);
      const mouseWc3Y = pixelToWc3Y(mouseY);
      
      setMousePosition({
        x: e.clientX,
        y: e.clientY,
        wc3X: mouseWc3X,
        wc3Y: mouseWc3Y
      });
    }

    if (isPanning) {
      updatePan(e);
    } else if (isBoxSelecting) {
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;
      const relativeX = (e.clientX - canvasBounds.left) / scale;
      const relativeY = (e.clientY - canvasBounds.top) / scale;
      setBoxSelectEnd({ x: relativeX, y: relativeY });
    } else if (isDraggingFrame) {
      updateDrag(e);
    } else if (isResizing) {
      updateResize(e);
    }
  };

  const handleMouseUp = () => {
    // 拖拽结束
    if (isDraggingFrame) {
      endDrag();
    }

    // 调整大小结束
    if (isResizing) {
      endResize();
    }

    // 框选结束时，选中框内的所有控件
    if (isBoxSelecting) {
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (canvasBounds) {
        // 计算选择框的边界（已经是除以scale的坐标）
        const boxLeft = Math.min(boxSelectStart.x, boxSelectEnd.x);
        const boxRight = Math.max(boxSelectStart.x, boxSelectEnd.x);
        const boxTop = Math.min(boxSelectStart.y, boxSelectEnd.y);
        const boxBottom = Math.max(boxSelectStart.y, boxSelectEnd.y);

        // 检查每个控件是否在选择框内
        const selectedIds: string[] = [];
        Object.values(project.frames).forEach(frame => {
          // 计算控件在画布上的位置（像素坐标，不考虑缩放）
          const calculatedPos = calculatePositionFromAnchors(frame, project.frames);
          const actualFrame = calculatedPos ? { ...frame, ...calculatedPos } : frame;
          
          const frameLeft = wc3ToPixelX(actualFrame.x);
          const frameBottom = wc3ToPixelYBottom(actualFrame.y);
          const frameWidth = wc3ToPixelW(actualFrame.width);
          const frameHeight = wc3ToPixelH(actualFrame.height);
          
          // 转换为从顶部计算的Y坐标（与框选坐标系一致）
          const frameTop = CANVAS_HEIGHT - (frameBottom + frameHeight);
          const frameRight = frameLeft + frameWidth;
          const frameBottomY = frameTop + frameHeight;

          // 判断控件是否与选择框相交（都是未缩放的画布坐标）
          if (frameRight >= boxLeft && frameLeft <= boxRight &&
              frameBottomY >= boxTop && frameTop <= boxBottom) {
            selectedIds.push(frame.id);
          }
        });

        // 更新选中的控件
        if (selectedIds.length > 0) {
          useUIStore.getState().selectMultipleFrames(selectedIds);
        }
      }
      setIsBoxSelecting(false);
    }

    endPan();
  };

  // 右键菜单处理
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // 优先用 WebGL hitTest 查找命中的帧
    let frameId: string | null = null;
    if (isWebGLReady && sceneGraphRef.current) {
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (canvasBounds) {
        const mouseX = (e.clientX - canvasBounds.left) / scale;
        const mouseY = (e.clientY - canvasBounds.top) / scale;
        frameId = hitTest(
          mouseX,
          mouseY,
          sceneGraphRef.current.scene,
          sceneGraphRef.current.camera,
          (id) => hasLayerStyleFlag(project.frames[id]?.layerStyle, 'IGNORETRACKEVENTS'),
        );
      }
    }
    // 回退：命中选中/锁定/MODEL 帧的 DOM 叠加层
    if (!frameId) {
      const target = e.target as HTMLElement;
      const frameElement = target.closest('.canvas-frame');
      if (frameElement) frameId = frameElement.getAttribute('data-frame-id');
    }

    // 如果点击在Frame上且该Frame未选中，则选中它
    if (frameId && frameId !== selectedFrameId) {
      selectFrame(frameId);
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      frameId: frameId
    });
  };

  // 构建右键菜单项
  const buildContextMenuItems = (frameId: string | null): ContextMenuItem[] => {
    if (frameId) {
      const frame = project.frames[frameId];
      if (!frame) return [];

      return [
        {
          label: '复制',
          shortcut: 'Ctrl+C',
          action: () => executeCommand(new CopyFrameCommand(frameId))
        },
        {
          label: '粘贴',
          shortcut: 'Ctrl+V',
          action: () => executeCommand(new PasteFrameCommand(0.02, 0.02)),
          disabled: !useUIStore.getState().clipboard
        },
        {
          label: '复制控件',
          shortcut: 'Ctrl+D',
          action: () => executeCommand(new DuplicateFrameCommand(frameId))
        },
        { separator: true },
        {
          label: '复制样式',
          shortcut: 'Ctrl+Shift+C',
          action: () => executeCommand(new CopyStyleCommand(frameId))
        },
        {
          label: '粘贴样式',
          shortcut: 'Ctrl+Shift+V',
          action: () => {
            const ids = useUIStore.getState().selectedFrameIds;
            executeCommand(new PasteStyleCommand(ids.length > 0 ? ids : [frameId]));
          },
          disabled: !useUIStore.getState().styleClipboard
        },
        { separator: true },
        {
          label: frame.locked ? '解锁' : '锁定',
          action: () => executeCommand(new UpdateFrameCommand(frameId, { locked: !frame.locked }))
        },
        { separator: true },
        {
          label: '删除',
          shortcut: 'Del',
          action: () => executeCommand(new RemoveFrameCommand(frameId))
        }
      ];
    } else {
      // 画布右键菜单
      return [
        {
          label: '粘贴',
          shortcut: 'Ctrl+V',
          action: () => executeCommand(new PasteFrameCommand(0.02, 0.02)),
          disabled: !useUIStore.getState().clipboard
        },
        { separator: true },
        {
          label: '显示网格',
          action: () => setShowGrid(!showGrid)
        },
        {
          label: '显示锚点',
          action: () => setShowAnchors(!showAnchors)
        },
        {
          label: '网格吸附',
          action: () => setSnapToGrid(!snapToGrid)
        }
      ];
    }
  };

  // Frame 的鼠标按下事件
  const handleFrameMouseDown = (e: React.MouseEvent, frameId: string) => {
    if (!e.altKey && e.button === 0) { // 左键且不按Alt键
      e.stopPropagation();
      
      const frame = project.frames[frameId];
      if (!frame) return;

      // 检查控件或其父控件是否锁定
      if (isFrameOrParentLocked(frameId)) {
        return;
      }

      // 检查是否有多个锚点 - 如果有则不允许拖动
      const anchorCount = Object.keys(frame.anchors || {}).length;
      if (anchorCount > 1) {
        selectFrame(frameId);
        return;
      }

      startDrag(e, frameId);
      selectFrame(frameId);
    }
  };

  // 开始调整 Frame 大小（包含锁定检查）
  const handleResizeStartWithLockCheck = (frameId: string) => {
    return (e: React.MouseEvent, direction: import('./ResizeHandles').ResizeDirection) => {
      if (isFrameOrParentLocked(frameId)) return;
      handleResizeStart(frameId)(e, direction);
    };
  };

  // 检查控件或其任何父控件是否被锁定
  const isFrameOrParentLocked = (frameId: string): boolean => {
    let currentId: string | null | undefined = frameId;
    while (currentId) {
      const currentFrame: FrameData | undefined = project.frames[currentId];
      if (!currentFrame) break;
      if (currentFrame.locked) return true;
      currentId = currentFrame.parentId;
    }
    return false;
  };

  // 检查控件或其任何父控件是否被隐藏
  const isFrameOrParentHidden = (frameId: string): boolean => {
    let currentId: string | null | undefined = frameId;
    while (currentId) {
      const currentFrame: FrameData | undefined = project.frames[currentId];
      if (!currentFrame) break;
      if (currentFrame.visible === false) return true;
      currentId = currentFrame.parentId;
    }
    return false;
  };

  // 计算帧的像素矩形（考虑锚点）
  const computeFramePixelRect = (frameId: string) => {
    const frame = project.frames[frameId];
    if (!frame) return null;
    const calculatedPos = calculatePositionFromAnchors(frame, project.frames);
    const actualFrame = calculatedPos ? { ...frame, ...calculatedPos } : frame;
    return {
      frame,
      left: wc3ToPixelX(actualFrame.x),
      bottom: wc3ToPixelYBottom(actualFrame.y),
      width: wc3ToPixelW(actualFrame.width),
      height: wc3ToPixelH(actualFrame.height),
    };
  };

  /**
   * 渲染帧的 DOM 叠加层（仅为需要交互/视觉反馈的帧生成 DOM）
   * 覆盖场景：选中边框 / 高亮边框 / 锁定边框 + 🔒 / ResizeHandles / ModelViewer
   * 普通未选中的帧完全由 WebGL 渲染，不再产生 DOM 节点
   */
  const renderFrameOverlay = (frameId: string) => {
    const frame = project.frames[frameId];
    if (!frame) return null;
    if (isFrameOrParentHidden(frameId)) return null;

    const isSelected = selectedFrameIds.includes(frameId);
    const isHighlighted = highlightedFrameIds.includes(frameId);
    const isLockedOrParentLocked = isFrameOrParentLocked(frameId);
    const isModel = frame.type === FrameType.MODEL;

    // 仅在以下情况需要渲染 DOM 叠加：选中/高亮/锁定/MODEL(独立 WebGL)
    const needsOverlay = isSelected || isHighlighted || isLockedOrParentLocked || isModel;
    if (!needsOverlay) return null;

    const rect = computeFramePixelRect(frameId);
    if (!rect) return null;
    const { left, bottom, width, height } = rect;

    const containerStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${left}px`,
      bottom: `${bottom}px`,
      width: `${width}px`,
      height: `${height}px`,
      zIndex: (frame.z || 0) + 1,
      pointerEvents: 'none', // 所有鼠标事件由根画布 hitTest 处理
      opacity: isLockedOrParentLocked ? 0.7 : 1,
    };

    // 边框样式（仅在选中/高亮/锁定时显示）
    const showBorder = isSelected || isHighlighted || isLockedOrParentLocked;
    const borderStyle: React.CSSProperties | undefined = showBorder ? {
      position: 'absolute',
      inset: 0,
      border: isLockedOrParentLocked
        ? '2px dashed #888888'
        : isSelected
          ? '2px solid #f22613'
          : '2px solid #00aaff',
      boxSizing: 'border-box',
      pointerEvents: 'none',
      boxShadow: isHighlighted && !isSelected ? '0 0 10px rgba(0, 170, 255, 0.5)' : undefined,
    } : undefined;

    return (
      <div
        key={frameId}
        className="canvas-frame"
        data-frame-id={frameId}
        style={containerStyle}
        title={frame.name}
      >
        {borderStyle && <div style={borderStyle} />}

        {/* MODEL: 3D 模型独立 WebGPU/WebGL 上下文，无法合入主 scene */}
        {isModel && frame.backgroundArt && (
          <MDXModelViewer
            modelPath={frame.backgroundArt}
            projectDir={projectDir || undefined}
            width={Math.round(width)}
            height={Math.round(height)}
            cameraYaw={frame.cameraYaw}
            cameraPitch={frame.cameraPitch}
            cameraDistance={frame.cameraDistance}
            onCameraChange={(params) => {
              executeCommand(new UpdateFrameCommand(frameId, {
                cameraYaw: params.yaw,
                cameraPitch: params.pitch,
                cameraDistance: params.distance,
              }));
            }}
          />
        )}

        {/* 锁定图标 */}
        {isLockedOrParentLocked && (
          <div style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#888888',
            padding: '2px 4px',
            fontSize: '12px',
            borderRadius: '2px',
            pointerEvents: 'none',
          }}>
            🔒
          </div>
        )}

        {/* ResizeHandles: 启用 pointer-events 接收手柄点击 */}
        {isSelected && !isLockedOrParentLocked && (
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>
            <ResizeHandles
              isSelected={true}
              onResizeStart={handleResizeStartWithLockCheck(frameId)}
            />
          </div>
        )}
      </div>
    );
  };

  // 递归获取所有需要渲染的控件ID（包括子控件）
  const getAllFrameIds = (frameIds: string[]): string[] => {
    const result: string[] = [];
    
    const traverse = (id: string) => {
      result.push(id);
      const frame = project.frames[id];
      if (frame && frame.children) {
        frame.children.forEach(childId => traverse(childId));
      }
    };
    
    frameIds.forEach(id => traverse(id));
    return result;
  };

  return (
    <div 
      ref={containerRef}
      className="canvas-container"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      style={{
        paddingLeft: showRulers ? '30px' : '0',
        paddingTop: showRulers ? '30px' : '0',
      }}
    >
      {/* 标尺角落 */}
      {showRulers && (
        <div className="ruler-corner">📐</div>
      )}

      {/* 水平标尺 */}
      {showRulers && containerSize.width > 0 && (
        <Ruler
          orientation="horizontal"
          length={containerSize.width}
          scale={scale}
          offset={offset.x}
          onCreateGuide={handleCreateGuide}
        />
      )}

      {/* 垂直标尺 */}
      {showRulers && containerSize.height > 0 && (
        <Ruler
          orientation="vertical"
          length={containerSize.height}
          scale={scale}
          offset={offset.y}
          onCreateGuide={handleCreateGuide}
        />
      )}

      <div
        className="canvas-wrapper"
        style={{
          transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
        }}
      >
        <div 
          ref={canvasRef}
          className="canvas"
          style={{
            width: `${CANVAS_WIDTH}px`,
            height: `${CANVAS_HEIGHT}px`,
            position: 'relative',
            backgroundImage: project.backgroundImage 
              ? `url(${project.backgroundImage})` 
              : 'linear-gradient(45deg, #1a1a1a 25%, #2a2a2a 25%, #2a2a2a 50%, #1a1a1a 50%, #1a1a1a 75%, #2a2a2a 75%, #2a2a2a)',
            backgroundSize: project.backgroundImage ? 'cover' : '20px 20px',
            backgroundColor: '#1a1a1a',
          }}
          onMouseDown={(e) => {
            // 左键：先用 WebGL hitTest 查找被点击的帧
            if (e.button === 0) {
              const canvasBounds = canvasRef.current?.getBoundingClientRect();
              const sg = sceneGraphRef.current;
              let frameId: string | null = null;
              if (canvasBounds && sg) {
                const mouseX = (e.clientX - canvasBounds.left) / scale;
                const mouseY = (e.clientY - canvasBounds.top) / scale;
                frameId = hitTest(
                  mouseX,
                  mouseY,
                  sg.scene,
                  sg.camera,
                  (id) => hasLayerStyleFlag(project.frames[id]?.layerStyle, 'IGNORETRACKEVENTS'),
                );
              }

              if (frameId) {
                // 命中某帧 —— 处理选择 + 拖拽
                e.stopPropagation();
                if (e.ctrlKey || e.metaKey) {
                  toggleSelectFrame(frameId);
                  return;
                }
                selectFrame(frameId);
                handleFrameMouseDown(e, frameId);
                return;
              }

              // 未命中：空白区域点击 → 清空选择（Ctrl/Shift 除外，由其他 handler 处理框选/平移）
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                selectFrame(null);
              }
            }
          }}
          onClick={() => {
            // onClick 不再处理选择逻辑，避免事件顺序问题
          }}
        >
          {/* 渲染4:3区域边界 */}
          <div 
            style={{
              position: 'absolute',
              left: `${MARGIN}px`,
              right: `${MARGIN}px`,
              top: 0,
              bottom: 0,
              border: '2px solid rgba(0, 255, 0, 0.5)',
              pointerEvents: 'none',
            }}
          />

          {/* WebGL 渲染层 — 位于画布背景之上、DOM 帧之下（DOM 帧背景透明，透见此层纹理） */}
          <canvas
            ref={webglCanvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* 网格线 */}
          {showGrid && (
            <svg
              style={{
                position: 'absolute',
                left: `${MARGIN}px`,
                top: 0,
                width: `${CANVAS_WIDTH - 2 * MARGIN}px`,
                height: `${CANVAS_HEIGHT}px`,
                pointerEvents: 'none',
              }}
            >
              {/* 垂直网格线 - 每0.05单位（相当于画布宽度的6.25%） */}
              {Array.from({ length: 16 }, (_, i) => i + 1).map(i => {
                const x = wc3ToPixelW(i * 0.05);
                return (
                  <line
                    key={`v-${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={CANVAS_HEIGHT}
                    stroke="rgba(150, 150, 150, 0.5)"
                    strokeWidth={i % 2 === 0 ? 1.5 : 0.8}
                  />
                );
              })}
              {/* 水平网格线 - 每0.05单位 */}
              {Array.from({ length: 12 }, (_, i) => i + 1).map(i => {
                const y = CANVAS_HEIGHT - wc3ToPixelH(i * 0.05);
                return (
                  <line
                    key={`h-${i}`}
                    x1={0}
                    y1={y}
                    x2={CANVAS_WIDTH - 2 * MARGIN}
                    y2={y}
                    stroke="rgba(150, 150, 150, 0.5)"
                    strokeWidth={i % 2 === 0 ? 1.5 : 0.8}
                  />
                );
              })}
              {/* 中心十字线 */}
              <line
                x1={wc3ToPixelW(0.4)}
                y1={0}
                x2={wc3ToPixelW(0.4)}
                y2={CANVAS_HEIGHT}
                stroke="rgba(0, 255, 0, 0.4)"
                strokeWidth={1}
                strokeDasharray="5,5"
              />
              <line
                x1={0}
                y1={CANVAS_HEIGHT - wc3ToPixelH(0.3)}
                x2={CANVAS_WIDTH - 2 * MARGIN}
                y2={CANVAS_HEIGHT - wc3ToPixelH(0.3)}
                stroke="rgba(0, 255, 0, 0.4)"
                strokeWidth={1}
                strokeDasharray="5,5"
              />
            </svg>
          )}
          
          {/* 渲染需要 DOM 叠加的 Frame（选中/高亮/锁定/MODEL）。
              普通 Frame 全部由 WebGL 层直接渲染，无 DOM 节点。 */}
          {getAllFrameIds(project.rootFrameIds).map(frameId => renderFrameOverlay(frameId))}
          
          {/* 锚点可视化 - 在canvas内部，跟随缩放变换 */}
          {showAnchors && (
            <AnchorVisualizer
              frames={project.frames}
              selectedFrameId={selectedFrameId}
              canvasWidth={CANVAS_WIDTH}
              canvasHeight={CANVAS_HEIGHT}
              margin={MARGIN}
            />
          )}
          
          {/* 参考线 - 在canvas内部，跟随缩放变换 */}
          {project.guides && project.guides.length > 0 && (
            <div className="guide-lines-container">
              {project.guides.map(guide => (
                <GuideLine
                  key={guide.id}
                  guide={guide}
                  scale={scale}
                  panX={offset.x}
                  panY={offset.y}
                  canvasWidth={CANVAS_WIDTH}
                  canvasHeight={CANVAS_HEIGHT}
                  onUpdate={updateGuide}
                  onRemove={removeGuide}
                />
              ))}
            </div>
          )}
          
          {/* 框选矩形 */}
          {isBoxSelecting && (
            <div
              style={{
                position: 'absolute',
                left: `${Math.min(boxSelectStart.x, boxSelectEnd.x)}px`,
                top: `${Math.min(boxSelectStart.y, boxSelectEnd.y)}px`,
                width: `${Math.abs(boxSelectEnd.x - boxSelectStart.x)}px`,
                height: `${Math.abs(boxSelectEnd.y - boxSelectStart.y)}px`,
                border: '2px dashed #00e640',
                backgroundColor: 'rgba(0, 230, 64, 0.1)',
                pointerEvents: 'none',
                zIndex: 10000,
              }}
            />
          )}
        </div>
      </div>

      {/* 缩放控制 */}
      <div className="canvas-controls">
        <button onClick={() => setScale(prev => Math.min(5, prev * 1.2))}>+</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(prev => Math.max(0.1, prev * 0.8))}>-</button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>重置</button>
        <button 
          onClick={() => setShowGrid(!showGrid)}
          style={{ marginLeft: '10px', backgroundColor: showGrid ? '#4CAF50' : undefined }}
          title="切换网格显示"
        >
          {showGrid ? '🟩' : '⬜'} 网格
        </button>
        <button 
          onClick={() => setShowAnchors(!showAnchors)}
          style={{ marginLeft: '10px', backgroundColor: showAnchors ? '#4CAF50' : undefined }}
          title="切换锚点显示"
        >
          {showAnchors ? '🔗' : '⛓️'} 锚点
        </button>
        <button 
          onClick={() => setSnapToGrid(!snapToGrid)}
          style={{ marginLeft: '10px', backgroundColor: snapToGrid ? '#4CAF50' : undefined }}
          title="切换网格吸附"
        >
          {snapToGrid ? '🧲' : '📍'} 吸附
        </button>
        <select
          value={buttonPreviewState}
          onChange={(e) => useUIStore.getState().setButtonPreviewState(e.target.value as any)}
          style={{ marginLeft: '10px' }}
          title="按钮/复选框预览态 — 切换显示 Normal / Pushed / Disabled / Mouseover 的 Backdrop 与文字"
        >
          <option value="normal">🔘 Normal</option>
          <option value="pushed">⏬ Pushed</option>
          <option value="disabled">🚫 Disabled</option>
          <option value="mouseover">🖱️ Hover</option>
        </select>
        <select
          value={gridSize}
          onChange={(e) => setGridSize(Number(e.target.value))}
          style={{ marginLeft: '5px' }}
          title="网格大小"
        >
          <option value={0.005}>0.005</option>
          <option value={0.01}>0.01</option>
          <option value={0.02}>0.02</option>
          <option value={0.05}>0.05</option>
        </select>
      </div>

      {/* 右键菜单 - 使用 Portal 渲染到 body */}
      {contextMenu && ReactDOM.createPortal(
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems(contextMenu.frameId)}
          onClose={() => setContextMenu(null)}
        />,
        document.body
      )}
    </div>
  );
});
