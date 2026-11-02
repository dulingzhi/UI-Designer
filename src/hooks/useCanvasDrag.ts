import React, { useState, useRef, useCallback } from 'react';
import { FramePoint, FrameAnchor, FrameData } from '../types';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useCommandStore, type Command } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { updateAnchorsFromBounds, calculatePositionFromAnchors, getAnchorPosition, getAnchorOffsetWc3 } from '../utils/anchorUtils';
import { pixelToWc3X, pixelToWc3Y } from '../utils/coordinateService';
import { computeDragRect } from '../utils/frameTransforms';

const UPDATE_THROTTLE_MS = 16; // ~60fps

// round 126：多选拖拽——计算除被拖帧外、其余选中帧按同一 delta 平移后的新帧数据。
// 锚点统一平移 delta：绝对锚点跟随移动；相对锚点的 offset 平移使解算位置
// 相对未动的参照帧平移同量——两种锚点数学一致。
export function computeMultiDragFrames(
  project: { frames: Record<string, FrameData> },
  starts: Map<string, { x: number; y: number }>,
  draggedFrameId: string,
  newX: number,
  newY: number,
): Record<string, FrameData> {
  const start = starts.get(draggedFrameId);
  if (!start || starts.size <= 1) return {};
  const dx = newX - start.x;
  const dy = newY - start.y;
  if (dx === 0 && dy === 0) return {};
  const extra: Record<string, FrameData> = {};
  starts.forEach((s, id) => {
    if (id === draggedFrameId) return;
    const f = project.frames[id];
    if (!f) return;
    const movedAnchors = (f.anchors ?? []).map(a => ({ ...a, x: (a.x ?? 0) + dx, y: (a.y ?? 0) + dy }));
    extra[id] = { ...f, x: s.x + dx, y: s.y + dy, anchors: movedAnchors };
  });
  return extra;
}

interface DragStartState {
  x: number;
  y: number;
  anchors: FrameAnchor[];
}

interface TempPosition {
  frameId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchors: FrameAnchor[];
}

export interface UseCanvasDragOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  offset: { x: number; y: number };
  snapValue: (value: number, gridSize: number) => number;
  snapToGrid: boolean;
  gridSize: number;
}

export interface UseCanvasDragReturn {
  isDragging: boolean;
  draggedFrameId: string | null;
  startDrag: (e: React.MouseEvent, frameId: string) => void;
  updateDrag: (e: React.MouseEvent) => void;
  endDrag: () => void;
}

