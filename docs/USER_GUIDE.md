# 🎮 Warcraft 3 UI Designer - 使用指南

## 🚀 快速开始

### 1. 启动应用

**开发模式（推荐）：**
```powershell
# 方法1：使用启动脚本
.\start-dev.ps1

# 方法2：手动启动
npm run tauri dev
```

**生产构建：**
```powershell
npm run tauri build
```

---

## 📐 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│  工具栏 (Toolbar)                                            │
│  [📄新建] [📂打开] [💾保存] [💾另存为] [📤JASS] [📤Lua] [📤TS] │
│  [↶撤销] [↷重做] [▭Backdrop] [🔘Button] [T Text] [☑Checkbox] │
├───────────┬─────────────────────────────────┬────────────────┤
│           │                                 │                │
│  项目树   │         画布 (Canvas)           │  属性面板      │
│ (Tree)    │                                 │ (Properties)   │
│           │   ┌─────────────────────┐      │                │
│ □ Root    │   │                     │      │ Frame 属性:    │
│   □ BG    │   │  [拖拽区域]         │      │ - 名称         │
│   □ Btn1  │   │                     │      │ - 类型         │
│   □ Text1 │   │                     │      │ - 位置 (X,Y)   │
│           │   └─────────────────────┘      │ - 大小 (W,H)   │
│           │   [+ - 重置] 100%              │ - 层级 (Z)     │
│           │                                 │                │
└───────────┴─────────────────────────────────┴────────────────┘
```

---

## 🎯 核心操作

### 创建 Frame
1. 点击工具栏中的 Frame 类型按钮（如 `▭ Backdrop`）
2. 新 Frame 将出现在画布上（默认位置 0.1, 0.1）
3. 新 Frame 自动被选中，可在属性面板编辑

### 选择 Frame
- **点击画布上的 Frame**：直接选中
- **点击项目树中的节点**：选中对应 Frame
- **点击画布空白处**：取消选择

### 移动 Frame
- **拖拽**：鼠标左键按住 Frame，拖动到新位置
- **属性面板**：精确输入 X, Y 坐标值
- **限制范围**：0 ≤ X ≤ 0.8，0 ≤ Y ≤ 0.6（魔兽 3 安全区）

### 编辑属性
1. 选中 Frame
2. 在右侧属性面板修改：
   - **基础**：名称、类型、父级
   - **位置**：X, Y, Width, Height, Z-index
   - **纹理**：diskTexture, wc3Texture
   - **文本**：text, textScale, textColor
   - **对齐**：horAlign, verAlign

### 撤销/重做
- **撤销**：Ctrl+Z 或点击 `↶ 撤销` 按钮
- **重做**：Ctrl+Y 或点击 `↷ 重做` 按钮
- 支持所有操作：创建、删除、修改、移动

---

## 🖼️ 画布控制

### 缩放
- **Alt + 鼠标滚轮**：缩放视图（10% - 500%）
- **+ 按钮**：放大 20%
- **- 按钮**：缩小 20%
- **重置按钮**：恢复 100% 缩放和居中

### 平移
- **Alt + 左键拖拽背景**：平移画布
- **鼠标中键拖拽**：平移画布
- **重置按钮**：恢复原始偏移

### 4:3 安全区
- 绿色边框表示 4:3 屏幕的安全区域
- 所有 UI 元素应在此区域内以确保兼容性

---

## 💾 文件操作

### 新建项目
1. 点击 `📄 新建`
2. 确认清空当前项目
3. 系统创建空白项目

### 保存项目
1. **首次保存**：点击 `💾 保存` 或 `💾 另存为`
2. 选择保存位置和文件名（扩展名 `.w3ui`）
3. **后续保存**：点击 `💾 保存` 直接覆盖

**项目文件格式：**
- 格式：JSON
- 扩展名：`.w3ui`
- 内容：完整的项目数据（Frames, Arrays, Settings）

### 打开项目
1. 点击 `📂 打开`
2. 选择 `.w3ui` 文件
3. 系统加载项目数据并渲染

---

## 📤 代码导出

### 导出 JASS 代码
```jass
// 点击 [📤 JASS] 按钮
library UILib initializer Init

globals
    framehandle myBackdrop = null
    framehandle myButton = null
endglobals

