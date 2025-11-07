# 种族纹理系统使用指南

## 概述

魔兽争霸3重制版支持根据种族显示不同的UI纹理。例如，人族使用蓝色主题的菜单，兽族使用绿色主题，暗夜精灵使用紫色主题，不死族使用紫黑色主题。

编辑器现在完全支持这一特性，允许您在设计时切换种族并实时预览不同种族的UI外观。

## 工作原理

### war3skins.txt 配置文件

魔兽争霸3使用 `UI\war3skins.txt` 文件定义种族特定的纹理映射。该文件包含以下部分：

```ini
[Main]
Skins=Human,Orc,NightElf,Undead

[Human]
EscMenuBorder=UI\Widgets\EscMenu\Human\human-options-menu-border.blp
EscMenuBackground=UI\Widgets\EscMenu\Human\human-options-menu-background.blp
ConsoleTexture01=UI\Console\Human\HumanUITile01.blp
...

[Orc]
EscMenuBorder=UI\Widgets\EscMenu\Orc\orc-options-menu-border.blp
EscMenuBackground=UI\Widgets\EscMenu\Orc\orc-options-menu-background.blp
ConsoleTexture01=UI\Console\Orc\OrcUITile01.blp
...

[NightElf]
...

[Undead]
...

[Default]
...
```

### 种族特定纹理示例

以下纹理会根据种族变化：

1. **ESC菜单** (`EscMenuBorder`, `EscMenuBackground`)
   - 人族: 蓝色装饰边框
   - 兽族: 绿色兽族图腾边框
   - 暗夜精灵: 紫色自然风格边框
   - 不死族: 紫黑色亡灵风格边框

2. **控制台纹理** (`ConsoleTexture01`-`ConsoleTexture04`)
   - 每个种族使用不同的UI平铺纹理

3. **任务对话框** (`QuestDialogBorder`, `QuestDialogBackground`)
   - 每个种族有独特的任务窗口装饰

4. **过场动画边框** (`CinematicBorder`)
   - 种族特定的过场动画装饰边框

## 在编辑器中使用

### 1. 加载 war3skins.txt

编辑器会在以下情况自动加载 war3skins.txt：

- 连接到 MPQ 档案时（通过 MPQ 管理器）
- 打开包含 war3skins 配置的项目文件时

加载成功后，菜单栏右侧会显示**种族纹理切换器**。

### 2. 切换种族

1. 在菜单栏右侧找到"种族纹理"下拉菜单
2. 选择目标种族：
   - 👑 人族 (Human)
   - ⚔️ 兽族 (Orc)
   - 🌙 暗夜精灵 (NightElf)
   - 💀 不死族 (Undead)
   - 🎨 默认 (Default)

3. 所有使用种族特定纹理的控件会**立即更新**其纹理路径

### 3. 受影响的控件

切换种族时，以下类型的控件会自动更新：

- 使用 `diskTexture` 属性引用种族纹理的 Backdrop/SimpleFrame
- 使用 `wc3Texture` 属性引用内置纹理的控件
- 任何引用 war3skins.txt 中定义的纹理路径的控件

### 4. 实时预览

切换种族后：

- ✅ 画布会立即刷新显示新纹理
- ✅ 属性面板会显示更新后的纹理路径
- ✅ 所有子控件的相关纹理也会自动更新

## 技术细节

### 纹理路径匹配

编辑器使用智能匹配算法来识别种族特定纹理：

1. **精确匹配**: 直接匹配 war3skins.txt 中的路径
2. **大小写不敏感**: 路径比较时忽略大小写
3. **路径分隔符标准化**: 统一处理 `\` 和 `/`

### 纹理更新流程

```typescript
// 用户切换种族
setRace('Orc')

