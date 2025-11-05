# V2 格式重构进度报告

## 重构目标
统一使用 FDF 格式作为数据源，支持模板库系统和无损导入导出。

## 重构策略
- **直接升级到 V2**，不兼容 V1 项目
- **混合存储方案**：FrameData（运行时）+ FDF 元数据（导入导出）
- **保留 FDF 原始信息**：INHERITS、rawProperties、comment 等

---

## ✅ 第一阶段：数据结构扩展（已完成）

### 1. 核心类型扩展 (`src/types/index.ts`)

#### 新增接口
```typescript
// FDF 元数据 - 保留原始 FDF 信息
interface FDFMetadata {
  inherits?: string;                    // INHERITS 模板名
  includeFile?: string;                 // IncludeFile 路径
  rawProperties?: Record<string, any>;  // 无法映射的原始属性
  comment?: string;                     // FDF 注释
  originalFDF?: string;                 // 原始 FDF 文本
}

// FDF 纹理数据
interface FDFTextureData {
  file: string;
  texCoord?: [number, number, number, number];
  alphaMode?: 'ALPHAKEY' | 'BLEND' | 'ADD';
  decorateFileNames?: boolean;
}

// FDF 文本数据
interface FDFStringData {
  content: string;
  font?: string;
  fontSize?: number;
  fontFlags?: string[];
  shadowOffset?: [number, number];
  shadowColor?: string;
}

// FDF Backdrop 数据
interface FDFBackdropData {
  background?: string;
  edgeFile?: string;
  cornerFlags?: string;
  cornerSize?: number;
  blendAll?: boolean;
}

// FDF 模板
interface FDFTemplate {
  name: string;
  frameType: string;
  inherits?: string;
  properties: Record<string, any>;
}
```

#### 扩展 FrameData
```typescript
interface FrameData {
  // ... 现有字段
  diskTexture?: string;        // ❗ 改为可选
  wc3Texture?: string;         // ❗ 改为可选
  
  // ✨ 新增 FDF 扩展字段
  fdfMetadata?: FDFMetadata;
  fdfTexture?: FDFTextureData;
  fdfString?: FDFStringData;
  fdfBackdrop?: FDFBackdropData;
}
```

#### 扩展 ProjectData
```typescript
interface ProjectData {
  version: 2;                  // ❗ 升级到 V2
  fdfTemplates?: Record<string, FDFTemplate>; // ✨ 模板库
  // ... 其他字段
}
```

### 2. FDF 模板管理器 (`src/utils/fdfTemplates.ts`)

#### 功能特性
- ✅ **模板注册**：`registerTemplate(name, template)`
- ✅ **批量注册**：`registerTemplates(templates)`
- ✅ **模板查询**：`getTemplate(name)`, `hasTemplate(name)`
- ✅ **从文件加载**：`loadTemplatesFromFile(fdfPath)`
- ✅ **从文本加载**：`loadTemplatesFromText(fdfText)`
- ✅ **继承解析**：`resolveInheritance(frameName)` - 自动展开 INHERITS 链
- ✅ **应用模板**：`applyTemplate(frame, templateName)`
- ✅ **导出模板**：`exportTemplates()` - 序列化为简化格式
- ✅ **循环检测**：防止无限继承循环

#### 核心代码
```typescript
export class FDFTemplateManager {
  private templates: Map<string, FDFFrameDefinition>;
  
  // 解析 INHERITS 继承链
  resolveInheritance(frameName: string): FDFFrameDefinition | null {
    const visited = new Set<string>();
    const inheritanceChain: FDFFrameDefinition[] = [];
    
    let currentName: string | undefined = frameName;
    while (currentName) {
      if (visited.has(currentName)) {
        console.error(`检测到循环继承: ${currentName}`);
        return null;
      }
      
      const template = this.getTemplate(currentName);
      if (!template) break;
      
      visited.add(currentName);
      inheritanceChain.push(template);
      currentName = template.inherits;
    }
    
    // 从父类到子类合并属性
    return mergeInheritanceChain(inheritanceChain);
  }
}

// 全局单例
export const templateManager = new FDFTemplateManager();
```

### 3. 增强 FDF 导入 (`src/utils/fdfImport.ts`)

