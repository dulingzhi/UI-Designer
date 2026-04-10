import React, { forwardRef, useImperativeHandle, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { useUIStore } from '../store/uiStore';
import { UpdateFrameCommand, RemoveFrameCommand, CopyFrameCommand, PasteFrameCommand } from '../commands/FrameCommands';
import { DuplicateFrameCommand } from '../commands/DuplicateFrameCommand';
import { FrameType, FrameData } from '../types';
import { ResizeHandles } from './ResizeHandles';
import { calculatePositionFromAnchors } from '../utils/anchorUtils';
import { AnchorVisualizer } from './AnchorVisualizer';
import { Ruler } from './Ruler';
import { GuideLine } from './GuideLine';
import { ContextMenu, ContextMenuItem } from './ContextMenu';
import { BackdropEdge } from './BackdropEdge';
import { useTextureLoaderBatch } from '../hooks/useTextureLoader';
import { ModelViewer } from './ModelViewer';
import { useProjectContext } from '../contexts/ProjectContext';
import { useCanvasPan } from '../hooks/useCanvasPan';
import { useCanvasDrag } from '../hooks/useCanvasDrag';
import { useCanvasResize } from '../hooks/useCanvasResize';
import { CANVAS_WIDTH, CANVAS_HEIGHT, CANVAS_MARGIN, WC3_MAX_X, WC3_MAX_Y } from '../constants';
import { pixelToWc3X, pixelToWc3Y, wc3ToPixelX, wc3ToPixelYBottom, wc3ToPixelW, wc3ToPixelH } from '../utils/coordinateService';
import './Canvas.css';

// 保留旧名兼容: MARGIN -> CANVAS_MARGIN
const MARGIN = CANVAS_MARGIN;

// BackdropBackground 内部组件 - 避免 IIFE 导致的渲染问题
const BackdropBackground: React.FC<{
  frame: FrameData;
  textureMap: Map<string, any>;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  margin: number;
  resolveTexturePath: (path: string | undefined) => string | undefined;
}> = ({ frame, textureMap, isSelected, canvasWidth, canvasHeight, margin, resolveTexturePath }) => {

  const leftInset = frame.backdropBackgroundInsets 
    ? (frame.backdropBackgroundInsets[0] / WC3_MAX_X) * (canvasWidth - 2 * margin)
    : 0;
  const topInset = frame.backdropBackgroundInsets 
    ? (frame.backdropBackgroundInsets[1] / WC3_MAX_Y) * canvasHeight
    : 0;
  const rightInset = frame.backdropBackgroundInsets 
    ? (frame.backdropBackgroundInsets[2] / WC3_MAX_X) * (canvasWidth - 2 * margin)
    : 0;
  const bottomInset = frame.backdropBackgroundInsets 
    ? (frame.backdropBackgroundInsets[3] / WC3_MAX_Y) * canvasHeight
    : 0;
  
  const resolvedBackdropPath = resolveTexturePath(frame.backdropBackground);
  const textureState = resolvedBackdropPath ? textureMap.get(resolvedBackdropPath) : undefined;
  const bgImage = textureState?.url ? `url(${textureState.url})` : undefined;
  
  return (
    <div
      style={{
        position: 'absolute',
        left: leftInset,
        top: topInset,
        right: rightInset,
        bottom: bottomInset,
        backgroundImage: bgImage,
        backgroundSize: frame.backdropTileBackground 
          ? (frame.backdropBackgroundSize 
              ? `${(frame.backdropBackgroundSize / WC3_MAX_X) * (canvasWidth - 2 * margin)}px` 
              : 'auto')
          : 'cover',
        backgroundRepeat: frame.backdropTileBackground ? 'repeat' : 'no-repeat',
        backgroundPosition: 'center center',
        pointerEvents: 'none',
        // 临时：添加边框以便调试
        border: isSelected ? '2px dashed red' : undefined,
      }}
    />
  );
};

// 辅助函数：将RGBA数组转换为CSS颜色字符串
const rgbaToCSS = (rgba: [number, number, number, number] | undefined): string | undefined => {
  if (!rgba) return undefined;
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
};

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
  const { selectedFrameId, selectFrame, toggleSelectFrame, highlightedFrameIds } = useUIStore();
  const { executeCommand } = useCommandStore();
  const { projectDir } = useProjectContext(); // 获取项目目录
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // ===== 显示控制状态 =====
  const [showGrid, setShowGrid] = React.useState(true);
  const [showAnchors, setShowAnchors] = React.useState(false);
  const [showRulers, setShowRulers] = React.useState(true);
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0, wc3X: 0, wc3Y: 0 });
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; frameId: string | null } | null>(null);
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [gridSize, setGridSize] = React.useState(0.01);

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
    
    // 如果无法解析，返回原值
    return textureValue;
  }, [project.war3Skins, project.currentRace]);
  
  // 收集所有需要加载的纹理路径
  const texturePaths = useMemo(() => {
    const paths: string[] = [];
    
    Object.values(project.frames).forEach(frame => {
      const resolvedTexture = resolveTexturePath(frame.texture);
      if (resolvedTexture) {
        paths.push(resolvedTexture);
      }
      // 添加 Backdrop 背景纹理路径
      const resolvedBackdrop = resolveTexturePath(frame.backdropBackground);
      if (resolvedBackdrop) {
        paths.push(resolvedBackdrop);
      }
      // 添加边框纹理路径
      const resolvedEdge = resolveTexturePath(frame.backdropEdgeFile);
      if (resolvedEdge) {
        paths.push(resolvedEdge);
      }
    });
    return paths;
  }, [project.frames, resolveTexturePath, project.currentRace]);
  
  // 批量加载纹理
  const textureMap = useTextureLoaderBatch(texturePaths);

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
    toggleGrid: () => setShowGrid(prev => !prev),
    toggleAnchors: () => setShowAnchors(prev => !prev),
    toggleRulers: () => setShowRulers(prev => !prev),
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
      
      // 存储相对于画布容器的坐标（考虑缩放和偏移）
      const relativeX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
      const relativeY = (e.clientY - canvasBounds.top - offset.y * scale) / scale;
      
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
      const mouseX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
      const mouseY = (canvasBounds.bottom - e.clientY + offset.y * scale) / scale;
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
      const relativeX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
      const relativeY = (e.clientY - canvasBounds.top - offset.y * scale) / scale;
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
    
    // 检查是否点击在某个Frame上
    const target = e.target as HTMLElement;
    const frameElement = target.closest('.canvas-frame');
    
    let frameId: string | null = null;
    
    if (frameElement) {
      // 通过 data-frame-id 属性获取 frameId
      frameId = frameElement.getAttribute('data-frame-id');
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

  // 渲染单个Frame
  const renderFrame = (frameId: string) => {
    const frame = project.frames[frameId];
    if (!frame) return null;

    // 如果控件或其任何父控件被隐藏，不渲染
    if (isFrameOrParentHidden(frameId)) return null;

    const isSelected = useUIStore.getState().selectedFrameIds.includes(frameId);
    const isHighlighted = highlightedFrameIds.includes(frameId);
    
    // 检查是否使用相对锚点，如果是则重新计算位置
    const calculatedPos = calculatePositionFromAnchors(frame, project.frames);
    const actualFrame = calculatedPos 
      ? { ...frame, ...calculatedPos }
      : frame;
    
    // 计算实际位置（从底部左侧开始）
    const left = wc3ToPixelX(actualFrame.x);
    const bottom = wc3ToPixelYBottom(actualFrame.y);
    const width = wc3ToPixelW(actualFrame.width);
    const height = wc3ToPixelH(actualFrame.height);

    // 检查控件或父控件是否锁定
    const isLockedOrParentLocked = isFrameOrParentLocked(frameId);

    // 外层容器样式（定位和基础属性，不包含边框）
    const containerStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${left}px`,
      bottom: `${bottom}px`,
      width: `${width}px`,
      height: `${height}px`,
      cursor: isLockedOrParentLocked ? 'not-allowed' : 'pointer',
      zIndex: frame.z,
      pointerEvents: 'auto',
      opacity: (isLockedOrParentLocked ? 0.7 : 1) * (frame.alpha ?? 1),
    };

    // 使用 texture 字段，解析纹理键名为实际路径
    const texturePath = resolveTexturePath(frame.texture);
    let backgroundImage: string | undefined = undefined;
    
    if (texturePath && typeof texturePath === 'string') {
      // 如果纹理已加载,使用加载后的URL
      const textureState = textureMap.get(texturePath);
      if (textureState && textureState.url) {
        backgroundImage = `url(${textureState.url})`;
      } else if (texturePath.startsWith('data:') || texturePath.startsWith('http://') || texturePath.startsWith('https://')) {
        // 如果是Data URL或HTTP URL,直接使用
        backgroundImage = `url(${texturePath})`;
      }
    }

    // 内层内容样式
    const contentStyle: React.CSSProperties = {
      position: 'relative',
      width: '100%',
      height: '100%',
      backgroundColor: getFrameBackgroundColor(frame.type),
      backgroundImage,
      backgroundSize: 'cover',
      color: frame.textColor || '#ffffff',
      display: 'flex',
      alignItems: frame.verAlign === 'start' ? 'flex-start' : frame.verAlign === 'center' ? 'center' : 'flex-end',
      justifyContent: frame.horAlign === 'left' ? 'flex-start' : frame.horAlign === 'center' ? 'center' : 'flex-end',
      fontSize: frame.fontSize ? `${frame.fontSize}px` : `${(frame.textScale || 1) * 14}px`,
      fontFamily: frame.font || undefined,
      fontWeight: frame.fontFlags?.includes('BOLD') ? 'bold' : undefined,
      fontStyle: frame.fontFlags?.includes('ITALIC') ? 'italic' : undefined,
      textDecoration: frame.fontFlags?.includes('UNDERLINE') ? 'underline' : frame.fontFlags?.includes('STRIKEOUT') ? 'line-through' : undefined,
      textShadow: frame.fontShadowColor && frame.fontShadowOffset 
        ? `${frame.fontShadowOffset[0]}px ${frame.fontShadowOffset[1]}px 2px ${rgbaToCSS(frame.fontShadowColor)}`
        : undefined,
      overflow: 'visible',
    };

    return (
      <div
        key={frameId}
        className="canvas-frame"
        data-frame-id={frameId}
        style={containerStyle}
        onMouseDown={(e) => {
          // 先处理选择逻辑（在拖拽开始之前）
          if (e.button === 0) { // 只处理左键
            if (e.ctrlKey || e.metaKey) {
              toggleSelectFrame(frameId);
              e.stopPropagation();
              return; // Ctrl+点击时不启动拖拽
            } else {
              selectFrame(frameId);
            }
          }
          handleFrameMouseDown(e, frameId);
        }}
        onClick={(e) => {
          e.stopPropagation(); // 阻止事件冒泡到画布
        }}
        title={frame.name}
      >
        {/* 选择框 - 最外层，不受内容影响 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: isLockedOrParentLocked 
              ? '2px dashed #888888' 
              : isSelected 
                ? '2px solid #f22613' 
                : isHighlighted 
                  ? '2px solid #00aaff'
                  : '1px solid #00e640',
            boxSizing: 'border-box',
            pointerEvents: 'none',
            boxShadow: isHighlighted ? '0 0 10px rgba(0, 170, 255, 0.5)' : undefined,
          }}
        />

        {/* Backdrop 背景和边框容器 */}
        {(frame.backdropBackground || frame.backdropEdgeFile) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
            }}
          >
            {/* Backdrop 背景纹理（带内边距） */}
            {frame.backdropBackground ? (
              <BackdropBackground
                frame={frame}
                textureMap={textureMap}
                isSelected={isSelected}
                canvasWidth={CANVAS_WIDTH}
                canvasHeight={CANVAS_HEIGHT}
                margin={MARGIN}
                resolveTexturePath={resolveTexturePath}
              />
            ) : isSelected && frame.backdropBackgroundInsets && (
              // 警告：设置了 insets 但没有背景纹理
              console.warn('[Canvas] ⚠️ 警告: 设置了 backdropBackgroundInsets 但没有 backdropBackground 纹理', {
                frameName: frame.name,
                backdropBackgroundInsets: frame.backdropBackgroundInsets,
                提示: '请在属性面板的 "Backdrop 背景纹理" 中选择一个纹理'
              }),
              null
            )}

            {/* Backdrop 边框纹理 */}
            {frame.backdropEdgeFile && frame.backdropCornerFlags && frame.backdropCornerSize && (
              <BackdropEdge
                edgeFile={frame.backdropEdgeFile}
                cornerFlags={frame.backdropCornerFlags}
                cornerSize={frame.backdropCornerSize}
                backgroundInsets={frame.backdropBackgroundInsets}
                textureDataURL={(() => {
                  const resolvedEdgePath = resolveTexturePath(frame.backdropEdgeFile);
                  const textureState = resolvedEdgePath ? textureMap.get(resolvedEdgePath) : undefined;
                  return textureState?.url || undefined;
                })()}
                canvasWidth={CANVAS_WIDTH - 2 * MARGIN}
              />
            )}
          </div>
        )}

        {/* 内容层 */}
        <div style={contentStyle}>
          {frame.text && (
            <span 
              className={`frame-text ${
                [FrameType.BUTTON, FrameType.GLUETEXTBUTTON, FrameType.GLUEBUTTON, 
                 FrameType.SIMPLEBUTTON, FrameType.CHECKBOX].includes(frame.type) 
                  ? 'frame-text-hoverable' 
                  : ''
              }`}
              style={{
                color: frame.type === FrameType.EDITBOX && frame.editTextColor 
                  ? rgbaToCSS(frame.editTextColor) 
                  : undefined,
                // 为可交互控件添加hover颜色变量
                ['--hover-color' as string]: frame.fontHighlightColor 
                  ? rgbaToCSS(frame.fontHighlightColor) 
                  : undefined,
              }}
            >
              {frame.text}
            </span>
          )}
          
          {/* EDITBOX 光标和边框样式 */}
          {frame.type === FrameType.EDITBOX && isSelected && (
            <div style={{
              position: 'absolute',
              inset: 0,
              borderColor: frame.editBorderColor ? rgbaToCSS(frame.editBorderColor) : undefined,
              borderWidth: '1px',
              borderStyle: 'solid',
              pointerEvents: 'none',
            }} />
          )}
          
          {/* SPRITE / MODEL 渲染或占位符 */}
          {(frame.type === FrameType.SPRITE || frame.type === FrameType.MODEL) && (
            <>
              {/* 如果有 backgroundArt，尝试渲染 3D 模型 */}
              {frame.type === FrameType.MODEL && frame.backgroundArt && (
                <ModelViewer
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
                      cameraDistance: params.distance
                    }));
                  }}
                />
              )}
              
              {/* 占位符：无模型文件或 SPRITE 类型 */}
              {(!frame.backgroundArt || frame.type === FrameType.SPRITE) && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: frame.type === FrameType.MODEL 
                    ? 'rgba(200, 100, 255, 0.15)' 
                    : 'rgba(255, 100, 200, 0.15)',
                  border: `1px dashed ${frame.type === FrameType.MODEL ? 'rgba(200, 100, 255, 0.5)' : 'rgba(255, 100, 200, 0.5)'}`,
                  pointerEvents: 'none',
                  fontSize: '11px',
                  color: '#aaa',
                  textAlign: 'center',
                  padding: '4px',
                  overflow: 'hidden',
                }}>
                  <div style={{ fontSize: '20px', marginBottom: '4px' }}>
                    {frame.type === FrameType.MODEL ? '🎭' : '🎨'}
                  </div>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>
                    {frame.type === FrameType.MODEL ? '3D Model' : 'Sprite'}
                  </div>
                  {frame.backgroundArt && (
                    <div style={{ 
                      fontSize: '9px', 
                      wordBreak: 'break-all',
                      maxHeight: '40px',
                      overflow: 'hidden',
                      lineHeight: '1.2',
                    }}>
                      {frame.backgroundArt.split('/').pop()?.split('\\').pop() || frame.backgroundArt}
                    </div>
                  )}
                  {!frame.backgroundArt && (
                    <div style={{ fontSize: '9px', fontStyle: 'italic', color: '#666' }}>
                      未设置模型文件
                    </div>
                  )}
                </div>
              )}
            </>
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
        </div>
        
        {/* 调整大小手柄 - 在外层容器中，不受内容层影响 */}
        <ResizeHandles
          isSelected={isSelected && !isLockedOrParentLocked}
          onResizeStart={handleResizeStartWithLockCheck(frameId)}
        />
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

  const getFrameBackgroundColor = (type: FrameType): string => {
    switch (type) {
      // 容器类型 - 灰色
      case FrameType.ORIGIN:
      case FrameType.FRAME:
      case FrameType.BACKDROP:
      case FrameType.SIMPLEFRAME:
        return 'rgba(128, 128, 128, 0.3)';
      
      // 按钮类型 - 蓝色
      case FrameType.BUTTON:
      case FrameType.GLUETEXTBUTTON:
      case FrameType.GLUEBUTTON:
      case FrameType.SIMPLEBUTTON:
      case FrameType.BROWSER_BUTTON:
      case FrameType.SCRIPT_DIALOG_BUTTON:
      case FrameType.INVIS_BUTTON:
        return 'rgba(0, 100, 200, 0.3)';
      
      // 文本类型 - 透明
      case FrameType.TEXT_FRAME:
      case FrameType.SIMPLEFONTSTRING:
      case FrameType.TEXTAREA:
        return 'transparent';
      
      // 交互控件 - 黄色
      case FrameType.CHECKBOX:
        return 'rgba(255, 255, 0, 0.3)';
      case FrameType.EDITBOX:
        return 'rgba(255, 200, 100, 0.3)';
      case FrameType.SLIDER:
        return 'rgba(200, 255, 100, 0.3)';
      case FrameType.SCROLLBAR:
        return 'rgba(150, 255, 150, 0.3)';
      case FrameType.LISTBOX:
        return 'rgba(255, 150, 255, 0.3)';
      case FrameType.MENU:
      case FrameType.POPUPMENU:
        return 'rgba(255, 100, 150, 0.3)';
      
      // 图形控件 - 紫色
      case FrameType.SPRITE:
      case FrameType.MODEL:
        return 'rgba(200, 100, 255, 0.3)';
      case FrameType.HIGHLIGHT:
        return 'rgba(255, 255, 100, 0.2)';
      
      // 状态栏 - 绿色
      case FrameType.SIMPLESTATUSBAR:
      case FrameType.STATUSBAR:
        return 'rgba(100, 255, 100, 0.3)';
      
      // 其他 - 默认灰色
      case FrameType.CONTROL:
      case FrameType.DIALOG:
      case FrameType.TIMERTEXT:
      default:
        return 'rgba(100, 100, 100, 0.3)';
    }
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
            // 只在非 Ctrl、非 Shift 左键点击时清空选择
            if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
              selectFrame(null);
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
                const x = ((i * 0.05) / WC3_MAX_X) * (CANVAS_WIDTH - 2 * MARGIN);
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
                const y = CANVAS_HEIGHT - ((i * 0.05) / WC3_MAX_Y) * CANVAS_HEIGHT;
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
                x1={(0.4 / WC3_MAX_X) * (CANVAS_WIDTH - 2 * MARGIN)}
                y1={0}
                x2={(0.4 / WC3_MAX_X) * (CANVAS_WIDTH - 2 * MARGIN)}
                y2={CANVAS_HEIGHT}
                stroke="rgba(0, 255, 0, 0.4)"
                strokeWidth={1}
                strokeDasharray="5,5"
              />
              <line
                x1={0}
                y1={CANVAS_HEIGHT - (0.3 / WC3_MAX_Y) * CANVAS_HEIGHT}
                x2={CANVAS_WIDTH - 2 * MARGIN}
                y2={CANVAS_HEIGHT - (0.3 / WC3_MAX_Y) * CANVAS_HEIGHT}
                stroke="rgba(0, 255, 0, 0.4)"
                strokeWidth={1}
                strokeDasharray="5,5"
              />
            </svg>
          )}
          
          {/* 渲染所有Frame（包括子控件），子控件也在画布根部独立渲染 */}
          {getAllFrameIds(project.rootFrameIds).map(frameId => renderFrame(frameId))}
          
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
