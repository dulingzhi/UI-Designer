# PLAN: WebGL + Three.js 精准还原 FDF 渲染引擎

> Milestone 1 from LONG_TERM_PLAN.md  
> CEO Review Mode: HOLD SCOPE  
> Generated: 2026-04-11  
> Branch: TBD (`feat/webgl-renderer`)  
> Prerequisite Data: [WC3_RENDERING_REVERSE_ENGINEERING.md](./WC3_RENDERING_REVERSE_ENGINEERING.md)

---

## 0. Executive Summary

将 Canvas.tsx 的 HTML/CSS div 渲染替换为 Three.js OrthographicCamera + PlaneGeometry + ShaderMaterial 渲染，
精确复现 WC3 Game.dll 的 FDF 渲染行为。逆向参数已从 1.27a Game.dll 提取完毕，包括：
- 6 种 alpha 混合模式及精确 D3D 混合因子
- 九宫格 8 段 UV 切割 (1/8 间隔) 及角偏移因子 (0.95)
- ALPHAKEY 硬边裁切阈值 192/255
- 4 种纹理过滤模式 (POINT/LINEAR/Bilinear+Mip/Trilinear)
- SnapTexelsToPixels 像素对齐算法
- FRAMEPOINT 9 值枚举及 CRect 布局

**技术选型**: Three.js v0.181.0 (已安装) + OrthographicCamera (2D UI) + 自定义 ShaderMaterial (GLSL)

**交付标准**: 导入暴雪原生 FDF (如 ConsoleUI.fdf) 后，WebGL 渲染结果与 WC3 1.27a 游戏内截图像素级吻合 (±1px)。

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Canvas.tsx (orchestrator)              │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ InteractionLayer │  │ WebGLRenderer │  │ OverlayLayer   │  │
│  │ (React/HTML)     │  │ (Three.js)    │  │ (React/HTML)   │  │
│  │ - 拖拽手柄       │  │ - Backdrop    │  │ - 右键菜单     │  │
│  │ - 框选矩形       │  │ - Text        │  │ - 锚点可视化   │  │
│  │ - 标尺/参考线    │  │ - Button      │  │ - Tooltip      │  │
│  │ - 光标检测       │  │ - Model(MDX)  │  │                │  │
│  └─────────────┘  │ - Sprite      │  └────────────────┘  │
│        ↕ pointer   │ - EditBox     │         ↕ overlay     │
│        events      │ - Slider...   │         DOM           │
│                    └──────┬───────┘                       │
│                           │                               │
│                    ┌──────┴───────┐                       │
│                    │ SceneGraph    │                       │
│                    │ Manager       │                       │
│                    └──────┬───────┘                       │
│           ┌───────────────┼───────────────┐               │
│     ┌─────┴─────┐  ┌─────┴─────┐  ┌──────┴─────┐       │
│     │TextureCache│  │ShaderLib  │  │FontAtlas   │       │
│     │(BLP→GPU)  │  │(GLSL)    │  │(SDF/Bitmap)│       │
│     └───────────┘  └───────────┘  └────────────┘       │
└─────────────────────────────────────────────────────────┘
                           │ IPC (invoke)
                    ┌──────┴───────┐
                    │ Rust/Tauri    │
                    │ - BLP decode  │
                    │ - MDX parse   │
                    │ - MPQ extract │
                    └──────────────┘