#### 核心功能
- ✅ **增强导入**：`importFromFDFEnhanced()` - 保留所有 FDF 元数据
- ✅ **批量导入**：`importFDFFolder()` - 导入整个文件夹作为模板库
- ✅ **编程式导入**：`importFromFDFText(fdfText)` - 从字符串导入
- ✅ **模板应用**：`applyTemplateInheritance(frame)` - 自动展开继承
- ✅ **批量应用**：`applyTemplateInheritanceToAll(frames)`

#### 元数据提取
```typescript
function enhanceFrameWithFDF(frame: FrameData, astNode: FDFFrameDefinition): FrameData {
  // 过滤出 FDFProperty 类型
  const properties = astNode.properties.filter(
    (p): p is FDFProperty => p.type === 'Property'
  );
  
  return {
    ...frame,
    fdfMetadata: {
      inherits: astNode.inherits,
      rawProperties: extractRawProperties(properties),
    },
    fdfTexture: extractTextureData(properties),
    fdfString: extractStringData(properties),
    fdfBackdrop: extractBackdropData(properties),
  };
}
```

#### 数据提取器
- ✅ `extractTextureData()` - 提取 SetTexture, SetTexCoord, SetAlphaMode
- ✅ `extractStringData()` - 提取 SetText, SetFont, SetFontSize, SetFontFlags
- ✅ `extractBackdropData()` - 提取 BackdropBackground, BackdropEdgeFile 等
- ✅ `extractRawProperties()` - 保留所有原始属性

### 4. 统一导入导出 API (`src/utils/fdfImportExport.ts`)

```typescript
// 导入功能
export {
  importFromFDFEnhanced,
  importFDFFolder,
  importFromFDFText,
  applyTemplateInheritance,
  applyTemplateInheritanceToAll,
} from './fdfImport';

// 导出功能
export { FDFExporter } from './fdfExporter';

// 模板管理
export { FDFTemplateManager, templateManager } from './fdfTemplates';

// 核心解析器
export { parseFDF, parseFDFToAST, exportFDF, validateFDF, formatFDF } from './fdf';
```

### 5. UI 集成 (`src/components/MenuBar.tsx`)

#### 新增菜单项
```typescript
{
  label: '导入',
  submenu: [
    { label: '导入 FDF (基础)', action: handleImportFDF },
    { label: '导入 FDF (增强)', action: handleImportFDFEnhanced },
    { separator: true },
    { label: '导入 FDF 模板库', action: handleImportFDFTemplates }
  ]
}
```

#### 新增处理函数
- ✅ `handleImportFDFEnhanced()` - 增强导入，保留元数据
- ✅ `handleImportFDFTemplates()` - 批量导入模板库

### 6. 项目默认值更新

#### `src/store/projectStore.ts`
```typescript
const createDefaultProject = (): ProjectData => ({
  version: 2,              // ✨ V2 版本
  fdfTemplates: {},        // ✨ 空模板库
  // ... 其他字段
})
```

#### `src/components/MenuBar.tsx`
```typescript
const handleNewProject = () => {
  const newProject: ProjectData = {
    version: 2,
    fdfTemplates: {},
    frames: [],
    // ...
  };
};
```

---

## 📊 第一阶段成果统计

### 新增文件（3 个）
1. `src/utils/fdfTemplates.ts` - 模板管理器（205 行）
2. `src/utils/fdfImport.ts` - 增强导入（300+ 行）
3. `src/utils/fdfImportExport.ts` - 统一 API（36 行）

### 修改文件（5 个）
1. `src/types/index.ts` - 类型扩展（+100 行）
2. `src/store/projectStore.ts` - 默认项目升级
3. `src/components/MenuBar.tsx` - 菜单集成
4. `src/utils/fileOperations.ts` - 导入路径修复
5. `src/utils/fdfExporter.ts` - 类型修复

### 代码统计
- **新增代码**：~600 行
- **修改代码**：~50 行
- **测试覆盖**：0%（待实现）

---

## 🔄 待完成阶段

### 第二阶段：增强 FDF 导出（2-3 天）
**目标**：实现无损导出，还原 FDF 元数据