function CreateFrames takes nothing returns nothing
    set myBackdrop = BlzCreateFrame("BACKDROP", BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), 0, 0)
    call BlzFrameSetAbsPoint(myBackdrop, FRAMEPOINT_BOTTOMLEFT, 0.10000, 0.10000)
    call BlzFrameSetSize(myBackdrop, 0.20000, 0.15000)
    call BlzFrameSetTexture(myBackdrop, "UI\\Widgets\\EscMenu\\Human\\background.blp", 0, true)
endfunction

function Init takes nothing returns nothing
    call CreateFrames()
endfunction

endlibrary
```

### 导出 Lua 代码
```lua
-- 点击 [📤 Lua] 按钮
myBackdrop = nil
myButton = nil

function CreateFrames()
    myBackdrop = BlzCreateFrame("BACKDROP", BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), 0, 0)
    BlzFrameSetAbsPoint(myBackdrop, FRAMEPOINT_BOTTOMLEFT, 0.10000, 0.10000)
    BlzFrameSetSize(myBackdrop, 0.20000, 0.15000)
    BlzFrameSetTexture(myBackdrop, "UI\\\\Widgets\\\\EscMenu\\\\Human\\\\background.blp", 0, true)
end

CreateFrames()
```

### 导出 TypeScript 代码
```typescript
// 点击 [📤 TS] 按钮
export class UILib {
  private myBackdrop: framehandle | null = null;
  private myButton: framehandle | null = null;

  constructor() {
    this.createFrames();
  }