// 对每个控件:
for (frame of allFrames) {
  // 1. 查找纹理路径对应的键名
  const key = findTextureKey(frame.diskTexture)
  
  // 2. 获取新种族的纹理路径
  const newPath = getTextureForRace(skins, 'Orc', key)
  
  // 3. 更新控件纹理
  updateFrame(frame.id, { diskTexture: newPath })
}
```

### 回退机制

如果某个种族没有定义特定纹理，系统会自动回退到 `Default` 部分：

```typescript
// 如果 Undead 部分没有定义 QuestDialogBorder
getTextureForRace(skins, 'Undead', 'QuestDialogBorder')
// 返回 Default.QuestDialogBorder
```

## 最佳实践

### 1. 设计跨种族UI

如果您希望UI在所有种族中保持一致：

- ✅ 使用 `Default` 部分的纹理
- ✅ 避免硬编码种族特定路径（如 `UI\Widgets\EscMenu\Human\...`）
- ✅ 使用 war3skins.txt 中定义的纹理键名

### 2. 测试所有种族

在发布UI前，切换到每个种族并测试：

1. 👑 人族 - 检查蓝色主题是否正确
2. ⚔️ 兽族 - 检查绿色主题是否正确
3. 🌙 暗夜精灵 - 检查紫色主题是否正确
4. 💀 不死族 - 检查紫黑色主题是否正确

### 3. 导出前确认

导出 FDF 文件前：

- 确认已选择正确的种族（或使用 Default）
- 检查导出的纹理路径是否符合预期
- 如果需要支持所有种族，考虑使用纹理键名而非绝对路径

## 示例：创建种族自适应菜单

```typescript
// 1. 创建 ESC 菜单背景
const menuBackground = {
  type: FrameType.BACKDROP,
  name: 'MenuBackground',
  diskTexture: 'UI\\Widgets\\EscMenu\\Human\\human-options-menu-background.blp',
  // 这个路径会在 war3skins.txt 中找到对应的键名
}

// 2. 添加边框
const menuBorder = {
  type: FrameType.BACKDROP,
  name: 'MenuBorder',
  diskTexture: 'UI\\Widgets\\EscMenu\\Human\\human-options-menu-border.blp',
}

// 3. 用户切换到兽族
setRace('Orc')

// 结果：
// menuBackground.diskTexture 自动变为:
// 'UI\\Widgets\\EscMenu\\Orc\\orc-options-menu-background.blp'

// menuBorder.diskTexture 自动变为:
// 'UI\\Widgets\\EscMenu\\Orc\\orc-options-menu-border.blp'
```

## 故障排除

### 问题：切换种族后纹理没有变化

**可能原因**：
- war3skins.txt 未正确加载
- 纹理路径未在 war3skins.txt 中定义
- 纹理路径拼写错误或大小写不匹配

**解决方案**：
1. 检查控制台是否有"war3skins.txt 已加载到项目状态"消息
2. 确认纹理路径是否在 war3skins.txt 中有定义
3. 使用标准的 WC3 纹理路径格式

### 问题：某些种族显示默认纹理

**原因**：
- 该种族部分未定义该纹理键

**解决方案**：
- 这是正常行为，系统会回退到 Default 部分
- 如需为该种族提供特定纹理，需要修改 war3skins.txt

### 问题：种族切换器不显示

**原因**：
- war3skins.txt 未加载到项目状态

**解决方案**：
1. 通过 MPQ 管理器连接到 War3 安装目录
2. 等待 war3skins.txt 加载完成
3. 查看控制台确认加载状态

## API 参考

### 类型定义

```typescript
type Race = 'Human' | 'Orc' | 'NightElf' | 'Undead' | 'Default';

interface War3Skins {
  skins: Race[];
  Human: SkinConfig;
  Orc: SkinConfig;
  NightElf: SkinConfig;
  Undead: SkinConfig;
  Default: SkinConfig;
}

interface SkinConfig {
  [key: string]: string; // 纹理键名 -> 纹理路径
}
```

### Store 方法

```typescript
// 切换当前种族
setRace(race: Race): void

// 加载 war3skins.txt 配置
loadWar3Skins(content: string): void

// 获取当前种族
const currentRace = useProjectStore(state => state.project.currentRace)

// 获取 war3skins 配置
const war3Skins = useProjectStore(state => state.project.war3Skins)
```

### 工具函数

```typescript
// 解析 war3skins.txt 内容
parseWar3Skins(content: string): War3Skins

// 根据种族获取纹理路径
getTextureForRace(skins: War3Skins, race: Race, key: string): string | undefined

// 根据纹理路径查找键名
findTextureKey(skins: War3Skins, texturePath: string): string | undefined

// 检查纹理是否有种族变体
isRaceSpecificTexture(skins: War3Skins, key: string): boolean

// 获取所有种族特定纹理键名
getRaceSpecificTextureKeys(skins: War3Skins): string[]

// 替换路径中的种族标识
replaceRaceInPath(path: string, race: Race): string
```

## 参考资料

- [war3skins.txt 属性参考](./FDF_PROPERTIES_REFERENCE.md#war3skins)
- [FDF 导入导出指南](./FDF_PARSER_GUIDE.md)
- [纹理加载器指南](./TEXTURE_LOADER_GUIDE.md)
- [MPQ 管理器指南](./MPQ_MANAGER_GUIDE.md)
