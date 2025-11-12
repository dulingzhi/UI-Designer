# War3 1.27 模板地图触发器代码

本文档包含模板地图 `test.1.27.w3x` 中的完整触发器代码，供参考或自定义地图使用。

## 触发器列表

1. **初始化** (`Init`) - 游戏开始时加载 UI
2. **热重载** (`Reload`) - 响应重载命令

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
        
        -- 2. 加载 UI
        local ui_path = "UI-Designer\\ui_generated.lua"
        local ui_success, ui_err = pcall(function()
            dofile(ui_path)
        end)
        
        if ui_success then
            print("|cff00ff00[UI Designer] UI 加载成功|r")
            print("|cff88ff88提示: 输入 -reload 或 -rl 可重新加载 UI|r")
        else
            print("|cffff0000[UI Designer] UI 加载失败:|r")
            print("|cffff0000" .. tostring(ui_err) .. "|r")
            print("|cffffcc00请检查文件路径: " .. ui_path .. "|r")
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

## 触发器 2: 热重载 (Reload)

### 配置
- **事件**: 
  - Player - Player 1 (Red) types a chat message containing `-reload` as An exact match
  - Player - Player 1 (Red) types a chat message containing `-rl` as An exact match
- **条件**: 无
- **动作**: 自定义脚本

### 代码 (Custom Script)
```lua
-- ========================================
-- UI Designer 热重载触发器
-- ========================================

function Trig_Reload_Actions()
    -- 1. 清理旧 UI (如果存在清理函数)
    if ClearUIFrames then
        local clear_success, clear_err = pcall(ClearUIFrames)
        if clear_success then
            print("|cff88ffff[UI Designer] 旧 UI 已清理|r")
        else
            print("|cffffcc00[UI Designer] 清理 UI 警告: " .. tostring(clear_err) .. "|r")
        end
    end
    
    -- 2. 重新加载 UI
    local ui_path = "UI-Designer\\ui_generated.lua"
    local ui_success, ui_err = pcall(function()
        dofile(ui_path)
    end)
    
    if ui_success then
        print("|cff00ff00[UI Designer] UI 重载成功 ✓|r")
    else
        print("|cffff0000[UI Designer] UI 重载失败:|r")
        print("|cffff0000" .. tostring(ui_err) .. "|r")
    end
end

-- ========================================
-- 注册触发器
-- ========================================
function InitTrig_Reload()
    gg_trg_Reload = CreateTrigger()
    TriggerRegisterPlayerChatEvent(gg_trg_Reload, Player(0), "-reload", true)
    TriggerRegisterPlayerChatEvent(gg_trg_Reload, Player(0), "-rl", true)
    TriggerAddAction(gg_trg_Reload, Trig_Reload_Actions)
end
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

#### 创建 Reload 触发器:
1. 命名为 `Reload`
2. 添加事件:
   - `Events` → `Player - Player 1 (Red) types a chat message`
   - 设置为 `-reload` (exact match)
   - 重复添加 `-rl` 事件
3. 删除默认的 Actions
4. 添加动作: `Actions` → `Custom script` → 粘贴上面的 Reload 代码

### 测试流程

1. **启动游戏**
   ```
   控制台输出:
   [UI Designer] DzAPI 加载成功
   [UI Designer] UI 加载成功
   提示: 输入 -reload 或 -rl 可重新加载 UI
   ```

2. **修改 UI** (在 UI Designer 中编辑)
   - 自动导出到 `ui_generated.lua`

3. **游戏内重载**
   ```
   输入: -reload
   输出: [UI Designer] UI 重载成功 ✓
   ```

---

## 高级配置

### 多玩家支持
允许所有玩家使用重载命令:
```lua
function InitTrig_Reload()
    gg_trg_Reload = CreateTrigger()
    for i = 0, 11 do
        TriggerRegisterPlayerChatEvent(gg_trg_Reload, Player(i), "-reload", true)
        TriggerRegisterPlayerChatEvent(gg_trg_Reload, Player(i), "-rl", true)
    end
    TriggerAddAction(gg_trg_Reload, Trig_Reload_Actions)
end
```

### 自定义 UI 路径
修改 `ui_path` 变量:
```lua
local ui_path = "CustomPath\\my_ui.lua"
```

### 调试模式
添加详细日志:
```lua
local DEBUG = true

if DEBUG then
    print("[DEBUG] 正在加载: " .. ui_path)
end
```

### 性能监控
测量加载时间:
```lua
local start_time = os.clock()
-- 加载 UI
local elapsed = os.clock() - start_time
print(string.format("[UI Designer] 加载耗时: %.3f 秒", elapsed))
```

---

## 常见问题

### Q: DzAPI 加载失败?
**A:** 确保:
- 使用 KKWE 启动器
- KKWE 版本支持 DzAPI
- `require('jass.japi')` 语法正确

### Q: UI 加载失败 "file not found"?
**A:** 检查:
- 路径分隔符使用 `\\` 而不是 `/`
- 相对于 War3 根目录
- 文件确实存在: `{War3}\UI-Designer\ui_generated.lua`

### Q: 重载命令无响应?
**A:** 确认:
- 玩家 ID 正确 (默认仅 Player 0)
- 命令格式完全匹配 (区分大小写)
- 已进入游戏而非地图编辑器

### Q: 旧 UI 未清理导致重复?
**A:** 确保 `ui_generated.lua` 导出了 `ClearUIFrames` 函数:
```lua
-- Lua 生成器会自动包含此函数
function ClearUIFrames()
    -- 清理所有创建的 Frame
end
```

---

## 相关文档

- [模板地图使用指南](./TEMPLATE_MAP_GUIDE.md)
- [Lua 生成器指南](./LUA_GENERATOR_GUIDE.md)
- [热重载实现文档](./HOT_RELOAD_IMPLEMENTATION.md)

---

**提示**: 这些触发器代码可以直接复制粘贴到自定义地图中使用。
