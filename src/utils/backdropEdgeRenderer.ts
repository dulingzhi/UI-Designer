/**
 * 边框渲染器
 * 用于渲染 WC3 风格的九宫格边框
 */

import { textureAtlasSplitter, parseCornerFlags, EdgeFlag } from './textureAtlas';
import { loadTexture } from './textureLoader';

export interface BackdropEdgeConfig {
  edgeFile: string;                    // 边框纹理文件路径
  cornerFlags: string;                 // "UL|UR|BL|BR|T|L|B|R"
  cornerSize: number;                  // 角部件尺寸（相对于屏幕宽度）
  backgroundInsets?: number[];         // [左, 上, 右, 下] 内边距
}

export interface RenderRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 边框渲染器类
 */
export class BackdropEdgeRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvasWidth: number;

  constructor(canvas: HTMLCanvasElement, canvasWidth: number = 800) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法创建 Canvas 上下文');
    }
    this.ctx = ctx;
    this.canvasWidth = canvasWidth;
  }

  /**
   * 渲染边框
   */
  async render(
    config: BackdropEdgeConfig,
    frameRect: RenderRect
  ): Promise<void> {
    try {
      // 1. 加载边框纹理
      const textureDataURL = await loadTexture(config.edgeFile);

      // 2. 提取子纹理
      const subTextures = await textureAtlasSplitter.extractSubTextures(textureDataURL);

      // 3. 解析要渲染的边框部件
      const flags = parseCornerFlags(config.cornerFlags);

      // 4. 计算角部件的像素尺寸
      const cornerPixelSize = config.cornerSize * this.canvasWidth;

      // 5. 渲染每个部件
      for (const flag of flags) {
        const texture = subTextures.get(flag);
        if (!texture) {
          console.warn(`[BackdropEdge] 未找到子纹理: ${flag}`);
          continue;
        }

        await this.renderPart(flag, texture, frameRect, cornerPixelSize);
      }
    } catch (error) {
      console.error('[BackdropEdge] 渲染失败:', error);
    }
  }

  /**
   * 渲染单个边框部件
   */
  private async renderPart(
    flag: EdgeFlag,
    textureDataURL: string,
    frameRect: RenderRect,
    cornerSize: number
  ): Promise<void> {
    const img = await this.loadImage(textureDataURL);

    switch (flag) {
      case 'UL': // 左上角
        this.ctx.drawImage(
          img,
          frameRect.x,
          frameRect.y,
          cornerSize,
          cornerSize
        );
        break;

      case 'UR': // 右上角
        this.ctx.drawImage(
          img,
          frameRect.x + frameRect.width - cornerSize,
          frameRect.y,
          cornerSize,
          cornerSize
        );
        break;

      case 'BL': // 左下角
        this.ctx.drawImage(
          img,
          frameRect.x,
          frameRect.y + frameRect.height - cornerSize,
          cornerSize,
          cornerSize
        );
        break;

      case 'BR': // 右下角
        this.ctx.drawImage(
          img,
          frameRect.x + frameRect.width - cornerSize,
          frameRect.y + frameRect.height - cornerSize,
          cornerSize,
          cornerSize
        );
        break;

      case 'T': // 顶边（平铺）
        await this.renderTiledEdge(
          img,
          frameRect.x + cornerSize,
          frameRect.y,
          frameRect.width - 2 * cornerSize,
          cornerSize,
          'horizontal'
        );
        break;

      case 'L': // 左边（平铺）
        await this.renderTiledEdge(
          img,
          frameRect.x,
          frameRect.y + cornerSize,
          cornerSize,
          frameRect.height - 2 * cornerSize,
          'vertical'
        );
        break;

      case 'B': // 底边（平铺）
        await this.renderTiledEdge(
          img,
          frameRect.x + cornerSize,
          frameRect.y + frameRect.height - cornerSize,
          frameRect.width - 2 * cornerSize,
          cornerSize,
          'horizontal'
        );
        break;

      case 'R': // 右边（平铺）
        await this.renderTiledEdge(
          img,
          frameRect.x + frameRect.width - cornerSize,
          frameRect.y + cornerSize,
          cornerSize,
          frameRect.height - 2 * cornerSize,
          'vertical'
        );
        break;
    }
  }

  /**
   * 渲染平铺边缘
   */
  private async renderTiledEdge(
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number,
    _direction: 'horizontal' | 'vertical'
  ): Promise<void> {
    // 使用 pattern 进行平铺
    const pattern = this.ctx.createPattern(img, 'repeat');
    if (!pattern) {
      console.warn('[BackdropEdge] 无法创建 pattern');
      return;
    }

    this.ctx.save();

    // 设置裁剪区域
    this.ctx.beginPath();
    this.ctx.rect(x, y, width, height);
    this.ctx.clip();

    // 平移到目标位置并填充
    this.ctx.translate(x, y);
    this.ctx.fillStyle = pattern;
    this.ctx.fillRect(0, 0, width, height);

    // 恢复上下文
    this.ctx.restore();
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
   * 计算内容区域（考虑边框和内边距）
   */
  calculateContentRect(
    frameRect: RenderRect,
    config: BackdropEdgeConfig
  ): RenderRect {
    const cornerPixelSize = config.cornerSize * this.canvasWidth;
    const insets = config.backgroundInsets || [0, 0, 0, 0];

    // 转换内边距为像素
    const insetPixels = insets.map(i => i * this.canvasWidth);

    return {
      x: frameRect.x + cornerPixelSize + insetPixels[0],
      y: frameRect.y + cornerPixelSize + insetPixels[1],
      width: frameRect.width - 2 * cornerPixelSize - insetPixels[0] - insetPixels[2],
      height: frameRect.height - 2 * cornerPixelSize - insetPixels[1] - insetPixels[3],
    };
  }

  /**
   * 更新 canvas 宽度
   */
  setCanvasWidth(width: number): void {
    this.canvasWidth = width;
  }
}

/**
 * 快捷函数：渲染边框到 canvas
 */
export async function renderBackdropEdge(
  canvas: HTMLCanvasElement,
  config: BackdropEdgeConfig,
  frameRect: RenderRect,
  canvasWidth: number = 800
): Promise<void> {
  const renderer = new BackdropEdgeRenderer(canvas, canvasWidth);
  await renderer.render(config, frameRect);
}
