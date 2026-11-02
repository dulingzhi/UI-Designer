import React, { useState, useEffect, useCallback } from 'react';
import { startPanAnchor, computePanOffset, computeWheelZoomAt } from '../utils/canvasViewTransforms';

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
  // round 159：滚轮锚定缩放需要 handler 内读最新值——effect 依赖 [] 只挂一次，用 ref 镜像
  const scaleRef = React.useRef(scale);
  const offsetRef = React.useRef(offset);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // ref 镜像同步（round 159）
  React.useEffect(() => { scaleRef.current = scale; }, [scale]);
  React.useEffect(() => { offsetRef.current = offset; }, [offset]);
// 滚轮缩放（原生事件防 passive 警告）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        // round 159：锚定缩放——保持鼠标下世界点屏幕位置不动（VS Code/Figma 同款）
        const { scale: ns, offset: noff } = computeWheelZoomAt(
          scaleRef.current,
          e.deltaY,
          { x: e.clientX, y: e.clientY },
          offsetRef.current,
        );
        setScale(ns);
        setOffset(noff);
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
