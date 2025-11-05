# FDF 解析器快速开始指南

## 5 分钟上手

### 1. 导入 FDF 文件

```typescript
import { parseFDF } from './utils/fdf';

// 读取 FDF 文件内容
const fdfText = `
Frame "BACKDROP" "MyFrame" {
  Width 0.256
  Height 0.032
  SetPoint TOPLEFT, "UIParent", TOPLEFT, 0.0, 0.0
  
  Texture {
    File "EscMenuBackground"
  }
}
`;

// 解析为 FrameData
const frames = parseFDF(fdfText, {
  baseWidth: 800,   // 画布宽度
  baseHeight: 600   // 画布高度
});

console.log(frames);
// [{
//   id: "frame_...",
//   name: "MyFrame",
//   type: 1, // BACKDROP
//   width: 204.8,  // 0.256 * 800
//   height: 19.2,  // 0.032 * 600
//   anchors: [...],
//   ...
// }]
```

### 2. 导出为 FDF

```typescript
import { exportFDF } from './utils/fdf';

const frames: FrameData[] = [
  {
    id: "frame1",
    name: "MyFrame",
    type: 1, // BACKDROP
    width: 200,
    height: 100,
    x: 50,
    y: 50,
    z: 0,
    parentId: null,
    children: [],
    tooltip: false,
    isRelative: false,
    anchors: [],
    diskTexture: "",
    wc3Texture: "",
  }
];

const fdfText = exportFDF(frames, {
  indent: '\t',
  includeComments: true
});

console.log(fdfText);
// Frame "BACKDROP" "MyFrame" {
// 	Width 0.250000
// 	Height 0.166667
// }
```

### 3. 验证 FDF 格式

```typescript
import { validateFDF } from './utils/fdf';

const result = validateFDF(fdfText);

if (result.valid) {
  console.log('✅ FDF 格式正确');
} else {
  console.error('❌ FDF 格式错误:');
  result.errors.forEach(err => console.error('  -', err));
}
```

### 4. 格式化 FDF

```typescript
import { formatFDF } from './utils/fdf';

const messyFDF = `Frame "BACKDROP" "Test"{Width 0.5 Height 0.3}`;

const cleanFDF = formatFDF(messyFDF, {
  indent: '  ' // 使用 2 空格缩进
});

console.log(cleanFDF);
// Frame "BACKDROP" "Test" {
//   Width 0.500000
//   Height 0.300000
// }
```

## 常见使用场景

### 场景 1: 从文件导入

```typescript
import { parseFDF } from './utils/fdf';

async function importFDFFile(filePath: string) {
  try {
    // 使用 Tauri 读取文件
    const fdfContent = await window.__TAURI__.fs.readTextFile(filePath);
    
    // 解析
    const frames = parseFDF(fdfContent, {
      baseWidth: 800,
      baseHeight: 600
    });
    
    // 添加到项目
    frames.forEach(frame => {
      projectStore.addFrame(frame);
    });
    
    console.log(`✅ 成功导入 ${frames.length} 个控件`);
  } catch (error) {
    console.error('❌ 导入失败:', error);
  }
}
```

### 场景 2: 导出到文件

```typescript
import { exportFDF } from './utils/fdf';

async function exportFDFFile(filePath: string) {
  try {
    // 获取所有 Frame
    const frames = Object.values(projectStore.frames);
    
    // 导出为 FDF
    const fdfText = exportFDF(frames, {
      indent: '\t',
      includeComments: true,
      baseWidth: 800,
      baseHeight: 600
    });
    
    // 使用 Tauri 写入文件
    await window.__TAURI__.fs.writeTextFile(filePath, fdfText);
    
    console.log('✅ 导出成功');
  } catch (error) {
    console.error('❌ 导出失败:', error);
  }
}
```

### 场景 3: 批量导入原生 UI

```typescript
import { parseFDF } from './utils/fdf';

async function importWC3NativeUI() {
  const nativeFiles = [
    'target/vendor/UI/FrameDef/UI/ConsoleUI.fdf',
    'target/vendor/UI/FrameDef/UI/ResourceBar.fdf',
    'target/vendor/UI/FrameDef/UI/InfoPanelUnitDetail.fdf',
  ];
  
  for (const filePath of nativeFiles) {
    try {
      const content = await window.__TAURI__.fs.readTextFile(filePath);
      const frames = parseFDF(content);
      
      frames.forEach(frame => {
        projectStore.addFrame(frame);
      });
      
      console.log(`✅ 导入 ${filePath}: ${frames.length} 个控件`);
    } catch (error) {
      console.error(`❌ 导入失败 ${filePath}:`, error);
    }
  }
}
```

### 场景 4: FDF 预览和编辑

```typescript
import { parseFDF, exportFDF, validateFDF } from './utils/fdf';
import { useState } from 'react';

function FDFEditor() {
  const [fdfText, setFdfText] = useState('');
  const [error, setError] = useState('');
  
  const handleChange = (text: string) => {
    setFdfText(text);
    
    // 实时验证
    const result = validateFDF(text);
    if (!result.valid) {
      setError(result.errors.join('\n'));
    } else {
      setError('');
    }
  };
  
  const handleImport = () => {
    try {
      const frames = parseFDF(fdfText);
      frames.forEach(frame => projectStore.addFrame(frame));
      alert(`✅ 导入成功! ${frames.length} 个控件`);
    } catch (err) {
      alert(`❌ 导入失败: ${err}`);
    }
  };
  
  return (
    <div>
      <textarea 
        value={fdfText} 
        onChange={e => handleChange(e.target.value)}
        placeholder="粘贴 FDF 代码..."
      />
      {error && <div className="error">{error}</div>}
      <button onClick={handleImport}>导入</button>
    </div>
  );
}
```

