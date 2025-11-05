# WC3 FDF 属性对照表

本文档列出了 Warcraft III 原生 UI FDF 格式中所有已知的控件类型和属性。

## Frame 类型

### 基础控件

| FDF 类型 | 说明 | 用途 |
|---------|------|------|
| FRAME | 通用容器 | 基础容器类型，可包含其他控件 |
| BACKDROP | 背景容器 | 带背景纹理的容器，支持九宫格 |
| SIMPLEFRAME | 简单容器 | 轻量级容器 |

### 文本控件

| FDF 类型 | 说明 | 用途 |
|---------|------|------|
| TEXT | 文本框 | 完整的文本显示控件 |
| SIMPLEFONTSTRING | 简单文本 | 轻量级文本显示 |
| TEXTAREA | 文本区域 | 多行文本显示 |

### 按钮控件

| FDF 类型 | 说明 | 用途 |
|---------|------|------|
| BUTTON | 标准按钮 | 基础按钮控件 |
| GLUETEXTBUTTON | 菜单文本按钮 | 游戏菜单中的文本按钮 |
| GLUEBUTTON | 菜单按钮 | 游戏菜单中的按钮 |
| SIMPLEBUTTON | 简单按钮 | 轻量级按钮 |
| BROWSER_BUTTON | 浏览器按钮 | 用于列表浏览 |
| SCRIPT_DIALOG_BUTTON | 脚本对话框按钮 | 脚本触发的对话框按钮 |
| INVIS_BUTTON | 透明按钮 | 不可见的点击区域 |

### 交互控件

| FDF 类型 | 说明 | 用途 |
|---------|------|------|
| CHECKBOX | 复选框 | 勾选框控件 |
| EDITBOX | 文本输入框 | 单行或多行文本输入 |
| SLIDER | 滑块 | 数值调节滑块 |
| SCROLLBAR | 滚动条 | 滚动条控件 |
| LISTBOX | 列表框 | 可选择的列表 |
| MENU | 菜单 | 菜单控件 |
| POPUPMENU | 弹出菜单 | 弹出式菜单 |

### 图形控件

| FDF 类型 | 说明 | 用途 |
|---------|------|------|
| SPRITE | 精灵 | 2D 图像显示 |
| MODEL | 3D 模型 | 3D 模型显示 |
| HIGHLIGHT | 高亮效果 | 鼠标悬停高亮 |

### 其他

| FDF 类型 | 说明 | 用途 |
|---------|------|------|
| CONTROL | 通用控件 | 自定义控件基类 |
| DIALOG | 对话框 | 对话框容器 |

## 通用属性

### 尺寸和位置

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| Width | number | 宽度（相对值 0-1） | `Width 0.256` |
| Height | number | 高度（相对值 0-1） | `Height 0.032` |
| SetAllPoints | flag | 填充整个父容器 | `SetAllPoints` |

### 锚点定位

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| Anchor | array | 绝对锚点 | `Anchor TOPLEFT, 0.1, 0.2` |
| SetPoint | array | 相对锚点 | `SetPoint TOPLEFT, "Parent", TOPLEFT, 0.0, 0.0` |

**锚点类型**:
- `TOPLEFT`, `TOP`, `TOPRIGHT`
- `LEFT`, `CENTER`, `RIGHT`
- `BOTTOMLEFT`, `BOTTOM`, `BOTTOMRIGHT`

### 文件引用

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| IncludeFile | string | 包含其他 FDF 文件 | `IncludeFile "UI\\FrameDef\\UI\\Templates.fdf"` |

### 模板继承

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| INHERITS | string | 继承模板 | `Frame "BACKDROP" "MyFrame" INHERITS "ParentTemplate"` |

## 文本属性

### 文本内容

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| Text | string | 文本内容 | `Text "Hello World"` |
| TextLength | number | 最大文本长度 | `TextLength 256` |

### 字体

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| Font | array | 字体定义 | `Font "MasterFont", 0.012, ""` |
| FrameFont | array | Frame 字体 | `FrameFont "MasterFont", 0.01, "FIXEDSIZE"` |
| FontFlags | string | 字体标志 | `FontFlags "FIXEDSIZE"` |

**字体标志**:
- `FIXEDSIZE` - 固定尺寸
- `THICKOUTLINE` - 粗描边

### 字体颜色

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| FontColor | array[4] | 字体颜色 RGBA | `FontColor 1.0 1.0 1.0 1.0` |
| FontHighlightColor | array[4] | 高亮颜色 | `FontHighlightColor 1.0 0.8 0.0 1.0` |
| FontDisabledColor | array[4] | 禁用颜色 | `FontDisabledColor 0.5 0.5 0.5 1.0` |
| FontShadowColor | array[4] | 阴影颜色 | `FontShadowColor 0.0 0.0 0.0 0.9` |

