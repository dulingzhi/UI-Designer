import React, { useState, useEffect, useCallback } from 'react';
import { computeWheelScale, startPanAnchor, computePanOffset } from '../utils/canvasViewTransforms';

export interface UseCanvasPanOptions {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  showRulers: boolean;
}

export interface UseCanvasPanReturn {
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  offset: { x: number; y: number };
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  isPanning: boolean;
  containerSize: { width: number; height: number };
  startPan: (e: React.MouseEvent) => void;
  updatePan: (e: React.MouseEvent) => void;
  endPan: () => void;
}

export function useCanvasPan({ canvasRef, containerRef, showRulers }: UseCanvasPanOptions): UseCanvasPanReturn {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // 滚轮缩放（原生事件防 passive 警告）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        setScale(prev => computeWheelScale(prev, e.deltaY));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => { canvas.removeEventListener('wheel', handleWheel); };
  }, []);

  // 容器尺寸监听
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerSize(entry.contentRect);
      }
    });
    ro.observe(container);
    return () => { ro.disconnect(); };
  }, [showRulers]);

  const startPan = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart(startPanAnchor(e.clientX, e.clientY, offset));
  }, [offset]);

  const updatePan = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setOffset(computePanOffset(e.clientX, e.clientY, panStart));
  }, [isPanning, panStart]);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  return {
    scale, setScale,
    offset, setOffset,
    isPanning,
    containerSize,
    startPan, updatePan, endPan,
  };
}
