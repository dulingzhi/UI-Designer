# MDX/MDL 3D 模型渲染使用指南

## 概述

本系统实现了魔兽争霸 3 的 MDX/MDL 3D 模型在 UI 设计器中的实时渲染。

## 功能特性

### ✅ 已实现 (MVP)
- **MDX 二进制解析**：Rust 解析器提取几何数据（顶点、法线、UV、面）
- **3D 实时渲染**：Three.js 渲染引擎显示静态模型
- **自动缩放**：模型自动适配控件尺寸
- **旋转预览**：自动旋转动画展示模型
- **错误处理**：解析失败时显示错误占位符

### 🚧 计划中
- 纹理加载（BLP 集成）
- 动画播放
- 光照调整
- 性能优化（模型缓存）

## 使用方法

### 1. 在画布中添加 MODEL 控件

```typescript
// 通过模板创建
const modelFrame = {
  type: FrameType.MODEL,
  name: 'MyModel',
  backgroundArt: 'Units/Human/Peasant/Peasant.mdx', // MDX 文件路径
  layerStyle: 'NOSHADING',
  width: 200,
  height: 200,
};
```

### 2. 设置模型文件路径

在属性面板中：
1. 选择 MODEL 控件
2. 找到 **MODEL 属性** 部分
3. 在 **backgroundArt** 字段输入 MDX 文件路径
4. 路径示例：
   - `UI/Glues/ScoreScreen/ScoreScreen-Background.mdx` - UI 背景
   - `Units/Human/Peasant/Peasant.mdx` - 人族农民
   - `Buildings/Orc/GreatHall/GreatHall.mdx` - 兽族大厅
   - `Doodads/Ashenvale/Trees/AshenTree/AshenTree.mdx` - 树木

### 3. 模型自动渲染

保存后，画布中的 MODEL 控件将自动：
- 从 MPQ 档案加载 MDX 文件
- 解析几何数据
- 渲染 3D 模型（带旋转动画）

## 开发测试

### 在控制台测试解析器

打开浏览器控制台 (F12)，运行：

```javascript
// 测试从 MPQ 解析多个模型
testMdxParsing()

// 测试解析二进制数据
const mdxData = new Uint8Array([...]); // 你的 MDX 数据
testMdxBinaryParsing(mdxData)
```

### 测试输出示例

```
测试: UI 背景模型
档案: war3.mpq
模型: UI/Glues/ScoreScreen/ScoreScreen-Background.mdx
✅ 解析成功 (45.23ms)
  - 版本: 800
  - 名称: ScoreScreenBackground
  - 顶点数: 1247
  - 法线数: 1247
  - UV数: 1247
  - 面数: 415
  - 边界框: min(-150.00, -100.00, -50.00) max(150.00, 100.00, 50.00)
  - 第一个顶点: (12.34, 56.78, 90.12)
  - 第一个面: [0, 1, 2]
```

## 技术架构

### 数据流

```
MPQ 档案
   ↓
Rust: read_mpq_file() 
   ↓
Rust: MdxParser.parse()
   ↓
JSON 几何数据
   ↓
TypeScript: ModelViewer
   ↓
Three.js: BufferGeometry
   ↓
WebGL 渲染
```

### 文件结构

```
src-tauri/src/
├── mdx_parser.rs         # Rust MDX 解析器
└── lib.rs                # Tauri 命令接口

src/components/
├── ModelViewer.tsx       # Three.js 渲染组件
└── Canvas.tsx            # 集成到画布

src/utils/
└── testMdxParser.ts      # 测试工具
```

## API 参考

### Rust 命令

#### `parse_mdx_file`
```rust
fn parse_mdx_file(mdx_data: Vec<u8>) -> Result<String, String>
```
解析 MDX 二进制数据，返回 JSON 字符串。

#### `parse_mdx_from_mpq`
```rust
fn parse_mdx_from_mpq(
  archive_path: String, 
  file_name: String
) -> Result<String, String>
```
从 MPQ 档案读取并解析 MDX 文件。

### TypeScript 组件

#### `ModelViewer`
```tsx
interface ModelViewerProps {
  modelPath: string;      // MDX 在 MPQ 中的路径
  mpqPath?: string;       // MPQ 档案路径（默认 war3.mpq）
  width: number;          // 渲染宽度
  height: number;         // 渲染高度
  className?: string;
}
```

## 性能建议

- **首次加载**：MDX 解析 + 渲染约 50-200ms
- **模型缓存**：相同模型重复使用会更快（待实现）
- **大模型**：顶点数 > 5000 可能影响性能
- **优化方向**：
  - 实现模型缓存
  - LOD (Level of Detail) 系统
  - Web Worker 异步解析

## 已知限制

1. **仅支持 MDX 格式**：不支持 MDL 文本格式（需单独解析器）
2. **无纹理**：当前使用灰色材质，BLP 纹理集成开发中
3. **无动画**：静态模型展示，动画系统待开发
4. **MPQ 依赖**：需要正确配置 MPQ 档案路径

## 故障排查

### 模型不显示
- 检查 `backgroundArt` 路径是否正确
- 确认 MPQ 档案路径存在
- 打开控制台查看错误信息

### 显示红色线框
- 表示解析失败
- 检查控制台错误详情
- 验证 MDX 文件是否损坏

### 性能问题
- 减小控件尺寸
- 使用低多边形模型
- 避免同时渲染过多模型

## 下一步开发

根据 `docs/MDX_RENDERING_PROPOSAL.md`：

### Phase 3: 纹理集成
- 从 MDX 读取纹理引用
- 加载 BLP 纹理文件
- 应用到 Three.js 材质

### Phase 4: 动画系统
- 解析动画序列
- 实现骨骼系统
- 动画播放控制

### Phase 5: 高级特性
- 粒子效果
- 光照效果
- 性能优化

## 贡献指南

修改解析器时：
1. 更新 `src-tauri/src/mdx_parser.rs`
2. 运行 `cargo test` 验证
3. 更新此文档

修改渲染器时：
1. 更新 `src/components/ModelViewer.tsx`
2. 测试不同模型
3. 验证性能影响

## 参考资料

- [MDX 格式规范](https://www.hiveworkshop.com/threads/mdx-specifications.240487/)
- [Three.js 文档](https://threejs.org/docs/)
- [Tauri IPC](https://tauri.app/develop/calling-rust/)
