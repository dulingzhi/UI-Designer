## 功能说明

这是一个基于 React + Tauri 重新实现的 Warcraft 3 UI 设计器，参考了 Warcraft-3-Reforged-UI-Designer 的核心功能。

### 已实现的核心功能

1. **项目架构**
   - ✅ React + TypeScript + Tauri 技术栈
   - ✅ Zustand 状态管理
   - ✅ 命令模式支持撤销/重做

2. **数据模型**
   - ✅ Frame 组件数据结构
   - ✅ 项目树结构
   - ✅ Array 系统（TableArray, CircleArray）
   - ✅ 完整的类型定义

3. **核心组件**
   - ✅ Canvas 画布组件（支持缩放、拖拽）
   - ✅ 属性面板（编辑Frame属性）
   - ✅ 项目树视图（层级显示）
   - ✅ 工具栏（创建元素、撤销重做）

4. **命令系统**
   - ✅ CreateFrameCommand
   - ✅ RemoveFrameCommand
   - ✅ UpdateFrameCommand
   - ✅ MoveFrameCommand
   - ✅ ChangeParentCommand

### 待实现的功能

1. **文件操作**
   - ⏳ 新建项目
   - ⏳ 打开项目
   - ⏳ 保存项目
   - ⏳ 另存为

2. **导出功能**
   - ⏳ JASS 代码导出
   - ⏳ LUA 代码导出
   - ⏳ TypeScript 代码导出
   - ⏳ TOC 文件生成

3. **高级功能**
   - ⏳ Array 创建和管理
   - ⏳ 图片处理（BLP/DDS支持）
   - ⏳ 模板系统
   - ⏳ 键盘快捷键
   - ⏳ 元素拖拽调整大小
   - ⏳ 网格对齐

4. **UI 增强**
   - ⏳ 主题切换
   - ⏳ 右键菜单
   - ⏳ Tooltip 提示
   - ⏳ 背景图片选择

### 安装依赖

```bash
npm install
```

### 运行开发环境

```bash
npm run dev
npm run tauri dev
```

### 构建应用

```bash
npm run tauri build
```

### 目录结构

```
src/
├── types/          # TypeScript类型定义
├── store/          # Zustand状态管理
├── commands/       # 命令模式实现
├── components/     # React组件
│   ├── Canvas.tsx
│   ├── Toolbar.tsx
│   ├── ProjectTree.tsx
│   └── PropertiesPanel.tsx
└── utils/          # 工具函数
```

### 原项目参考

基于 [Warcraft-3-Reforged-UI-Designer](https://github.com/Deadreyo/Warcraft-3-Reforged-UI-Designer) 的功能设计。

### 技术栈

- **前端**: React 19 + TypeScript
- **状态管理**: Zustand
- **桌面框架**: Tauri 2
- **构建工具**: Vite
- **UI**: 原生CSS（可扩展为Tailwind/MUI）
