# FDF 测试工具

此目录包含 FDF（Frame Definition File）解析器的测试文件。

## 文件说明

### test-fdf.ts
完整的 FDF 解析器测试套件，包括：
- **基础测试**（10 个）：验证解析、转换、导出、往返等核心功能
  - 解析简单 Frame
  - 解析 INHERITS 继承语法
  - 解析数组属性
  - AST 转换为 FrameData
  - 保留 FDF 元数据
  - 提取 Texture 数据
  - 导出为 FDF
  - 往返测试（简单 Frame、INHERITS、复杂属性）
  
- **WC3 文件测试**：测试 84 个魔兽争霸 3 原生 FDF 文件
- **统计分析**：分析 Frame 类型、模板使用、继承关系等

### test-fdf.js
从 TypeScript 编译生成的 JavaScript 版本，用于直接运行测试。

### debug-inherits.ts
调试脚本，用于追踪 INHERITS 功能的完整数据流：
- 原始 FDF → AST 解析
- AST → FrameData 转换
- FrameData → FDF 导出
- 导出 FDF → 再次解析

## 运行测试

```bash
# 运行完整测试套件
bun tests/test-fdf.ts

# 或使用编译后的 JS 版本
node tests/test-fdf.js

# 运行 INHERITS 调试脚本
bun tests/debug-inherits.ts
```

## 测试结果

- **基础测试**: 10/10 通过（100%）
- **WC3 文件测试**: 79/84 通过（94%）
  - 5 个失败的文件为字符串定义文件（不包含 Frame）
- **继承关系**: 检测到 787 个继承关系，最大继承深度为 2
- **Frame 类型**: 支持 30 种不同的 Frame 类型
- **模板数量**: 1309 个模板定义

## 相关文件

FDF 解析器核心代码位于 `src/utils/` 目录：
- `fdf.ts` - 主入口和词法分析器
- `fdfLexer.ts` - 词法分析器（Tokenizer）
- `fdfParser.ts` - 语法分析器（Parser）
- `fdfTransformer.ts` - AST 转换器
- `fdfExporter.ts` - FDF 导出器
- `fdfImport.ts` - 增强的 FDF 导入功能
