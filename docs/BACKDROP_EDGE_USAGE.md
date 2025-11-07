# Backdrop 边框纹理使用指南

## 概述

WC3 UI Designer 现在支持 WC3 原生的 9-slice 边框纹理渲染系统。这允许你使用单个纹理图集文件创建可伸缩的边框，就像魔兽3中的按钮、对话框和面板边框一样。

## 功能特性

- ✅ 自动分割纹理图集（单个 BLP 文件包含 8 个子纹理）
- ✅ 支持两种图集布局：3x3 网格和 2x4 紧凑布局
- ✅ 自动平铺边缘纹理以适应 Frame 大小
- ✅ 支持选择性渲染（只显示角、只显示边等）
- ✅ 种族纹理切换支持（Human/Orc/NightElf/Undead）
- ✅ 缓存优化，避免重复处理纹理

## 纹理图集结构

### 标准 3x3 布局 (256x256 或 512x512)

```
┌──────┬──────┬──────┐
│  UL  │  T   │  UR  │  行0: 左上角 + 顶边 + 右上角
├──────┼──────┼──────┤
│  L   │ (中) │  R   │  行1: 左边 + 中心 + 右边
├──────┼──────┼──────┤
│  BL  │  B   │  BR  │  行2: 左下角 + 底边 + 右下角
└──────┴──────┴──────┘
```

### 紧凑 2x4 布局

```
┌──────┬──────┐
│  UL  │  UR  │  行0: 左上角 + 右上角
├──────┼──────┤
│  T   │  B   │  行1: 顶边 + 底边
├──────┼──────┤
│  L   │  R   │  行2: 左边 + 右边
├──────┼──────┤
│  BL  │  BR  │  行3: 左下角 + 右下角
└──────┴──────┘
```

## 使用方法

### 1. 在代码中设置边框属性

```typescript
const frame: FrameData = {
  // ... 基础属性
  type: FrameType.BACKDROP,
  
  // 边框纹理属性
  backdropEdgeFile: 'UI\\Widgets\\EscMenu\\Human\\human-options-menu-border.blp',
  backdropCornerFlags: 'UL|UR|BL|BR|T|L|B|R',  // 渲染所有部分
  backdropCornerSize: 0.008,                    // 角尺寸（相对于0.8屏幕宽度）
  backdropBackgroundInsets: [0.004, 0.004, 0.004, 0.004], // 内边距 [left, top, right, bottom]
};
```

### 2. 在 FDF 文件中定义

```fdf
Frame "BACKDROP" "EscMenuMainPanel" {
    BackdropEdgeFile "UI\Widgets\EscMenu\Human\human-options-menu-border.blp",
    BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R",
    BackdropCornerSize 0.008,
    BackdropBackgroundInsets 0.004 0.004 0.004 0.004,
}
```

### 3. 使用属性编辑器

1. 选择 BACKDROP 类型的 Frame
2. 在属性面板中找到 "Backdrop 背景属性" 部分
3. 设置以下属性：
   - **边框纹理 (backdropEdgeFile)**: 选择或输入纹理路径
   - **角标志 (backdropCornerFlags)**: 输入要渲染的部分，用 `|` 分隔
   - **角尺寸 (backdropCornerSize)**: 输入 0.004 到 0.02 之间的值
   - **背景内边距 (backdropBackgroundInsets)**: 输入 4 个数值

## 常用边框纹理路径

### Human（人族）
```
UI\Widgets\EscMenu\Human\human-options-menu-border.blp
UI\Widgets\QuestDialog\Human\QuestDialogBorder.blp
UI\Widgets\Console\Human\ConsoleButtonBorder.blp
```

### Orc（兽族）
```
UI\Widgets\EscMenu\Orc\orc-options-menu-border.blp
UI\Widgets\QuestDialog\Orc\QuestDialogBorder.blp
UI\Widgets\Console\Orc\ConsoleButtonBorder.blp
```

