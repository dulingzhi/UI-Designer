# War3 1.27 模板地图触发器代码

本文档包含模板地图 `test.1.27.w3x` 中的完整触发器代码，供参考或自定义地图使用。

## 触发器列表

1. **初始化** (`Init`) - 游戏开始时加载 UI 加载器

---

## 触发器 1: 初始化 (Init)

### 配置
- **事件**: Map initialization
- **条件**: 无
- **动作**: 自定义脚本

### 代码 (Custom Script)
```lua
-- ========================================
-- UI Designer 初始化触发器
-- ========================================

function Trig_Init_Actions()
    -- 延迟加载，确保游戏环境完全初始化
    TimerStart(CreateTimer(), 0.1, false, function()
        -- 1. 加载 DzAPI (War3 1.27 KKWE)
        local dzapi_loaded = false
        local success, err = pcall(function()
            require('jass.japi')
            dzapi_loaded = true
        end)
        
        if dzapi_loaded then
            print("|cff00ff00[UI Designer] DzAPI 加载成功|r")
        else
            print("|cffffcc00[UI Designer] DzAPI 加载失败: " .. tostring(err) .. "|r")
            print("|cffffcc00请确保使用 KKWE 启动游戏|r")
        end
        
        -- 2. 加载 UI 加载器 (只需加载一次)
        local loader_path = "UI-Designer\\ui_loader.lua"
        local loader_success, loader_err = pcall(function()
            dofile(loader_path)
            -- 调用初始化函数
            if InitUIDesigner then
                InitUIDesigner()
            end
        end)
        
        if not loader_success then
            print("|cffff0000[UI Designer] 加载器加载失败:|r")
            print("|cffff0000" .. tostring(loader_err) .. "|r")
            print("|cffffcc00请检查文件路径: " .. loader_path .. "|r")
        end
    end)
end

-- ========================================
-- 注册触发器
-- ========================================
function InitTrig_Init()
    gg_trg_Init = CreateTrigger()
    TriggerAddAction(gg_trg_Init, Trig_Init_Actions)
end
```

---

## 说明

### 工作流程

1. **地图初始化时**：触发器执行 `ui_loader.lua`
2. **加载器做什么**：
   - 初始化 API 兼容层 (DzAPI/Reforged)
   - 注册 `-reload` / `-rl` 命令
   - 首次加载 `ui_generated.lua` (UI内容)
   - 提供清理和重载函数
3. **游戏内重载**：输入 `-reload` 或 `-rl`，加载器自动清理旧UI并重新执行 `ui_generated.lua`

### 文件结构

```
War3目录\
└── UI-Designer\
    ├── ui_loader.lua      # 加载器脚本 (固定，只初始化一次)
    └── ui_generated.lua   # UI内容脚本 (频繁更新)
```
---

## 使用说明

### 在 World Editor 中创建触发器

1. **打开 World Editor**
2. **触发器编辑器** (F4)
3. **创建新触发器**: 右键 → New → Trigger

#### 创建 Init 触发器:
1. 命名为 `Init`
2. 添加事件: `Events` → `Map initialization`
3. 删除默认的 Actions
4. 添加动作: `Actions` → `Custom script` → 粘贴上面的 Init 代码

### 测试流程

1. **启动游戏**
   ```
   控制台输出:
   [UI Designer] DzAPI 加载成功
   ============================================================
              UI Designer - 动态UI系统 v1.0
   ============================================================
   [UI Designer] 命令: -reload 或 -rl  刷新UI
   [UI Designer] UI加载成功
   ============================================================
   ```

2. **修改 UI** (在 UI Designer 中编辑)
   - 自动导出到 `ui_generated.lua`
   - `ui_loader.lua` 保持不变

3. **游戏内重载**
   ```
   输入: -reload 或 -rl
   输出: [UI Designer] UI已重载 (XXms)
   ```

---

## 高级配置

---

## 常见问题

### Q: DzAPI 加载失败?
**A:** 确保:
- 使用 KKWE 启动器
- KKWE 版本支持 DzAPI
- `require('jass.japi')` 语法正确

### Q: 加载器或UI内容加载失败 "file not found"?
**A:** 检查:
- 路径分隔符使用 `\\` 而不是 `/`
- 相对于 War3 根目录
- 文件确实存在: 
  - `{War3}\UI-Designer\ui_loader.lua` (加载器)
  - `{War3}\UI-Designer\ui_generated.lua` (UI内容)

### Q: 重载命令无响应?
**A:** 确认:
- 加载器已成功初始化 (查看游戏内初始化输出)
- 命令格式完全匹配: `-reload` 或 `-rl` (区分大小写)
- 已进入游戏而非地图编辑器

### Q: 旧 UI 未清理导致重复?
**A:** 加载器会自动清理，如仍有问题：
- 检查加载器初始化是否成功
- 确保 `ui_generated.lua` 正常执行

---

## 相关文档

- [模板地图使用指南](./TEMPLATE_MAP_GUIDE.md)
- [热重载实现文档](./HOT_RELOAD_IMPLEMENTATION.md)

---

**提示**: 新的两文件架构更加清晰，加载器只需初始化一次，UI内容可以频繁重载。
