# 功能演示脚本

## 🎬 演示场景 1：创建简单的主菜单

### 步骤说明

1. **启动应用**
   ```powershell
   npm run tauri dev
   ```

2. **创建背景 Frame**
   - 点击工具栏 `▭ Backdrop` 按钮
   - 在属性面板设置：
     * 名称：`menuBackground`
     * X: 0.2
     * Y: 0.2
     * Width: 0.4
     * Height: 0.3
     * wc3Texture: `UI\Widgets\EscMenu\Human\background.blp`

3. **创建标题文本**
   - 点击工具栏 `T Text` 按钮
   - 设置属性：
     * 名称：`titleText`
     * 父级：选择 `menuBackground`
     * X: 0.3
     * Y: 0.42
     * Width: 0.2
     * Height: 0.05
     * text: "魔兽争霸3"
     * textScale: 2.0
     * textColor: #FFD700

4. **创建开始按钮**
   - 点击 `🔘 Button`
   - 设置属性：
     * 名称：`startButton`
     * 父级：`menuBackground`
     * X: 0.35
     * Y: 0.32
     * Width: 0.1
     * Height: 0.04

5. **创建退出按钮**
   - 再次点击 `🔘 Button`
   - 设置属性：
     * 名称：`exitButton`
     * 父级：`menuBackground`
     * X: 0.35
     * Y: 0.25
     * Width: 0.1
     * Height: 0.04

6. **测试交互功能**
   - 拖拽 `menuBackground` 移动整个菜单
   - 观察子元素（标题和按钮）跟随移动
   - 使用 `↶ 撤销` 恢复原位置
   - 使用 `↷ 重做` 重新应用移动

7. **保存项目**
   - 点击 `💾 另存为`
   - 输入文件名：`main_menu.w3ui`
   - 点击保存

8. **导出 JASS 代码**
   - 点击 `📤 JASS`
   - 输入文件名：`main_menu.j`
   - 打开生成的文件查看代码

---

## 🎬 演示场景 2：测试拖拽功能

### 步骤说明

1. **创建多个 Frame**
   - 创建 3 个 Backdrop Frame
   - 分别命名为 `panel1`, `panel2`, `panel3`

2. **测试拖拽移动**
   - 左键点击 `panel1`，观察边框变红（选中状态）
   - 保持按住左键，拖拽到新位置
   - 观察实时移动效果
   - 松开鼠标，位置固定

3. **测试画布控制**
   - 按住 `Alt` 键 + 左键拖拽背景，平移整个画布
   - 按住 `Alt` 键 + 滚动鼠标滚轮，缩放画布
   - 点击 `重置` 按钮，恢复原始视图

4. **测试撤销功能**
   - 移动 `panel2` 到新位置
   - 点击 `↶ 撤销`，观察 `panel2` 回到原位
   - 点击 `↷ 重做`，观察 `panel2` 重新移动

5. **测试边界限制**
   - 尝试拖拽 Frame 超出绿色边框（4:3 安全区）
   - 观察 Frame 被限制在 0.8 x 0.6 范围内

---

## 🎬 演示场景 3：完整工作流

### 步骤说明

1. **新建项目**
   - 点击 `📄 新建`
   - 确认清空当前数据

2. **设计游戏内 UI**
   
   **背景层：**
   - 创建 Backdrop：`resourceBar`
     * X: 0.0, Y: 0.55, Width: 0.8, Height: 0.05
     * wc3Texture: 黑色背景
   
   **资源显示：**
   - 创建 Text：`goldText`
     * 父级：`resourceBar`
     * X: 0.05, Y: 0.555, Width: 0.1, Height: 0.04
     * text: "黄金: 500"
     * textColor: #FFD700
   
   - 创建 Text：`lumberText`
     * 父级：`resourceBar`
     * X: 0.2, Y: 0.555, Width: 0.1, Height: 0.04
     * text: "木材: 300"
     * textColor: #90EE90

3. **测试父子关系**
   - 拖拽 `resourceBar` 移动
   - 观察 `goldText` 和 `lumberText` 跟随移动
   - 修改 `goldText` 的父级为 null
   - 再次拖拽 `resourceBar`，观察 `goldText` 不再跟随