### NightElf（暗夜精灵）
```
UI\Widgets\EscMenu\NightElf\nightelf-options-menu-border.blp
UI\Widgets\QuestDialog\NightElf\QuestDialogBorder.blp
UI\Widgets\Console\NightElf\ConsoleButtonBorder.blp
```

### Undead（亡灵）
```
UI\Widgets\EscMenu\Undead\undead-options-menu-border.blp
UI\Widgets\QuestDialog\Undead\QuestDialogBorder.blp
UI\Widgets\Console\Undead\ConsoleButtonBorder.blp
```

## 高级用法

### 只显示角（无边缘）

```typescript
backdropCornerFlags: 'UL|UR|BL|BR'
```

适用于：装饰性边角、照片框效果

### 只显示顶部和底部边缘

```typescript
backdropCornerFlags: 'T|B'
```

适用于：分隔线、横条

### 只显示左右边缘

```typescript
backdropCornerFlags: 'L|R'
```

适用于：竖条、侧边栏

### 不对称边框

```typescript
backdropCornerFlags: 'UL|UR|T'  // 只显示顶部
backdropCornerFlags: 'BL|BR|B'  // 只显示底部
```

## 尺寸和坐标系统

### 角尺寸计算

```typescript
// WC3 坐标系统：0.8 屏幕宽度 = 4:3 游戏区域宽度
const canvasWidth = 1440; // 1920 - 2*240 (边距)
const cornerSizePx = (backdropCornerSize / 0.8) * canvasWidth;

// 示例：
// backdropCornerSize = 0.008
// cornerSizePx = (0.008 / 0.8) * 1440 = 14.4px
```

### 推荐值

| 用途 | cornerSize | 像素大小 (1440px) |
|------|-----------|------------------|
| 小按钮边框 | 0.004 | ~7px |
| 中等按钮边框 | 0.008 | ~14px |
| 对话框边框 | 0.012 | ~22px |
| 大面板边框 | 0.016 | ~29px |

## 性能优化

### 纹理缓存

边框渲染器会自动缓存提取的子纹理：

```typescript
// 第一次渲染：提取并缓存
<BackdropEdge edgeFile="path/to/border.blp" ... />

// 后续渲染：直接使用缓存
<BackdropEdge edgeFile="path/to/border.blp" ... /> // 立即显示
```

### 批量加载

使用 `useTextureLoaderBatch` hook 批量加载所有边框纹理：

```typescript
const texturePaths = useMemo(() => {
  const paths: string[] = [];
  Object.values(frames).forEach(frame => {
    if (frame.backdropEdgeFile) {
      paths.push(frame.backdropEdgeFile);
    }
  });
  return paths;
}, [frames]);

const textureMap = useTextureLoaderBatch(texturePaths);
```

## 故障排除

### 边框不显示

**可能原因：**
1. 纹理路径错误或文件不存在
2. `cornerFlags` 为空或格式错误
3. `cornerSize` 为 0 或未定义
4. 纹理未加载完成

**解决方法：**
```typescript
// 检查纹理是否加载
const textureState = textureMap.get(frame.backdropEdgeFile);
console.log('纹理状态:', textureState);

// 验证属性
console.log('边框属性:', {
  edgeFile: frame.backdropEdgeFile,
  cornerFlags: frame.backdropCornerFlags,
  cornerSize: frame.backdropCornerSize,
});
```

### 边框显示不完整

**可能原因：**
1. `cornerFlags` 缺少某些标志
2. 纹理图集布局检测错误
3. 角尺寸过大导致遮挡

**解决方法：**
```typescript
// 使用完整标志
backdropCornerFlags: 'UL|UR|BL|BR|T|L|B|R'

// 调整角尺寸
backdropCornerSize: 0.006  // 减小尺寸
```

### 边框变形或拉伸

**可能原因：**
1. 纹理图集不是正方形
2. 子纹理尺寸不一致
3. 错误的布局模式

**解决方法：**
- 确保纹理图集是 256x256 或 512x512
- 检查 BLP 文件是否损坏
- 尝试重新导出纹理

## 技术细节

