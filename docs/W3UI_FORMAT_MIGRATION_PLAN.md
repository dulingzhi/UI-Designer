# .w3ui 文件格式统一改造方案

## 当前 .w3ui 文件结构

```typescript
interface ProjectData {
  // 项目设置
  libraryName: string;
  originMode: 'gameui' | 'worldframe' | 'consoleui';
  exportVersion: 'reforged' | '1.27';
  hideGameUI: boolean;
  // ... 其他设置
  
  // 核心数据
  frames: Record<string, FrameData>;        // 控件数据（当前格式）
  rootFrameIds: string[];
  
  // 辅助数据
  tableArrays: TableArrayData[];
  circleArrays: CircleArrayData[];
  guides?: GuideLine[];
  stylePresets?: StylePreset[];
  frameGroups?: FrameGroup[];
}
```

## 问题分析

### 当前存在的问题

1. **数据格式不统一**
   - `.w3ui` 使用自定义的 `FrameData` 格式
   - `.fdf` 使用 WC3 原生格式
   - 两者需要转换，增加复杂度

2. **无法直接复用 FDF 控件**
   - 导入 FDF 需要转换为 FrameData
   - 导出 FDF 需要再次转换
   - 转换过程可能丢失信息

3. **属性映射复杂**
   - FDF 属性 → FrameData 属性需要手动映射
   - 某些 FDF 特性（如模板继承）难以保存

## 改造方案

### 方案 1: 混合存储（推荐）

在 `.w3ui` 文件中保存**原始 FDF AST** + **运行时 FrameData**

```typescript
interface ProjectData {
  // ... 现有设置
  
  // 方式 1: 混合存储
  frames: Record<string, FrameData>;           // 运行时使用（编辑器内部）
  fdfSources?: Record<string, FDFFrameDefinition>; // 原始 FDF AST（可选）
  
  // 或者方式 2: 统一存储
  frames: Record<string, EnhancedFrameData>;   // 增强的 FrameData
}

// 增强的 FrameData（包含 FDF 源信息）
interface EnhancedFrameData extends FrameData {
  // FDF 相关（可选）
  fdfSource?: {
    inherits?: string;           // 继承的模板名
    originalProperties?: any[];   // 原始 FDF 属性
    rawFDF?: string;             // 原始 FDF 文本（用于精确还原）
  };
}
```

**优点**:
- ✅ 保留 FDF 原始信息
- ✅ 无损导入导出
- ✅ 支持模板继承
- ✅ 向后兼容（fdfSource 可选）

**缺点**:
- ❌ 文件大小增加
- ❌ 数据结构复杂

### 方案 2: 完全基于 FDF AST

`.w3ui` 文件直接存储 FDF AST，运行时转换为 FrameData

```typescript
interface ProjectData {
  // ... 现有设置
  
  // 存储 FDF AST
  fdfProgram: FDFProgram;  // 完整的 FDF 语法树
  
  // 运行时缓存（不保存）
  // frames 在加载时由 fdfProgram 转换生成
}
```

**优点**:
- ✅ 完全 FDF 兼容
- ✅ 支持所有 FDF 特性
- ✅ 文件格式统一

**缺点**:
- ❌ 与现有代码不兼容（需要大量重构）
- ❌ 加载时需要转换（性能开销）
- ❌ 编辑器内部操作复杂

### 方案 3: 扩展 FrameData（渐进式改造）

逐步扩展 FrameData 以支持更多 FDF 特性

```typescript
interface FrameData {
  // ... 现有字段
  
  // 新增 FDF 兼容字段
  inherits?: string;              // INHERITS 模板名
  fdfProperties?: Record<string, any>; // 额外的 FDF 属性
  
  // 嵌套元素
  texture?: {
    file: string;
    texCoord?: [number, number, number, number];
    alphaMode?: string;
  };
  
  // 更丰富的文本属性
  textData?: {
    content: string;
    font?: string;
    fontSize?: number;
    flags?: string[];
    shadowOffset?: [number, number];
  };
}
```

**优点**:
- ✅ 向后兼容
- ✅ 渐进式改造
- ✅ 风险低

**缺点**:
- ❌ 仍需维护两套属性映射
- ❌ 无法支持所有 FDF 特性

## 推荐实现方案：**方案 1（混合存储）**

### 实现步骤

#### 第一阶段：数据结构扩展

1. **扩展 FrameData 类型**

```typescript
// src/types/index.ts
export interface FrameData {
  // ... 现有字段
  
  // FDF 元数据（可选）
  fdfMetadata?: {
    inherits?: string;           // INHERITS 模板名
    includeFile?: string;        // IncludeFile 路径
    rawProperties?: Record<string, any>; // 无法映射的原始属性
    comment?: string;            // 注释
  };
}
```

2. **更新 ProjectData**

```typescript
export interface ProjectData {
  // ... 现有字段
  
  // FDF 模板库（可选）
  fdfTemplates?: Record<string, FDFFrameDefinition>;
}
```