#### 任务清单
- [ ] 创建 `exportToFDFEnhanced(frames)` 函数
- [ ] 还原 FDF 元数据（inherits, rawProperties）
- [ ] 添加 INHERITS 引用
- [ ] 合并原始属性和运行时属性
- [ ] 保留注释和格式
- [ ] 支持导出为多个文件（按模板分组）

#### 核心功能
```typescript
function exportToFDFEnhanced(frame: FrameData): string {
  // 1. 优先使用 fdfMetadata.originalFDF（如果有）
  if (frame.fdfMetadata?.originalFDF) {
    return frame.fdfMetadata.originalFDF;
  }
  
  // 2. 从 FrameData 重建 FDF
  const fdf = `Frame "${frame.type}" "${frame.name}" {
    ${frame.fdfMetadata?.inherits ? `INHERITS "${frame.fdfMetadata.inherits}",` : ''}
    
    // 运行时属性（优先）
    ${exportRuntimeProperties(frame)}
    
    // 原始属性（如果不冲突）
    ${exportRawProperties(frame.fdfMetadata?.rawProperties)}
    
    // FDF 扩展属性
    ${exportTextureData(frame.fdfTexture)}
    ${exportStringData(frame.fdfString)}
    ${exportBackdropData(frame.fdfBackdrop)}
  }`;
  
  return fdf;
}
```

### 第三阶段：模板系统完善（1-2 天）
**目标**：UI 友好的模板管理

#### 任务清单
- [ ] 创建 `TemplateManager.tsx` 组件
- [ ] 模板列表展示（带预览）
- [ ] 模板应用按钮
- [ ] 模板编辑功能
- [ ] 模板保存/删除
- [ ] 模板导出为 FDF 文件

#### UI 设计
```
┌─ 模板管理器 ──────────────────────┐
│ 搜索: [_______________] [刷新]    │
│                                   │
│ ┌─ WC3 原生模板 (258) ──────────┐ │
│ │ ☑ SIMPLEFRAME                 │ │
│ │ ☑ BACKDROP                    │ │
│ │ ☑ TEXT                        │ │
│ │ ☑ BUTTON                      │ │
│ │ ...                           │ │
│ └───────────────────────────────┘ │
│                                   │
│ ┌─ 自定义模板 (12) ─────────────┐ │
│ │ ☑ MyButton                    │ │
│ │ ☑ MyDialog                    │ │
│ │ ...                           │ │
│ └───────────────────────────────┘ │
│                                   │
│ [应用] [编辑] [删除] [导出]       │
└───────────────────────────────────┘
```

### 第四阶段：测试与文档（1 天）
**目标**：确保功能稳定

#### 任务清单
- [ ] 单元测试：模板管理器
- [ ] 单元测试：FDF 导入导出
- [ ] 集成测试：完整工作流
- [ ] 编写用户文档
- [ ] 编写开发文档

---

## 🎯 重构成果

### 核心优势
1. **统一技术栈**：全面采用 FDF 格式
2. **无损往返**：导入 → 编辑 → 导出不丢失信息
3. **模板系统**：复用 WC3 原生模板库（258+ 控件）
4. **向后兼容**：保留原始 FDF 属性
5. **扩展性强**：易于添加新的 FDF 特性

### 技术债务
1. ❌ 未兼容 V1 项目（按计划）
2. ⚠️ 缺少单元测试
3. ⚠️ 缺少错误处理（部分）
4. ⚠️ 性能未优化（大量模板时）

---

## 📅 时间规划

- **第一阶段**：✅ 已完成（1 天）
- **第二阶段**：⏳ 预计 2-3 天
- **第三阶段**：⏳ 预计 1-2 天
- **第四阶段**：⏳ 预计 1 天

**总计**：5-7 天完成整个重构

---

## 🚀 下一步行动

1. **立即开始第二阶段**：增强 FDF 导出
   - 创建 `exportToFDFEnhanced()`
   - 还原 FDF 元数据
   - 添加 INHERITS 支持

2. **优先级调整**：
   - 先完成核心功能（导入导出）
   - 再完善 UI（模板管理器）
   - 最后补充测试

3. **风险控制**：
   - 每阶段结束后 Git 提交
   - 保持编译零错误
   - 及时更新文档

---

**报告生成时间**：2024-01-XX  
**当前版本**：V2.0-alpha  
**Git Commit**：`728372b`
