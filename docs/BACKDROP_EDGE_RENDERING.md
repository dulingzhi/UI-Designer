# WC3 边框纹理渲染机制分析

## 问题描述

从 WC3 资源浏览器中看到的 `human-options-menu-border.blp` 纹理文件包含了 **4 个独立的边框部件**：
1. 左上角部件
2. 上边框条
3. 中间框架部件  
4. 右下角部件

但这个单一的 BLP 文件如何被分解并渲染为一个完整的边框？

## FDF 边框定义

在 `EscMenuTemplates.fdf` 中找到了边框定义：

```fdf
Frame "BACKDROP" "EscMenuButtonBackdropTemplate" {
    DecorateFileNames,
    BackdropTileBackground,
    BackdropBackground  "EscMenuButtonBackground",
    BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R",
    BackdropCornerSize  0.0125,
    BackdropBackgroundSize  0.256,
    BackdropBackgroundInsets 0.006 0.006 0.006 0.006,
    BackdropEdgeFile  "EscMenuButtonBorder",
}
```

### 关键属性说明

#### 1. `BackdropEdgeFile`
- **作用**: 指定边框纹理文件
- **值**: `"EscMenuButtonBorder"` (实际路径通过 war3skins.txt 映射)
- **实际文件**: `UI\Widgets\EscMenu\Human\human-options-menu-border.blp`

#### 2. `BackdropCornerFlags`
- **作用**: 定义边框的哪些部分需要渲染
- **值**: `"UL|UR|BL|BR|T|L|B|R"`
- **含义**:
  - `UL` = Upper Left (左上角)
  - `UR` = Upper Right (右上角)
  - `BL` = Bottom Left (左下角)
  - `BR` = Bottom Right (右下角)
  - `T` = Top (顶边)
  - `L` = Left (左边)
  - `B` = Bottom (底边)
  - `R` = Right (右边)

#### 3. `BackdropCornerSize`
- **作用**: 定义角部件的尺寸
- **值**: `0.0125` (相对于屏幕宽度的比例)
- **说明**: 影响四个角的渲染大小

#### 4. `BackdropBackgroundInsets`
- **作用**: 定义背景相对于边框的内边距
- **值**: `0.006 0.006 0.006 0.006` (左 上 右 下)
- **说明**: 边框和内容之间的间距

## 纹理文件结构

`human-options-menu-border.blp` 文件内部是一个 **纹理图集 (Texture Atlas)**，包含多个子纹理区域：

```
+------------------+------------------+
|   左上角 (UL)    |    右上角 (UR)   |
|                  |                  |
+------------------+------------------+
|    左边 (L)      |     右边 (R)     |
|                  |                  |
+------------------+------------------+
|   左下角 (BL)    |    底边 (B)      |
|                  |                  |
+------------------+------------------+
|    顶边 (T)      |  (可能有更多)    |
|                  |                  |
+------------------+------------------+
```

### 纹理分割规则

WC3 引擎会根据 **固定的分割规则** 将单个 BLP 文件分解为多个边框部件：

1. **角部件** (UL, UR, BL, BR):
   - 固定尺寸的正方形区域
   - 通常是纹理图集的前4个区域

2. **边部件** (T, L, B, R):
   - 可平铺（tiled）的条状区域
   - 可以拉伸以适应不同大小的框架

3. **分割方式**:
   - 纹理通常是 256x256 或 512x512 的 BLP 文件
   - 每个子纹理区域是 64x64 像素（示例）
   - 引擎按照预定义的网格布局读取

## 渲染流程

### 1. 加载纹理
```typescript
// 从 war3skins.txt 获取实际路径
const borderPath = war3skins[currentRace]['EscMenuButtonBorder'];
// 例如: "UI\Widgets\EscMenu\Human\human-options-menu-border.blp"

// 加载 BLP 文件
const blpData = await mpqManager.readFile(borderPath);
const texture = await decodeBLPToDataURL(blpData);
```