#### 第二阶段：导入功能增强

3. **增强 FDF 导入**

```typescript
// src/utils/fdfImport.ts
import { parseFDF, parseFDFToAST } from './fdf';

export async function importFromFDFEnhanced(): Promise<FrameData[] | null> {
  try {
    const path = await open({
      filters: [{ name: 'FDF', extensions: ['fdf'] }]
    });
    
    if (!path || Array.isArray(path)) return null;
    
    const fdfContent = await readTextFile(path);
    
    // 解析为 AST（保留原始信息）
    const ast = parseFDFToAST(fdfContent);
    
    // 转换为 FrameData（保留 FDF 元数据）
    const frames = parseFDF(fdfContent, {
      baseWidth: 800,
      baseHeight: 600
    });
    
    // 为每个 Frame 添加 FDF 元数据
    frames.forEach((frame, index) => {
      const astNode = ast.body[index];
      if (astNode.type === 'FrameDefinition') {
        frame.fdfMetadata = {
          inherits: astNode.inherits,
          // 保存无法映射的原始属性
          rawProperties: extractUnmappedProperties(astNode)
        };
      }
    });
    
    return frames;
  } catch (error) {
    console.error('FDF 导入失败:', error);
    throw error;
  }
}

function extractUnmappedProperties(node: FDFFrameDefinition): Record<string, any> {
  // 提取 fdfTransformer 未处理的属性
  const unmapped: Record<string, any> = {};
  // ... 实现逻辑
  return unmapped;
}
```

4. **模板系统**

```typescript
// src/utils/fdfTemplates.ts
export class FDFTemplateManager {
  private templates: Map<string, FDFFrameDefinition> = new Map();
  
  // 注册模板
  registerTemplate(name: string, template: FDFFrameDefinition) {
    this.templates.set(name, template);
  }
  
  // 解析 INHERITS
  resolveInheritance(frame: FrameData): FrameData {
    if (!frame.fdfMetadata?.inherits) return frame;
    
    const template = this.templates.get(frame.fdfMetadata.inherits);
    if (!template) return frame;
    
    // 合并模板属性
    return mergeTemplate(frame, template);
  }
  
  // 从 FDF 文件加载模板库
  async loadTemplates(fdfPath: string) {
    const content = await readTextFile(fdfPath);
    const ast = parseFDFToAST(content);
    
    ast.body.forEach(node => {
      if (node.type === 'FrameDefinition') {
        this.registerTemplate(node.name, node);
      }
    });
  }
}
```

#### 第三阶段：导出功能增强

5. **增强 FDF 导出**

```typescript
// src/utils/fdfExport.ts
import { exportFDF } from './fdf';

export async function exportToFDFEnhanced(frames: FrameData[]): Promise<string | null> {
  try {
    // 如果 Frame 有 FDF 元数据，优先使用原始信息
    const enhancedFrames = frames.map(frame => {
      if (frame.fdfMetadata?.rawProperties) {
        // 合并原始属性和编辑后的属性
        return mergeWithRawProperties(frame);
      }
      return frame;
    });
    
    const fdfText = exportFDF(enhancedFrames, {
      indent: '\t',
      includeComments: true,
      baseWidth: 800,
      baseHeight: 600
    });
    
    // 添加 INHERITS 和模板引用
    const enhancedFDF = addTemplateReferences(fdfText, frames);
    
    const path = await save({
      filters: [{ name: 'FDF', extensions: ['fdf'] }]
    });
    
    if (!path) return null;
    
    await writeTextFile(path, enhancedFDF);
    return path;
  } catch (error) {
    console.error('FDF 导出失败:', error);
    throw error;
  }
}

function addTemplateReferences(fdfText: string, frames: FrameData[]): string {
  // 在 Frame 定义中添加 INHERITS 关键字
  // ... 实现逻辑
  return fdfText;
}
```

#### 第四阶段：.w3ui 文件升级

6. **文件格式迁移**

```typescript
// src/utils/fileOperations.ts

// 升级到 v2 格式
function migrateToV2(project: ProjectData): ProjectData {
  return {
    ...project,
    version: 2, // 添加版本号
    fdfTemplates: {}, // 初始化模板库
    frames: Object.fromEntries(
      Object.entries(project.frames).map(([id, frame]) => [
        id,
        {
          ...frame,
          fdfMetadata: undefined // 现有项目没有元数据
        }
      ])
    )
  };
}

// 加载项目时自动迁移
export async function loadProjectFromPath(path: string) {
  const jsonData = await readTextFile(path);
  let project = JSON.parse(jsonData) as ProjectData;
  
  // 检查版本并迁移
  if (!project.version || project.version < 2) {
    project = migrateToV2(project);
  }
  
  project = migrateProjectData(project);
  
  return { project, path };
}
```

## 功能清单

### 需要实现的功能

#### 1. 核心功能

