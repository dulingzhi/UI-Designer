import React, { forwardRef, useImperativeHandle } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { FrameType } from '../types';
import { ResizeHandles, ResizeDirection } from './ResizeHandles';
import { updateAnchorsFromBounds, calculatePositionFromAnchors } from '../utils/anchorUtils';
import './Canvas.css';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MARGIN = 240; // 4:3区域边距

export interface CanvasHandle {
  setScale: (scale: number) => void;
  centerCanvas: () => void;
}

export const Canvas = forwardRef<CanvasHandle>((_, ref) => {
  const { project, selectedFrameId, selectFrame, setProject } = useProjectStore();
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [offset, setOffset] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [panStart, setPanStart] = React.useState({ x: 0, y: 0 });
  
  // Frame 拖拽状态
  const [isDraggingFrame, setIsDraggingFrame] = React.useState(false);
  const [draggedFrameId, setDraggedFrameId] = React.useState<string | null>(null);
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 }); // 鼠标相对Frame的偏移
  const [dragStartState, setDragStartState] = React.useState<{ x: number; y: number; anchors: any } | null>(null); // 拖拽开始时的状态
  
  // Frame 调整大小状态
  const [isResizing, setIsResizing] = React.useState(false);
  const [resizeFrameId, setResizeFrameId] = React.useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = React.useState<ResizeDirection | null>(null);
  const [resizeStartPos, setResizeStartPos] = React.useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = React.useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeStartAnchors, setResizeStartAnchors] = React.useState<any>(null); // 调整大小开始时的锚点

  // 暴露给父组件的方法
  useImperativeHandle(ref, () => ({
    setScale: (newScale: number) => setScale(newScale),
    centerCanvas: () => {
      setOffset({ x: 0, y: 0 });
      setScale(1);
    }
  }));

  // 处理缩放
  const handleWheel = (e: React.WheelEvent) => {
    if (e.altKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }
  };

  // 处理画布拖拽（平移）
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.altKey || e.button === 1) { // Alt键或中键拖拽画布
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (isDraggingFrame && draggedFrameId) {
      // 拖拽 Frame - 直接更新状态，不创建命令
      const frame = project.frames[draggedFrameId];
      if (!frame) return;

      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;

      // 计算鼠标在画布上的相对位置
      const mouseX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
      const mouseY = (canvasBounds.bottom - e.clientY + offset.y * scale) / scale;

      // 转换为魔兽坐标 (0-0.8, 0-0.6)
      const mouseWc3X = ((mouseX - MARGIN) / (CANVAS_WIDTH - 2 * MARGIN)) * 0.8;
      const mouseWc3Y = (mouseY / CANVAS_HEIGHT) * 0.6;

      // 应用拖拽偏移，得到 Frame 的新位置
      const newX = Math.max(0, Math.min(0.8 - frame.width, mouseWc3X - dragOffset.x));
      const newY = Math.max(0, Math.min(0.6 - frame.height, mouseWc3Y - dragOffset.y));

      // 更新锚点
      const updatedAnchors = updateAnchorsFromBounds(
        frame.anchors,
        newX,
        newY,
        frame.width,
        frame.height
      );

      // 直接更新状态，不通过命令系统
      setProject({
        ...project,
        frames: {
          ...project.frames,
          [draggedFrameId]: {
            ...frame,
            x: newX,
            y: newY,
            anchors: updatedAnchors
          }
        }
      });
    } else if (isResizing && resizeFrameId && resizeDirection) {
      // 调整 Frame 大小 - 直接更新状态，不创建命令
      const frame = project.frames[resizeFrameId];
      if (!frame) return;

      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;

      // 计算鼠标移动距离（Canvas 像素）
      const deltaX = (e.clientX - resizeStartPos.x) / scale;
      const deltaY = (e.clientY - resizeStartPos.y) / scale; // 浏览器坐标：向下为正

      // 转换为魔兽坐标增量
      const deltaWc3X = (deltaX / (CANVAS_WIDTH - 2 * MARGIN)) * 0.8;
      const deltaWc3Y = -(deltaY / CANVAS_HEIGHT) * 0.6; // 魔兽坐标：向上为正，所以取反

      let newX = resizeStartSize.x;
      let newY = resizeStartSize.y;
      let newWidth = resizeStartSize.width;
      let newHeight = resizeStartSize.height;

      // 根据拖拽方向计算新的位置和大小
      const isShiftPressed = e.shiftKey;

      if (resizeDirection.includes('e')) {
        newWidth = Math.max(0.01, resizeStartSize.width + deltaWc3X);
      }
      if (resizeDirection.includes('w')) {
        const oldRight = resizeStartSize.x + resizeStartSize.width;
        newX = Math.max(0, resizeStartSize.x + deltaWc3X);
        newWidth = oldRight - newX;
      }
      if (resizeDirection.includes('n')) {
        // 北边（上边）：向上拖拽增加高度
        newHeight = Math.max(0.01, resizeStartSize.height + deltaWc3Y);
      }
      if (resizeDirection.includes('s')) {
        // 南边（下边）：向下拖拽减少 Y 坐标，增加高度
        const oldTop = resizeStartSize.y + resizeStartSize.height;
        newY = Math.max(0, resizeStartSize.y + deltaWc3Y);
        newHeight = Math.max(0.01, oldTop - newY);
      }

      // Shift 键保持纵横比
      if (isShiftPressed && (resizeDirection === 'ne' || resizeDirection === 'nw' || resizeDirection === 'se' || resizeDirection === 'sw')) {
        const aspectRatio = resizeStartSize.width / resizeStartSize.height;
        if (Math.abs(newWidth - resizeStartSize.width) > Math.abs(newHeight - resizeStartSize.height)) {
          newHeight = newWidth / aspectRatio;
        } else {
          newWidth = newHeight * aspectRatio;
        }
      }

      // 边界限制
      newX = Math.max(0, Math.min(0.8 - newWidth, newX));
      newY = Math.max(0, Math.min(0.6 - newHeight, newY));
      newWidth = Math.max(0.01, Math.min(0.8 - newX, newWidth));
      newHeight = Math.max(0.01, Math.min(0.6 - newY, newHeight));

      // 更新锚点
      const updatedAnchors = updateAnchorsFromBounds(
        frame.anchors,
        newX,
        newY,
        newWidth,
        newHeight
      );

      // 直接更新状态，不通过命令系统
      setProject({
        ...project,
        frames: {
          ...project.frames,
          [resizeFrameId]: {
            ...frame,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
            anchors: updatedAnchors
          }
        }
      });
    }
  };

  const handleMouseUp = () => {
    // 拖拽结束时，创建命令记录到历史（不执行，因为状态已经在 mouseMove 中更新了）
    if (isDraggingFrame && draggedFrameId && dragStartState) {
      const currentFrame = project.frames[draggedFrameId];
      if (currentFrame) {
        // 只有当位置真的改变了才创建命令
        if (currentFrame.x !== dragStartState.x || currentFrame.y !== dragStartState.y) {
          // 创建命令并手动设置 previousState
          const command = new UpdateFrameCommand(
            draggedFrameId,
            {
              x: currentFrame.x,
              y: currentFrame.y,
              anchors: currentFrame.anchors
            }
          );
          // 手动设置之前的状态（因为 execute 已经在 mouseMove 中完成了）
          (command as any).previousState = {
            x: dragStartState.x,
            y: dragStartState.y,
            anchors: dragStartState.anchors
          };
          // 直接添加到历史栈，不执行 execute
          const { undoStack } = useCommandStore.getState();
          useCommandStore.setState({
            undoStack: [...undoStack, command],
            redoStack: [], // 清空重做栈
          });
        }
      }
    }

    // 调整大小结束时，创建命令记录到历史
    if (isResizing && resizeFrameId && resizeStartAnchors) {
      const currentFrame = project.frames[resizeFrameId];
      if (currentFrame) {
        // 检查是否真的改变了
        const sizeChanged = 
          currentFrame.x !== resizeStartSize.x ||
          currentFrame.y !== resizeStartSize.y ||
          currentFrame.width !== resizeStartSize.width ||
          currentFrame.height !== resizeStartSize.height;
        
        if (sizeChanged) {
          // 创建命令
          const command = new UpdateFrameCommand(
            resizeFrameId,
            {
              x: currentFrame.x,
              y: currentFrame.y,
              width: currentFrame.width,
              height: currentFrame.height,
              anchors: currentFrame.anchors
            }
          );
          // 手动设置之前的状态
          (command as any).previousState = {
            x: resizeStartSize.x,
            y: resizeStartSize.y,
            width: resizeStartSize.width,
            height: resizeStartSize.height,
            anchors: resizeStartAnchors
          };
          // 直接添加到历史栈，不执行 execute
          const { undoStack } = useCommandStore.getState();
          useCommandStore.setState({
            undoStack: [...undoStack, command],
            redoStack: [], // 清空重做栈
          });
        }
      }
    }

    setIsPanning(false);
    setIsDraggingFrame(false);
    setDraggedFrameId(null);
    setDragStartState(null);
    setIsResizing(false);
    setResizeFrameId(null);
    setResizeDirection(null);
    setResizeStartAnchors(null);
  };

  // Frame 的鼠标按下事件
  const handleFrameMouseDown = (e: React.MouseEvent, frameId: string) => {
    if (!e.altKey && e.button === 0) { // 左键且不按Alt键
      e.stopPropagation();
      
      const frame = project.frames[frameId];
      if (!frame) return;

      // 检查是否有多个锚点 - 如果有则不允许拖动
      const anchorCount = Object.keys(frame.anchors || {}).length;
      if (anchorCount > 1) {
        // 只选中,不允许拖动
        selectFrame(frameId);
        return;
      }

      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;

      // 计算鼠标在画布上的位置（魔兽坐标）
      const mouseX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
      const mouseY = (canvasBounds.bottom - e.clientY + offset.y * scale) / scale;
      const mouseWc3X = ((mouseX - MARGIN) / (CANVAS_WIDTH - 2 * MARGIN)) * 0.8;
      const mouseWc3Y = (mouseY / CANVAS_HEIGHT) * 0.6;

      // 计算鼠标相对于 Frame 左下角的偏移
      const offsetX = mouseWc3X - frame.x;
      const offsetY = mouseWc3Y - frame.y;

      // 保存拖拽开始时的状态
      setDragStartState({
        x: frame.x,
        y: frame.y,
        anchors: JSON.parse(JSON.stringify(frame.anchors)) // 深拷贝
      });

      setIsDraggingFrame(true);
      setDraggedFrameId(frameId);
      setDragOffset({ x: offsetX, y: offsetY });
      selectFrame(frameId);
    }
  };

  // 开始调整 Frame 大小
  const handleResizeStart = (frameId: string) => {
    return (e: React.MouseEvent, direction: ResizeDirection) => {
      const frame = project.frames[frameId];
      if (!frame) return;

      // 保存调整大小开始时的状态
      setResizeStartAnchors(JSON.parse(JSON.stringify(frame.anchors))); // 深拷贝

      setIsResizing(true);
      setResizeFrameId(frameId);
      setResizeDirection(direction);
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      setResizeStartSize({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
    };
  };

  // 渲染单个Frame
  const renderFrame = (frameId: string) => {
    const frame = project.frames[frameId];
    if (!frame) return null;

    const isSelected = frameId === selectedFrameId;
    
    // 检查是否使用相对锚点，如果是则重新计算位置
    const calculatedPos = calculatePositionFromAnchors(frame, project.frames);
    const actualFrame = calculatedPos 
      ? { ...frame, ...calculatedPos }
      : frame;
    
    // 调试日志
    if (calculatedPos) {
      console.log(`[Canvas] Frame ${frame.name} uses relative anchors, calculated pos:`, calculatedPos);
    }
    
    // 计算实际位置（从底部左侧开始）
    const left = (actualFrame.x / 0.8) * (CANVAS_WIDTH - 2 * MARGIN) + MARGIN;
    const bottom = (actualFrame.y / 0.6) * CANVAS_HEIGHT;
    const width = (actualFrame.width / 0.8) * (CANVAS_WIDTH - 2 * MARGIN);
    const height = (actualFrame.height / 0.6) * CANVAS_HEIGHT;

    const style: React.CSSProperties = {
      position: 'absolute',
      left: `${left}px`,
      bottom: `${bottom}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: isSelected ? '2px solid #f22613' : '1px solid #00e640',
      boxSizing: 'border-box',
      cursor: 'pointer',
      zIndex: frame.z,
      backgroundColor: getFrameBackgroundColor(frame.type),
      backgroundImage: frame.diskTexture ? `url(${frame.diskTexture})` : undefined,
      backgroundSize: 'cover',
      color: frame.textColor || '#ffffff',
      display: 'flex',
      alignItems: frame.verAlign === 'start' ? 'flex-start' : frame.verAlign === 'center' ? 'center' : 'flex-end',
      justifyContent: frame.horAlign === 'left' ? 'flex-start' : frame.horAlign === 'center' ? 'center' : 'flex-end',
      fontSize: `${(frame.textScale || 1) * 14}px`,
    };

    return (
      <div
        key={frameId}
        className="canvas-frame"
        style={style}
        onMouseDown={(e) => handleFrameMouseDown(e, frameId)}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDraggingFrame && !isResizing) {
            selectFrame(frameId);
          }
        }}
        title={frame.name}
      >
        {frame.text && <span>{frame.text}</span>}
        {frame.children.map(childId => renderFrame(childId))}
        
        {/* 调整大小手柄 */}
        <ResizeHandles
          isSelected={isSelected}
          onResizeStart={handleResizeStart(frameId)}
        />
      </div>
    );
  };

  const getFrameBackgroundColor = (type: FrameType): string => {
    switch (type) {
      case FrameType.BACKDROP:
        return 'rgba(128, 128, 128, 0.3)';
      case FrameType.BUTTON:
      case FrameType.BROWSER_BUTTON:
      case FrameType.SCRIPT_DIALOG_BUTTON:
        return 'rgba(0, 100, 200, 0.3)';
      case FrameType.TEXT_FRAME:
        return 'transparent';
      case FrameType.CHECKBOX:
        return 'rgba(255, 255, 0, 0.3)';
      default:
        return 'rgba(100, 100, 100, 0.3)';
    }
  };

  return (
    <div 
      className="canvas-container"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
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
          onClick={() => selectFrame(null)}
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
          
          {/* 渲染所有根Frame */}
          {project.rootFrameIds.map(frameId => renderFrame(frameId))}
        </div>
      </div>

      {/* 缩放控制 */}
      <div className="canvas-controls">
        <button onClick={() => setScale(prev => Math.min(5, prev * 1.2))}>+</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(prev => Math.max(0.1, prev * 0.8))}>-</button>
        <button onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>重置</button>
      </div>
    </div>
  );
});
