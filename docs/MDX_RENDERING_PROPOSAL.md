# MDX/MDL 3D 模型渲染方案

## 📊 项目现状

### 已有基础设施
- ✅ **Tauri 2 后端** - Rust 可调用
- ✅ **MPQ 档案系统** - 已实现文件读取 (`wow-mpq` crate)
- ✅ **BLP 纹理解码** - 已实现 BLP 图像解码
- ✅ **模型属性** - `backgroundArt` 字段已添加到 FrameData
- ✅ **占位符显示** - 画布中显示模型文件名

### 技术栈
- **前端**: React 19 + TypeScript
- **后端**: Rust + Tauri 2
- **已有 Crates**: `wow-mpq`, `blp`, `image`, `base64`

---

## 🎯 三种实现方案对比

### 方案 1: Rust 解析 + WebGL 渲染 ⭐ **推荐**

#### 架构流程
```
MDX/MDL 文件 (MPQ)
    ↓
Rust 解析器 (Tauri Command)
    ↓
JSON 数据 (顶点、纹理、动画)
    ↓
React 组件
    ↓
Three.js / WebGL 渲染器
```

#### 优点
- ✅ Rust 高性能解析二进制格式
- ✅ 充分利用现有 MPQ 基础设施
- ✅ Three.js 成熟的 WebGL 渲染能力
- ✅ 前后端职责清晰分离

#### 缺点
- ⚠️ 需要实现 MDX 解析器
- ⚠️ 需要学习 Three.js
- ⚠️ 工作量中等

---

### 方案 2: 纯前端解析 + Three.js

#### 架构流程
```
MDX/MDL 文件 (MPQ)
    ↓
Tauri: 读取二进制数据
    ↓
TypeScript MDX Parser
    ↓
Three.js 渲染
```

#### 优点
- ✅ 不需要 Rust MDX 解析器
- ✅ 调试方便（浏览器工具）

#### 缺点
- ❌ TypeScript 解析二进制较慢
- ❌ 需要移植或实现 MDX 解析逻辑
- ❌ 没有现成的 TS MDX 库

---

### 方案 3: 预渲染静态图片

#### 架构流程
```
MDX/MDL 文件
    ↓
离线工具预渲染
    ↓
PNG 截图
    ↓
Canvas 直接显示图片
```

#### 优点
- ✅ 实现简单快速
- ✅ 性能好（只是图片）

#### 缺点
- ❌ 无法动态加载模型
- ❌ 需要预先准备所有截图
- ❌ 不支持动画预览

---

## 🚀 推荐方案：Rust + Three.js

### 技术栈选择

#### Rust 侧
- **MDX 解析**: 自己实现或参考现有项目
- **数据输出**: 序列化为 JSON
- **Crates**:
  ```toml
  [dependencies]
  serde = { version = "1", features = ["derive"] }
  serde_json = "1"
  byteorder = "1.5"  # 二进制解析
  ```

#### TypeScript 侧
- **3D 渲染**: Three.js
- **依赖**:
  ```json
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0"
  }
  ```

---

## 📐 MDX 文件格式简介

### 基本结构
```
MDX File
├── Header (魔数: "MDLX")
├── Version
├── Model Info
├── Chunks:
│   ├── VERS - Version
│   ├── MODL - Model
│   ├── SEQS - Sequences (动画)
│   ├── GEOS - Geosets (几何体)
│   ├── GEOA - Geoset Animations
│   ├── BONE - Bones (骨骼)
│   ├── TEXS - Textures
│   ├── MTLS - Materials
│   └── ...
```

### 关键数据结构

#### Geoset (几何体)
```rust
struct Geoset {
    vertices: Vec<[f32; 3]>,      // 顶点位置
    normals: Vec<[f32; 3]>,       // 法线
    tex_coords: Vec<[f32; 2]>,    // UV坐标
    vertex_groups: Vec<u8>,       // 骨骼组
    faces: Vec<u16>,              // 三角形索引
    material_id: u32,             // 材质ID
}
```

#### Material (材质)
```rust
struct Material {
    layers: Vec<Layer>,
}

struct Layer {
    texture_id: u32,              // 纹理ID
    blend_mode: BlendMode,        // 混合模式
    alpha: f32,                   // 透明度
}
```

