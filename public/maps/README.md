# 模板地图目录

此目录包含 UI Designer 内置的 War3 模板地图文件。

## 文件列表

### test.1.27.w3x
- **用途**: War3 1.27 热重载测试地图
- **DzAPI**: 需要 KKWE 启动器
- **功能**: 
  - 自动加载 `UI-Designer\ui_generated.lua`
  - 支持 `-reload` / `-rl` 热重载命令
  - 包含完整的错误处理和调试输出

## 使用方式

### 1. 通过 UI 初始化 (推荐)
在 UI Designer 的热重载面板中:
1. 点击 **📦 初始化** 按钮
2. 自动释放到 `{War3目录}\Maps\Test\test.w3x`
3. 配置自动更新

### 2. 手动复制
如果自动初始化失败，可以手动复制:
```bash
# 从应用资源目录
{应用目录}\resources\maps\test.1.27.w3x

# 复制到 War3 目录
{War3目录}\Maps\Test\test.w3x
```

## 模板地图内容

### 触发器
1. **Init** - 初始化 DzAPI 和 UI
2. **Reload** - 响应重载命令

### 玩家
- Player 1 (Red) - 可使用重载命令

### 地图设置
- 地图大小: 64x64 (最小)
- 地形: 默认平原
- 天气: 无特效
- 单位: 无 (纯 UI 测试)

## 自定义地图

如果需要自定义地图，请参考:
- [模板地图触发器代码](../docs/TEMPLATE_MAP_TRIGGERS.md)
- [模板地图使用指南](../docs/TEMPLATE_MAP_GUIDE.md)

## 版本历史

- **v1.0.0** - 初始版本，支持 War3 1.27 + KKWE

## 注意事项

⚠️ **重要**: 
- 此地图仅用于 UI 测试，不包含游戏逻辑
- 必须使用 KKWE 启动器才能正常工作
- 需要配合热重载功能使用

## 支持

遇到问题请查看:
- [用户指南](../docs/USER_GUIDE.md)
- [常见问题](../docs/TEMPLATE_MAP_GUIDE.md#常见问题)