  private createFrames(): void {
    this.myBackdrop = BlzCreateFrame("BACKDROP", Frame.fromOrigin(ORIGIN_FRAME_GAME_UI, 0), 0, 0);
    BlzFrameSetAbsPoint(this.myBackdrop, FRAMEPOINT_BOTTOMLEFT, 0.10000, 0.10000);
    BlzFrameSetSize(this.myBackdrop, 0.20000, 0.15000);
  }
}
```

**使用导出的代码：**
1. 将导出的代码复制到地图脚本中
2. JASS：放在自定义脚本或触发器中
3. Lua：放在 war3map.lua 或自定义 Lua 文件
4. TypeScript：集成到 Lua 转换工作流

---

## 🎨 Frame 类型说明

### BACKDROP (背景)
- **用途**：图片背景、容器
- **关键属性**：wc3Texture（纹理路径）
- **示例**：UI 背景板、按钮背景

### BUTTON (按钮)
- **用途**：可点击的按钮
- **关键属性**：text（按钮文本）
- **示例**：确认按钮、取消按钮

### TEXT_FRAME (文本)
- **用途**：显示文字
- **关键属性**：text, textColor, textScale
- **示例**：标题、说明文字

### EDITBOX (输入框)
- **用途**：用户输入文本
- **关键属性**：text（默认值）
- **示例**：玩家名称输入、聊天框

### SLIDER (滑块)
- **用途**：数值选择
- **关键属性**：最小值、最大值、当前值
- **示例**：音量调节、亮度调节

### CHECKBOX (复选框)
- **用途**：开关选项
- **关键属性**：checked（是否选中）
- **示例**：设置开关

---

## 🔧 高级功能

### 父子关系
- **设置父级**：在属性面板的"父级"下拉框选择
- **效果**：子 Frame 跟随父 Frame 移动
- **用途**：组合 UI 元素（如按钮+文本）

### 层级（Z-index）
- **作用**：控制 Frame 的显示顺序
- **数值越大越在上层**
- **默认值**：新建 Frame 比父级 +1

### 纹理路径
**魔兽 3 内置纹理路径示例：**
```
UI\Widgets\EscMenu\Human\background.blp
UI\Widgets\Console\Human\CommandButton-Up.blp
UI\Widgets\ToolTips\Human\human-tooltip-background.blp
Textures\Black32.blp  (纯黑色)
Textures\White32.blp  (纯白色)
```

**自定义纹理：**
- 支持 `.blp` 和 `.dds` 格式
- 路径相对于地图文件
- 示例：`war3mapImported\MyTexture.blp`

---

## ⌨️ 快捷键

### 当前支持
- **Ctrl+Z**：撤销
- **Ctrl+Y**：重做
- **Alt + 鼠标滚轮**：缩放画布
- **Alt + 左键拖拽**：平移画布

### 计划中
- **Ctrl+S**：快速保存
- **Ctrl+N**：新建项目
- **Ctrl+O**：打开项目
- **Delete**：删除选中 Frame
- **Ctrl+D**：复制 Frame
- **Ctrl+C/V**：复制/粘贴

---

## 🐛 故障排除

### 问题：拖拽 Frame 没有反应
**原因**：可能按住了 Alt 键  
**解决**：不按 Alt 键，直接左键拖拽

### 问题：画布无法平移
**原因**：没有按 Alt 键或使用中键  
**解决**：按住 Alt 键 + 左键拖拽背景

### 问题：导出的代码为空
**原因**：项目中没有 Frame  
**解决**：先创建一些 Frame 再导出

### 问题：保存文件失败
**原因**：Tauri 权限问题  
**解决**：检查 `src-tauri/capabilities/default.json` 是否包含文件系统权限

---

## 📚 参考资料

### 魔兽 3 Frame API
- [Blizzard.j 官方 API](https://www.hiveworkshop.com/threads/blizzard-j-1-31.303679/)
- [Frame Handle 文档](https://www.hiveworkshop.com/threads/ui-frame-handle-natives.300627/)
- [Reforged UI 指南](https://www.hiveworkshop.com/threads/ui-tutorial-reforged.316654/)

### 坐标系统
- **游戏 UI 原点**：ORIGIN_FRAME_GAME_UI
- **4:3 安全区**：X: 0 - 0.8, Y: 0 - 0.6
- **锚点**：FRAMEPOINT_BOTTOMLEFT（左下角）
- **单位**：相对坐标（0-1 范围，1 = 屏幕宽/高）

### 社区资源
- [Hive Workshop](https://www.hiveworkshop.com/) - 地图制作社区
- [WC3 Modding](https://www.wc3modding.info/) - 模组教程
- [Reforged UI Templates](https://github.com/topics/warcraft3-reforged) - GitHub 资源

---

## 💡 最佳实践

### 1. 使用语义化命名
```
好的命名：mainMenuBG, startButton, playerNameText
避免：frame1, button2, text3
```

### 2. 合理使用层级
```
背景层 (Z=0-10)
内容层 (Z=11-100)
弹窗层 (Z=101-200)
提示层 (Z=201+)
```

### 3. 保持 4:3 兼容
- 所有关键 UI 元素在安全区内
- 装饰性元素可以超出安全区
- 测试不同分辨率（4:3, 16:9, 16:10）

### 4. 定期保存
- 每完成一个组件就保存
- 使用版本号命名（myui_v1.w3ui, myui_v2.w3ui）
- 重要更改前先"另存为"备份

### 5. 模块化设计
- 将复杂 UI 拆分为多个子 Frame
- 使用父子关系组织结构
- 一个 Frame 只负责一个功能

---

## 🎓 教程：创建第一个 UI

### 示例：创建主菜单界面

**步骤 1：创建背景**
1. 点击 `▭ Backdrop`
2. 在属性面板设置：
   - 名称：`mainMenuBG`
   - X: 0.2, Y: 0.2
   - Width: 0.4, Height: 0.2
   - wc3Texture: `UI\Widgets\EscMenu\Human\background.blp`

**步骤 2：创建标题文本**
1. 点击 `T Text`
2. 设置属性：
   - 名称：`titleText`
   - 父级：`mainMenuBG`
   - X: 0.3, Y: 0.35
   - Width: 0.2, Height: 0.05
   - text: "主菜单"
   - textScale: 1.5
   - textColor: #FFD700
   - horAlign: center

**步骤 3：创建开始按钮**
1. 点击 `🔘 Button`
2. 设置属性：
   - 名称：`startButton`
   - 父级：`mainMenuBG`
   - X: 0.35, Y: 0.25
   - Width: 0.1, Height: 0.04

**步骤 4：保存并导出**
1. 点击 `💾 另存为`，保存为 `main_menu.w3ui`
2. 点击 `📤 JASS`，导出为 `main_menu.j`
3. 将 `main_menu.j` 的内容复制到地图编辑器的自定义脚本中

**完成！** 🎉

---

需要帮助？查看 [FEATURES.md](./FEATURES.md) 了解更多技术细节。