```

### 层级分离

| 层级 | 技术 | 职责 |
|------|------|------|
| **InteractionLayer** | React DOM (transparent div) | 接收所有鼠标/键盘事件，处理拖拽、框选、resize |
| **WebGLRenderer** | Three.js Canvas | 纯渲染，不接收事件。所有 28 种 FrameType 的 GPU 绘制 |
| **OverlayLayer** | React DOM | 右键菜单、锚点线、Tooltip 等叠加辅助信息 |

**关键原则**:
1. WebGL `<canvas>` 放在 `canvas-wrapper` 内部（与 interactive overlay 同级），**继承 CSS transform** 进行 pan/zoom。
2. `pointer-events: none`，所有交互由 InteractionLayer 处理。
3. Three.js OrthographicCamera **固定** 在 `(0, 1920, 1080, 0)`，**不做 applyTransform**。
4. Pan/Zoom 完全由 CSS `transform: scale(s) translate(ox, oy)` 驱动，WebGL canvas 自动跟随。

这保证现有的 useCanvasPan / useCanvasDrag / useCanvasResize 等 Hook **零改动复用**，
且 WebGL 渲染层与交互层的坐标系**始终完美一致**（同一 CSS transform）。

> **[MF-1 Resolution]**: 原计划中 `applyTransform()` 通过调整 camera bounds 模拟 CSS transform，
> 但 CSS transform-origin=50%50% + `scale(s) translate(ox, oy)` 的矩阵等价关系推导复杂且易错。
> 将 WebGL canvas 放入 CSS wrapper 内，彻底消除此问题。
> 缩放清晰度优化（Phase 5）：可动态调整 `renderer.setSize(1920*scale, 1080*scale)` + CSS 尺寸固定，
> 实现高倍缩放时的原生分辨率渲染。

---

## 2. Coordinate System Mapping

### WC3 → Three.js NDC

```
WC3 空间: X ∈ [0, 0.8], Y ∈ [0, 0.6]  (左下原点, Y 向上)
Canvas:   1920×1080px, 左右各 240px 边距 → 有效区 1440×1080px
Three.js: OrthographicCamera(0, 1920, 0, 1080, -1000, 1000)
```

```typescript
// 复用现有 coordinateService.ts — 零改动
// WC3 坐标 → Three.js 世界坐标 (像素空间)
const threeX = wc3ToPixelX(frame.x);          // 包含 240px 左边距
const threeY = wc3ToPixelYBottom(frame.y);     // 底部向上 (Three.js Y-up)
const threeW = wc3ToPixelW(frame.width);
const threeH = wc3ToPixelH(frame.height);
```

### Camera Setup
```typescript
// Camera 固定不变 — pan/zoom 由 CSS transform 处理
const camera = new THREE.OrthographicCamera(
  0,             // left
  CANVAS_WIDTH,  // right = 1920
  CANVAS_HEIGHT, // top = 1080
  0,             // bottom
  -1000,         // near (for z-order)
  1000           // far
);
camera.position.set(0, 0, 500);
camera.lookAt(0, 0, 0);
// ⚠️ 注意: 不需要 applyTransform() — camera 永远不变
```

**Z-Order**: `frame.z` 直接映射到 Three.js mesh.position.z，无需转换。

---

## 3. Shader Library — GLSL 实现规格

### 3.1 Backdrop Shader (九宫格 + 背景)

**Uniforms:**
```glsl
uniform sampler2D u_mainTexture;      // 背景纹理 (BLP→RGBA)
uniform sampler2D u_edgeTexture;      // 边框纹理 (BLP→RGBA, 8 段)
uniform vec2  u_frameSize;            // 帧像素尺寸 [width, height]
uniform float u_cornerSize;           // 角大小 (像素)
uniform float u_cornerFactor;         // = 0.95 (逆向确认)
uniform int   u_edgePieceBitfield;    // 8 bit: TL|TR|BL|BR|T|B|L|R
uniform int   u_alphaMode;           // EGxMatAlphaOp (0-5)
uniform float u_alphaRef;            // alphaRef 阈值 (归一化)
uniform float u_vertexAlpha;         // 顶点 alpha
uniform bool  u_hasEdgeTexture;      // 是否有独立边框纹理
uniform bool  u_tileBackground;      // 背景平铺
uniform vec4  u_backgroundInsets;    // [left, top, right, bottom] 像素
uniform vec2  u_backgroundTileSize;  // 平铺尺寸 (像素)
```

**Fragment Shader 核心逻辑:**
```glsl
// 九宫格区域判定
float cx = u_cornerSize * u_cornerFactor;  // 角偏移
float cy = u_cornerSize * u_cornerFactor;

vec2 fragPos = v_uv * u_frameSize;  // 片段像素位置

// 判断当前片段在哪个区域
int region = classifyRegion(fragPos, cx, cy, u_frameSize);
// region: 0=center, 1=TL, 2=TR, 3=BL, 4=BR, 5=T, 6=B, 7=L, 8=R

// UV 映射 (逆向确认的 8 段)
vec2 texCoord;
if (region == 0) {
    // 中心：主纹理，可能平铺
    texCoord = computeCenterUV(fragPos, u_backgroundInsets, u_tileBackground);
    color = texture2D(u_mainTexture, texCoord);
} else if (u_hasEdgeTexture) {
    // 有独立边框纹理：8 段 UV (每段 0.125 宽)
    texCoord = computeEdgeUV_8strip(region, fragPos, cx, cy, u_frameSize);
    color = texture2D(u_edgeTexture, texCoord);
} else {
    // 无边框纹理：用主纹理的象限
    texCoord = computeEdgeUV_quadrant(region, fragPos, cx, cy, u_frameSize);
    color = texture2D(u_mainTexture, texCoord);
}

// Alpha 模式处理 (逆向精确值)
color.a *= u_vertexAlpha;
if (u_alphaMode == 1 && color.a < 0.753) discard;  // ALPHAKEY: 192/255
if (u_alphaMode >= 2 && color.a < 0.016) discard;  // BLEND/ADD/MOD: 4/255
```

### 3.2 Text Shader (SDF Font Rendering)

**策略**: 使用 SDF (Signed Distance Field) 字体渲染，离线生成 WC3 字体的 SDF atlas。

```glsl
uniform sampler2D u_fontAtlas;
uniform vec4  u_textColor;       // RGBA
uniform vec4  u_shadowColor;     // 字体阴影颜色
uniform vec2  u_shadowOffset;    // 阴影偏移 (像素)
uniform float u_fontSize;        // 像素字号
uniform float u_outlineWidth;    // 描边宽度 (0 = 无描边)
uniform vec4  u_outlineColor;    // 描边颜色

