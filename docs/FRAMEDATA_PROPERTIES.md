# FrameData 完整属性字段文档

本文档详细说明了 `FrameData` 接口的所有属性字段，包括每个控件类型支持的属性。

## 基础属性 (所有控件通用)

### 标识和类型
```typescript
id: string;              // 唯一标识符
name: string;            // 控件名称
type: FrameType;         // 控件类型枚举
```

### 位置和尺寸
```typescript
x: number;               // X坐标 (相对单位 0-0.8)
y: number;               // Y坐标 (相对单位 0-0.6)
width: number;           // 宽度 (相对单位)
height: number;          // 高度 (相对单位)
z: number;               // Z轴层级
```

### 层级关系
```typescript
parentId: string | null; // 父控件ID
children: string[];      // 子控件ID列表
```

### 锚点系统
```typescript
anchors: FrameAnchor[];  // 锚点数组
```

FrameAnchor 接口:
```typescript
{
  point: FramePoint;           // 锚点类型 (TOPLEFT, CENTER等)
  x: number;                   // X偏移
  y: number;                   // Y偏移
  relativeTo?: string;         // 相对于哪个Frame的ID
  relativePoint?: FramePoint;  // 相对于目标Frame的哪个锚点
}
```

## 显示控制属性

```typescript
locked?: boolean;              // 是否锁定 (编辑器专用)
visible?: boolean;             // 是否可见
tooltip?: boolean | string;    // 工具提示 (布尔或字符串)
alpha?: number;                // 透明度 (0-255)
```

## 纹理属性

### 基础纹理
```typescript
diskTexture?: string;          // 主纹理文件路径
wc3Texture?: string;           // WC3资源纹理名
backDiskTexture?: string;      // 背景纹理文件路径
backWc3Texture?: string;       // 背景WC3资源纹理名
```

### 高级纹理设置
```typescript
textureFile?: string;                              // 纹理文件路径
texCoord?: [number, number, number, number];       // 纹理坐标 [left, right, top, bottom]
alphaMode?: 'ALPHAKEY' | 'BLEND' | 'ADD';          // Alpha混合模式
decorateFileNames?: boolean;                       // 装饰文件名
```

## 文本属性

### 文本内容
```typescript
text?: string;                 // 文本内容
textScale?: number;            // 文本缩放
textLength?: number;           // 最大文本长度
```

### 文本颜色
```typescript
textColor?: string;                                // 主文本颜色 (字符串格式)
fontColor?: [number, number, number, number];      // 字体颜色 RGBA (0-1)
fontHighlightColor?: [number, number, number, number]; // 高亮颜色
fontDisabledColor?: [number, number, number, number];  // 禁用颜色
fontShadowColor?: [number, number, number, number];    // 阴影颜色
```

### 文本对齐
```typescript
// 简化格式 (编辑器使用)
horAlign?: 'left' | 'center' | 'right';            // 水平对齐
verAlign?: 'start' | 'center' | 'flex-end';        // 垂直对齐

// FDF格式
fontJustificationH?: 'JUSTIFYLEFT' | 'JUSTIFYCENTER' | 'JUSTIFYRIGHT';
fontJustificationV?: 'JUSTIFYTOP' | 'JUSTIFYMIDDLE' | 'JUSTIFYBOTTOM';
```

### 字体设置
```typescript
font?: string;                                     // 字体名称
fontSize?: number;                                 // 字体大小
fontFlags?: string[];                              // 字体标志 ['FIXEDSIZE', 'THICKOUTLINE']
fontShadowOffset?: [number, number];               // 阴影偏移 [x, y]
```

## BACKDROP 背景属性

```typescript
backdropBackground?: string;                       // 背景纹理
backdropTileBackground?: boolean;                  // 平铺背景
backdropBackgroundSize?: number;                   // 背景尺寸
backdropBackgroundInsets?: [number, number, number, number]; // 内边距 [L,T,R,B]
backdropEdgeFile?: string;                         // 边框纹理
backdropCornerFlags?: string;                      // 角标志 "UL|UR|BL|BR|T|L|B|R"
backdropCornerSize?: number;                       // 角尺寸
backdropBlendAll?: boolean;                        // 混合所有层
```

## BUTTON 按钮属性

```typescript
controlStyle?: string;                             // 控件样式标志
controlBackdrop?: string;                          // 默认背景
controlPushedBackdrop?: string;                    // 按下背景
controlDisabledBackdrop?: string;                  // 禁用背景
controlMouseOverHighlight?: string;                // 鼠标悬停高亮
buttonPushedTextOffset?: [number, number];         // 按下文本偏移 [x, y]
```

控件样式标志示例:
- `"AUTOTRACK"` - 自动跟踪
- `"HIGHLIGHTONMOUSEOVER"` - 鼠标悬停高亮
- `"AUTOTRACK|HIGHLIGHTONMOUSEOVER"` - 组合标志

## EDITBOX 文本输入框属性

```typescript
multiline?: boolean;                               // 多行文本
maxChars?: number;                                 // 最大字符数
editTextColor?: [number, number, number, number];  // 编辑文本颜色 RGBA
editCursorColor?: [number, number, number, number]; // 光标颜色
editBorderColor?: [number, number, number, number]; // 边框颜色
```

## SLIDER 滑块属性