### 2. 分割纹理
```typescript
// 根据纹理图集布局分割为子纹理
const subTextures = {
  UL: extractSubTexture(texture, 0, 0, 64, 64),      // 左上角
  UR: extractSubTexture(texture, 64, 0, 64, 64),     // 右上角
  BL: extractSubTexture(texture, 0, 64, 64, 64),     // 左下角
  BR: extractSubTexture(texture, 64, 64, 64, 64),    // 右下角
  T:  extractSubTexture(texture, 128, 0, 64, 64),    // 顶边
  L:  extractSubTexture(texture, 0, 128, 64, 64),    // 左边
  B:  extractSubTexture(texture, 128, 64, 64, 64),   // 底边
  R:  extractSubTexture(texture, 64, 128, 64, 64),   // 右边
};
```

### 3. 渲染边框
```typescript
// 根据 BackdropCornerFlags 渲染每个部件
const flags = parseCornerFlags("UL|UR|BL|BR|T|L|B|R");

flags.forEach(flag => {
  const subTexture = subTextures[flag];
  const position = calculatePosition(flag, frameSize, cornerSize);
  
  // 渲染到画布
  if (['T', 'L', 'B', 'R'].includes(flag)) {
    // 边部件：平铺或拉伸
    renderTiled(subTexture, position, tileMode);
  } else {
    // 角部件：固定大小
    renderCorner(subTexture, position, cornerSize);
  }
});
```

### 4. 组合完整边框

```
┌─────────────────────────────────────┐
│ UL        T (平铺)              UR  │
├─────────────────────────────────────┤
│ L                                R  │
│   (背景区域)                         │
│ L                                R  │
├─────────────────────────────────────┤
│ BL        B (平铺)              BR  │
└─────────────────────────────────────┘
```

## 编辑器实现需求

### Canvas.tsx 中需要实现的功能

```typescript
interface BackdropEdgeConfig {
  edgeFile: string;           // 边框纹理文件路径
  cornerFlags: string;        // "UL|UR|BL|BR|T|L|B|R"
  cornerSize: number;         // 0.0125
  backgroundInsets: number[]; // [0.006, 0.006, 0.006, 0.006]
}

class BackdropEdgeRenderer {
  /**
   * 解析 CornerFlags
   */
  parseCornerFlags(flags: string): string[] {
    return flags.split('|').map(f => f.trim());
  }

  /**
   * 从纹理图集中提取子纹理
   */
  async extractSubTextures(texturePath: string): Promise<Map<string, string>> {
    const texture = await loadTexture(texturePath);
    
    // 创建临时 canvas 进行分割
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    const img = new Image();
    img.src = texture;
    await img.decode();
    
    // 假设纹理是 256x256，每个子纹理是 64x64
    const subSize = 64;
    const subTextures = new Map<string, string>();
    
    // 定义每个部件在图集中的位置
    const layout = {
      UL: [0, 0],
      UR: [1, 0],
      BL: [0, 1],
      BR: [1, 1],
      T:  [2, 0],
      L:  [0, 2],
      B:  [2, 1],
      R:  [1, 2],
    };
    
    for (const [flag, [x, y]] of Object.entries(layout)) {
      canvas.width = subSize;
      canvas.height = subSize;
      ctx.clearRect(0, 0, subSize, subSize);
      ctx.drawImage(img, 
        x * subSize, y * subSize, subSize, subSize,  // 源区域
        0, 0, subSize, subSize                       // 目标区域
      );
      
      subTextures.set(flag, canvas.toDataURL());
    }
    
    return subTextures;
  }

  /**
   * 渲染边框
   */
  async renderBackdropEdge(
    ctx: CanvasRenderingContext2D,
    config: BackdropEdgeConfig,
    frameRect: { x: number; y: number; width: number; height: number }
  ): Promise<void> {
    const flags = this.parseCornerFlags(config.cornerFlags);
    const subTextures = await this.extractSubTextures(config.edgeFile);
    
    const cornerPixelSize = config.cornerSize * CANVAS_WIDTH; // 转换为像素
    
    for (const flag of flags) {
      const texture = subTextures.get(flag);
      if (!texture) continue;
      
      const img = new Image();
      img.src = texture;
      await img.decode();
      
      switch (flag) {
        case 'UL': // 左上角
          ctx.drawImage(img, frameRect.x, frameRect.y, cornerPixelSize, cornerPixelSize);
          break;
          
        case 'UR': // 右上角
          ctx.drawImage(img, 
            frameRect.x + frameRect.width - cornerPixelSize, 
            frameRect.y, 
            cornerPixelSize, cornerPixelSize
          );
          break;
          
        case 'BL': // 左下角
          ctx.drawImage(img, 
            frameRect.x, 
            frameRect.y + frameRect.height - cornerPixelSize, 
            cornerPixelSize, cornerPixelSize
          );
          break;
          
        case 'BR': // 右下角
          ctx.drawImage(img, 
            frameRect.x + frameRect.width - cornerPixelSize, 
            frameRect.y + frameRect.height - cornerPixelSize, 
            cornerPixelSize, cornerPixelSize
          );
          break;
          
        case 'T': // 顶边（平铺）
          this.renderTiledEdge(ctx, img, 
            frameRect.x + cornerPixelSize, 
            frameRect.y,
            frameRect.width - 2 * cornerPixelSize,
            cornerPixelSize,
            'horizontal'
          );
          break;
          
        case 'L': // 左边（平铺）
          this.renderTiledEdge(ctx, img,
            frameRect.x,
            frameRect.y + cornerPixelSize,
            cornerPixelSize,
            frameRect.height - 2 * cornerPixelSize,
            'vertical'
          );
          break;
          
        case 'B': // 底边（平铺）
          this.renderTiledEdge(ctx, img,
            frameRect.x + cornerPixelSize,
            frameRect.y + frameRect.height - cornerPixelSize,
            frameRect.width - 2 * cornerPixelSize,
            cornerPixelSize,
            'horizontal'
          );
          break;
          
        case 'R': // 右边（平铺）
          this.renderTiledEdge(ctx, img,
            frameRect.x + frameRect.width - cornerPixelSize,
            frameRect.y + cornerPixelSize,
            cornerPixelSize,
            frameRect.height - 2 * cornerPixelSize,
            'vertical'
          );
          break;
      }
    }
  }

  /**
   * 渲染平铺边缘
   */
  private renderTiledEdge(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    direction: 'horizontal' | 'vertical'
  ): void {
    const pattern = ctx.createPattern(img, 'repeat');
    if (!pattern) return;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}
```

