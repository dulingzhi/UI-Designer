# FDF 解析器测试

## 测试工具

测试工具位于 `src/utils/fdfTestRunner.ts`，提供三个主要功能：

### 1. 基础功能测试

测试 FDF 解析器的核心功能：
- 解析简单 Frame
- 解析 INHERITS 继承
- 解析数组属性
- 解析字符串/数字属性
- 解析嵌套 Frame
- AST 转换为 FrameData
- 保留 FDF 元数据
- 提取 Texture/String/Backdrop 数据
- 导出为 FDF

### 2. WC3 原生文件测试

测试对 Warcraft III 原生 FDF 文件的解析能力：
- 扫描 `target/vendor/UI/FrameDef` 目录
- 解析所有 `.fdf` 文件
- 统计成功率

### 3. 统计分析

分析 WC3 原生 FDF 文件的特征：
- Frame 类型统计
- 模板数量统计
- 继承关系分析
- 最大继承深度计算

## 使用方法

### 方法 1：在浏览器控制台运行（推荐）

1. 启动开发服务器：
```bash
bun tauri dev
```

2. 打开浏览器控制台（F12）

3. 导入测试工具：
```javascript
import('/src/utils/fdfTestRunner.ts').then(async (module) => {
  // 运行所有测试
  const results = await module.runAllTests();
  console.log('测试完成！', results);
  
  // 或者单独运行某个测试
  // await module.runBasicTests();
  // await module.runWC3Tests();
  // await module.analyzeWC3FDF();
});
```

### 方法 2：在应用中调用

在任意 React 组件中导入并调用：

```typescript
import { runAllTests, runBasicTests, runWC3Tests, analyzeWC3FDF } from '../utils/fdfTestRunner';

// 在事件处理函数或 useEffect 中调用
const handleRunTests = async () => {
  const results = await runAllTests();
  console.log(results);
};
```

### 方法 3：添加到菜单

在 MenuBar.tsx 中添加菜单项：

```typescript
{
  label: '测试',
  submenu: [
    { label: '运行 FDF 解析器测试', action: async () => {
      const { runAllTests } = await import('../utils/fdfTestRunner');
      await runAllTests();
    }},
  ]
}
```

## 测试输出示例

```
🧪 开始 FDF 解析器基础测试...

✓ 测试 1: 解析简单 Frame
✓ 测试 2: 解析 INHERITS
✓ 测试 3: 解析数组属性
✓ 测试 4: AST 转换为 FrameData
✓ 测试 5: 保留 FDF 元数据
✓ 测试 6: 提取 Texture 数据
✓ 测试 7: 导出为 FDF

============================================================
基础测试完成: ✓ 7 通过, ✗ 0 失败

============================================================
🧪 开始 WC3 原生 FDF 文件测试...

找到 42 个 FDF 文件

✓ UI\\FrameDef\\UI\\Console.fdf (15 个定义)
✓ UI\\FrameDef\\UI\\EscMenu.fdf (28 个定义)
✓ UI\\FrameDef\\UI\\FrameDef.fdf (156 个定义)
...

============================================================
WC3 文件测试完成: ✓ 38/42 通过

============================================================
📊 分析 WC3 原生 FDF 文件...

📈 Frame 类型统计:
  FRAME               145
  BACKDROP            89
  TEXT                76
  BUTTON              54
  ...

📦 模板统计:
  总模板数: 258
  总 Frame 数: 512
  继承关系数: 187
  最大继承深度: 5

🎯 常见模板示例:
  SIMPLEFRAME
  BACKDROP
  TEXT
  BUTTON → ButtonTemplate
  EscMenuButtonTemplate → ButtonTemplate
  ...

============================================================
📊 总体结果:
  基础测试: 7/7 通过
  WC3 文件: 38/42 通过
  总 Frame 类型: 18
  总模板数: 258
```

## 预期结果

### 基础测试
- ✅ 所有 7 个测试应该通过

### WC3 文件测试
- ✅ 至少 90% 的文件应该成功解析
- ⚠️ 少量文件可能失败（特殊语法、扩展功能等）

### 统计分析
- Frame 类型数量：~15-20 种
- 模板数量：~250-300 个
- 最大继承深度：~3-6 层

## 常见问题

### Q: 找不到 `target/vendor/UI/FrameDef` 目录

A: 确保已从魔兽争霸 III 安装目录复制了 UI 文件到项目的 `target/vendor` 目录。

### Q: 部分 WC3 文件解析失败

A: 这是正常的。WC3 原生文件可能使用了一些特殊语法或扩展功能，我们的解析器可能不支持。只要通过率 > 90% 就算合格。

### Q: 如何查看详细的解析错误？

A: 在控制台中查看错误信息，或修改 `runWC3Tests()` 函数增加错误输出。

## 下一步

如果测试通过率低于 90%，需要：
1. 查看失败的文件列表
2. 分析失败原因（语法错误、不支持的特性等）
3. 修复 FDF 解析器
4. 重新运行测试

## 贡献

欢迎添加更多测试用例！测试文件位于 `src/utils/fdfTestRunner.ts`。
