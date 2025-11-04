import React, { forwardRef, useImperativeHandle } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { FrameType, FramePoint } from '../types';
import { ResizeHandles, ResizeDirection } from './ResizeHandles';
import { updateAnchorsFromBounds, calculatePositionFromAnchors, getAnchorPosition, getAnchorOffsetWc3 } from '../utils/anchorUtils';
import { AnchorVisualizer } from './AnchorVisualizer';
import { Ruler } from './Ruler';
import './Canvas.css';

const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const MARGIN = 240; // 4:3区域边距

export interface CanvasHandle {
  setScale: (scale: number | ((prev: number) => number)) => void;
  centerCanvas: () => void;
  toggleGrid: () => void;
  toggleAnchors: () => void;
  toggleRulers: () => void;
  getScale: () => number;
}

export const Canvas = forwardRef<CanvasHandle>((_, ref) => {
  const { project, selectedFrameId, selectFrame, toggleSelectFrame, setProject } = useProjectStore();
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

  // 框选状态
  const [isBoxSelecting, setIsBoxSelecting] = React.useState(false);
  const [boxSelectStart, setBoxSelectStart] = React.useState({ x: 0, y: 0 });
  const [boxSelectEnd, setBoxSelectEnd] = React.useState({ x: 0, y: 0 });

  // 网格显示状态
  const [showGrid, setShowGrid] = React.useState(true);
  
  // 锚点可视化状态
  const [showAnchors, setShowAnchors] = React.useState(false);
  
  // 标尺显示状态
  const [showRulers, setShowRulers] = React.useState(true);
  
  // 网格吸附状态
  const [snapToGrid, setSnapToGrid] = React.useState(true);
  const [gridSize, setGridSize] = React.useState(0.01); // WC3单位，默认0.01
  
  // 吸附到网格的辅助函数
  const snapValue = (value: number, gridSize: number): number => {
    if (!snapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
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
    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (isBoxSelecting) {
      // 更新框选区域（考虑缩放和偏移）
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (!canvasBounds) return;
      
      const relativeX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
      const relativeY = (e.clientY - canvasBounds.top - offset.y * scale) / scale;
      setBoxSelectEnd({ x: relativeX, y: relativeY });
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

      // 检查是否有相对锚点
      const hasRelativeAnchors = frame.anchors?.some(a => a.relativeTo);

      if (hasRelativeAnchors && frame.anchors) {
        // 有相对锚点：只更新锚点偏移量，保持相对定位
        let newX = mouseWc3X - dragOffset.x;
        let newY = mouseWc3Y - dragOffset.y;

        console.log('[Drag] Mouse WC3:', mouseWc3X.toFixed(3), mouseWc3Y.toFixed(3));
        console.log('[Drag] Drag offset:', dragOffset.x.toFixed(3), dragOffset.y.toFixed(3));
        console.log('[Drag] New frame bottom-left position:', newX.toFixed(3), newY.toFixed(3));

        // 网格吸附
        if (snapToGrid) {
          newX = snapValue(newX, gridSize);
          newY = snapValue(newY, gridSize);
        }

        // 更新每个相对锚点的偏移量
        const updatedAnchors = frame.anchors.map(anchor => {
          if (anchor.relativeTo) {
            const relativeFrame = project.frames[anchor.relativeTo];
            if (relativeFrame) {
              const relativePoint = anchor.relativePoint !== undefined ? anchor.relativePoint : FramePoint.TOPLEFT;
              const relativePos = getAnchorPosition(relativeFrame, relativePoint);
              
              // 计算当前锚点在控件上的位置（相对于控件左下角的偏移，WC3坐标系）
              const anchorOffsetInFrame = getAnchorOffsetWc3(anchor.point, frame.width, frame.height);
              
              // 计算锚点的目标绝对位置 = 控件新的左下角位置 + 锚点在控件内的偏移
              const targetAnchorX = newX + anchorOffsetInFrame.x;
              const targetAnchorY = newY + anchorOffsetInFrame.y;
              
              console.log('[Drag] Anchor', FramePoint[anchor.point], 'offset in frame (WC3):', anchorOffsetInFrame);
              console.log('[Drag] Target anchor abs pos:', targetAnchorX.toFixed(3), targetAnchorY.toFixed(3));
              console.log('[Drag] Relative anchor pos:', relativePos.x.toFixed(3), relativePos.y.toFixed(3));
              
              // 计算新的偏移量 = 目标锚点位置 - 相对锚点位置
              const newOffsetX = targetAnchorX - relativePos.x;
              const newOffsetY = targetAnchorY - relativePos.y;
              
              console.log('[Drag] New anchor offset:', newOffsetX.toFixed(3), newOffsetY.toFixed(3));

              return { ...anchor, x: newOffsetX, y: newOffsetY };
            }
          }
          return anchor;
        });

        // 直接更新状态，不通过命令系统
        setProject({
          ...project,
          frames: {
            ...project.frames,
            [draggedFrameId]: {
              ...frame,
              anchors: updatedAnchors
            }
          }
        });
      } else {
        // 没有相对锚点：更新绝对位置
        let newX = Math.max(0, Math.min(0.8 - frame.width, mouseWc3X - dragOffset.x));
        let newY = Math.max(0, Math.min(0.6 - frame.height, mouseWc3Y - dragOffset.y));
        
        // 网格吸附
        if (snapToGrid) {
          newX = snapValue(newX, gridSize);
          newY = snapValue(newY, gridSize);
        }

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
      }
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

      // 网格吸附
      if (snapToGrid) {
        newX = snapValue(newX, gridSize);
        newY = snapValue(newY, gridSize);
        newWidth = snapValue(newWidth, gridSize);
        newHeight = snapValue(newHeight, gridSize);
      }

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

    // 框选结束时，选中框内的所有控件
    if (isBoxSelecting) {
      const canvasBounds = canvasRef.current?.getBoundingClientRect();
      if (canvasBounds) {
        // 计算选择框的边界（相对于画布容器的坐标）
        const boxLeft = Math.min(boxSelectStart.x, boxSelectEnd.x);
        const boxRight = Math.max(boxSelectStart.x, boxSelectEnd.x);
        const boxTop = Math.min(boxSelectStart.y, boxSelectEnd.y);
        const boxBottom = Math.max(boxSelectStart.y, boxSelectEnd.y);

        // 检查每个控件是否在选择框内
        const selectedIds: string[] = [];
        Object.values(project.frames).forEach(frame => {
          // 计算控件在画布上的位置（像素坐标）
          const calculatedPos = calculatePositionFromAnchors(frame, project.frames);
          const actualFrame = calculatedPos ? { ...frame, ...calculatedPos } : frame;
          
          const frameLeft = (actualFrame.x / 0.8) * (CANVAS_WIDTH - 2 * MARGIN) + MARGIN;
          const frameBottom = (actualFrame.y / 0.6) * CANVAS_HEIGHT;
          const frameWidth = (actualFrame.width / 0.8) * (CANVAS_WIDTH - 2 * MARGIN);
          const frameHeight = (actualFrame.height / 0.6) * CANVAS_HEIGHT;
          
          // 转换为相对于画布容器的坐标（考虑缩放和偏移）
          const frameRelativeLeft = frameLeft * scale + offset.x * scale;
          const frameRelativeRight = frameRelativeLeft + frameWidth * scale;
          const frameRelativeTop = (CANVAS_HEIGHT - (frameBottom + frameHeight)) * scale + offset.y * scale;
          const frameRelativeBottom = frameRelativeTop + frameHeight * scale;

          // 判断控件是否与选择框相交
          if (frameRelativeRight >= boxLeft && frameRelativeLeft <= boxRight &&
              frameRelativeBottom >= boxTop && frameRelativeTop <= boxBottom) {
            selectedIds.push(frame.id);
          }
        });

        // 更新选中的控件
        if (selectedIds.length > 0) {
          const store = useProjectStore.getState();
          store.selectMultipleFrames(selectedIds);
        }
      }
      setIsBoxSelecting(false);
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

      // 检查是否锁定
      if (frame.locked) {
        console.log('[Canvas] Frame is locked:', frame.name);
        return;
      }

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

      // 获取控件的实际位置（考虑相对锚点）
      const hasRelativeAnchors = frame.anchors?.some(a => a.relativeTo);
      let actualX = frame.x;
      let actualY = frame.y;
      
      if (hasRelativeAnchors) {
        const calculatedPos = calculatePositionFromAnchors(frame, project.frames);
        if (calculatedPos) {
          actualX = calculatedPos.x;
          actualY = calculatedPos.y;
        }
      }

      // 计算鼠标相对于控件左下角的偏移
      const offsetX = mouseWc3X - actualX;
      const offsetY = mouseWc3Y - actualY;

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

      // 检查是否锁定
      if (frame.locked) {
        console.log('[Canvas] Frame is locked:', frame.name);
        return;
      }

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

    // 如果控件被隐藏，不渲染
    if (frame.visible === false) return null;

    const store = useProjectStore.getState();
    const isSelected = store.selectedFrameIds.includes(frameId);
    
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
      border: frame.locked 
        ? '2px dashed #888888' 
        : isSelected ? '2px solid #f22613' : '1px solid #00e640',
      boxSizing: 'border-box',
      cursor: frame.locked ? 'not-allowed' : 'pointer',
      zIndex: frame.z,
      backgroundColor: getFrameBackgroundColor(frame.type),
      backgroundImage: frame.diskTexture ? `url(${frame.diskTexture})` : undefined,
      backgroundSize: 'cover',
      color: frame.textColor || '#ffffff',
      display: 'flex',
      alignItems: frame.verAlign === 'start' ? 'flex-start' : frame.verAlign === 'center' ? 'center' : 'flex-end',
      justifyContent: frame.horAlign === 'left' ? 'flex-start' : frame.horAlign === 'center' ? 'center' : 'flex-end',
      fontSize: `${(frame.textScale || 1) * 14}px`,
      pointerEvents: 'auto',
      opacity: frame.locked ? 0.7 : 1,
    };

    return (
      <div
        key={frameId}
        className="canvas-frame"
        style={style}
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
        {frame.text && <span>{frame.text}</span>}
        
        {/* 锁定图标 */}
        {frame.locked && (
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
        
        {/* 调整大小手柄 */}
        <ResizeHandles
          isSelected={isSelected && !frame.locked}
          onResizeStart={handleResizeStart(frameId)}
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
      {showRulers && (
        <Ruler
          orientation="horizontal"
          length={CANVAS_WIDTH - 2 * MARGIN}
          scale={scale}
          offset={offset.x + MARGIN * scale}
          wc3UnitSize={CANVAS_WIDTH - 2 * MARGIN}
        />
      )}

      {/* 垂直标尺 */}
      {showRulers && (
        <Ruler
          orientation="vertical"
          length={CANVAS_HEIGHT}
          scale={scale}
          offset={offset.y}
          wc3UnitSize={CANVAS_HEIGHT}
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
                const x = ((i * 0.05) / 0.8) * (CANVAS_WIDTH - 2 * MARGIN);
                return (
                  <line
                    key={`v-${i}`}
                    x1={x}
                    y1={0}
                    x2={x}
                    y2={CANVAS_HEIGHT}
                    stroke="rgba(100, 100, 100, 0.3)"
                    strokeWidth={i % 2 === 0 ? 1 : 0.5}
                  />
                );
              })}
              {/* 水平网格线 - 每0.05单位 */}
              {Array.from({ length: 12 }, (_, i) => i + 1).map(i => {
                const y = CANVAS_HEIGHT - ((i * 0.05) / 0.6) * CANVAS_HEIGHT;
                return (
                  <line
                    key={`h-${i}`}
                    x1={0}
                    y1={y}
                    x2={CANVAS_WIDTH - 2 * MARGIN}
                    y2={y}
                    stroke="rgba(100, 100, 100, 0.3)"
                    strokeWidth={i % 2 === 0 ? 1 : 0.5}
                  />
                );
              })}
              {/* 中心十字线 */}
              <line
                x1={(0.4 / 0.8) * (CANVAS_WIDTH - 2 * MARGIN)}
                y1={0}
                x2={(0.4 / 0.8) * (CANVAS_WIDTH - 2 * MARGIN)}
                y2={CANVAS_HEIGHT}
                stroke="rgba(0, 255, 0, 0.4)"
                strokeWidth={1}
                strokeDasharray="5,5"
              />
              <line
                x1={0}
                y1={CANVAS_HEIGHT - (0.3 / 0.6) * CANVAS_HEIGHT}
                x2={CANVAS_WIDTH - 2 * MARGIN}
                y2={CANVAS_HEIGHT - (0.3 / 0.6) * CANVAS_HEIGHT}
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
    </div>
  );
});
