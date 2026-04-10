import React, { useState, useRef, useCallback } from 'react';
import { FrameAnchor } from '../types';
import { ResizeDirection } from '../components/ResizeHandles';
import { useProjectStore } from '../store/projectStore';
import { useCommandStore } from '../store/commandStore';
import { UpdateFrameCommand } from '../commands/FrameCommands';
import { updateAnchorsFromBounds } from '../utils/anchorUtils';
import { pixelDeltaToWc3X, pixelDeltaToWc3Y } from '../utils/coordinateService';
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

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

    let newX = resizeStartSize.x;
    let newY = resizeStartSize.y;
    let newWidth = resizeStartSize.width;
    let newHeight = resizeStartSize.height;

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
      newHeight = Math.max(0.01, resizeStartSize.height + deltaWc3Y);
    }
    if (resizeDirection.includes('s')) {
      const oldTop = resizeStartSize.y + resizeStartSize.height;
      newY = Math.max(0, resizeStartSize.y + deltaWc3Y);
      newHeight = Math.max(0.01, oldTop - newY);
    }

    // Shift 保持纵横比
    if (isShiftPressed && (resizeDirection === 'ne' || resizeDirection === 'nw' || resizeDirection === 'se' || resizeDirection === 'sw')) {
      const aspectRatio = resizeStartSize.width / resizeStartSize.height;
      if (Math.abs(newWidth - resizeStartSize.width) > Math.abs(newHeight - resizeStartSize.height)) {
        newHeight = newWidth / aspectRatio;
      } else {
        newWidth = newHeight * aspectRatio;
      }
    }

    // 边界限制
    newX = Math.max(0, Math.min(WC3_MAX_X - newWidth, newX));
    newY = Math.max(0, Math.min(WC3_MAX_Y - newHeight, newY));
    newWidth = Math.max(0.01, Math.min(WC3_MAX_X - newX, newWidth));
    newHeight = Math.max(0.01, Math.min(WC3_MAX_Y - newY, newHeight));

    if (snapToGrid) {
      newX = snapValue(newX, gridSize);
      newY = snapValue(newY, gridSize);
      newWidth = snapValue(newWidth, gridSize);
      newHeight = snapValue(newHeight, gridSize);
    }

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