4. **保存并导出**
   - 保存项目：`resource_ui.w3ui`
   - 导出 JASS：`resource_ui.j`
   - 导出 Lua：`resource_ui.lua`
   - 导出 TypeScript：`resource_ui.ts`

5. **重新加载测试**
   - 点击 `📄 新建` 清空项目
   - 点击 `📂 打开`
   - 选择 `resource_ui.w3ui`
   - 验证所有 Frame 正确加载

---

## 🎬 演示场景 4：代码导出对比

### JASS 输出示例
```jass
library ResourceUI initializer Init

globals
    framehandle resourceBar = null
    framehandle goldText = null
    framehandle lumberText = null
endglobals

function CreateFrames takes nothing returns nothing
    // 创建资源条背景
    set resourceBar = BlzCreateFrame("BACKDROP", BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), 0, 0)
    call BlzFrameSetAbsPoint(resourceBar, FRAMEPOINT_BOTTOMLEFT, 0.00000, 0.55000)
    call BlzFrameSetSize(resourceBar, 0.80000, 0.05000)
    call BlzFrameSetTexture(resourceBar, "Textures\\Black32.blp", 0, true)
    
    // 创建黄金文本
    set goldText = BlzCreateFrameByType("TEXT", "", resourceBar, "", 0)
    call BlzFrameSetAbsPoint(goldText, FRAMEPOINT_BOTTOMLEFT, 0.05000, 0.55500)
    call BlzFrameSetSize(goldText, 0.10000, 0.04000)
    call BlzFrameSetText(goldText, "|cffFFD700黄金: 500|r")
    call BlzFrameSetScale(goldText, 1.00)
    
    // 创建木材文本
    set lumberText = BlzCreateFrameByType("TEXT", "", resourceBar, "", 0)
    call BlzFrameSetAbsPoint(lumberText, FRAMEPOINT_BOTTOMLEFT, 0.20000, 0.55500)
    call BlzFrameSetSize(lumberText, 0.10000, 0.04000)
    call BlzFrameSetText(lumberText, "|cff90EE90木材: 300|r")
    call BlzFrameSetScale(lumberText, 1.00)
endfunction

function Init takes nothing returns nothing
    call CreateFrames()
endfunction

endlibrary
```

### Lua 输出示例
```lua
-- Resource UI
resourceBar = nil
goldText = nil
lumberText = nil

function CreateFrames()
    resourceBar = BlzCreateFrame("BACKDROP", BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0), 0, 0)
    BlzFrameSetAbsPoint(resourceBar, FRAMEPOINT_BOTTOMLEFT, 0.00000, 0.55000)
    BlzFrameSetSize(resourceBar, 0.80000, 0.05000)
    BlzFrameSetTexture(resourceBar, "Textures\\\\Black32.blp", 0, true)
    
    goldText = BlzCreateFrameByType("TEXT", "", resourceBar, "", 0)
    BlzFrameSetAbsPoint(goldText, FRAMEPOINT_BOTTOMLEFT, 0.05000, 0.55500)
    BlzFrameSetSize(goldText, 0.10000, 0.04000)
    BlzFrameSetText(goldText, "|cffFFD700黄金: 500|r")
    BlzFrameSetScale(goldText, 1.00)
    
    lumberText = BlzCreateFrameByType("TEXT", "", resourceBar, "", 0)
    BlzFrameSetAbsPoint(lumberText, FRAMEPOINT_BOTTOMLEFT, 0.20000, 0.55500)
    BlzFrameSetSize(lumberText, 0.10000, 0.04000)
    BlzFrameSetText(lumberText, "|cff90EE90木材: 300|r")
    BlzFrameSetScale(lumberText, 1.00)
end

CreateFrames()
```