## 高级用法

### 自定义转换选项

```typescript
const frames = parseFDF(fdfText, {
  // 画布尺寸
  baseWidth: 1920,
  baseHeight: 1080,
  
  // 是否解析模板继承
  resolveInheritance: false,
  
  // 模板注册表（用于 INHERITS 展开）
  templateRegistry: new Map([
    ['MyTemplate', templateFrame]
  ])
});
```

### 自定义导出选项

```typescript
const fdfText = exportFDF(frames, {
  // 缩进样式
  indent: '    ', // 4 空格
  
  // 是否包含注释
  includeComments: true,
  
  // 画布尺寸（用于像素 → 相对坐标转换）
  baseWidth: 800,
  baseHeight: 600
});
```

### 解析为 AST（高级）

```typescript
import { parseFDFToAST } from './utils/fdf';

// 解析为抽象语法树（不转换为 FrameData）
const ast = parseFDFToAST(fdfText);

console.log(ast);
// {
//   type: 'Program',
//   body: [
//     {
//       type: 'FrameDefinition',
//       frameType: 'BACKDROP',
//       name: 'MyFrame',
//       properties: [...]
//     }
//   ]
// }

// 可以对 AST 进行自定义处理...
```

## 支持的 FDF 特性

✅ **已支持**:
- Frame 定义 (`Frame "TYPE" "Name" { ... }`)
- 模板继承 (`INHERITS "TemplateName"`)
- 文件包含 (`IncludeFile "path.fdf"`)
- 嵌套元素 (`Texture {}`, `String {}`)
- 所有基础属性 (Width, Height, SetPoint, Text, Font, etc.)
- 注释 (`//` 和 `/* */`)

🚧 **部分支持**:
- 模板自动展开（解析但不展开）
- 文件自动加载（解析但不加载）

❌ **未支持**:
- 动画定义
- 事件处理器
- 脚本表达式

## 错误处理

```typescript
import { parseFDF, validateFDF } from './utils/fdf';

// 方式 1: 先验证再解析
const validation = validateFDF(fdfText);
if (!validation.valid) {
  console.error('格式错误:', validation.errors);
  return;
}

const frames = parseFDF(fdfText);

// 方式 2: Try-Catch
try {
  const frames = parseFDF(fdfText);
} catch (error) {
  console.error('解析失败:', error);
  // 错误信息包含行号和列号
  // 例如: "Expected token type STRING but got NUMBER at line 15:23"
}
```

## 性能建议

- ✅ **小文件 (<1KB)**: 直接解析，无需优化
- ✅ **中等文件 (1-100KB)**: 正常使用，性能良好
- ⚠️ **大文件 (>100KB)**: 考虑分批处理或使用 Web Worker

```typescript
// 大文件优化示例
async function parseLargeFDF(fdfText: string) {
  // 分批处理（每批 1000 行）
  const lines = fdfText.split('\n');
  const batchSize = 1000;
  const allFrames: FrameData[] = [];
  
  for (let i = 0; i < lines.length; i += batchSize) {
    const batch = lines.slice(i, i + batchSize).join('\n');
    const frames = parseFDF(batch);
    allFrames.push(...frames);
    
    // 让出主线程
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  
  return allFrames;
}
```

## 调试技巧

### 1. 查看 Token 流

```typescript
import { FDFLexer } from './utils/fdf';

const lexer = new FDFLexer(fdfText);
const tokens = lexer.tokenize();

console.log('Tokens:', tokens);
// 可以看到词法分析的结果
```

### 2. 查看 AST

```typescript
import { parseFDFToAST } from './utils/fdf';

const ast = parseFDFToAST(fdfText);
console.log('AST:', JSON.stringify(ast, null, 2));
// 可以看到语法树结构
```

### 3. 逐步调试

```typescript
import { FDFLexer, FDFParser, FDFTransformer } from './utils/fdf';

// 步骤 1: 词法分析
const lexer = new FDFLexer(fdfText);
const tokens = lexer.tokenize();
console.log('✅ 词法分析完成');

// 步骤 2: 语法分析
const parser = new FDFParser(tokens);
const ast = parser.parse();
console.log('✅ 语法分析完成');

// 步骤 3: 转换
const transformer = new FDFTransformer();
const frames = transformer.transform(ast);
console.log('✅ 转换完成');
```

## 更多资源

- 📖 [技术文档](./FDF_PARSER_GUIDE.md) - 详细的架构和 API 说明
- 📚 [属性参考](./FDF_PROPERTIES_REFERENCE.md) - 完整的 FDF 语法参考
- 📝 [开发总结](./FDF_PARSER_SUMMARY.md) - 项目总结和未来计划

## 常见问题

**Q: 如何处理 INHERITS 模板继承?**

A: 目前解析器会解析 INHERITS 关键字，但不会自动展开模板。你可以：
```typescript
const frames = parseFDF(fdfText, {
  resolveInheritance: false, // 禁用自动展开
  templateRegistry: new Map() // 或提供自定义模板
});
```

**Q: 如何处理 IncludeFile?**

A: 解析器会解析 IncludeFile 指令到 AST，但不会自动加载文件。你需要手动处理：
```typescript
const ast = parseFDFToAST(fdfText);
for (const node of ast.body) {
  if (node.type === 'Include') {
    const includedContent = await loadFile(node.path);
    // 递归解析...
  }
}
```

**Q: 导出的坐标为什么不准确?**

A: 确保提供正确的 baseWidth 和 baseHeight：
```typescript
const fdfText = exportFDF(frames, {
  baseWidth: 800,   // 必须与导入时相同
  baseHeight: 600
});
```

---

**开始使用吧！** 🚀