#### Bone (骨骼)
```rust
struct Bone {
    name: String,
    object_id: u32,
    parent_id: i32,               // -1 表示根骨骼
    translation: Vec<Keyframe<[f32; 3]>>,
    rotation: Vec<Keyframe<[f32; 4]>>,
    scaling: Vec<Keyframe<[f32; 3]>>,
}
```

---

## 🛠️ 实现步骤

### Phase 1: Rust MDX 解析器 (核心)

#### 1.1 创建 MDX 模块
```bash
# src-tauri/src/mdx/
├── mod.rs          # 模块入口
├── parser.rs       # 主解析器
├── chunks.rs       # Chunk 定义
├── types.rs        # 数据结构
└── reader.rs       # 二进制读取工具
```

#### 1.2 基础解析器
```rust
// src-tauri/src/mdx/parser.rs
use byteorder::{LittleEndian, ReadBytesExt};
use std::io::{Cursor, Read};

pub struct MdxParser {
    data: Vec<u8>,
    cursor: usize,
}

impl MdxParser {
    pub fn new(data: Vec<u8>) -> Result<Self, String> {
        // 验证魔数
        if &data[0..4] != b"MDLX" {
            return Err("不是有效的 MDX 文件".to_string());
        }
        
        Ok(MdxParser { data, cursor: 0 })
    }
    
    pub fn parse(&mut self) -> Result<MdxModel, String> {
        let mut model = MdxModel::default();
        
        // 跳过魔数和版本
        self.cursor = 8;
        
        // 读取所有 Chunks
        while self.cursor < self.data.len() {
            let chunk = self.read_chunk()?;
            
            match chunk.tag.as_str() {
                "VERS" => model.version = self.parse_version(&chunk.data)?,
                "MODL" => model.model_info = self.parse_model(&chunk.data)?,
                "GEOS" => model.geosets = self.parse_geosets(&chunk.data)?,
                "TEXS" => model.textures = self.parse_textures(&chunk.data)?,
                "MTLS" => model.materials = self.parse_materials(&chunk.data)?,
                _ => {
                    // 忽略其他 chunk
                    println!("跳过未知 Chunk: {}", chunk.tag);
                }
            }
        }
        
        Ok(model)
    }
    
    fn read_chunk(&mut self) -> Result<Chunk, String> {
        let tag = String::from_utf8_lossy(&self.data[self.cursor..self.cursor+4]).to_string();
        self.cursor += 4;
        
        let size = self.read_u32()? as usize;
        let data = self.data[self.cursor..self.cursor+size].to_vec();
        self.cursor += size;
        
        Ok(Chunk { tag, data })
    }
    
    fn read_u32(&mut self) -> Result<u32, String> {
        let mut cursor = Cursor::new(&self.data[self.cursor..self.cursor+4]);
        self.cursor += 4;
        cursor.read_u32::<LittleEndian>()
            .map_err(|e| format!("读取失败: {}", e))
    }
}
```

#### 1.3 数据结构定义
```rust
// src-tauri/src/mdx/types.rs
use serde::Serialize;

#[derive(Default, Serialize)]
pub struct MdxModel {
    pub version: u32,
    pub model_info: ModelInfo,
    pub geosets: Vec<Geoset>,
    pub textures: Vec<String>,
    pub materials: Vec<Material>,
    pub bones: Vec<Bone>,
}

#[derive(Default, Serialize)]
pub struct Geoset {
    pub vertices: Vec<[f32; 3]>,
    pub normals: Vec<[f32; 3]>,
    pub tex_coords: Vec<[f32; 2]>,
    pub faces: Vec<u16>,
    pub material_id: u32,
}

#[derive(Default, Serialize)]
pub struct Material {
    pub priority_plane: i32,
    pub flags: u32,
    pub layers: Vec<MaterialLayer>,
}

#[derive(Serialize)]
pub struct MaterialLayer {
    pub texture_id: u32,
    pub blend_mode: u32,
    pub alpha: f32,
}
```