### 字体对齐

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| FontJustificationH | identifier | 水平对齐 | `FontJustificationH JUSTIFYCENTER` |
| FontJustificationV | identifier | 垂直对齐 | `FontJustificationV JUSTIFYMIDDLE` |

**水平对齐**:
- `JUSTIFYLEFT` - 左对齐
- `JUSTIFYCENTER` - 居中
- `JUSTIFYRIGHT` - 右对齐

**垂直对齐**:
- `JUSTIFYTOP` - 顶部对齐
- `JUSTIFYMIDDLE` - 居中
- `JUSTIFYBOTTOM` - 底部对齐

### 字体效果

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| FontShadowOffset | array[2] | 阴影偏移 | `FontShadowOffset 0.001, -0.001` |

## Backdrop 属性

### 背景

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| BackdropBackground | string | 背景纹理 | `BackdropBackground "EscMenuBackground"` |
| BackdropTileBackground | flag | 平铺背景 | `BackdropTileBackground` |
| BackdropBackgroundSize | number | 背景尺寸 | `BackdropBackgroundSize 0.256` |
| BackdropBackgroundInsets | array[4] | 背景内边距 | `BackdropBackgroundInsets 0.01, 0.01, 0.01, 0.01` |
| BackdropBlendAll | flag | 混合所有层 | `BackdropBlendAll` |

### 边框

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| BackdropEdgeFile | string | 边框纹理 | `BackdropEdgeFile "EscMenuBorder"` |
| BackdropCornerFlags | string | 角标志 | `BackdropCornerFlags "UL\|UR\|BL\|BR\|T\|L\|B\|R"` |
| BackdropCornerSize | number | 角尺寸 | `BackdropCornerSize 0.016` |

**角标志**:
- `UL` - 左上角
- `UR` - 右上角
- `BL` - 左下角
- `BR` - 右下角
- `T` - 顶边
- `L` - 左边
- `B` - 底边
- `R` - 右边

## Texture 属性

### 纹理文件

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| File | string | 纹理文件路径 | `File "UI\\Widgets\\EscMenu\\Human\\editbox-background.blp"` |
| DecorateFileNames | flag | 装饰文件名 | `DecorateFileNames` |

**纹理路径格式**:
- 绝对路径: `UI\\...\\file.blp`
- 相对路径: `file.blp`
- 魔兽资源: `EscMenuBackground`

### 纹理坐标

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| TexCoord | array[4] | 纹理坐标 | `TexCoord 0.0, 1.0, 0.0, 1.0` |

**坐标格式**: `left, right, top, bottom` (范围 0-1)

### 混合模式

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| AlphaMode | string | Alpha 混合模式 | `AlphaMode "BLEND"` |

**混合模式**:
- `ALPHAKEY` - Alpha 键
- `BLEND` - 混合
- `ADD` - 相加

## Button 属性

### 控件样式

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| ControlStyle | string | 控件样式标志 | `ControlStyle "AUTOTRACK\|HIGHLIGHTONMOUSEOVER"` |

**样式标志**:
- `AUTOTRACK` - 自动跟踪
- `HIGHLIGHTONMOUSEOVER` - 鼠标悬停高亮
- `HIGHLIGHTONCLICK` - 点击高亮

### 按钮背景

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| ControlBackdrop | string | 默认背景 | `ControlBackdrop "EscMenuButtonBackdrop"` |
| ControlPushedBackdrop | string | 按下背景 | `ControlPushedBackdrop "EscMenuButtonPushedBackdrop"` |
| ControlDisabledBackdrop | string | 禁用背景 | `ControlDisabledBackdrop "EscMenuButtonDisabledBackdrop"` |
| ControlDisabledPushedBackdrop | string | 禁用按下背景 | `ControlDisabledPushedBackdrop "..."` |
| ControlMouseOverHighlight | string | 鼠标悬停高亮 | `ControlMouseOverHighlight "EscMenuButtonHighlight"` |

### 按钮文本

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| ButtonPushedTextOffset | array[2] | 按下文本偏移 | `ButtonPushedTextOffset 0.001, -0.001` |

## Highlight 属性

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| HighlightType | string | 高亮类型 | `HighlightType "FILETEXTURE"` |
| HighlightAlphaFile | string | 高亮 Alpha 文件 | `HighlightAlphaFile "UI\\Widgets\\EscMenu\\Human\\editbox-highlight.blp"` |
| HighlightAlphaMode | string | 高亮混合模式 | `HighlightAlphaMode "ADD"` |

## EditBox 属性

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| EditTextColor | array[4] | 编辑文本颜色 | `EditTextColor 1.0 1.0 1.0 1.0` |
| EditCursorColor | array[4] | 光标颜色 | `EditCursorColor 1.0 1.0 1.0 1.0` |
| EditBorderColor | array[4] | 边框颜色 | `EditBorderColor 0.1 0.1 0.1 1.0` |
| MaxChars | number | 最大字符数 | `MaxChars 256` |