export function useCanvasDrag({
  canvasRef,
  scale,
  offset,
  snapValue,
  snapToGrid,
  gridSize,
}: UseCanvasDragOptions): UseCanvasDragReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFrameId, setDraggedFrameId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartState, setDragStartState] = useState<DragStartState | null>(null);

  const dragTempPositionRef = useRef<TempPosition | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  // round 126：多选拖拽——捕获拖动开始时全部选中帧（含被拖帧）的起始状态。
  // 单选时 Map 仅含 1 帧，多帧路径与单帧路径行为一致。
  const dragMultiStartRef = useRef<Map<string, { x: number; y: number; anchors: FrameAnchor[] | undefined }>>(new Map());

  const startDrag = useCallback((e: React.MouseEvent, frameId: string) => {
    const { project } = useProjectStore.getState();
    const frame = project.frames[frameId];
    if (!frame) return;

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) return;

    // 计算鼠标在画布上的位置（魔兽坐标）
    const mouseX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
    const mouseY = (canvasBounds.bottom - e.clientY + offset.y * scale) / scale;
    const mouseWc3X = pixelToWc3X(mouseX);
    const mouseWc3Y = pixelToWc3Y(mouseY);

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

    // 多选捕获：被拖帧在选中集内且选中数 >1 时，同步移动全部选中帧
    const { selectedFrameIds } = useUIStore.getState();
    const multiIds = selectedFrameIds.includes(frameId) && selectedFrameIds.length > 1
      ? selectedFrameIds
      : [frameId];
    const starts = new Map<string, { x: number; y: number; anchors: typeof frame.anchors }>();
    for (const id of multiIds) {
      const f = project.frames[id];
      if (f) starts.set(id, { x: f.x, y: f.y, anchors: JSON.parse(JSON.stringify(f.anchors)) });
    }
    dragMultiStartRef.current = starts;

    setDragStartState({
      x: frame.x,
      y: frame.y,
      anchors: JSON.parse(JSON.stringify(frame.anchors)),
    });

    setIsDragging(true);
    setDraggedFrameId(frameId);
    setDragOffset({ x: offsetX, y: offsetY });
  }, [canvasRef, scale, offset]);

  const updateDrag = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !draggedFrameId) return;

    // 时间节流
    const now = Date.now();
    if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) return;
    lastUpdateTimeRef.current = now;

    const { project, setProject } = useProjectStore.getState();
    const frame = project.frames[draggedFrameId];
    if (!frame) return;

    const canvasBounds = canvasRef.current?.getBoundingClientRect();
    if (!canvasBounds) return;

    const mouseX = (e.clientX - canvasBounds.left - offset.x * scale) / scale;
    const mouseY = (canvasBounds.bottom - e.clientY + offset.y * scale) / scale;
    const mouseWc3X = pixelToWc3X(mouseX);
    const mouseWc3Y = pixelToWc3Y(mouseY);

    const hasRelativeAnchors = frame.anchors?.some(a => a.relativeTo);

    if (hasRelativeAnchors && frame.anchors) {
      let newX = mouseWc3X - dragOffset.x;
      let newY = mouseWc3Y - dragOffset.y;

      if (snapToGrid) {
        newX = snapValue(newX, gridSize);
        newY = snapValue(newY, gridSize);
      }

      const updatedAnchors = frame.anchors.map(anchor => {
        if (anchor.relativeTo) {
          const relativeFrame = project.frames[anchor.relativeTo];
          if (relativeFrame) {
            const relativePoint = anchor.relativePoint !== undefined ? anchor.relativePoint : FramePoint.TOPLEFT;
            const relativePos = getAnchorPosition(relativeFrame, relativePoint);
            const anchorOffsetInFrame = getAnchorOffsetWc3(anchor.point, frame.width, frame.height);
            const targetAnchorX = newX + anchorOffsetInFrame.x;
            const targetAnchorY = newY + anchorOffsetInFrame.y;
            const newOffsetX = targetAnchorX - relativePos.x;
            const newOffsetY = targetAnchorY - relativePos.y;
            return { ...anchor, x: newOffsetX, y: newOffsetY };
          }
        }
        return anchor;
      });

      dragTempPositionRef.current = {
        frameId: draggedFrameId,
        x: newX,
        y: newY,
        width: frame.width,
        height: frame.height,
        anchors: updatedAnchors,
      };

      setProject({
        ...project,
        frames: {
          ...project.frames,
          [draggedFrameId]: { ...frame, x: newX, y: newY, anchors: updatedAnchors },
          ...computeMultiDragFrames(project, dragMultiStartRef.current, draggedFrameId, newX, newY),
        },
      });
    } else {
      // 固定尺寸拖拽：几何计算统一走 frameTransforms（可单测，且与 resize 共享钳制/吸附语义）
      const rect = computeDragRect(
        { x: mouseWc3X, y: mouseWc3Y },
        { x: dragOffset.x, y: dragOffset.y },
        { width: frame.width, height: frame.height },
        { snapToGrid, gridSize, snapValue },
      );
      const newX = rect.x;
      const newY = rect.y;

      const updatedAnchors = updateAnchorsFromBounds(frame.anchors, newX, newY, frame.width, frame.height);

      dragTempPositionRef.current = {
        frameId: draggedFrameId,
        x: newX,
        y: newY,
        width: frame.width,
        height: frame.height,
        anchors: updatedAnchors,
      };

      setProject({
        ...project,
        frames: {
          ...project.frames,
          [draggedFrameId]: { ...frame, x: newX, y: newY, anchors: updatedAnchors },
          ...computeMultiDragFrames(project, dragMultiStartRef.current, draggedFrameId, newX, newY),
        },
      });
    }
  }, [isDragging, draggedFrameId, canvasRef, scale, offset, dragOffset, snapToGrid, gridSize, snapValue]);

  const endDrag = useCallback(() => {
    if (!isDragging || !draggedFrameId) {
      setIsDragging(false);
      setDraggedFrameId(null);
      setDragStartState(null);
      dragTempPositionRef.current = null;
      return;
    }

    const { project, setProject } = useProjectStore.getState();

    if (dragStartState) {
      const finalPos = dragTempPositionRef.current;
      const currentFrame = project.frames[draggedFrameId];

      if (currentFrame && finalPos) {
        // 确保最终位置已同步
        if (currentFrame.x !== finalPos.x || currentFrame.y !== finalPos.y) {
          setProject({
            ...project,
            frames: {
              ...project.frames,
              [draggedFrameId]: { ...currentFrame, x: finalPos.x, y: finalPos.y, anchors: finalPos.anchors },
            },
          });
        }

        // 位置变化才记录 undo
        if (finalPos.x !== dragStartState.x || finalPos.y !== dragStartState.y) {
          const command = new UpdateFrameCommand(draggedFrameId, {
            x: finalPos.x,
            y: finalPos.y,
            anchors: finalPos.anchors,
          });
          (command as any).previousState = {
            x: dragStartState.x,
            y: dragStartState.y,
            anchors: dragStartState.anchors,
          };
          useCommandStore.getState().pushCommand(command);
        }
      } else if (currentFrame) {
        // 没有 temp ref 的兼容路径
        if (currentFrame.x !== dragStartState.x || currentFrame.y !== dragStartState.y) {
          const command = new UpdateFrameCommand(draggedFrameId, {
            x: currentFrame.x,
            y: currentFrame.y,
            anchors: currentFrame.anchors,
          });
          (command as any).previousState = {
            x: dragStartState.x,
            y: dragStartState.y,
            anchors: dragStartState.anchors,
          };
          useCommandStore.getState().pushCommand(command);
        }
      }
    }

    // 多选拖拽：其余选中帧的批量 undo——组合命令，一次 Ctrl+Z 全撤（逆序恢复）。
    const multiStarts = dragMultiStartRef.current;
    if (multiStarts.size > 1) {
      const { project: curProject } = useProjectStore.getState();
      const commands: Command[] = [];
      multiStarts.forEach((s, id) => {
        if (id === draggedFrameId) return; // 主帧由上方单帧逻辑记录
        const f = curProject.frames[id];
        if (!f) return;
        if (f.x === s.x && f.y === s.y) return;
        const cmd = new UpdateFrameCommand(id, { x: f.x, y: f.y, anchors: f.anchors });
        (cmd as unknown as { previousState: unknown }).previousState = {
          x: s.x,
          y: s.y,
          anchors: s.anchors,
        };
        commands.push(cmd);
      });
      if (commands.length > 0) {
        useCommandStore.getState().pushCommand({
          execute: () => commands.forEach(c => c.execute()),
          undo: () => [...commands].reverse().forEach(c => c.undo()),
          redo: () => commands.forEach(c => c.redo()),
        });
      }
    }
    dragMultiStartRef.current = new Map();

    setIsDragging(false);
    setDraggedFrameId(null);
    setDragStartState(null);
    dragTempPositionRef.current = null;
  }, [isDragging, draggedFrameId, dragStartState]);

  return { isDragging, draggedFrameId, startDrag, updateDrag, endDrag };
}