### TypeScript 输出示例
```typescript
export class ResourceUI {
  private resourceBar: framehandle | null = null;
  private goldText: framehandle | null = null;
  private lumberText: framehandle | null = null;

  constructor() {
    this.createFrames();
  }

  private createFrames(): void {
    this.resourceBar = BlzCreateFrame("BACKDROP", Frame.fromOrigin(ORIGIN_FRAME_GAME_UI, 0), 0, 0);
    BlzFrameSetAbsPoint(this.resourceBar, FRAMEPOINT_BOTTOMLEFT, 0.00000, 0.55000);
    BlzFrameSetSize(this.resourceBar, 0.80000, 0.05000);
    
    this.goldText = BlzCreateFrameByType("TEXT", "", this.resourceBar, "", 0);
    BlzFrameSetAbsPoint(this.goldText, FRAMEPOINT_BOTTOMLEFT, 0.05000, 0.55500);
    BlzFrameSetSize(this.goldText, 0.10000, 0.04000);
    BlzFrameSetText(this.goldText, "|cffFFD700黄金: 500|r");
    BlzFrameSetScale(this.goldText, 1.00);
    
    this.lumberText = BlzCreateFrameByType("TEXT", "", this.resourceBar, "", 0);
    BlzFrameSetAbsPoint(this.lumberText, FRAMEPOINT_BOTTOMLEFT, 0.20000, 0.55500);
    BlzFrameSetSize(this.lumberText, 0.10000, 0.04000);
    BlzFrameSetText(this.lumberText, "|cff90EE90木材: 300|r");
    BlzFrameSetScale(this.lumberText, 1.00);
  }
}

const ui = new ResourceUI();
```

---

## 🎬 演示场景 5：快捷键操作

### 当前支持的快捷键

1. **Ctrl + Z（撤销）**
   - 创建一个 Frame
   - 按 `Ctrl + Z`
   - 观察 Frame 消失

2. **Ctrl + Y（重做）**
   - 接上一步
   - 按 `Ctrl + Y`
   - 观察 Frame 重新出现

3. **Alt + 鼠标滚轮（缩放）**
   - 按住 `Alt` 键
   - 滚动鼠标滚轮
   - 观察画布缩放（10% - 500%）

4. **Alt + 左键拖拽（平移）**
   - 按住 `Alt` 键
   - 左键点击并拖拽背景
   - 观察整个画布平移

---

## 📊 性能测试场景

### 测试大量 Frame

1. **创建 100 个 Frame**
   - 使用循环创建（待实现批量创建功能）
   - 观察渲染性能

2. **拖拽性能测试**
   - 拖拽其中一个 Frame
   - 观察是否流畅（目标：60 FPS）

3. **撤销性能测试**
   - 连续创建 50 个 Frame
   - 连续按 50 次 `Ctrl + Z`
   - 观察撤销速度

---

## 🔍 边界测试场景

### 极限值测试

1. **最小 Frame**
   - Width: 0.001, Height: 0.001
   - 观察是否可见

2. **最大 Frame**
   - Width: 0.8, Height: 0.6
   - 观察是否覆盖整个安全区

3. **负数坐标**
   - X: -0.1, Y: -0.1
   - 观察是否被限制

4. **超大坐标**
   - X: 1.0, Y: 1.0
   - 观察是否被限制

---

## ✅ 验收标准

### 功能正确性
- [ ] 所有按钮都能响应点击
- [ ] 拖拽移动准确无误
- [ ] 撤销/重做完全可逆
- [ ] 文件保存/加载数据完整
- [ ] 代码导出格式正确

### 性能要求
- [ ] 画布渲染 60 FPS
- [ ] 拖拽延迟 < 50ms
- [ ] 文件保存 < 1s
- [ ] 代码导出 < 2s

### 用户体验
- [ ] 操作直观易懂
- [ ] 错误提示友好
- [ ] 界面响应迅速
- [ ] 没有明显 Bug

---

## 📝 测试清单

### 基础功能
- [ ] 新建项目
- [ ] 保存项目
- [ ] 打开项目
- [ ] 创建 Backdrop
- [ ] 创建 Button
- [ ] 创建 Text
- [ ] 创建 Checkbox
- [ ] 拖拽移动 Frame
- [ ] 修改 Frame 属性
- [ ] 撤销操作
- [ ] 重做操作
- [ ] 导出 JASS
- [ ] 导出 Lua
- [ ] 导出 TypeScript

### 高级功能
- [ ] 设置父子关系
- [ ] 修改层级顺序
- [ ] 缩放画布
- [ ] 平移画布
- [ ] 重置视图
- [ ] 边界限制

### 错误处理
- [ ] 打开无效文件
- [ ] 保存到受保护目录
- [ ] 删除不存在的 Frame
- [ ] 设置非法属性值

---

祝测试顺利！🎉