void main() {
    float dist = texture2D(u_fontAtlas, v_uv).a;
    float alpha = smoothstep(0.5 - u_smoothing, 0.5 + u_smoothing, dist);
    
    // 描边
    if (u_outlineWidth > 0.0) {
        float outlineAlpha = smoothstep(
            0.5 - u_outlineWidth - u_smoothing,
            0.5 - u_outlineWidth + u_smoothing,
            dist
        );
        gl_FragColor = mix(u_outlineColor, u_textColor, alpha);
        gl_FragColor.a = outlineAlpha;
    } else {
        gl_FragColor = vec4(u_textColor.rgb, u_textColor.a * alpha);
    }
}
```

### 3.3 Blend Mode Implementation (Three.js)

```typescript
function applyBlendMode(material: THREE.ShaderMaterial, mode: EGxMatAlphaOp) {
  switch (mode) {
    case 0: // DISABLE
      material.blending = THREE.NoBlending;
      material.depthWrite = true;
      break;
    case 1: // ALPHAKEY — shader 内 discard, 不需要 GPU 混合
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneMinusSrcAlphaFactor;
      material.transparent = true;
      break;
    case 2: // BLEND
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneMinusSrcAlphaFactor;
      material.transparent = true;
      break;
    case 3: // ADD
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.SrcAlphaFactor;
      material.blendDst = THREE.OneFactor;
      material.transparent = true;
      break;
    case 4: // MODULATE
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.DstColorFactor;
      material.blendDst = THREE.ZeroFactor;
      material.transparent = true;
      break;
    case 5: // MODULATE2X
      material.blending = THREE.CustomBlending;
      material.blendSrc = THREE.DstColorFactor;
      material.blendDst = THREE.SrcColorFactor;
      material.transparent = true;
      break;
  }
}
```

---

## 4. TextureCache — BLP → GPU 管线

> **[MF-3 Resolution]**: 原计划使用 Rust IPC `decode_blp_to_rgba` 返回 `Vec<u8>` JSON。
> 经审计发现 `Vec<u8>` 序列化为 JSON `number[]`，1024×1024 BLP = 8-16MB JSON。
> 
> 修正方案：**包装现有 `textureLoader.ts`**，复用其 BLP 解码 + LRU 缓存 + 路径解析，
> 只增加 `ImageData → THREE.DataTexture` 的 GPU 上传层。
> 
> BLP 解码路径：`MPQ/文件 → ArrayBuffer → blpDecoder.ts (前端) → ImageData → THREE.DataTexture`
> 不走 Rust IPC，零 JSON 序列化开销。

```typescript
import { decodeBLP } from '../utils/blpDecoder';
import { textureLoader, TextureLoader } from '../utils/textureLoader';
import { mpqManager } from '../utils/mpqManager';
import { readFile } from '@tauri-apps/plugin-fs';

class TextureCache {
  private gpuCache: Map<string, THREE.Texture> = new Map();     // path:filter:wrap → GPU Texture
  private pending: Map<string, Promise<THREE.Texture>> = new Map();
  private fallbackTexture: THREE.DataTexture;                    // 加载失败时的占位纹理

  constructor() {
    // 1×1 品红色占位纹理 [SF-1: 错误处理 fallback]
    const magenta = new Uint8Array([255, 0, 255, 255]);
    this.fallbackTexture = new THREE.DataTexture(magenta, 1, 1, THREE.RGBAFormat);
    this.fallbackTexture.needsUpdate = true;
  }

  /**
   * 获取 GPU 纹理（带缓存 + 去重 + 错误处理）
   */
  async getTexture(path: string, filterMode = 0, wrapU = 0, wrapV = 0): Promise<THREE.Texture> {
    const key = `${path}:${filterMode}:${wrapU}:${wrapV}`;
    if (this.gpuCache.has(key)) return this.gpuCache.get(key)!;
    if (this.pending.has(key)) return this.pending.get(key)!;

    const promise = this.loadAndUpload(path, filterMode, wrapU, wrapV);
    this.pending.set(key, promise);
    
    try {
      const tex = await promise;
      this.gpuCache.set(key, tex);
      return tex;
    } catch (error) {
      console.error(`[TextureCache] 加载失败: ${path}`, error);
      return this.fallbackTexture;  // [SF-1] 返回品红占位，不抛异常
    } finally {
      this.pending.delete(key);  // [SF-1] 无论成功失败都清理 pending
    }
  }