### 实现文件

- **src/utils/textureAtlas.ts**: 纹理图集分割器
- **src/utils/backdropEdgeRenderer.ts**: Canvas 2D 渲染器（备用）
- **src/components/BackdropEdge.tsx**: React 组件渲染器
- **src/components/Canvas.tsx**: 集成到画布中

### 渲染流程

```
1. 收集边框纹理路径
   ↓
2. 批量加载纹理 (useTextureLoaderBatch)
   ↓
3. 自动检测图集布局 (detectLayout)
   ↓
4. 提取子纹理 (extractSubTextures)
   ↓
5. 缓存子纹理 URL
   ↓
6. 渲染 9 个 div（4角 + 4边 + 1中心）
   ↓
7. 使用 background-repeat 平铺边缘
```

### 布局检测算法

```typescript
async detectLayout(textureDataURL: string) {
  const img = await this.loadImage(textureDataURL);
  
  // 检测常见尺寸
  if (img.width === 256 && img.height === 256) {
    return { layout: DEFAULT_BORDER_LAYOUT, subSize: 85 };
  }
  if (img.width === 512 && img.height === 512) {
    return { layout: DEFAULT_BORDER_LAYOUT, subSize: 170 };
  }
  if (img.width === 128 && img.height === 256) {
    return { layout: COMPACT_BORDER_LAYOUT, subSize: 64 };
  }
  
  // 默认：3x3 布局
  return { 
    layout: DEFAULT_BORDER_LAYOUT, 
    subSize: Math.floor(img.width / 3) 
  };
}
```

## 示例

### 创建带边框的对话框

```typescript
import { FrameType } from '../types';

const dialog: FrameData = {
  id: 'my-dialog',
  name: 'MyDialog',
  type: FrameType.BACKDROP,
  x: 0.2,
  y: 0.3,
  width: 0.4,
  height: 0.3,
  z: 10,
  
  // 边框
  backdropEdgeFile: 'UI\\Widgets\\EscMenu\\Human\\human-options-menu-border.blp',
  backdropCornerFlags: 'UL|UR|BL|BR|T|L|B|R',
  backdropCornerSize: 0.012,
  backdropBackgroundInsets: [0.006, 0.006, 0.006, 0.006],
  
  // 背景（可选）
  backdropBackground: 'UI\\Widgets\\EscMenu\\Human\\human-options-menu-background.blp',
  backdropTileBackground: false,
  
  // 其他属性
  parentId: null,
  children: [],
  anchors: [],
};
```

### 创建装饰性边角

```typescript
const decorativeCorners: FrameData = {
  id: 'corners',
  name: 'DecorativeCorners',
  type: FrameType.BACKDROP,
  x: 0.1,
  y: 0.1,
  width: 0.3,
  height: 0.2,
  z: 5,
  
  // 只显示 4 个角
  backdropEdgeFile: 'UI\\Widgets\\QuestDialog\\Human\\QuestDialogBorder.blp',
  backdropCornerFlags: 'UL|UR|BL|BR',
  backdropCornerSize: 0.016,
  
  parentId: null,
  children: [],
  anchors: [],
};
```

## 参考资料

- [WC3 FDF 格式文档](./FDF_PARSER_GUIDE.md)
- [纹理加载器指南](./TEXTURE_LOADER_GUIDE.md)
- [边框渲染技术分析](./BACKDROP_EDGE_RENDERING.md)
- [FDF 属性参考](./FDF_PROPERTIES_REFERENCE.md)

## 更新日志

### v0.5.0 (当前版本)
- ✅ 实现基于 React 的 BackdropEdge 组件
- ✅ 自动纹理图集分割和缓存
- ✅ 支持 3x3 和 2x4 图集布局
- ✅ 集成到 Canvas 渲染流程
- ✅ 添加边框纹理批量加载

### 未来计划
- 🔄 属性编辑器 UI 支持
- 🔄 边框纹理浏览器
- 🔄 自定义图集布局配置
- 🔄 边框动画效果支持