## Slider 属性

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| SliderMinValue | number | 最小值 | `SliderMinValue 0` |
| SliderMaxValue | number | 最大值 | `SliderMaxValue 100` |
| SliderInitialValue | number | 初始值 | `SliderInitialValue 50` |
| SliderStepSize | number | 步进值 | `SliderStepSize 1` |
| SliderLayoutHorizontal | flag | 水平布局 | `SliderLayoutHorizontal` |
| SliderLayoutVertical | flag | 垂直布局 | `SliderLayoutVertical` |

## ListBox 属性

| 属性名 | 类型 | 说明 | 示例 |
|-------|------|------|------|
| ListBoxItems | array | 列表项 | `ListBoxItems "Item1", "Item2", "Item3"` |

## 嵌套元素

### Texture 块

```fdf
Texture {
  File "path/to/texture.blp"
  TexCoord 0.0, 1.0, 0.0, 1.0
  AlphaMode "BLEND"
}
```

### String 块

```fdf
String {
  Text "STRINGKEY_NAME"
}
```

或命名 String:

```fdf
String "MyString" {
  Text "Content"
}
```

## 特殊值

### 布尔标志

无参数属性表示布尔标志（true）:
```fdf
DecorateFileNames
BackdropTileBackground
SetAllPoints
```

### 字符串键

字符串可以是：
- 字面量: `"Hello World"`
- 本地化键: `"COLON_ARMOR"` (从字符串表加载)
- 路径: `"UI\\Widgets\\..."`

### 数值格式

- 整数: `256`
- 浮点数: `0.256`
- 科学计数法: `1.23e-4`
- 负数: `-0.001`

### 颜色格式

RGBA 值范围 0.0-1.0:
```fdf
FontColor 1.0 1.0 1.0 1.0  // 白色不透明
FontColor 1.0 0.0 0.0 0.5  // 红色半透明
```

## 完整示例

### 复杂按钮定义

```fdf
Frame "GLUETEXTBUTTON" "StartMenuButton" INHERITS "StandardButtonTemplate" {
  Width 0.15
  Height 0.04
  SetPoint TOPLEFT, "UIParent", TOPLEFT, 0.1, 0.1
  
  ControlStyle "AUTOTRACK|HIGHLIGHTONMOUSEOVER"
  ControlBackdrop "EscMenuButtonBackdrop"
  ControlPushedBackdrop "EscMenuButtonPushedBackdrop"
  ControlMouseOverHighlight "EscMenuButtonHighlight"
  
  ButtonPushedTextOffset 0.001, -0.001
  
  Text "START_GAME"
  Font "MasterFont", 0.014, "FIXEDSIZE"
  FontColor 1.0 1.0 1.0 1.0
  FontHighlightColor 1.0 0.8 0.0 1.0
  FontDisabledColor 0.5 0.5 0.5 1.0
  FontJustificationH JUSTIFYCENTER
  FontJustificationV JUSTIFYMIDDLE
  
  Texture {
    File "UI\\Widgets\\EscMenu\\Human\\button-background.blp"
    TexCoord 0.0, 1.0, 0.0, 1.0
    AlphaMode "BLEND"
  }
}
```

### 带背景的容器

```fdf
Frame "BACKDROP" "DialogBackdrop" {
  Width 0.5
  Height 0.4
  SetPoint CENTER, "UIParent", CENTER, 0.0, 0.0
  
  BackdropTileBackground
  BackdropBackground "DialogBackground"
  BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R"
  BackdropCornerSize 0.016
  BackdropEdgeFile "DialogBorder"
  BackdropBackgroundSize 0.256
  BackdropBackgroundInsets 0.01, 0.01, 0.01, 0.01
  BackdropBlendAll
}
```

### 文本框

```fdf
Frame "TEXT" "TitleText" {
  Width 0.3
  Height 0.03
  SetPoint TOP, "DialogBackdrop", TOP, 0.0, -0.02
  
  Text "DIALOG_TITLE"
  FrameFont "MasterFont", 0.016, "THICKOUTLINE"
  FontColor 1.0 0.9 0.0 1.0
  FontShadowColor 0.0 0.0 0.0 0.9
  FontShadowOffset 0.001, -0.001
  FontJustificationH JUSTIFYCENTER
  FontJustificationV JUSTIFYTOP
}
```

## 参考资料

- WC3 原生 FDF: `target/vendor/UI/FrameDef/UI/`
- 字符串表: `target/vendor/UI/FrameDef/GlobalStrings.txt`
- 纹理资源: `UI\Widgets\`, `UI\Glues\`

## 更新记录

- 2024-01-15: 初始版本，基于 WC3 1.32+ 原生 FDF 分析