  /**
   * 加载 BLP/图片文件 → 解码为 RGBA → 上传到 GPU
   * 复用现有 blpDecoder.ts（前端解码），不走 Rust IPC [MF-3]
   */
  private async loadAndUpload(
    path: string, filterMode: number, wrapU: number, wrapV: number
  ): Promise<THREE.Texture> {
    // Step 1: 获取文件字节 (复用 textureLoader 的路径解析逻辑)
    const buffer = await this.readFileBuffer(path);
    
    // Step 2: 解码为 RGBA ImageData (前端 blpDecoder.ts)
    let imageData: ImageData;
    if (path.toLowerCase().endsWith('.blp')) {
      imageData = await decodeBLP(buffer);
    } else {
      // 非 BLP 格式：用 Image 元素解码
      imageData = await this.decodeImageToRGBA(buffer, path);
    }
    
    // Step 3: 上传到 GPU
    const texture = new THREE.DataTexture(
      new Uint8Array(imageData.data.buffer),
      imageData.width,
      imageData.height,
      THREE.RGBAFormat
    );
    
    // 逆向确认的过滤模式表
    const FILTER_MODES = [
      { mag: THREE.NearestFilter,  min: THREE.NearestFilter },                    // Mode 0: POINT
      { mag: THREE.LinearFilter,   min: THREE.LinearFilter },                     // Mode 1: LINEAR
      { mag: THREE.LinearFilter,   min: THREE.LinearMipmapNearestFilter },        // Mode 2: Bilinear+NearestMip
      { mag: THREE.LinearFilter,   min: THREE.LinearMipmapLinearFilter },         // Mode 3: Trilinear
    ];
    
    const fm = FILTER_MODES[filterMode] || FILTER_MODES[0];
    texture.magFilter = fm.mag;
    texture.minFilter = fm.min;
    texture.generateMipmaps = filterMode >= 2;
    
    // 逆向确认的 Wrap 模式: 0=REPEAT, 1=CLAMP
    texture.wrapS = wrapU === 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    texture.wrapT = wrapV === 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * 读取文件为 ArrayBuffer（支持 WC3 MPQ 路径和本地路径）
   */
  private async readFileBuffer(path: string): Promise<ArrayBuffer> {
    const type = textureLoader.getTextureType(path);
    
    if (type === 'wc3' || type === 'builtin') {
      const normalizedPath = path.replace(/\//g, '\\');
      const buffer = await mpqManager.readFile(normalizedPath);
      if (!buffer) throw new Error(`WC3 纹理未找到: ${path}`);
      return buffer;
    } else {
      const uint8 = await readFile(path);
      return uint8.buffer;
    }
  }

  /**
   * 非 BLP 格式解码（PNG/JPG/TGA → RGBA ImageData）
   */
  private async decodeImageToRGBA(buffer: ArrayBuffer, path: string): Promise<ImageData> {
    const blob = new Blob([buffer]);
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  }

  dispose() {
    for (const tex of this.gpuCache.values()) {
      if (tex !== this.fallbackTexture) tex.dispose();
    }
    this.gpuCache.clear();
    this.fallbackTexture.dispose();
  }
}
```

---

## 5. SceneGraph Manager

```typescript
class SceneGraphManager {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private renderer: THREE.WebGLRenderer;
  private meshes: Map<string, THREE.Mesh> = new Map();      // frameId → Mesh
  private textureCache: TextureCache;
  private shaderLib: ShaderLib;
  private dirty: boolean = false;                            // 按需渲染标记
  private rafId: number | null = null;
  private unitPlane: THREE.PlaneGeometry;                    // 共享 1×1 几何体
  
  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,            // 透明背景，让下层 React DOM 可见
      antialias: false,       // WC3 不抗锯齿
      premultipliedAlpha: false,
    });
    this.renderer.setSize(CANVAS_WIDTH, CANVAS_HEIGHT);
    this.renderer.setPixelRatio(1);  // 固定 1:1，匹配 WC3 像素
    
    // Camera 固定不变 — pan/zoom 由 CSS transform 处理 [MF-1]
    this.camera = new THREE.OrthographicCamera(0, CANVAS_WIDTH, CANVAS_HEIGHT, 0, -1000, 1000);
    this.camera.position.z = 500;
    