```typescript
minValue?: number;                                 // 最小值
maxValue?: number;                                 // 最大值
stepSize?: number;                                 // 步进值
sliderInitialValue?: number;                       // 初始值
sliderLayoutHorizontal?: boolean;                  // 水平布局
sliderLayoutVertical?: boolean;                    // 垂直布局
```

## CHECKBOX 复选框属性

```typescript
checked?: boolean;                                 // 勾选状态
```

## LISTBOX 列表框属性

```typescript
listBoxItems?: string[];                           // 列表项数组
```

## HIGHLIGHT 高亮属性

```typescript
highlightType?: string;                            // 高亮类型
highlightAlphaFile?: string;                       // 高亮Alpha文件
highlightAlphaMode?: string;                       // 高亮混合模式
```

## 功能属性

```typescript
trigVar?: string;                                  // 触发器变量名
arrayId?: string;                                  // 数组ID (编辑器专用)
isRelative?: boolean;                              // 相对定位 (已废弃)
layer?: string;                                    // 图层名称
```

## FDF 扩展数据

### FDFMetadata - 元数据
```typescript
fdfMetadata?: {
  inherits?: string;                               // 继承的模板名
  includeFile?: string;                            // 包含的文件路径
  rawProperties?: Record<string, any>;             // 原始FDF属性
  comment?: string;                                // FDF注释
  originalFDF?: string;                            // 原始FDF文本
  setAllPoints?: boolean;                          // 是否使用SetAllPoints
}
```

### FDFTextureData - 纹理数据
```typescript
fdfTexture?: {
  file: string;                                    // 纹理文件
  texCoord?: [number, number, number, number];     // 纹理坐标
  alphaMode?: 'ALPHAKEY' | 'BLEND' | 'ADD';        // Alpha模式
  decorateFileNames?: boolean;                     // 装饰文件名
}
```

### FDFStringData - 文本数据
```typescript
fdfString?: {
  content: string;                                 // 文本内容
  font?: string;                                   // 字体名称
  fontSize?: number;                               // 字体大小
  fontFlags?: string[];                            // 字体标志
  shadowOffset?: [number, number];                 // 阴影偏移
  shadowColor?: string;                            // 阴影颜色
}
```

### FDFBackdropData - 背景数据
```typescript
fdfBackdrop?: {
  background?: string;                             // 背景纹理
  tileBackground?: boolean;                        // 平铺背景
  backgroundSize?: number;                         // 背景尺寸
  backgroundInsets?: [number, number, number, number]; // 内边距
  edgeFile?: string;                               // 边框纹理
  cornerFlags?: string;                            // 角标志
  cornerSize?: number;                             // 角尺寸
  blendAll?: boolean;                              // 混合所有层
}
```

## 各控件类型支持的属性对照表

### FRAME / SIMPLEFRAME (容器)
- ✅ 基础属性 (位置、尺寸、层级)
- ✅ 锚点系统
- ✅ 显示控制
- ❌ 文本属性
- ❌ 纹理属性 (除非嵌套Texture块)

### BACKDROP (背景容器)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ BACKDROP背景属性
- ✅ 纹理属性

### TEXT / SIMPLEFONTSTRING (文本)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ 所有文本属性
- ❌ 背景属性

### BUTTON 系列 (按钮)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ 文本属性
- ✅ BUTTON按钮属性
- ✅ 纹理属性

### EDITBOX (文本输入框)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ 文本属性
- ✅ EDITBOX属性
- ✅ 背景属性

### SLIDER (滑块)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ SLIDER属性

### CHECKBOX (复选框)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ CHECKBOX属性
- ✅ 纹理属性

### LISTBOX (列表框)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ LISTBOX属性
- ✅ 背景属性

### SPRITE / MODEL (图形)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ 纹理属性

### HIGHLIGHT (高亮)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ HIGHLIGHT属性

### STATUSBAR 系列 (状态栏)
- ✅ 基础属性
- ✅ 锚点系统
- ✅ 显示控制
- ✅ 纹理属性

## 常用属性组合示例

### 简单按钮
```typescript
{
  type: FrameType.BUTTON,
  name: "MyButton",
  x: 0.4, y: 0.3,
  width: 0.15, height: 0.04,
  text: "Click Me",
  fontColor: [1, 1, 1, 1],
  controlBackdrop: "ButtonBackground",
  controlPushedBackdrop: "ButtonPushed",
  anchors: [{ point: FramePoint.CENTER, x: 0, y: 0 }]
}
```

### 带背景的容器
```typescript
{
  type: FrameType.BACKDROP,
  name: "MyPanel",
  width: 0.5, height: 0.4,
  backdropBackground: "DialogBackground",
  backdropCornerFlags: "UL|UR|BL|BR|T|L|B|R",
  backdropCornerSize: 0.016,
  anchors: [
    { point: FramePoint.TOPLEFT, x: 0, y: 0.6 },
    { point: FramePoint.BOTTOMRIGHT, x: 0.8, y: 0 }
  ]
}
```

### 文本输入框
```typescript
{
  type: FrameType.EDITBOX,
  name: "MyEditBox",
  width: 0.3, height: 0.03,
  multiline: false,
  maxChars: 256,
  editTextColor: [1, 1, 1, 1],
  editCursorColor: [1, 1, 1, 1],
  font: "MasterFont",
  fontSize: 0.012
}
```

## 更新记录

- 2025-01-06: 初始版本，补齐29个控件类型和所有属性字段