- [ ] **FDF 元数据支持**
  - [ ] 扩展 FrameData 类型（fdfMetadata 字段）
  - [ ] 扩展 ProjectData 类型（fdfTemplates 字段）
  - [ ] 文件版本管理（version 字段）

- [ ] **增强导入**
  - [ ] `importFromFDFEnhanced` - 保留 FDF 元数据
  - [ ] `extractUnmappedProperties` - 提取无法映射的属性
  - [ ] 批量导入 FDF 文件夹

- [ ] **模板系统**
  - [ ] `FDFTemplateManager` 类
  - [ ] 模板注册和解析
  - [ ] INHERITS 自动展开
  - [ ] 模板库管理 UI

- [ ] **增强导出**
  - [ ] `exportToFDFEnhanced` - 还原 FDF 元数据
  - [ ] `addTemplateReferences` - 添加 INHERITS
  - [ ] `mergeWithRawProperties` - 合并原始属性
  - [ ] 导出时自动提取模板

#### 2. UI 功能

- [ ] **菜单栏**
  - [ ] "文件" → "导入 FDF"（增强版）
  - [ ] "文件" → "导出 FDF"（增强版）
  - [ ] "文件" → "导入 FDF 模板库"
  - [ ] "工具" → "管理模板库"

- [ ] **属性面板**
  - [ ] 显示 "继承自" 模板名称
  - [ ] "应用模板" 按钮
  - [ ] "保存为模板" 按钮

- [ ] **模板管理器**（新组件）
  - [ ] 模板列表
  - [ ] 模板预览
  - [ ] 创建/编辑/删除模板
  - [ ] 从 FDF 导入模板
  - [ ] 导出模板为 FDF

#### 3. 文件格式升级

- [ ] **数据迁移**
  - [ ] `migrateToV2` - 升级到 v2 格式
  - [ ] 向后兼容 v1 格式
  - [ ] 自动迁移提示

- [ ] **.w3ui 格式**
  - [ ] 添加 `version: 2`
  - [ ] 添加 `fdfTemplates` 字段
  - [ ] 所有 frames 包含 `fdfMetadata`

## 实现时间估算

| 阶段 | 功能 | 时间 |
|------|------|------|
| 第一阶段 | 数据结构扩展 | 1-2 天 |
| 第二阶段 | 导入功能增强 | 2-3 天 |
| 第三阶段 | 导出功能增强 | 2-3 天 |
| 第四阶段 | 文件格式升级 | 1-2 天 |
| UI 功能 | 模板管理器等 | 3-4 天 |
| 测试和优化 | 完整测试 | 2-3 天 |

**总计**: 11-17 天

## 渐进式实施建议

### Phase 1: 基础支持（优先）
1. 扩展 FrameData 类型（fdfMetadata）
2. 基础 FDF 导入（保留元数据）
3. 基础 FDF 导出（还原元数据）

### Phase 2: 模板系统
4. FDFTemplateManager 实现
5. INHERITS 解析和展开
6. 模板库管理 UI

### Phase 3: 完整集成
7. 文件格式迁移
8. 完整测试
9. 文档更新

## 兼容性策略

### 向后兼容

```typescript
// 加载 v1 格式项目
if (!project.version) {
  // v1 格式，自动升级
  project = migrateToV2(project);
}

// 保存时可选择格式
export async function saveProject(project: ProjectData, format: 'v1' | 'v2' = 'v2') {
  if (format === 'v1') {
    // 移除 v2 特性，保存为 v1
    return saveAsV1(project);
  }
  // 默认保存为 v2
  return saveAsV2(project);
}
```

### 向前兼容

```typescript
// 未来 v3 格式预留
interface ProjectDataV3 extends ProjectData {
  version: 3;
  // 新特性...
}

// 加载时自动迁移
function loadProject(data: any): ProjectData {
  const version = data.version || 1;
  
  let project = data;
  if (version === 1) project = migrateToV2(project);
  if (version === 2) project = migrateToV3(project);
  
  return project;
}
```

## 总结

**推荐采用方案 1（混合存储）**，理由：

1. ✅ **最小改动** - 在现有 FrameData 基础上扩展
2. ✅ **向后兼容** - v1 项目可以无缝升级
3. ✅ **功能完整** - 支持 FDF 所有特性
4. ✅ **性能优化** - 运行时使用 FrameData，导入导出时才转换
5. ✅ **风险可控** - 渐进式实施，每个阶段可独立测试

**核心优势**:
- 用户可以直接导入 WC3 原生 FDF 文件
- 导出的 FDF 文件可以在 WC3 中使用
- 支持模板库复用（如官方 UI 模板）
- 保留所有 FDF 特性（INHERITS, IncludeFile 等）

**下一步行动**:
1. 扩展 `FrameData` 添加 `fdfMetadata` 字段
2. 实现 `importFromFDFEnhanced` 函数
3. 创建 `FDFTemplateManager` 类
4. 更新 UI 添加模板管理功能