    this.scene = new THREE.Scene();
    this.textureCache = new TextureCache();
    this.shaderLib = new ShaderLib();
    this.unitPlane = new THREE.PlaneGeometry(1, 1);  // 共享几何体，用 scale 控制尺寸
  }

  /**
   * 全量同步：对比 frames dict 与当前 meshes，增删改
   */
  sync(frames: Record<string, FrameData>, rootFrameIds: string[]) {
    const activeIds = new Set<string>();
    
    // 遍历可见帧，创建/更新 mesh
    for (const [id, frame] of Object.entries(frames)) {
      if (frame.visible === false) continue;
      activeIds.add(id);
      
      if (this.meshes.has(id)) {
        this.updateMesh(id, frame);
      } else {
        this.createMesh(id, frame);
      }
    }
    
    // 删除不再存在的 mesh
    for (const [id, mesh] of this.meshes) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
        this.meshes.delete(id);
      }
    }
    
    this.markDirty();
  }

  private createMesh(id: string, frame: FrameData) {
    const { x, y, w, h } = this.computePixelRect(frame);
    const material = this.shaderLib.createMaterial(frame);
    
    // 使用共享 1×1 PlaneGeometry + scale 控制尺寸 [SF from eng review]
    const mesh = new THREE.Mesh(this.unitPlane, material);
    mesh.scale.set(w, h, 1);
    mesh.position.set(x + w / 2, y + h / 2, frame.z || 0);
    mesh.userData.frameId = id;
    
    this.scene.add(mesh);
    this.meshes.set(id, mesh);
    
    // 异步加载纹理
    this.loadFrameTextures(id, frame);
  }

  private updateMesh(id: string, frame: FrameData) {
    const mesh = this.meshes.get(id)!;
    const { x, y, w, h } = this.computePixelRect(frame);
    
    // 位置/尺寸更新 — 用 scale 而非重建几何体
    mesh.position.set(x + w / 2, y + h / 2, frame.z || 0);
    mesh.scale.set(w, h, 1);
    
    // uniform 更新
    this.shaderLib.updateUniforms(mesh.material as THREE.ShaderMaterial, frame);
  }

  private computePixelRect(frame: FrameData) {
    // 复用 coordinateService (锚点计算由调用方处理)
    return {
      x: wc3ToPixelX(frame.x),
      y: wc3ToPixelYBottom(frame.y),
      w: wc3ToPixelW(frame.width),
      h: wc3ToPixelH(frame.height),
    };
  }

  /**
   * 按需渲染 — dirty flag 驱动，不跑 60fps 循环
   */
  markDirty() {
    if (this.dirty) return;
    this.dirty = true;
    this.rafId = requestAnimationFrame(() => {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      this.rafId = null;
    });
  }

  dispose() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.textureCache.dispose();
    for (const mesh of this.meshes.values()) {
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
    this.unitPlane.dispose();
    this.renderer.dispose();
  }
}
```

> **[MF-1 Resolution]**: 已删除 `applyTransform()` 方法。Camera 固定在 `(0, 1920, 1080, 0)`，
> 永远不变。Pan/Zoom 完全由 CSS `transform: scale(s) translate(ox, oy)` 处理。
> WebGL `<canvas>` 作为 canvas-wrapper 的子元素，自动继承 CSS transform。

> **[Eng Review SF]**: PlaneGeometry 改为共享 1×1 + `mesh.scale` 控制尺寸，
> 避免拖拽 resize 时每 16ms dispose + 重建几何体。

---

## 6. Raycasting — WebGL 点击检测

交互层的 React DOM 需要知道鼠标下方是哪个 Frame：

```typescript
/**
 * 将鼠标在 canvas 局部坐标映射到 Three.js 场景中的 frameId
 * 用于替代当前 DOM 的 data-frame-id 查找
 * 
 * 注意: mouseX/mouseY 是 canvas 内部坐标 (0-1920, 0-1080)，
 * 由 InteractionLayer 通过 getBoundingClientRect() 转换得到。
 * 因为 WebGL canvas 和 InteractionLayer 共用同一个 CSS transform，
 * 坐标一致性由 CSS 保证。
 */
