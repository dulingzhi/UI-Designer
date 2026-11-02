import React, { useState, useRef, useCallback } from 'react';
import { FrameAnchor } from '../types';
import { ResizeDirection } from '../components/ResizeHandles';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { updateAnchorsFromBounds } from '../utils/anchorUtils';
import { pixelDeltaToWc3X, pixelDeltaToWc3Y } from '../utils/coordinateService';
import { computeResizeRect } from '../utils/frameTransforms';

const UPDATE_THROTTLE_MS = 16;

interface TempPosition {
  frameId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  anchors: FrameAnchor[];
}

export interface UseCanvasResizeOptions {
  scale: number;
  snapValue: (value: number, gridSize: number) => number;
  snapToGrid: boolean;
  gridSize: number;
}

export interface UseCanvasResizeReturn {
  isResizing: boolean;
  resizeFrameId: string | null;
  startResize: (frameId: string) => (e: React.MouseEvent, direction: ResizeDirection) => void;
  updateResize: (e: React.MouseEvent) => void;
  endResize: () => void;
}

export function useCanvasResize({
  scale,
  snapValue,
  snapToGrid,
  gridSize,
}: UseCanvasResizeOptions): UseCanvasResizeReturn {
  const [isResizing, setIsResizing] = useState(false);
  const [resizeFrameId, setResizeFrameId] = useState<string | null>(null);
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection | null>(null);
  const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [resizeStartAnchors, setResizeStartAnchors] = useState<FrameAnchor[] | null>(null);

  const resizeTempPositionRef = useRef<TempPosition | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const startResize = useCallback((frameId: string) => {
    return (e: React.MouseEvent, direction: ResizeDirection) => {
      const { project } = useProjectStore.getState();
      const frame = project.frames[frameId];
      if (!frame) return;

      setResizeStartAnchors(JSON.parse(JSON.stringify(frame.anchors)));
      setIsResizing(true);
      setResizeFrameId(frameId);
      setResizeDirection(direction);
      setResizeStartPos({ x: e.clientX, y: e.clientY });
      setResizeStartSize({ x: frame.x, y: frame.y, width: frame.width, height: frame.height });
    };
  }, []);

  const updateResize = useCallback((e: React.MouseEvent) => {
    if (!isResizing || !resizeFrameId || !resizeDirection) return;

    const now = Date.now();
    if (now - lastUpdateTimeRef.current < UPDATE_THROTTLE_MS) return;
    lastUpdateTimeRef.current = now;

    const { project, setProject } = useProjectStore.getState();
    const frame = project.frames[resizeFrameId];
    if (!frame) return;

    const deltaX = (e.clientX - resizeStartPos.x) / scale;
    const deltaY = (e.clientY - resizeStartPos.y) / scale;
    const deltaWc3X = pixelDeltaToWc3X(deltaX);
    const deltaWc3Y = -pixelDeltaToWc3Y(deltaY);

    const isShiftPressed = e.shiftKey;

    // 几何计算统一走 frameTransforms（可单测；语义严格对齐原实现）
    const rect = computeResizeRect(
      resizeStartSize,
      resizeDirection,
      { x: deltaWc3X, y: deltaWc3Y },
      isShiftPressed,
      { snapToGrid, gridSize, snapValue },
    );
    const newX = rect.x;
    const newY = rect.y;
    const newWidth = rect.width;
    const newHeight = rect.height;

    const updatedAnchors = updateAnchorsFromBounds(frame.anchors, newX, newY, newWidth, newHeight);

    resizeTempPositionRef.current = {
      frameId: resizeFrameId,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      anchors: updatedAnchors,
    };

    setProject({
      ...project,
      frames: {
        ...project.frames,
        [resizeFrameId]: { ...frame, x: newX, y: newY, width: newWidth, height: newHeight, anchors: updatedAnchors },
      },
    });
  }, [isResizing, resizeFrameId, resizeDirection, resizeStartPos, resizeStartSize, scale, snapToGrid, gridSize, snapValue]);

  const endResize = useCallback(() => {
    if (!isResizing || !resizeFrameId) {
      setIsResizing(false);
      setResizeFrameId(null);
      setResizeDirection(null);
      setResizeStartAnchors(null);
      resizeTempPositionRef.current = null;
      return;
    }

    if (resizeStartAnchors) {
      const { project } = useProjectStore.getState();
      const currentFrame = project.frames[resizeFrameId];
      if (currentFrame) {
        const sizeChanged =
          currentFrame.x !== resizeStartSize.x ||
          currentFrame.y !== resizeStartSize.y ||
          currentFrame.width !== resizeStartSize.width ||
          currentFrame.height !== resizeStartSize.height;

        if (sizeChanged) {
          const command = new UpdateFrameCommand(resizeFrameId, {
            x: currentFrame.x,
            y: currentFrame.y,
            width: currentFrame.width,
            height: currentFrame.height,
            anchors: currentFrame.anchors,
          });
          (command as any).previousState = {
            x: resizeStartSize.x,
            y: resizeStartSize.y,
            width: resizeStartSize.width,
            height: resizeStartSize.height,
            anchors: resizeStartAnchors,
          };
          const { undoStack } = useCommandStore.getState();
          useCommandStore.setState({ undoStack: [...undoStack, command], redoStack: [] });
        }
      }
    }

    setIsResizing(false);
    setResizeFrameId(null);
    setResizeDirection(null);
    setResizeStartAnchors(null);
    resizeTempPositionRef.current = null;
  }, [isResizing, resizeFrameId, resizeStartAnchors, resizeStartSize]);

  return { isResizing, resizeFrameId, startResize, updateResize, endResize };
}