#### 1.4 Tauri Command
```rust
// src-tauri/src/lib.rs
use crate::mdx::parser::MdxParser;

#[tauri::command]
async fn parse_mdx_file(file_path: String) -> Result<serde_json::Value, String> {
    // 从 MPQ 读取文件
    let data = read_mpq_file(archive_path, file_path)?;
    
    // 解析 MDX
    let mut parser = MdxParser::new(data)?;
    let model = parser.parse()?;
    
    // 序列化为 JSON
    serde_json::to_value(&model)
        .map_err(|e| format!("序列化失败: {}", e))
}
```

### Phase 2: Three.js 渲染器

#### 2.1 创建 ModelViewer 组件
```tsx
// src/components/ModelViewer.tsx
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';

interface ModelViewerProps {
  modelPath: string;
  width: number;
  height: number;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({ 
  modelPath, 
  width, 
  height 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // 初始化场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);
    
    // 相机
    const camera = new THREE.PerspectiveCamera(
      45,
      width / height,
      0.1,
      1000
    );
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    
    // 渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    containerRef.current.appendChild(renderer.domElement);
    
    // 光源
    const ambientLight = new THREE.AmbientLight(0x404040);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);
    
    sceneRef.current = scene;
    rendererRef.current = renderer;
    
    // 加载模型
    loadModel(modelPath, scene);
    
    // 动画循环
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();
    
    // 清理
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [modelPath, width, height]);
  
  const loadModel = async (path: string, scene: THREE.Scene) => {
    try {
      // 调用 Rust 解析器
      const modelData = await invoke<any>('parse_mdx_file', { 
        filePath: path 
      });
      
      // 创建 Three.js 几何体
      modelData.geosets.forEach((geoset: any) => {
        const geometry = new THREE.BufferGeometry();
        
        // 设置顶点
        const vertices = new Float32Array(
          geoset.vertices.flat()
        );
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(vertices, 3)
        );
        
        // 设置法线
        if (geoset.normals.length > 0) {
          const normals = new Float32Array(
            geoset.normals.flat()
          );
          geometry.setAttribute(
            'normal',
            new THREE.BufferAttribute(normals, 3)
          );
        }
        
        // 设置UV
        if (geoset.tex_coords.length > 0) {
          const uvs = new Float32Array(
            geoset.tex_coords.flat()
          );
          geometry.setAttribute(
            'uv',
            new THREE.BufferAttribute(uvs, 2)
          );
        }
        
        // 设置索引
        geometry.setIndex(geoset.faces);
        
        // 创建材质
        const material = new THREE.MeshStandardMaterial({
          color: 0x808080,
          side: THREE.DoubleSide,
        });
        
        // 创建网格
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);
      });
      
    } catch (error) {
      console.error('加载模型失败:', error);
    }
  };
  
  return <div ref={containerRef} />;
};
```

#### 2.2 集成到 Canvas
```tsx
// src/components/Canvas.tsx
import { ModelViewer } from './ModelViewer';

// 在渲染 SPRITE/MODEL 控件时
{(frame.type === FrameType.MODEL || frame.type === FrameType.SPRITE) && 
 frame.backgroundArt && (
  <ModelViewer
    modelPath={frame.backgroundArt}
    width={frame.width * pixelScale}
    height={frame.height * pixelScale}
  />
)}
```

### Phase 3: 纹理加载

#### 3.1 加载 BLP 纹理
```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn load_mdx_texture(texture_path: String) -> Result<String, String> {
    // 从 MPQ 读取 BLP
    let blp_data = read_mpq_file(archive_path, texture_path)?;
    
    // 解码 BLP（已有实现）
    let image_data = decode_blp_to_png(blp_data)?;
    
    // 转为 Data URL
    let base64 = base64::encode(&image_data);
    Ok(format!("data:image/png;base64,{}", base64))
}
```

#### 3.2 在 Three.js 中应用
```typescript
// 加载纹理
const textureLoader = new THREE.TextureLoader();
const textureDataURL = await invoke<string>('load_mdx_texture', {
  texturePath: modelData.textures[geoset.material_id]
});

const texture = await textureLoader.loadAsync(textureDataURL);
material.map = texture;
material.needsUpdate = true;
```

---

## 📦 依赖安装

### Cargo.toml
```toml
[dependencies]
# 现有依赖
tauri = { version = "2", features = [] }
wow-mpq = "0.3.2"
blp = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# 新增依赖
byteorder = "1.5"          # 二进制解析
```

