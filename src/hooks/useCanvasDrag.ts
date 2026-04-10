import React, { useState, useRef, useCallback } from 'react';
import { FramePoint, FrameAnchor } from '../types';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { updateAnchorsFromBounds, calculatePositionFromAnchors, getAnchorPosition, getAnchorOffsetWc3 } from '../utils/anchorUtils';
import { pixelToWc3X, pixelToWc3Y } from '../utils/coordinateService';
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

const UPDATE_THROTTLE_MS = 16; // ~60fps

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
        },
      });
    } else {
      let newX = Math.max(0, Math.min(WC3_MAX_X - frame.width, mouseWc3X - dragOffset.x));
      let newY = Math.max(0, Math.min(WC3_MAX_Y - frame.height, mouseWc3Y - dragOffset.y));

      if (snapToGrid) {
        newX = snapValue(newX, gridSize);
        newY = snapValue(newY, gridSize);
      }

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
          const { undoStack } = useCommandStore.getState();
          useCommandStore.setState({ undoStack: [...undoStack, command], redoStack: [] });
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
          const { undoStack } = useCommandStore.getState();
          useCommandStore.setState({ undoStack: [...undoStack, command], redoStack: [] });
        }
      }
    }

    setIsDragging(false);
    setDraggedFrameId(null);
    setDragStartState(null);
    dragTempPositionRef.current = null;
  }, [isDragging, draggedFrameId, dragStartState]);

  return { isDragging, draggedFrameId, startDrag, updateDrag, endDrag };
}
