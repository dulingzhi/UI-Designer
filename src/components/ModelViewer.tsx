import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';
import { mpqManager } from '../utils/mpqManager';

interface MdxVertex {
  x: number;
  y: number;
  z: number;
}

interface MdxNormal {
  x: number;
  y: number;
  z: number;
}

interface MdxUV {
  u: number;
  v: number;
}

interface MdxFace {
  indices: [number, number, number];
}

interface MdxBoundingBox {
  min: MdxVertex;
  max: MdxVertex;
}

interface MdxModel {
  version: number;
  name: string;
  vertices: MdxVertex[];
  normals: MdxNormal[];
  uvs: MdxUV[];
  faces: MdxFace[];
  bounds: MdxBoundingBox;
}

interface ModelViewerProps {
  modelPath: string; // MDX 文件路径（相对或绝对）
  projectDir?: string; // 项目目录（用于查找本地文件）
  width: number;
  height: number;
  className?: string;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  modelPath,
  projectDir,
  width,
  height,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!containerRef.current || !modelPath) return;

    // 初始化 Three.js 场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    sceneRef.current = scene;

    // 相机设置
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 0, 500);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // 渲染器设置
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 添加定向光
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    // 加载并解析 MDX 模型
    loadModel();

    // 动画循环
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      
      // 旋转模型
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.01;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    // 清理函数
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (containerRef.current && rendererRef.current?.domElement) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
    };
  }, [modelPath, projectDir, width, height]);

  const loadModel = async () => {
    try {
      if (!sceneRef.current) return;

      let modelJson: string | null = null;
      
      // 策略 1: 尝试从项目本地目录加载
      if (projectDir) {
        try {
          const localModelPath = await join(projectDir, modelPath);
          
          // 检查文件是否存在
          if (await exists(localModelPath)) {
            console.log('从本地文件加载 MDX:', localModelPath);
            modelJson = await invoke<string>('parse_mdx_from_file', {
              filePath: localModelPath,
            });
          }
        } catch (localError) {
          console.log('本地文件加载失败，尝试 MPQ:', localError);
        }
      }

      // 策略 2: 如果本地加载失败，从 MPQ 加载
      if (!modelJson) {
        console.log('从 MPQ 档案加载 MDX:', modelPath);
        const status = mpqManager.getStatus();
        
        if (!status.war3Path) {
          throw new Error('未设置 War3 路径，无法从 MPQ 加载模型');
        }

        // 尝试所有已加载的 MPQ 档案
        const loadedArchives = status.archives.filter(a => a.loaded);
        if (loadedArchives.length === 0) {
          throw new Error('没有可用的 MPQ 档案');
        }

        let lastError: Error | null = null;
        
        for (const archive of loadedArchives) {
          try {
            const mpqArchivePath = await join(status.war3Path, archive.name);
            console.log(`尝试从 ${archive.name} 加载: ${modelPath}`);
            
            modelJson = await invoke<string>('parse_mdx_from_mpq', {
              archivePath: mpqArchivePath,
              fileName: modelPath,
            });
            
            if (modelJson) {
              console.log('从 MPQ 档案加载成功:', archive.name);
              break;
            }
          } catch (error) {
            console.log(`从 ${archive.name} 加载失败:`, error);
            lastError = error as Error;
            // 继续尝试下一个档案
          }
        }
        
        // 如果所有档案都失败，抛出最后的错误
        if (!modelJson && lastError) {
          throw lastError;
        }
      }

      // 如果仍然没有加载成功，抛出错误
      if (!modelJson) {
        throw new Error('无法从本地或 MPQ 加载模型: ' + modelPath);
      }

      const model: MdxModel = JSON.parse(modelJson);
      console.log('MDX 模型已加载:', model.name, model.vertices.length, '顶点');

      // 创建 Three.js 几何体
      const geometry = new THREE.BufferGeometry();

      // 顶点数据
      const positions = new Float32Array(model.vertices.length * 3);
      model.vertices.forEach((v, i) => {
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
      });
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // 法线数据
      if (model.normals.length === model.vertices.length) {
        const normals = new Float32Array(model.normals.length * 3);
        model.normals.forEach((n, i) => {
          normals[i * 3] = n.x;
          normals[i * 3 + 1] = n.y;
          normals[i * 3 + 2] = n.z;
        });
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      } else {
        geometry.computeVertexNormals();
      }

      // UV 数据
      if (model.uvs.length > 0) {
        const uvs = new Float32Array(model.uvs.length * 2);
        model.uvs.forEach((uv, i) => {
          uvs[i * 2] = uv.u;
          uvs[i * 2 + 1] = uv.v;
        });
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      }

      // 面数据（索引）
      if (model.faces.length > 0) {
        const indices = new Uint16Array(model.faces.length * 3);
        model.faces.forEach((face, i) => {
          indices[i * 3] = face.indices[0];
          indices[i * 3 + 1] = face.indices[1];
          indices[i * 3 + 2] = face.indices[2];
        });
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
      }

      // 材质（默认灰色）
      const material = new THREE.MeshStandardMaterial({
        color: 0x888888,
        metalness: 0.3,
        roughness: 0.7,
        side: THREE.DoubleSide,
      });

      // 创建 Mesh
      const mesh = new THREE.Mesh(geometry, material);

      // 自动缩放以适应视口
      const boundingBox = new THREE.Box3().setFromObject(mesh);
      const center = boundingBox.getCenter(new THREE.Vector3());
      const size = boundingBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 200 / maxDim; // 缩放到合适大小
      mesh.scale.setScalar(scale);
      mesh.position.sub(center.multiplyScalar(scale));

      // 移除旧模型，添加新模型
      if (meshRef.current) {
        sceneRef.current.remove(meshRef.current);
        meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
          meshRef.current.material.forEach((m) => m.dispose());
        } else {
          meshRef.current.material.dispose();
        }
      }

      sceneRef.current.add(mesh);
      meshRef.current = mesh;
    } catch (error) {
      console.error('MDX 加载失败:', error);
      // 显示错误占位符
      showErrorPlaceholder(String(error));
    }
  };

  const showErrorPlaceholder = (errorMessage: string) => {
    if (!sceneRef.current) return;

    // 创建一个简单的立方体作为错误指示
    const geometry = new THREE.BoxGeometry(100, 100, 100);
    const material = new THREE.MeshBasicMaterial({ 
      color: 0xff0000, 
      wireframe: true 
    });
    const cube = new THREE.Mesh(geometry, material);

    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
    }

    sceneRef.current.add(cube);
    meshRef.current = cube;

    console.error('模型加载失败:', errorMessage);
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
};

export default ModelViewer;
