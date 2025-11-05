# Warcraft 3 UI Designer - React + Tauri 版本

这是一个基于 React + Tauri 重新实现的魔兽争霸3 UI设计器，参考了 [Warcraft-3-Reforged-UI-Designer](https://github.com/Deadreyo/Warcraft-3-Reforged-UI-Designer) 的核心功能。

## 📋 项目概述

本项目提供了一个可视化的UI设计工具，用于创建魔兽争霸3的自定义用户界面，无需编写代码即可设计复杂的UI系统，并能导出为JASS、LUA或TypeScript代码。

## ✨ 已实现的核心功能

### 1. 架构设计

- ✅ **技术栈**: React 19 + TypeScript + Tauri 2
- ✅ **状态管理**: 使用 Zustand 进行全局状态管理
- ✅ **命令模式**: 支持完整的撤销/重做功能
- ✅ **类型安全**: 完整的 TypeScript 类型定义

### 2. 数据模型

#### Frame 数据结构
```typescript
interface FrameData {
  id: string;                    // 唯一标识符
  name: string;                  // Frame名称
  type: FrameType;               // Frame类型
  x, y, width, height: number;   // 位置和大小
  z: number;                     // 层级
  parentId: string | null;       // 父级ID
  children: string[];            // 子元素列表
  tooltip: boolean;              // 是否为Tooltip
  isRelative: boolean;           // 相对定位
  
  // 纹理属性
  diskTexture: string;
  wc3Texture: string;
  
  // 文本属性
  text?: string;
  textScale?: number;
  textColor?: string;
  horAlign?: 'left' | 'center' | 'right';
  verAlign?: 'start' | 'center' | 'flex-end';
  
  // 功能属性
  trigVar?: string;
}
```

#### Frame 类型支持
- `ORIGIN` - 根节点
- `BACKDROP` - 背景
- `BUTTON` - 自定义按钮
- `BROWSER_BUTTON` - 浏览器按钮
- `SCRIPT_DIALOG_BUTTON` - 脚本对话框按钮
- `CHECKBOX` - 复选框
- `INVIS_BUTTON` - 透明按钮
- `TEXT_FRAME` - 文本框
- `HORIZONTAL_BAR` - 水平进度条
- `HOR_BAR_BACKGROUND` - 带背景的进度条
- `HOR_BAR_TEXT` - 带文本的进度条
- `HOR_BAR_BACKGROUND_TEXT` - 带背景和文本的进度条
- `TEXTAREA` - 文本区域
- `EDITBOX` - 编辑框

### 3. UI 组件

#### Canvas (画布组件)
- ✅ 可视化编辑区域
- ✅ 缩放功能 (Alt + 鼠标滚轮)
- ✅ 拖拽画布 (Alt + 鼠标拖拽)
- ✅ Frame选择和高亮
- ✅ 4:3安全区域显示
- ✅ 实时预览Frame样式

#### ProjectTree (项目树)
- ✅ 层级结构显示
- ✅ 父子关系可视化
- ✅ 点击选择Frame
- ✅ 选中状态高亮

#### PropertiesPanel (属性面板)
- ✅ Frame详细属性编辑
- ✅ 通用设置编辑
- ✅ 类型切换
- ✅ 坐标和大小调整
- ✅ 纹理路径设置
- ✅ 文本属性编辑
- ✅ 触发变量设置

#### Toolbar (工具栏)
- ✅ 文件操作按钮（新建、打开、保存、另存为）
- ✅ 撤销/重做按钮
- ✅ 快速创建Frame按钮
- ✅ 导出代码按钮

### 4. 命令系统

支持的命令：
- ✅ `CreateFrameCommand` - 创建Frame
- ✅ `RemoveFrameCommand` - 删除Frame
- ✅ `UpdateFrameCommand` - 更新Frame属性
- ✅ `MoveFrameCommand` - 移动Frame
- ✅ `ChangeParentCommand` - 更改父级

所有命令都支持撤销和重做操作。

### 5. 项目设置

#### 通用设置
- ✅ 库名称配置
- ✅ Origin模式选择 (Game UI / World Frame / Console UI)
- ✅ 默认游戏UI隐藏选项
  - 隐藏所有游戏UI
  - 隐藏英雄栏
  - 隐藏小地图
  - 隐藏资源栏
  - 隐藏按钮栏
  - 隐藏头像
  - 隐藏聊天

#### Array系统（数据结构已实现）
- ✅ `TableArrayData` - 表格数组数据结构
- ✅ `CircleArrayData` - 圆形数组数据结构

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

需要安装的关键依赖：
- `zustand` - 状态管理
- `nanoid` - ID生成
- `@tauri-apps/api` - Tauri API
- `@tauri-apps/plugin-dialog` - 文件对话框
- `@tauri-apps/plugin-fs` - 文件系统

### 开发模式

```bash
# 启动Vite开发服务器
npm run dev

# 启动Tauri开发模式
npm run tauri dev
```

### 构建应用

```bash
npm run tauri build
```

## 📦 项目结构

```
src/
├── types/                    # TypeScript类型定义
│   └── index.ts              # 核心类型定义
├── store/                    # Zustand状态管理
│   ├── projectStore.ts       # 项目状态管理
│   └── commandStore.ts       # 命令历史管理
├── commands/                 # 命令模式实现
│   └── FrameCommands.ts      # Frame相关命令
├── components/               # React组件
│   ├── Canvas.tsx            # 画布组件
│   ├── Canvas.css
│   ├── Toolbar.tsx           # 工具栏组件
│   ├── Toolbar.css
│   ├── ProjectTree.tsx       # 项目树组件
│   ├── ProjectTree.css
│   ├── PropertiesPanel.tsx   # 属性面板组件
│   └── PropertiesPanel.css
├── App.tsx                   # 主应用组件
└── App.css                   # 全局样式
```

## 🔧 待实现功能

### 高优先级

1. **文件操作**
   - [ ] 新建项目功能
   - [ ] 打开项目（JSON格式）
   - [ ] 保存项目
   - [ ] 另存为

2. **导出功能**
   - [ ] JASS代码生成
   - [ ] LUA代码生成
   - [ ] TypeScript代码生成
   - [ ] TOC文件生成

3. **画布交互**
   - [ ] 拖拽移动Frame
   - [ ] 调整Frame大小
   - [ ] 网格对齐
   - [ ] 键盘方向键微调

### 中优先级

4. **Array系统**
   - [ ] 创建TableArray
   - [ ] 创建CircleArray
   - [ ] Array配置面板
   - [ ] Array元素批量操作

5. **图片处理**
   - [ ] BLP格式支持
   - [ ] DDS格式支持
   - [ ] 图片预览
   - [ ] 文件浏览器

6. **UI增强**
   - [ ] 右键菜单
   - [ ] Tooltip详细提示
   - [ ] 主题切换
   - [ ] 背景图片选择

### 低优先级

7. **高级功能**
   - [ ] 模板系统
   - [ ] 快捷键配置
   - [ ] 最近文件列表
   - [ ] 导入原项目文件

## 🎯 使用说明

### 创建UI元素

1. 点击工具栏的相应按钮创建Frame
2. 在画布上会显示新创建的Frame
3. 在项目树中查看层级结构
4. 在属性面板中编辑详细属性

### 编辑Frame

1. 在画布或项目树中选择Frame
2. 在属性面板中修改属性
3. 更改会实时反映在画布上
4. 使用撤销/重做按钮管理历史

### 组织结构

1. 通过属性面板的"父级"选项更改父子关系
2. Frame会自动在项目树中重新组织
3. 子Frame会跟随父Frame移动

## 🎨 样式和主题

当前使用深色主题，主要颜色：
- 背景: `#1a1a1a`
- 面板: `#2c3e50`
- 按钮: `#3498db`
- 文本: `#ecf0f1`

## 📝 开发注意事项

### 状态管理

使用Zustand的项目状态存储：
```typescript
const { project, selectedFrameId, selectFrame, updateFrame } = useProjectStore();
```

### 命令执行

所有可撤销操作都应通过命令系统：
```typescript
const { executeCommand } = useCommandStore();
const command = new CreateFrameCommand(frameData);
executeCommand(command);
```

### 类型安全

所有Frame操作都有完整的类型检查，确保数据一致性。

## 🔗 参考资料

- [原项目 Warcraft-3-Reforged-UI-Designer](https://github.com/Deadreyo/Warcraft-3-Reforged-UI-Designer)
- [Tauri 文档](https://tauri.app/)
- [Zustand 文档](https://zustand-demo.pmnd.rs/)
- [React 文档](https://react.dev/)

## 📄 许可证

本项目参考原项目的设计，采用相同的CC0-1.0许可证。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## ⚠️ 当前状态

项目处于开发初期阶段。核心架构和基础UI已完成，但文件操作和代码导出功能还需要实现。

建议先运行 `npm install` 安装所有依赖后再进行开发。