### package.json
```json
{
  "dependencies": {
    "three": "^0.160.0",
    "@types/three": "^0.160.0"
  }
}
```

---

## 🎮 使用示例

### 在属性面板设置
```tsx
<FilePath
  label="模型文件 (MDX/MDL)"
  value={frame.backgroundArt}
  onChange={(path) => updateFrame(frame.id, { backgroundArt: path })}
  placeholder="Units/HumanKnight/HumanKnight.mdx"
/>
```

### Canvas 自动渲染
```tsx
{frame.type === FrameType.MODEL && frame.backgroundArt && (
  <div style={{ position: 'absolute', inset: 0 }}>
    <ModelViewer
      modelPath={frame.backgroundArt}
      width={framePixelWidth}
      height={framePixelHeight}
    />
  </div>
)}
```

---

## ⚡ 性能优化

### 1. 模型缓存
```rust
// 缓存已解析的模型
static MODEL_CACHE: Mutex<HashMap<String, MdxModel>> = ...;

#[tauri::command]
async fn parse_mdx_file(file_path: String) -> Result<MdxModel, String> {
    let mut cache = MODEL_CACHE.lock().unwrap();
    
    if let Some(cached) = cache.get(&file_path) {
        return Ok(cached.clone());
    }
    
    let model = parse_mdx_internal(file_path.clone())?;
    cache.insert(file_path, model.clone());
    Ok(model)
}
```

### 2. LOD (Level of Detail)
```typescript
// 根据控件大小选择不同精度
if (frame.width < 0.05) {
  // 小控件：低精度
  geometry.scale(0.5, 0.5, 0.5);
}
```

### 3. 懒加载
```typescript
// 只在可见时渲染
const isVisible = useIntersectionObserver(containerRef);

{isVisible && <ModelViewer ... />}
```

---

## 🐛 已知限制

1. **动画系统** - 初期不支持骨骼动画
2. **粒子效果** - 不支持粒子系统
3. **复杂材质** - 只支持基础材质
4. **性能** - 大量模型可能影响性能

---

## 📚 参考资源

### MDX 格式文档
- [WC3 MDX Format](https://www.hiveworkshop.com/threads/mdx-specifications.240487/)
- [MDL/MDX Spec](https://github.com/flowtsohg/mdx-m3-viewer)

### Three.js 文档
- [Three.js 官方文档](https://threejs.org/docs/)
- [BufferGeometry](https://threejs.org/docs/#api/en/core/BufferGeometry)

### 现有项目参考
- [mdx-m3-viewer](https://github.com/flowtsohg/mdx-m3-viewer) - JS MDX 查看器
- [War3ModelEditor](https://github.com/PhoenixZeng/War3ModelEditor) - C++ 编辑器

---

## 🚦 开发优先级

### MVP (最小可用版本)
1. ✅ 占位符显示（已完成）
2. 🔄 Rust 解析 Geoset
3. 🔄 Three.js 渲染基础几何体
4. 🔄 加载单个纹理

### 第二阶段
5. ⏳ 多纹理支持
6. ⏳ 材质混合模式
7. ⏳ 骨骼结构解析

### 第三阶段
8. ⏳ 简单动画播放
9. ⏳ 性能优化
10. ⏳ UI 控制（播放/暂停）

---

## 💡 建议

### 快速启动
建议先实现**静态模型渲染**（无动画），这样可以：
- ✅ 快速看到效果
- ✅ 验证技术可行性
- ✅ 为后续动画打基础

### 开发顺序
1. **Week 1**: Rust MDX 基础解析器
2. **Week 2**: Three.js 集成和简单渲染
3. **Week 3**: 纹理加载和材质
4. **Week 4**: 优化和调试

### 替代方案
如果 MDX 解析太复杂，可以考虑：
- 使用现有的 JS MDX 库（如 mdx-m3-viewer）
- 先支持 MDL（文本格式，更容易解析）
- 只渲染截图（方案3）

---

**总结**: 方案1（Rust + Three.js）技术上可行，充分利用现有架构，但需要实现 MDX 解析器。建议先实现基础版本验证效果，再逐步完善。
