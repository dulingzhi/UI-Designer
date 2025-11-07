/**
 * 纹理图集工具
 * 用于从单个纹理文件中提取子纹理区域
 */

export type EdgeFlag = 'UL' | 'UR' | 'BL' | 'BR' | 'T' | 'L' | 'B' | 'R';

export interface SubTextureLayout {
  [key: string]: [number, number]; // [x, y] 在图集中的网格坐标
}

/**
 * 默认边框纹理图集布局
 * WC3 标准布局：8个部件在 256x256 或 512x512 纹理中
 */
export const DEFAULT_BORDER_LAYOUT: SubTextureLayout = {
  UL: [0, 0],  // 左上角
  UR: [1, 0],  // 右上角
  BL: [0, 1],  // 左下角
  BR: [1, 1],  // 右下角
  T:  [2, 0],  // 顶边
  L:  [0, 2],  // 左边
  B:  [2, 1],  // 底边
  R:  [1, 2],  // 右边
};

/**
 * 替代布局：紧凑型 2x4
 */
export const COMPACT_BORDER_LAYOUT: SubTextureLayout = {
  UL: [0, 0],
  UR: [1, 0],
  T:  [0, 1],
  B:  [1, 1],
  L:  [0, 2],
  R:  [1, 2],
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
        ctx.drawImage(
          img,
          sourceX, sourceY, subSize, subSize,  // 源区域
          0, 0, subSize, subSize               // 目标区域
        );

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
   * 尝试不同的布局和尺寸，找到最佳匹配
   */
  async detectLayout(textureDataURL: string): Promise<{
    layout: SubTextureLayout;
    subSize: number;
  }> {
    const img = await this.loadImage(textureDataURL);

    // 常见的子纹理尺寸
    const commonSizes = [64, 32, 128, 16];

    for (const size of commonSizes) {
      // 检查图像尺寸是否匹配
      if (img.width >= size * 3 && img.height >= size * 3) {
        // 标准布局（3x3网格）
        return {
          layout: DEFAULT_BORDER_LAYOUT,
          subSize: size,
        };
      } else if (img.width >= size * 2 && img.height >= size * 4) {
        // 紧凑布局（2x4网格）
        return {
          layout: COMPACT_BORDER_LAYOUT,
          subSize: size,
        };
      }
    }

    // 默认返回标准布局
    return {
      layout: DEFAULT_BORDER_LAYOUT,
      subSize: 64,
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
