/**
 * 纹理图集工具
 * 用于从单个纹理文件中提取子纹理区域
 */

export type EdgeFlag = 'UL' | 'UR' | 'BL' | 'BR' | 'T' | 'L' | 'B' | 'R';

export interface SubTextureLayout {
  [key: string]: [number, number]; // [x, y] 在图集中的网格坐标
}

/**
 * 默认边框纹理图集布局 (3x3)
 * WC3 标准布局：8个部件在 256x256 或 512x512 纹理中
 * 
 * 网格布局：
 * [UL] [T ] [UR]
 * [L ] [  ] [R ]
 * [BL] [B ] [BR]
 */
export const DEFAULT_BORDER_LAYOUT: SubTextureLayout = {
  UL: [0, 0],  // 左上角
  T:  [1, 0],  // 顶边
  UR: [2, 0],  // 右上角
  L:  [0, 1],  // 左边
  R:  [2, 1],  // 右边
  BL: [0, 2],  // 左下角
  B:  [1, 2],  // 底边
  BR: [2, 2],  // 右下角
};

/**
 * 替代布局：水平排列 8x1
 * 
 * WC3 实际使用的布局（human-options-menu-border.blp）
 * 从左到右水平排列（512x64，每个子纹理64x64）：
 * [L] [R] [T] [B] [UL] [UR] [BL] [BR]
 *
 * ⚠️ TODO(P1) — Hexrays 验证存在差异：
 *   反编译 WorldEditKKWE.exe sub_44D1A0 (CBackdropFrame::OnUpdateModels) 显示
 *   游戏内 v88=true（hasEdgeFile）模式下，每条边占纹理 1/8 strip，bit↔索引 映射为：
 *     0x01 → idx0  (Top)
 *     0x02 → idx1  (Bottom)
 *     0x04 → idx2  (Left  或 Right — vertex 推导未确认)
 *     0x08 → idx3  (Right 或 Left)
 *     0x10 → idx4  (TL/UL)
 *     0x20 → idx5  (TR/UR)
 *     0x40 → idx6  (BL)
 *     0x80 → idx7  (BR)
 *   即真实顺序应为 [T, B, L?, R?, UL, UR, BL, BR]，与下方 [L, R, T, B, ...] 不同。
 *   修复需配合 tests/baselines/ 真实游戏截图验证后再改，避免破坏现有用户的自定义边缘文件。
 */
export const HORIZONTAL_BORDER_LAYOUT: SubTextureLayout = {
  L:  [0, 0],  // 索引0: 左边
  R:  [1, 0],  // 索引1: 右边
  T:  [2, 0],  // 索引2: 顶边
  B:  [3, 0],  // 索引3: 底边
  UL: [4, 0],  // 索引4: 左上角
  UR: [5, 0],  // 索引5: 右上角
  BL: [6, 0],  // 索引6: 左下角
  BR: [7, 0],  // 索引7: 右下角
};

/**
 * 替代布局：紧凑型 2x4
 * 
 * 网格布局：
 * [L ] [R ]  <- 行0: 左右边缘
 * [T ] [B ]  <- 行1: 上下边缘
 * [UL] [UR]  <- 行2: 上角
 * [BL] [BR]  <- 行3: 下角
 */
export const COMPACT_BORDER_LAYOUT: SubTextureLayout = {
  L:  [0, 0],
  R:  [1, 0],
  T:  [0, 1],
  B:  [1, 1],
  UL: [0, 2],
  UR: [1, 2],
  BL: [0, 3],
  BR: [1, 3],
};

/**
 * 纹理图集分割器
 */
export class TextureAtlasSplitter {
  private cache = new Map<string, Map<EdgeFlag, string>>();

