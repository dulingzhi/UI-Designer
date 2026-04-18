// ============================================================
// MDXModelViewer — WebGPU 版 MDX 模型查看器
// ============================================================
// 使用 three/webgpu + 自研 mdx/ 适配器（替代 war3-model 的 WebGL ModelRenderer）。
// 与原 ModelViewer.tsx 并存，兼容相同的 props。

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { join } from '@tauri-apps/api/path';
import { exists, readFile } from '@tauri-apps/plugin-fs';
import { mpqManager } from '../utils/mpqManager';
import { decodeBLPToRGBA, blpImageDataToImageData } from '../utils/rustBridge';
import { MDXModel, type MdxTextureResolver } from '../renderer/mdx/MDXModel';

interface MDXModelViewerProps {
  modelPath: string;
  projectDir?: string;
  width: number;
  height: number;
  className?: string;
  cameraYaw?: number;
  cameraPitch?: number;
  cameraDistance?: number;
  /** 团队颜色索引 (0-27)，用于 MDX ReplaceableId=1/2 纹理替换。默认 0 (红) */
  teamColor?: number;
  onCameraChange?: (params: { yaw: number; pitch: number; distance: number }) => void;
}

/** WC3 团队颜色 RGB（0-27），用于 MPQ 中找不到纹理时的纯色回退 */
const TEAM_COLORS_RGB: Array<[number, number, number]> = [
  [1.00, 0.02, 0.02], [0.00, 0.26, 1.00], [0.10, 0.90, 0.68], [0.33, 0.00, 0.51],
  [1.00, 1.00, 0.00], [1.00, 0.53, 0.00], [0.13, 0.78, 0.00], [0.89, 0.37, 0.69],
  [0.58, 0.58, 0.58], [0.49, 0.75, 1.00], [0.06, 0.38, 0.27], [0.30, 0.17, 0.02],
  [0.61, 0.00, 0.00], [0.00, 0.00, 0.77], [0.00, 0.91, 0.91], [0.31, 0.00, 0.30],
  [0.78, 0.48, 0.20], [0.75, 0.62, 0.50], [0.50, 0.60, 0.29], [0.30, 0.35, 0.18],
  [0.49, 0.38, 0.19], [0.60, 0.75, 1.00], [0.77, 0.44, 0.77], [0.73, 0.73, 0.73],
  [0.06, 0.27, 0.42], [0.38, 0.11, 0.80], [0.62, 0.28, 0.09], [0.70, 0.15, 0.13],
];

/** 构造 ReplaceableId=1/2 对应的 MPQ 纹理路径 */
function getReplaceablePath(replaceableId: number, teamColor: number): string | null {
  const idx = String(Math.max(0, Math.min(27, teamColor))).padStart(2, '0');
  if (replaceableId === 1) return `ReplaceableTextures\\TeamColor\\TeamColor${idx}.blp`;
  if (replaceableId === 2) return `ReplaceableTextures\\TeamGlow\\TeamGlow${idx}.blp`;
  return null;
}