function hitTest(mouseX: number, mouseY: number, scene: THREE.Scene, camera: THREE.OrthographicCamera): string | null {
  const raycaster = new THREE.Raycaster();
  // Camera 固定在 (0,1920,1080,0)，NDC = (mouseX/1920)*2-1
  const mouse = new THREE.Vector2(
    (mouseX / CANVAS_WIDTH) * 2 - 1,
    -(mouseY / CANVAS_HEIGHT) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  
  const intersects = raycaster.intersectObjects(scene.children, false);
  if (intersects.length > 0) {
    // 按 z-order (position.z) 排序, 取最上层
    intersects.sort((a, b) => b.object.position.z - a.object.position.z);
    return intersects[0].object.userData.frameId;
  }
  return null;
}
```

---

## 7. Implementation Phases

### Phase 1: 基础骨架 (Week 1-2)

**目标**: Three.js renderer 能显示纯色矩形，交互不变

| Task | 文件 | 改动 |
|------|------|------|
| 1.1 创建 WebGLRenderer 类 | `src/renderer/SceneGraphManager.ts` | **NEW** — camera 固定，不含 applyTransform |
| 1.2 创建 TextureCache 类 | `src/renderer/TextureCache.ts` | **NEW** — 包装 blpDecoder.ts (前端解码)，输出 THREE.DataTexture |
| 1.3 创建 ShaderLib 类 | `src/renderer/ShaderLib.ts` | **NEW** |
| 1.4 嵌入 Three.js canvas 到 Canvas.tsx | `src/components/Canvas.tsx` | **MODIFY** — `<canvas>` 放入 canvas-wrapper 内，继承 CSS transform |
| 1.5 ~~同步 Pan/Zoom~~ | ~~`src/components/Canvas.tsx`~~ | ~~不需要~~ — CSS transform 自动处理 [MF-1] |
| 1.6 hitTest 替代 DOM frameId 查找 | `src/renderer/hitTest.ts` | **NEW** |

**验收**: 打开项目，所有帧显示为彩色矩形 (按 FrameType 着色)，拖拽/缩放/选中行为不变。

### Phase 2: Backdrop 渲染 (Week 3-4)

**目标**: Backdrop 帧的背景 + 九宫格边框与 WC3 像素级吻合

| Task | 文件 | 改动 |
|------|------|------|
| 2.1 Backdrop 基础 shader (纯背景) | `src/renderer/shaders/backdrop.vert/frag` | **NEW** |
| 2.2 九宫格 shader (8 段 UV) | 同上 | **EXTEND** |
| 2.3 TextureCache 集成 BLP→GPU | `src/renderer/TextureCache.ts` | **EXTEND** |
| 2.4 Alpha 混合模式 6 种 | `src/renderer/ShaderLib.ts` | **EXTEND** |
| 2.5 像素对齐 (SnapTexelsToPixels) | `src/renderer/pixelSnap.ts` | **NEW** |
| 2.6 删除 BackdropEdge.tsx (CSS 实现) | `src/components/BackdropEdge.tsx` | **DEPRECATE** (保留但不渲染) |

**验收**: 导入 ConsoleUI.fdf，Backdrop 帧边框截图 vs WC3 截图 diff ≤ 1px。

### Phase 3: 文字渲染 (Week 5-6)

**目标**: TEXT_FRAME / FontString 渲染与 WC3 一致

| Task | 文件 | 改动 |
|------|------|------|
| 3.1 WC3 字体 SDF Atlas 预生成工具 | `src/renderer/fontAtlasGenerator.ts` | **NEW** |
| 3.2 Text shader (SDF + shadow + outline) | `src/renderer/shaders/text.vert/frag` | **NEW** |
| 3.3 文本布局引擎 (对齐/截断/换行) | `src/renderer/textLayout.ts` | **NEW** |
| 3.4 FontString uniform 同步 | `src/renderer/ShaderLib.ts` | **EXTEND** |

**验收**: TEXT_FRAME 文字截断行为、对齐方式、字体阴影与 WC3 吻合。

### Phase 4: 交互控件 (Week 7-8)

**目标**: Button/Slider/Checkbox 等可交互控件渲染

| Task | 文件 | 改动 |
|------|------|------|
| 4.1 Button 多状态纹理切换 | `src/renderer/ShaderLib.ts` | **EXTEND** (normal/pushed/disabled/highlight) |
| 4.2 Slider 滑块渲染 | `src/renderer/shaders/slider.vert/frag` | **NEW** |
| 4.3 Checkbox toggle 渲染 | `src/renderer/ShaderLib.ts` | **EXTEND** |
| 4.4 EditBox 光标 + 选区渲染 | `src/renderer/shaders/editbox.vert/frag` | **NEW** |
| 4.5 Sprite/Model 集成 (复用 war3-model) | `src/renderer/modelBridge.ts` | **NEW** — 见下方 MF-2 设计 |

> **[MF-2 Resolution] ModelViewer / modelBridge 详细设计**
> 
> **Phase 1-4 策略: Keep ModelViewer as DOM Overlay**
> - 现有 `ModelViewer` (war3-model 4.0.0) 创建独立 WebGL context + `<canvas>` 元素
> - 保持其 DOM 元素放在 canvas-wrapper 内部，自动继承 CSS transform
> - 不尝试在 Phase 1-4 强行合并到 Three.js 共享 context
> - 原因: war3-model 依赖自己的 WebGL state (独立 program、VAO、blend 设置)，
>   合并需要大量 WebGL state save/restore 工作
> 
> **Phase 5 modelBridge 设计 (两个可选方案):**
> 
> **方案 A (推荐): OffscreenCanvas → DataTexture**
> ```typescript
> class ModelBridge {
>   private offscreen: OffscreenCanvas;
>   private modelViewer: ModelViewer;
>   
>   renderToTexture(mdxPath: string, animFrame: number): THREE.DataTexture {
>     // 1. ModelViewer 渲染到 OffscreenCanvas
>     this.modelViewer.render(this.offscreen, mdxPath, animFrame);
>     // 2. readPixels 获取 RGBA
>     const gl = this.offscreen.getContext('webgl2')!;
>     const pixels = new Uint8Array(w * h * 4);
>     gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
>     // 3. 上传到 Three.js texture
>     return new THREE.DataTexture(pixels, w, h, THREE.RGBAFormat);
>   }
> }
> ```
> 
> **方案 B: WebGL Context Sharing (复杂但高效)**
> - 用 `canvas.getContext('webgl2', { sharedContext })` 共享 GL 上下文
> - 需要每帧 save/restore 全部 GL state (program, blend, depth, VAO...)
> - 在 Three.js render pass 之间插入 war3-model render pass
> - 风险: GL state 泄漏导致渲染错误，调试困难
> 
> **WebGL Context 数量限制**:
> - 浏览器通常限制 8-16 个 WebGL 上下文
> - Phase 1-4 中每个 ModelViewer 创建独立上下文: ≤3-4 个 Model frame 可接受
> - Phase 5 合并后只有 1 个共享上下文

**验收**: 所有 28 种 FrameType 在 WebGL 中有对应渲染，无 CSS fallback。

### Phase 5: 清理与优化 (Week 9-10)

| Task | 文件 | 改动 |
|------|------|------|
| 5.1 移除 Canvas.tsx 的 CSS 渲染代码 | `src/components/Canvas.tsx` | **MAJOR MODIFY** — 删除 renderFrame 中 ~400 行 CSS style 代码 |
| 5.2 移除 BackdropBackground 组件 | `src/components/Canvas.tsx` | **DELETE** 内部组件 |
| 5.3 Batch rendering 优化 | `src/renderer/SceneGraphManager.ts` | **OPTIMIZE** — 合并同材质的 draw call |
| 5.4 纹理预加载 / LRU 淘汰 | `src/renderer/TextureCache.ts` | **OPTIMIZE** |
| 5.5 像素级 snapshot 测试框架 | `tests/visual-regression/` | **NEW** |

---

## 8. File Inventory — 新增/改动文件

### 新增文件 (~12 files)

```
src/renderer/
├── SceneGraphManager.ts      # 场景管理、帧同步、渲染循环
├── TextureCache.ts           # BLP→GPU 纹理缓存
├── ShaderLib.ts              # ShaderMaterial 工厂 + uniform 更新
├── hitTest.ts                # Raycasting 点击检测
├── pixelSnap.ts              # SnapTexelsToPixels 算法
├── textLayout.ts             # 文本度量/截断/换行引擎
├── fontAtlasGenerator.ts     # WC3 字体 SDF atlas 生成
├── modelBridge.ts            # war3-model ↔ Three.js 桥接
├── constants.ts              # 逆向参数常量 (blend factors, UV maps, etc.)
└── shaders/
    ├── backdrop.vert          # 通用顶点着色器
    ├── backdrop.frag          # 九宫格 + 背景 + alpha 混合
    ├── text.vert              # 文字顶点着色器
    ├── text.frag              # SDF 文字 + 阴影 + 描边
    └── common.glsl            # 共享工具函数 (alpha test, UV utils)
```

### 改动文件 (~3 files)

| 文件 | 改动量 | 说明 |
|------|--------|------|
| `src/components/Canvas.tsx` | ~200 行改, ~400 行删 | 插入 Three.js canvas, 删除 CSS 渲染 |
| `src/components/BackdropEdge.tsx` | 标记 deprecated | WebGL 九宫格 shader 取代 |
| `package.json` | 可能 +0 | Three.js 已安装，无需新依赖 |

### 不改动文件

| 文件 | 原因 |
|------|------|
| `src/utils/coordinateService.ts` | 完全复用 |
| `src/store/projectStore.ts` | 帧数据结构不变 |
| `src/types/index.ts` | FrameData 接口不变 |
| `src/hooks/useCanvasPan.ts` | 交互层不变 |
| `src/hooks/useCanvasDrag.ts` | 交互层不变 |
| `src/hooks/useCanvasResize.ts` | 交互层不变 |
| `src-tauri/src/blp_handler.rs` | BLP 解码接口不变 |
| `src-tauri/src/mdx_parser.rs` | MDX 解析接口不变 |

---

## 9. Reverse-Engineered Constants Module

所有逆向参数集中在一个常量文件中，确保 shader 和 JS 代码引用同一数据源：

```typescript
// src/renderer/constants.ts

/** WC3 Alpha Blend Modes (from Game.dll EGxMatAlphaOp) */
export enum EGxMatAlphaOp {
  DISABLE = 0,
  ALPHAKEY = 1,
  BLEND = 2,
  ADD = 3,
  MODULATE = 4,
  MODULATE2X = 5,
}

/** Alpha reference thresholds (normalized 0-1) */
export const ALPHA_REF: Record<EGxMatAlphaOp, number> = {
  [EGxMatAlphaOp.DISABLE]:    1.0,        // 0xFF
  [EGxMatAlphaOp.ALPHAKEY]:   0.7529,     // 0xC0 / 0xFF = 192/255
  [EGxMatAlphaOp.BLEND]:      0.0157,     // 0x04 / 0xFF
  [EGxMatAlphaOp.ADD]:        0.0157,
  [EGxMatAlphaOp.MODULATE]:   0.0157,
  [EGxMatAlphaOp.MODULATE2X]: 0.0157,
};

/** Nine-slice edge UV strips (逆向: CBackdropGenerator::Generate) */
export const EDGE_UV_STRIPS = {
  TL:     [0.000, 0.125],
  TR:     [0.125, 0.250],
  BL:     [0.250, 0.375],
  BR:     [0.375, 0.500],
  TOP:    [0.500, 0.625],
  BOTTOM: [0.625, 0.750],
  LEFT:   [0.750, 0.875],
  RIGHT:  [0.875, 1.000],
} as const;

/** Corner position inset factor (逆向: 0.94999999 ≈ 0.95) */
export const CORNER_POSITION_FACTOR = 0.95;

/** Edge piece bitfield flags */
export const EDGE_FLAGS = {
  TL: 0x01, TR: 0x02, BL: 0x04, BR: 0x08,
  T:  0x10, B:  0x20, L:  0x40, R:  0x80,
} as const;

/** Texture filter mode table (from s_filterModes) */
export const FILTER_MODES = [
  { mag: 'NEAREST',  min: 'NEAREST',                  mip: 'NONE' },     // 0
  { mag: 'LINEAR',   min: 'LINEAR',                   mip: 'NONE' },     // 1
  { mag: 'LINEAR',   min: 'LINEAR_MIPMAP_NEAREST',    mip: 'NEAREST' },  // 2
  { mag: 'LINEAR',   min: 'LINEAR_MIPMAP_LINEAR',     mip: 'LINEAR' },   // 3
] as const;
```

---

## 10. Risk Registry

| # | 风险 | 影响 | 概率 | 缓解措施 |
|---|------|------|------|----------|
| R1 | Canvas.tsx 重构破坏现有交互 | 高 | 中 | 交互层完全保留 React DOM，WebGL 为纯渲染层 |
| R2 | SDF 字体与 WC3 原生字体差异 | 中 | 中 | 先用 bitmap font atlas (离线从 WC3 字体光栅化)，后续迭代 SDF |
| R3 | Nine-slice shader 边缘接缝 | 中 | 低 | 实现 SnapTexelsToPixels 算法，逆向已提供完整逻辑 |
| R4 | 大量纹理的 GPU 内存压力 | 低 | 低 | TextureCache LRU 淘汰 + 延迟加载 |
| R5 | WebGL context loss | 中 | 低 | 监听 `webglcontextlost` 事件，自动重建场景 |
| R6 | 拖拽交互 hitTest 性能 | 低 | 低 | Raycaster 在 <100 mesh 场景中 <1ms |

---

## 11. Failure Modes & Recovery

| 场景 | 检测 | 恢复 |
|------|------|------|
| BLP 纹理加载失败 | `invoke()` reject | 显示紫色占位纹理 + console.warn |
| Shader 编译失败 | `gl.getShaderInfoLog` | 回退到纯色 MeshBasicMaterial |
| WebGL 不支持 | `!!canvas.getContext('webgl2')` | 保持原 CSS 渲染路径 (graceful degradation) |
| 帧数据无效 (NaN coords) | isNaN check in computePixelRect | 跳过渲染该帧，日志警告 |

---

## 12. Testing Strategy

### 像素级回归测试
```
tests/visual-regression/
├── baseline/          # WC3 游戏内截图 (1440×1080 有效区)
│   ├── ConsoleUI.png
│   ├── ResourceBar.png
│   └── EscMenu.png
├── snapshots/         # WebGL 渲染输出
├── diffs/             # pixelmatch 差异图
└── visual-test.ts     # 自动比较脚本
```

### 单元测试
- `textLayout.test.ts` — 文本截断/换行边界用例
- `pixelSnap.test.ts` — 坐标对齐精度 (vs 逆向结果)
- `shaderLib.test.ts` — 每种 blend mode 的 Three.js material 属性验证
- `textureCache.test.ts` — 加载/缓存/淘汰逻辑

---

## 13. Definition of Done

- [ ] 所有 28 种 FrameType 在 WebGL 中渲染 (无 CSS fallback)
- [ ] ConsoleUI.fdf 渲染 vs WC3 截图 diff ≤ 1px (去除字体差异区域)
- [ ] EscMenuMainPanel.fdf 九宫格边框像素级吻合
- [ ] 6 种 alpha 混合模式行为正确 (ALPHAKEY 硬边 @ 192/255)
- [ ] 拖拽/缩放/选中/框选/右键菜单 功能不退化
- [ ] 像素级回归测试 CI 通过
- [ ] 无 CSS 渲染残留代码 (BackdropEdge.tsx, BackdropBackground, 内联 style 渲染)

---

## 14. Immediate Next Action

```
git checkout -b feat/webgl-renderer
```

**Task 1.1**: 创建 `src/renderer/SceneGraphManager.ts` — 最小实现：
1. 初始化 Three.js renderer + orthographic camera (固定 0-1920, 0-1080)
2. 遍历 `project.frames`，每个 frame 创建纯色 PlaneGeometry (共享 1×1 + scale)
3. 嵌入 Canvas.tsx 的 **canvas-wrapper** 内 (pointer-events: none)，继承 CSS transform
4. 按需渲染 (dirty flag + requestAnimationFrame)

> **注意**: 不需要 applyTransform 或 camera 同步 — CSS transform 自动处理 pan/zoom [MF-1]

一旦能看到彩色矩形正确叠加在 Canvas 上，Phase 1 的骨架就完成了。