  /**
   * 从纹理图集中提取子纹理
   * @param textureDataURL 纹理的 Data URL
   * @param layout 子纹理布局（默认使用标准布局）
   * @param subSize 每个子纹理的尺寸（像素）
   * @returns 边框部件到 Data URL 的映射
   */
  async extractSubTextures(
    textureDataURL: string,
    layout: SubTextureLayout = DEFAULT_BORDER_LAYOUT,
    subSize: number = 64
  ): Promise<Map<EdgeFlag, string>> {
    // 检查缓存
    const cacheKey = `${textureDataURL}_${subSize}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const subTextures = new Map<EdgeFlag, string>();

    // 加载源图像
    const img = await this.loadImage(textureDataURL);
    
    console.log('[TextureAtlas] 源图像尺寸:', img.width, 'x', img.height);
    console.log('[TextureAtlas] 子纹理尺寸:', subSize);
    console.log('[TextureAtlas] 使用布局:', layout);

    // 创建临时 canvas 用于提取子纹理
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建 Canvas 上下文');
    }

    // 设置 canvas 尺寸
    canvas.width = subSize;
    canvas.height = subSize;

    // 提取每个子纹理
    for (const [flag, [gridX, gridY]] of Object.entries(layout)) {
      // 清空 canvas
      ctx.clearRect(0, 0, subSize, subSize);

      // 从源图像绘制对应区域
      const sourceX = gridX * subSize;
      const sourceY = gridY * subSize;

      try {
        // 对于顶边(T)和底边(B)，需要旋转90度
        const needsRotation = flag === 'T' || flag === 'B';
        
        if (needsRotation) {
          // 保存当前状态
          ctx.save();
          // 移动到中心点
          ctx.translate(subSize / 2, subSize / 2);
          // 旋转90度
          ctx.rotate(90 * Math.PI / 180);
          // 绘制图像（从中心点偏移）
          ctx.drawImage(
            img,
            sourceX, sourceY, subSize, subSize,  // 源区域
            -subSize / 2, -subSize / 2, subSize, subSize  // 目标区域（从中心点偏移）
          );
          // 恢复状态
          ctx.restore();
        } else {
          ctx.drawImage(
            img,
            sourceX, sourceY, subSize, subSize,  // 源区域
            0, 0, subSize, subSize               // 目标区域
          );
        }

        // 转换为 Data URL
        const dataURL = canvas.toDataURL('image/png');
        subTextures.set(flag as EdgeFlag, dataURL);
      } catch (error) {
        console.warn(`[TextureAtlas] 提取子纹理失败: ${flag}`, error);
      }
    }

    // 缓存结果
    this.cache.set(cacheKey, subTextures);

    return subTextures;
  }

  /**
   * 智能检测布局
   * 根据图像实际尺寸自动检测最佳布局
   */
  async detectLayout(textureDataURL: string): Promise<{
    layout: SubTextureLayout;
    subSize: number;
  }> {
    const img = await this.loadImage(textureDataURL);

    console.log('[TextureAtlas] 检测纹理尺寸:', img.width, 'x', img.height);

    // 检查是否是水平排列 8x1（宽:高 = 8:1）
    const aspectRatio = img.width / img.height;
    
    if (aspectRatio >= 7 && aspectRatio <= 9) {
      // 8x1 水平布局：512x64 或类似比例
      const subSize = img.height; // 子纹理是正方形，边长 = 高度
      console.log('[TextureAtlas] 检测为 8x1 水平布局，子纹理尺寸:', subSize);
      return {
        layout: HORIZONTAL_BORDER_LAYOUT,
        subSize: subSize,
      };
    } else if (aspectRatio >= 0.4 && aspectRatio <= 0.6) {
      // 2x4 布局：宽度是高度的一半
      const subSize = img.width / 2;
      console.log('[TextureAtlas] 检测为 2x4 布局，子纹理尺寸:', subSize);
      return {
        layout: COMPACT_BORDER_LAYOUT,
        subSize: subSize,
      };
    } else if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
      // 3x3 布局：正方形
      const subSize = img.width / 3;
      console.log('[TextureAtlas] 检测为 3x3 布局，子纹理尺寸:', subSize);
      return {
        layout: DEFAULT_BORDER_LAYOUT,
        subSize: subSize,
      };
    }

    // 默认：尝试 3x3 布局
    console.warn('[TextureAtlas] 未知布局比例:', aspectRatio, '使用默认 3x3');
    return {
      layout: DEFAULT_BORDER_LAYOUT,
      subSize: Math.floor(img.width / 3),
    };
  }

  /**
   * 加载图像
   */
  private loadImage(dataURL: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图像加载失败'));
      img.src = dataURL;
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 移除特定纹理的缓存
   */
  removeCacheEntry(textureDataURL: string, subSize: number = 64): void {
    const cacheKey = `${textureDataURL}_${subSize}`;
    this.cache.delete(cacheKey);
  }

  /**
   * 获取缓存大小
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

/**
 * 全局纹理图集分割器实例
 */
export const textureAtlasSplitter = new TextureAtlasSplitter();

/**
 * 解析 BackdropCornerFlags 字符串
 * @param flags 例如 "UL|UR|BL|BR|T|L|B|R"
 * @returns 标志数组
 */
export function parseCornerFlags(flags: string): EdgeFlag[] {
  if (!flags) return [];
  
  return flags
    .split('|')
    .map(f => f.trim() as EdgeFlag)
    .filter(f => ['UL', 'UR', 'BL', 'BR', 'T', 'L', 'B', 'R'].includes(f));
}

/**
 * 检查是否包含所有边框部件
 */
export function hasAllBorderParts(flags: EdgeFlag[]): boolean {
  const required: EdgeFlag[] = ['UL', 'UR', 'BL', 'BR', 'T', 'L', 'B', 'R'];
  return required.every(flag => flags.includes(flag));
}

/**
 * 检查是否只有角部件
 */
export function hasOnlyCorners(flags: EdgeFlag[]): boolean {
  const corners: EdgeFlag[] = ['UL', 'UR', 'BL', 'BR'];
  return flags.every(flag => corners.includes(flag));
}

/**
 * 检查是否只有边部件
 */
export function hasOnlyEdges(flags: EdgeFlag[]): boolean {
  const edges: EdgeFlag[] = ['T', 'L', 'B', 'R'];
  return flags.every(flag => edges.includes(flag));
}