## 实际纹理图集布局分析

通过观察 `human-options-menu-border.blp`，实际布局可能是：

```
+--------+--------+--------+--------+
|   UL   |   T    |   UR   |        |
| 64x64  | 64x64  | 64x64  |  空    |
+--------+--------+--------+--------+
|   L    |        |   R    |        |
| 64x64  |  空    | 64x64  |  空    |
+--------+--------+--------+--------+
|   BL   |   B    |   BR   |        |
| 64x64  | 64x64  | 64x64  |  空    |
+--------+--------+--------+--------+
|        |        |        |        |
|  空    |  空    |  空    |  空    |
+--------+--------+--------+--------+
```

或者更紧凑的 2x4 布局：

```
+--------+--------+
|   UL   |   UR   |
+--------+--------+
|   T    |   B    |
+--------+--------+
|   L    |   R    |
+--------+--------+
|   BL   |   BR   |
+--------+--------+
```

## 下一步实现计划

1. ✅ 分析 FDF 边框属性
2. ✅ 理解纹理图集结构
3. 📋 **确定实际图集布局** (需要读取 BLP 文件并分析)
4. 📋 实现 `extractSubTextures()` 函数
5. 📋 在 `Canvas.tsx` 中集成边框渲染器
6. 📋 支持 `BackdropEdgeFile` 属性渲染
7. 📋 测试不同种族的边框纹理

## 参考资料

- `EscMenuTemplates.fdf` - 边框模板定义
- war3skins.txt - 纹理路径映射
- BLP 解码器 - `blpDecoder.ts`
- 纹理加载器 - `textureLoader.ts`

## 常见边框类型

| 边框名称 | 用途 | 文件示例 |
|---------|------|---------|
| EscMenuBorder | 主菜单边框 | human-options-menu-border.blp |
| QuestDialogBorder | 任务对话框边框 | human-questdialog-border.blp |
| ConsoleButtonBorder | 控制台按钮边框 | consolebuttonborder.blp |
| EscMenuButtonBorder | 菜单按钮边框 | human-escmenu-button-border.blp |
| CinematicBorder | 过场动画边框 | cinematicborder.blp |
