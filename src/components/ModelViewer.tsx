import React, { useEffect, useRef, useState } from 'react';
import { vec3, mat4, quat } from 'gl-matrix';
import { join } from '@tauri-apps/api/path';
import { exists, readFile } from '@tauri-apps/plugin-fs';
import { mpqManager } from '../utils/mpqManager';
// @ts-ignore - war3-model 是 TypeScript 源码，没有类型定义
import { parseMDX, ModelRenderer, decodeBLP, getBLPImageData } from 'war3-model';

interface ModelViewerProps {
  modelPath: string; // MDX 文件路径（相对或绝对）
  projectDir?: string; // 项目目录（用于查找本地文件）
  width: number;
  height: number;
  className?: string;
  cameraYaw?: number; // 相机水平旋转角度（弧度），默认 0
  cameraPitch?: number; // 相机俯仰角度（弧度），默认 0.3
  cameraDistance?: number; // 相机距离，默认 300
}

function calcCameraQuat(position: vec3, target: vec3): quat {
  const dir = vec3.create();
  vec3.subtract(dir, target, position);
  vec3.normalize(dir, dir);

  const up = vec3.fromValues(0, 0, 1);
  const right = vec3.create();
  vec3.cross(right, up, dir);
  vec3.normalize(right, dir);

  const actualUp = vec3.create();
  vec3.cross(actualUp, dir, right);

  const rotationMatrix = mat4.create();
  mat4.set(
    rotationMatrix,
    right[0], right[1], right[2], 0,
    actualUp[0], actualUp[1], actualUp[2], 0,
    dir[0], dir[1], dir[2], 0,
    0, 0, 0, 1
  );

  const rotation = quat.create();
  mat4.getRotation(rotation, rotationMatrix);
  return rotation;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelPath,
  projectDir,
  width,
  height,
  className,
  cameraYaw = 0,
  cameraPitch = 0.3,
  cameraDistance = 300,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRendererRef = useRef<ModelRenderer | null>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const [error, setError] = useState<string | null>(null);
  
  // 存储相机参数的ref,用于渲染时更新
  const cameraParamsRef = useRef({ yaw: cameraYaw, pitch: cameraPitch, distance: cameraDistance });
  
  // 更新相机参数ref
  useEffect(() => {
    cameraParamsRef.current = { yaw: cameraYaw, pitch: cameraPitch, distance: cameraDistance };
  }, [cameraYaw, cameraPitch, cameraDistance]);

  // 分离的 useEffect: 处理模型加载
  useEffect(() => {
    if (!canvasRef.current || !modelPath) return;

    let cancelled = false;
    const canvas = canvasRef.current;

    const loadAndRenderModel = async () => {
      try {
        setError(null);

        // 尝试本地加载
        let modelBuffer: ArrayBuffer | null = null;
        
        if (projectDir) {
          const fullPath = await join(projectDir, modelPath);
          const fileExists = await exists(fullPath);
          
          if (fileExists) {
            const uint8Array = await readFile(fullPath);
            modelBuffer = uint8Array.buffer;
            console.log(`✅ 从本地加载 MDX: ${fullPath}`);
          }
        }

        // 如果本地不存在，从 MPQ 加载
        if (!modelBuffer) {
          console.log(`🔍 从 MPQ 档案加载: ${modelPath}`);
          modelBuffer = await mpqManager.readFile(modelPath);
          
          if (modelBuffer) {
            console.log(`✅ 从 MPQ 加载成功`);
          }
        }

        if (!modelBuffer) {
          throw new Error(`无法加载模型: ${modelPath}`);
        }

        if (cancelled) return;

        // 解析 MDX
        const model = parseMDX(modelBuffer);
        console.log('📦 MDX 模型已解析:', {
          version: model.Version,
          name: model.Info?.Name,
          geosets: model.Geosets?.length || 0,
          textures: model.Textures?.length || 0,
          sequences: model.Sequences?.length || 0
        });

        // 创建 ModelRenderer
        const modelRenderer = new ModelRenderer(model);
        modelRendererRef.current = modelRenderer;

        // 初始化 WebGL
        let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
        try {
          gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          if (!gl) {
            throw new Error('无法创建 WebGL 上下文');
          }

          gl.clearColor(0.1, 0.1, 0.1, 1.0);
          gl.enable(gl.DEPTH_TEST);
          gl.depthFunc(gl.LEQUAL);
          gl.viewport(0, 0, canvas.width, canvas.height);

          glRef.current = gl as WebGLRenderingContext;
          modelRenderer.initGL(gl as WebGLRenderingContext);

          console.log('🎨 WebGL 上下文已初始化');
        } catch (err) {
          console.error('WebGL 初始化失败:', err);
          throw err;
        }

        // 加载模型纹理
        console.log('🖼️ 开始加载纹理:', model.Textures?.length || 0, '个');
        
        if (model.Textures && model.Textures.length > 0) {
          // 异步加载所有纹理
          const texturePromises = model.Textures.map(async (texture) => {
            if (!texture.Image || texture.ReplaceableId) {
              // 跳过可替换纹理（如团队颜色）
              return;
            }

            try {
              // 从 MPQ 加载 BLP 文件
              const texturePath = texture.Image.replace(/\\/g, '/');
              const blpBuffer = await mpqManager.readFile(texturePath);
              
              if (!blpBuffer) {
                console.warn(`⚠️ 找不到纹理: ${texturePath}`);
                return;
              }

              // 解码 BLP 为 BLPImage
              const blpImage = decodeBLP(blpBuffer);
              
              // 获取 mipmap level 0 的 ImageData
              const imageData = getBLPImageData(blpImage, 0);
              
              if (!imageData) {
                console.warn(`⚠️ BLP 解码失败: ${texturePath}`);
                return;
              }

              // 创建 Image 对象
              const canvas = document.createElement('canvas');
              canvas.width = imageData.width;
              canvas.height = imageData.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                // 将 ImageData 转换为标准 ImageData (处理 colorSpace)
                const standardImageData = new ImageData(
                  new Uint8ClampedArray(imageData.data),
                  imageData.width,
                  imageData.height
                );
                ctx.putImageData(standardImageData, 0, 0);
                
                const img = new Image();
                img.onload = () => {
                  modelRenderer.setTextureImage(texture.Image, img);
                  console.log(`✅ 纹理已设置: ${texture.Image}`);
                };
                img.src = canvas.toDataURL();
              }
            } catch (err) {
              console.warn(`⚠️ 加载纹理失败: ${texture.Image}`, err);
            }
          });

          // 等待所有纹理加载完成（不阻塞渲染）
          Promise.all(texturePromises).then(() => {
            console.log('🖼️ 所有纹理处理完成');
          });
        } else {
          console.log('ℹ️ 模型没有纹理');
        }

        // 设置相机和矩阵
        const pMatrix = mat4.create();
        const mvMatrix = mat4.create();
        
        // 使用球面坐标计算相机位置
        // yaw: 水平旋转 (0 = 正前方, π/2 = 右侧, π = 背后, -π/2 = 左侧)
        // pitch: 俯仰角 (0 = 平视, π/2 = 俯视)
        const x = cameraDistance * Math.cos(cameraPitch) * Math.sin(cameraYaw);
        const y = -cameraDistance * Math.cos(cameraPitch) * Math.cos(cameraYaw);
        const z = cameraDistance * Math.sin(cameraPitch) + 50; // 50 是目标高度偏移
        
        const cameraPos = vec3.fromValues(x, y, z);
        const cameraTarget = vec3.fromValues(0, 0, 50);
        const cameraUp = vec3.fromValues(0, 0, 1);
        const cameraQuat = calcCameraQuat(cameraPos, cameraTarget);

        mat4.perspective(pMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 3000.0);
        mat4.lookAt(mvMatrix, cameraPos, cameraTarget, cameraUp);

        modelRenderer.setCamera(cameraPos, cameraQuat);

        console.log('📷 相机设置:', {
          yaw: (cameraYaw * 180 / Math.PI).toFixed(1) + '°',
          pitch: (cameraPitch * 180 / Math.PI).toFixed(1) + '°',
          distance: cameraDistance,
          position: { x: x.toFixed(1), y: y.toFixed(1), z: z.toFixed(1) }
        });

        // 设置默认团队颜色
        modelRenderer.setTeamColor([1.0, 0.0, 0.0]);

        // 如果有动画，播放第一个
        if (model.Sequences && model.Sequences.length > 0) {
          const firstSeq = model.Sequences[0];
          modelRenderer.setSequence(0);
          console.log(`🎬 播放动画: ${firstSeq.Name || 'Sequence 0'} (${model.Sequences.length} 个动画)`);
        }

        // 渲染循环
        startTimeRef.current = performance.now();
        
        // 存储矩阵引用
        const pMatrixRef = pMatrix;
        const mvMatrixRef = mvMatrix;
        
        const animate = (timestamp: number) => {
          if (cancelled) return;

          const delta = timestamp - startTimeRef.current;
          startTimeRef.current = timestamp;

          // 更新模型动画
          modelRenderer.update(delta);

          // 使用最新的相机参数重新计算相机位置和矩阵
          const params = cameraParamsRef.current;
          const x = params.distance * Math.cos(params.pitch) * Math.sin(params.yaw);
          const y = -params.distance * Math.cos(params.pitch) * Math.cos(params.yaw);
          const z = params.distance * Math.sin(params.pitch) + 50;
          
          const newCameraPos = vec3.fromValues(x, y, z);
          const cameraTarget = vec3.fromValues(0, 0, 50);
          const cameraUp = vec3.fromValues(0, 0, 1);
          const newCameraQuat = calcCameraQuat(newCameraPos, cameraTarget);
          
          mat4.lookAt(mvMatrixRef, newCameraPos, cameraTarget, cameraUp);
          modelRenderer.setCamera(newCameraPos, newCameraQuat);

          // 清除画布
          gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);

          // 渲染模型
          modelRenderer.render(mvMatrixRef, pMatrixRef, {
            wireframe: false
          });

          animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

      } catch (err) {
        console.error('❌ 模型加载失败:', err);
        setError(err instanceof Error ? err.message : String(err));
      }
    };

    loadAndRenderModel();

    return () => {
      cancelled = true;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [modelPath, projectDir]);

  // 分离的 useEffect: 处理尺寸变化
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;

    // 如果已经有 GL 上下文，更新视口
    if (glRef.current) {
      glRef.current.viewport(0, 0, width, height);
    }
  }, [width, height]);

  return (
    <div 
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'absolute',
        top: 0,
        left: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: '#ff4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontSize: '14px',
            textAlign: 'center'
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default ModelViewer;