/** 生成 1×1 纯色 Texture，作为 TeamColor 的回退 */
function createSolidColorTexture(rgb: [number, number, number]): THREE.DataTexture {
  const data = new Uint8Array([
    Math.round(rgb[0] * 255),
    Math.round(rgb[1] * 255),
    Math.round(rgb[2] * 255),
    255,
  ]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/** 加载 MDX 原始字节（本地优先，再尝试 MPQ） */
async function loadMdxBuffer(modelPath: string, projectDir?: string): Promise<ArrayBuffer> {
  if (projectDir) {
    const fullPath = await join(projectDir, modelPath);
    if (await exists(fullPath)) {
      const bytes = await readFile(fullPath);
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    }
  }
  const mpqBuf = await mpqManager.readFile(modelPath);
  if (!mpqBuf) throw new Error(`无法加载模型: ${modelPath}`);
  return mpqBuf;
}

/** 从 BLP 生成 THREE.DataTexture */
async function loadBLPAsTexture(texturePath: string): Promise<THREE.Texture | null> {
  try {
    const blpBuffer = await mpqManager.readFile(texturePath);
    if (!blpBuffer) return null;
    const blpImageData = await decodeBLPToRGBA(new Uint8Array(blpBuffer));
    if (!blpImageData) return null;
    const imgData = blpImageDataToImageData(blpImageData);

    const tex = new THREE.DataTexture(
      new Uint8Array(imgData.data.buffer),
      imgData.width,
      imgData.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType,
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.needsUpdate = true;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  } catch (err) {
    console.warn(`[MDXModelViewer] 纹理加载失败: ${texturePath}`, err);
    return null;
  }
}

export const MDXModelViewer: React.FC<MDXModelViewerProps> = ({
  modelPath,
  projectDir,
  width,
  height,
  className,
  cameraYaw = 0,
  cameraPitch = 0.3,
  cameraDistance = 300,
  teamColor = 0,
  onCameraChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sequences, setSequences] = useState<string[]>([]);
  const [currentSeq, setCurrentSeq] = useState<string>('');

  const rendererRef = useRef<WebGPURenderer | THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<MDXModel | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const cameraParamsRef = useRef({ yaw: cameraYaw, pitch: cameraPitch, distance: cameraDistance });

  // 同步外部相机参数
  useEffect(() => {
    cameraParamsRef.current = { yaw: cameraYaw, pitch: cameraPitch, distance: cameraDistance };
  }, [cameraYaw, cameraPitch, cameraDistance]);

  // 主加载 effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !modelPath) return;

    let cancelled = false;
    let renderer: WebGPURenderer | THREE.WebGLRenderer | null = null;
    let mdxModel: MDXModel | null = null;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. 初始化渲染器：优先 WebGPU，失败则回退 WebGL2
        const tryWebGPU = typeof navigator !== 'undefined' && !!(navigator as any).gpu;
        if (tryWebGPU) {
          try {
            const gpu = new WebGPURenderer({ canvas, antialias: true, alpha: true });
            gpu.setPixelRatio(window.devicePixelRatio);
            gpu.setSize(width, height, false);
            await gpu.init();
            renderer = gpu;
          } catch (gpuErr) {
            console.warn('[MDXModelViewer] WebGPU 初始化失败，回退到 WebGL:', gpuErr);
            renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(width, height, false);
          }
        } else {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
          renderer.setPixelRatio(window.devicePixelRatio);
          renderer.setSize(width, height, false);
        }
        if (cancelled) { renderer.dispose(); return; }

        // 2. 场景 + 相机
        const scene = new THREE.Scene();
        scene.background = null;
        const camera = new THREE.PerspectiveCamera(45, width / height, 1, 10000);

        // 3. 加载 MDX
        const buffer = await loadMdxBuffer(modelPath, projectDir);
        if (cancelled) return;

        const resolver: MdxTextureResolver = async (path, replaceableId) => {
          // ReplaceableId=1 (TeamColor) / =2 (TeamGlow)：替换为 MPQ 中的团队颜色纹理
          if (replaceableId === 1 || replaceableId === 2) {
            const replacePath = getReplaceablePath(replaceableId, teamColor)!;
            const loaded = await loadBLPAsTexture(replacePath);
            if (loaded) return loaded;
            // MPQ 中找不到：TeamColor 回退纯色，TeamGlow 回退透明
            if (replaceableId === 1) {
              return createSolidColorTexture(TEAM_COLORS_RGB[Math.max(0, Math.min(27, teamColor))]);
            }
            return createSolidColorTexture([0, 0, 0]);
          }
          // 其他 ReplaceableId（环境纹理等）暂不处理
          if (replaceableId) return null;
          if (!path) return null;
          return loadBLPAsTexture(path.replace(/\\/g, '/'));
        };

        mdxModel = await MDXModel.load(buffer, resolver);
        if (cancelled) { mdxModel.dispose(); return; }

        scene.add(mdxModel.root);

        // 4. 默认播放第一个序列
        const seqNames = mdxModel.getSequenceNames();
        setSequences(seqNames);
        if (seqNames.length > 0) {
          const stand = seqNames.find((n) => /stand/i.test(n)) ?? seqNames[0];
          mdxModel.playSequence(stand);
          setCurrentSeq(stand);
        }

        rendererRef.current = renderer;
        sceneRef.current = scene;
        cameraRef.current = camera;
        modelRef.current = mdxModel;
        setLoading(false);

        // 5. 渲染循环
        const clock = new THREE.Clock();
        const tick = () => {
          if (cancelled) return;
          animFrameRef.current = requestAnimationFrame(tick);

          const dt = clock.getDelta();
          modelRef.current?.update(dt, camera);

          const { yaw, pitch, distance } = cameraParamsRef.current;
          const cosP = Math.cos(pitch);
          camera.position.set(
            distance * cosP * Math.sin(yaw),
            distance * Math.sin(pitch),
            distance * cosP * Math.cos(yaw),
          );
          camera.lookAt(0, 0, 0);

          try {
            const result = (renderer as any).render(scene, camera);
            if (result && typeof result.catch === 'function') result.catch(() => {});
          } catch { /* 渲染错误（可能来自 WebGPU device lost） */ }
        };
        tick();
      } catch (err) {
        console.error('[MDXModelViewer] 加载失败:', err);
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
      mdxModel?.dispose();
      renderer?.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      modelRef.current = null;
    };
  }, [modelPath, projectDir, width, height, teamColor]);

  // 鼠标拖拽控制
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dragging = false;
    let lastX = 0, lastY = 0;

    const onDown = (e: MouseEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const p = cameraParamsRef.current;
      const next = {
        yaw: p.yaw - dx * 0.01,
        pitch: Math.max(-1.4, Math.min(1.4, p.pitch + dy * 0.01)),
        distance: p.distance,
      };
      cameraParamsRef.current = next;
      onCameraChange?.(next);
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = cameraParamsRef.current;
      const next = { ...p, distance: Math.max(20, Math.min(5000, p.distance * (1 + e.deltaY * 0.001))) };
      cameraParamsRef.current = next;
      onCameraChange?.(next);
    };

    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [onCameraChange]);

  return (
    <div className={className} style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ display: 'block', width, height, background: '#1a1a1a' }}
      />
      {loading && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#4a9eff', fontSize: 12, pointerEvents: 'none',
        }}>
          加载中...
        </div>
      )}
      {error && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#ff6b6b', fontSize: 12, padding: 8, textAlign: 'center',
        }}>
          {error}
        </div>
      )}
      {!loading && !error && sequences.length > 1 && (
        <select
          value={currentSeq}
          onChange={(e) => {
            setCurrentSeq(e.target.value);
            modelRef.current?.playSequence(e.target.value);
          }}
          style={{
            position: 'absolute', top: 4, left: 4, fontSize: 10, padding: '2px 4px',
            background: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid #444',
          }}
        >
          {sequences.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      )}
    </div>
  );
};
