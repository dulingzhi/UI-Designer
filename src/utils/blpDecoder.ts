/**
 * BLP (Blizzard Picture) 图像格式解码器
 * 
 * 支持的格式:
 * - BLP0: Warcraft 3 Beta (未实现)
 * - BLP1: Warcraft 3 / WoW Classic (JPEG压缩 + Paletted)
 * - BLP2: WoW TBC+ (DXT压缩)
 * 
 * 参考规范:
 * - https://wowdev.wiki/BLP
 * - http://www.wc3jass.com/showthread.php?t=7670
 */

// BLP 文件头结构
interface BLPHeader {
  magic: string;           // 'BLP0' | 'BLP1' | 'BLP2'
  version: number;         // BLP版本 (0, 1, 2)
  compression: number;     // 压缩类型: 0=JPEG, 1=Paletted, 2=DXT1, 3=DXT3, 4=DXT5
  alphaDepth: number;      // Alpha位深度: 0, 1, 4, 8
  alphaEncoding: number;   // Alpha编码: 0=DXT1, 1=DXT3, 7=DXT5
  hasMipmaps: number;      // 是否有Mipmap
  width: number;           // 宽度
  height: number;          // 高度
  mipOffsets: number[];    // 16个Mipmap偏移量
  mipSizes: number[];      // 16个Mipmap大小
}

// 压缩类型枚举
enum BLPCompressionType {
  JPEG = 0,
  PALETTED = 1,
  DXT1 = 2,
  DXT3 = 3,
  DXT5 = 4,
  UNCOMPRESSED = 5,
}

/**
 * BLP 解码器类
 */
export class BLPDecoder {
  private view: DataView;
  private header: BLPHeader;
  
  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
    this.header = this.parseHeader();
  }
  
  /**
   * 解析 BLP 文件头
   */
  private parseHeader(): BLPHeader {
    // 读取魔数 (4字节)
    const magic = String.fromCharCode(
      this.view.getUint8(0),
      this.view.getUint8(1),
      this.view.getUint8(2),
      this.view.getUint8(3)
    );
    
    if (!['BLP0', 'BLP1', 'BLP2'].includes(magic)) {
      throw new Error(`不支持的BLP格式: ${magic}`);
    }
    
    const version = parseInt(magic[3]);
    
    if (version === 1) {
      return this.parseBLP1Header(magic);
    } else if (version === 2) {
      return this.parseBLP2Header(magic);
    } else {
      throw new Error(`不支持的BLP版本: ${version}`);
    }
  }
  
  /**
   * 解析 BLP1 文件头
   */
  private parseBLP1Header(magic: string): BLPHeader {
    const compression = this.view.getUint32(4, true);
    const alphaDepth = this.view.getUint32(8, true);
    const width = this.view.getUint32(12, true);
    const height = this.view.getUint32(16, true);
    const alphaEncoding = this.view.getUint32(20, true);
    const hasMipmaps = this.view.getUint32(24, true);
    
    // 读取16个Mipmap偏移量和大小
    const mipOffsets: number[] = [];
    const mipSizes: number[] = [];
    
    for (let i = 0; i < 16; i++) {
      mipOffsets.push(this.view.getUint32(28 + i * 4, true));
    }
    
    for (let i = 0; i < 16; i++) {
      mipSizes.push(this.view.getUint32(92 + i * 4, true));
    }
    
    return {
      magic,
      version: 1,
      compression,
      alphaDepth,
      alphaEncoding,
      hasMipmaps,
      width,
      height,
      mipOffsets,
      mipSizes,
    };
  }
  
  /**
   * 解析 BLP2 文件头
   */
  private parseBLP2Header(magic: string): BLPHeader {
    const compression = this.view.getUint8(4);
    const alphaDepth = this.view.getUint8(5);
    const alphaEncoding = this.view.getUint8(6);
    const hasMipmaps = this.view.getUint8(7);
    const width = this.view.getUint32(8, true);
    const height = this.view.getUint32(12, true);
    
    // 读取16个Mipmap偏移量和大小
    const mipOffsets: number[] = [];
    const mipSizes: number[] = [];
    
    for (let i = 0; i < 16; i++) {
      mipOffsets.push(this.view.getUint32(16 + i * 4, true));
    }
    
    for (let i = 0; i < 16; i++) {
      mipSizes.push(this.view.getUint32(80 + i * 4, true));
    }
    
    return {
      magic,
      version: 2,
      compression,
      alphaDepth,
      alphaEncoding,
      hasMipmaps,
      width,
      height,
      mipOffsets,
      mipSizes,
    };
  }
  
  /**
   * 解码为 ImageData
   * @param mipLevel Mipmap级别 (0=原始大小)
   */
  async decode(mipLevel: number = 0): Promise<ImageData> {
    const { width, height, compression } = this.header;
    
    // 计算当前Mipmap的尺寸
    const mipWidth = Math.max(1, width >> mipLevel);
    const mipHeight = Math.max(1, height >> mipLevel);
    
    // 根据压缩类型解码
    let rgbaData: Uint8ClampedArray;
    
    switch (compression) {
      case BLPCompressionType.JPEG:
        rgbaData = await this.decodeJPEG(mipLevel);
        break;
        
      case BLPCompressionType.PALETTED:
        rgbaData = this.decodePaletted(mipLevel);
        break;
        
      case BLPCompressionType.DXT1:
        rgbaData = this.decodeDXT1(mipLevel);
        break;
        
      case BLPCompressionType.DXT3:
        rgbaData = this.decodeDXT3(mipLevel);
        break;
        
      case BLPCompressionType.DXT5:
        rgbaData = this.decodeDXT5(mipLevel);
        break;
        
      default:
        throw new Error(`不支持的压缩类型: ${compression}`);
    }
    
    // 尝试使用浏览器ImageData，如果不存在则返回自定义对象
    if (typeof ImageData !== 'undefined') {
      // @ts-ignore - TypeScript类型定义问题，实际运行正常
      return new ImageData(rgbaData, mipWidth, mipHeight);
    } else {
      // Node.js 环境: 返回兼容对象
      return {
        data: rgbaData,
        width: mipWidth,
        height: mipHeight,
        colorSpace: 'srgb' as PredefinedColorSpace,
      } as ImageData;
    }
  }
  
  /**
   * 解码 JPEG 压缩 (BLP1)
   */
  private async decodeJPEG(mipLevel: number): Promise<Uint8ClampedArray> {
    const { mipOffsets, mipSizes, width, height } = this.header;
    const offset = mipOffsets[mipLevel];
    const size = mipSizes[mipLevel];
    
    const mipWidth = width >> mipLevel;
    const mipHeight = height >> mipLevel;
    
    if (offset === 0 || size === 0) {
      // 返回占位图像而不是抛出错误
      return this.createPlaceholderImage(mipWidth, mipHeight);
    }
    
    try {
      // 读取 JPEG 头大小 (存储在偏移 156 = 39*4 字节处)
      const jpegHeaderSize = this.view.getUint32(156, true);
      
      // 读取 JPEG 头 (从偏移 160 = 40*4 字节开始)
      const jpegHeader = new Uint8Array(this.view.buffer, 160, jpegHeaderSize);
      
      // 读取 JPEG 数据
      const jpegData = new Uint8Array(this.view.buffer, offset, size);
      
      // 合并 JPEG 头和数据
      const fullJPEG = new Uint8Array(jpegHeaderSize + jpegData.length);
      fullJPEG.set(jpegHeader, 0);
      fullJPEG.set(jpegData, jpegHeaderSize);
      
      // 使用浏览器原生解码JPEG
      return await this.decodeJPEGWithCanvas(fullJPEG, mipWidth, mipHeight);
    } catch (error) {
      // JPEG 解码失败时，返回占位图像（静默失败）
      return this.createPlaceholderImage(mipWidth, mipHeight);
    }
  }
  
  /**
   * 使用 Canvas 解码 JPEG
   */
  private async decodeJPEGWithCanvas(jpegData: Uint8Array, width: number, height: number): Promise<Uint8ClampedArray> {
    // 创建Blob
    // @ts-ignore - TypeScript类型定义问题，实际运行正常
    const blob = new Blob([jpegData], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    
    // 创建临时Image和Canvas
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    canvas.width = width;
    canvas.height = height;
    
    // 异步加载
    img.src = url;
    
    return new Promise<Uint8ClampedArray>((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(imageData.data);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('JPEG解码失败'));
      };
    });
  }
  
  /**
   * 创建占位图像（半透明灰色）
   */
  private createPlaceholderImage(width: number, height: number): Uint8ClampedArray {
    const rgbaData = new Uint8ClampedArray(width * height * 4);
    // 填充为半透明灰色
    for (let i = 0; i < rgbaData.length; i += 4) {
      rgbaData[i] = 128;     // R
      rgbaData[i + 1] = 128; // G
      rgbaData[i + 2] = 128; // B
      rgbaData[i + 3] = 128; // A (半透明)
    }
    return rgbaData;
  }
  
  /**
   * 解码 Paletted 压缩 (BLP1)
   */
  private decodePaletted(mipLevel: number): Uint8ClampedArray {
    const { mipOffsets, mipSizes, width, height, alphaDepth } = this.header;
    const offset = mipOffsets[mipLevel];
    const size = mipSizes[mipLevel];
    
    if (offset === 0 || size === 0) {
      throw new Error(`无效的Mipmap级别: ${mipLevel}`);
    }
    
    const mipWidth = Math.max(1, width >> mipLevel);
    const mipHeight = Math.max(1, height >> mipLevel);
    
    // 读取调色板 (256色 * 4字节BGRA)
    const paletteOffset = this.header.version === 1 ? 156 : 148;
    const palette = new Uint8Array(256 * 4);
    
    for (let i = 0; i < 256; i++) {
      const b = this.view.getUint8(paletteOffset + i * 4 + 0);
      const g = this.view.getUint8(paletteOffset + i * 4 + 1);
      const r = this.view.getUint8(paletteOffset + i * 4 + 2);
      const a = this.view.getUint8(paletteOffset + i * 4 + 3);
      
      palette[i * 4 + 0] = r;
      palette[i * 4 + 1] = g;
      palette[i * 4 + 2] = b;
      palette[i * 4 + 3] = a;
    }
    
    // 读取索引数据
    const indices = new Uint8Array(this.view.buffer, offset, mipWidth * mipHeight);
    
    // 构建RGBA数据
    const rgbaData = new Uint8ClampedArray(mipWidth * mipHeight * 4);
    
    for (let i = 0; i < mipWidth * mipHeight; i++) {
      const index = indices[i];
      rgbaData[i * 4 + 0] = palette[index * 4 + 0]; // R
      rgbaData[i * 4 + 1] = palette[index * 4 + 1]; // G
      rgbaData[i * 4 + 2] = palette[index * 4 + 2]; // B
      rgbaData[i * 4 + 3] = palette[index * 4 + 3]; // A
    }
    
    // 处理额外的Alpha通道 (如果有)
    if (alphaDepth > 0) {
      const alphaOffset = offset + mipWidth * mipHeight;
      this.applyAlphaChannel(rgbaData, alphaOffset, mipWidth, mipHeight, alphaDepth);
    }
    
    return rgbaData;
  }
  
  /**
   * 应用额外的Alpha通道
   */
  private applyAlphaChannel(
    rgbaData: Uint8ClampedArray,
    alphaOffset: number,
    width: number,
    height: number,
    alphaDepth: number
  ): void {
    const pixelCount = width * height;
    
    if (alphaDepth === 1) {
      // 1位Alpha (8像素/字节)
      for (let i = 0; i < pixelCount; i++) {
        const byteIndex = Math.floor(i / 8);
        const bitIndex = 7 - (i % 8);
        const alphaByte = this.view.getUint8(alphaOffset + byteIndex);
        const alpha = (alphaByte >> bitIndex) & 0x1;
        rgbaData[i * 4 + 3] = alpha * 255;
      }
    } else if (alphaDepth === 4) {
      // 4位Alpha (2像素/字节)
      for (let i = 0; i < pixelCount; i++) {
        const byteIndex = Math.floor(i / 2);
        const isHighNibble = i % 2 === 0;
        const alphaByte = this.view.getUint8(alphaOffset + byteIndex);
        const alpha = isHighNibble ? (alphaByte >> 4) & 0xF : alphaByte & 0xF;
        rgbaData[i * 4 + 3] = (alpha / 15) * 255;
      }
    } else if (alphaDepth === 8) {
      // 8位Alpha (1像素/字节)
      for (let i = 0; i < pixelCount; i++) {
        const alpha = this.view.getUint8(alphaOffset + i);
        rgbaData[i * 4 + 3] = alpha;
      }
    }
  }
  
  /**
   * 解码 DXT1 压缩 (BLP2)
   */
  private decodeDXT1(mipLevel: number): Uint8ClampedArray {
    const { mipOffsets, width, height } = this.header;
    const offset = mipOffsets[mipLevel];
    
    const mipWidth = Math.max(1, width >> mipLevel);
    const mipHeight = Math.max(1, height >> mipLevel);
    
    const rgbaData = new Uint8ClampedArray(mipWidth * mipHeight * 4);
    
    // DXT1: 4x4块，每块8字节
    const blockCountX = Math.ceil(mipWidth / 4);
    const blockCountY = Math.ceil(mipHeight / 4);
    
    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        const blockOffset = offset + (by * blockCountX + bx) * 8;
        this.decodeDXT1Block(rgbaData, blockOffset, bx, by, mipWidth, mipHeight);
      }
    }
    
    return rgbaData;
  }
  
  /**
   * 解码单个 DXT1 4x4 块
   */
  private decodeDXT1Block(
    output: Uint8ClampedArray,
    blockOffset: number,
    blockX: number,
    blockY: number,
    imageWidth: number,
    imageHeight: number
  ): void {
    // 读取两个RGB565颜色
    const color0 = this.view.getUint16(blockOffset, true);
    const color1 = this.view.getUint16(blockOffset + 2, true);
    
    // 解码RGB565为RGB888
    const colors: number[][] = [];
    colors[0] = this.rgb565ToRGB888(color0);
    colors[1] = this.rgb565ToRGB888(color1);
    
    // 计算中间颜色
    if (color0 > color1) {
      // 4色模式
      colors[2] = [
        Math.floor((2 * colors[0][0] + colors[1][0]) / 3),
        Math.floor((2 * colors[0][1] + colors[1][1]) / 3),
        Math.floor((2 * colors[0][2] + colors[1][2]) / 3),
        255
      ];
      colors[3] = [
        Math.floor((colors[0][0] + 2 * colors[1][0]) / 3),
        Math.floor((colors[0][1] + 2 * colors[1][1]) / 3),
        Math.floor((colors[0][2] + 2 * colors[1][2]) / 3),
        255
      ];
    } else {
      // 3色+透明模式
      colors[2] = [
        Math.floor((colors[0][0] + colors[1][0]) / 2),
        Math.floor((colors[0][1] + colors[1][1]) / 2),
        Math.floor((colors[0][2] + colors[1][2]) / 2),
        255
      ];
      colors[3] = [0, 0, 0, 0]; // 透明
    }
    
    // 读取索引数据 (4字节，每2位一个像素)
    const indices = this.view.getUint32(blockOffset + 4, true);
    
    // 解码4x4块
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const pixelX = blockX * 4 + x;
        const pixelY = blockY * 4 + y;
        
        // 跳过超出图像边界的像素
        if (pixelX >= imageWidth || pixelY >= imageHeight) continue;
        
        // 获取像素索引 (2位)
        const bitIndex = (y * 4 + x) * 2;
        const colorIndex = (indices >> bitIndex) & 0x3;
        
        // 写入RGBA
        const outputOffset = (pixelY * imageWidth + pixelX) * 4;
        const color = colors[colorIndex];
        output[outputOffset + 0] = color[0]; // R
        output[outputOffset + 1] = color[1]; // G
        output[outputOffset + 2] = color[2]; // B
        output[outputOffset + 3] = color[3]; // A
      }
    }
  }
  
  /**
   * 解码 DXT3 压缩 (BLP2)
   */
  private decodeDXT3(mipLevel: number): Uint8ClampedArray {
    const { mipOffsets, width, height } = this.header;
    const offset = mipOffsets[mipLevel];
    
    const mipWidth = Math.max(1, width >> mipLevel);
    const mipHeight = Math.max(1, height >> mipLevel);
    
    const rgbaData = new Uint8ClampedArray(mipWidth * mipHeight * 4);
    
    // DXT3: 4x4块，每块16字节 (8字节Alpha + 8字节RGB)
    const blockCountX = Math.ceil(mipWidth / 4);
    const blockCountY = Math.ceil(mipHeight / 4);
    
    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        const blockOffset = offset + (by * blockCountX + bx) * 16;
        this.decodeDXT3Block(rgbaData, blockOffset, bx, by, mipWidth, mipHeight);
      }
    }
    
    return rgbaData;
  }
  
  /**
   * 解码单个 DXT3 4x4 块
   */
  private decodeDXT3Block(
    output: Uint8ClampedArray,
    blockOffset: number,
    blockX: number,
    blockY: number,
    imageWidth: number,
    imageHeight: number
  ): void {
    // 先解码RGB部分 (使用DXT1算法)
    this.decodeDXT1Block(output, blockOffset + 8, blockX, blockY, imageWidth, imageHeight);
    
    // 解码Alpha部分 (前8字节，4位/像素)
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const pixelX = blockX * 4 + x;
        const pixelY = blockY * 4 + y;
        
        if (pixelX >= imageWidth || pixelY >= imageHeight) continue;
        
        // 读取4位Alpha
        const pixelIndex = y * 4 + x;
        const byteIndex = Math.floor(pixelIndex / 2);
        const isHighNibble = pixelIndex % 2 === 0;
        const alphaByte = this.view.getUint8(blockOffset + byteIndex);
        const alpha4 = isHighNibble ? (alphaByte >> 4) & 0xF : alphaByte & 0xF;
        
        // 扩展4位到8位
        const alpha8 = (alpha4 << 4) | alpha4;
        
        // 写入Alpha通道
        const outputOffset = (pixelY * imageWidth + pixelX) * 4 + 3;
        output[outputOffset] = alpha8;
      }
    }
  }
  
  /**
   * 解码 DXT5 压缩 (BLP2)
   */
  private decodeDXT5(mipLevel: number): Uint8ClampedArray {
    const { mipOffsets, width, height } = this.header;
    const offset = mipOffsets[mipLevel];
    
    const mipWidth = Math.max(1, width >> mipLevel);
    const mipHeight = Math.max(1, height >> mipLevel);
    
    const rgbaData = new Uint8ClampedArray(mipWidth * mipHeight * 4);
    
    // DXT5: 4x4块，每块16字节 (8字节Alpha + 8字节RGB)
    const blockCountX = Math.ceil(mipWidth / 4);
    const blockCountY = Math.ceil(mipHeight / 4);
    
    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        const blockOffset = offset + (by * blockCountX + bx) * 16;
        this.decodeDXT5Block(rgbaData, blockOffset, bx, by, mipWidth, mipHeight);
      }
    }
    
    return rgbaData;
  }
  
  /**
   * 解码单个 DXT5 4x4 块
   */
  private decodeDXT5Block(
    output: Uint8ClampedArray,
    blockOffset: number,
    blockX: number,
    blockY: number,
    imageWidth: number,
    imageHeight: number
  ): void {
    // 先解码RGB部分
    this.decodeDXT1Block(output, blockOffset + 8, blockX, blockY, imageWidth, imageHeight);
    
    // 解码DXT5 Alpha部分 (插值算法)
    const alpha0 = this.view.getUint8(blockOffset);
    const alpha1 = this.view.getUint8(blockOffset + 1);
    
    // 计算8个Alpha值
    const alphas = [alpha0, alpha1];
    if (alpha0 > alpha1) {
      // 6个插值
      for (let i = 1; i < 7; i++) {
        alphas.push(Math.floor(((7 - i) * alpha0 + i * alpha1) / 7));
      }
    } else {
      // 4个插值 + 0 + 255
      for (let i = 1; i < 5; i++) {
        alphas.push(Math.floor(((5 - i) * alpha0 + i * alpha1) / 5));
      }
      alphas.push(0);
      alphas.push(255);
    }
    
    // 读取索引数据 (6字节，3位/像素)
    const indices = new Uint8Array(6);
    for (let i = 0; i < 6; i++) {
      indices[i] = this.view.getUint8(blockOffset + 2 + i);
    }
    
    // 解码4x4块
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const pixelX = blockX * 4 + x;
        const pixelY = blockY * 4 + y;
        
        if (pixelX >= imageWidth || pixelY >= imageHeight) continue;
        
        // 获取3位索引
        const pixelIndex = y * 4 + x;
        const bitIndex = pixelIndex * 3;
        const byteIndex = Math.floor(bitIndex / 8);
        const bitOffset = bitIndex % 8;
        
        let alphaIndex: number;
        if (bitOffset <= 5) {
          // 索引在单个字节内
          alphaIndex = (indices[byteIndex] >> bitOffset) & 0x7;
        } else {
          // 索引跨越两个字节
          const lowBits = indices[byteIndex] >> bitOffset;
          const highBits = (indices[byteIndex + 1] << (8 - bitOffset)) & 0xFF;
          alphaIndex = (lowBits | highBits) & 0x7;
        }
        
        // 写入Alpha通道
        const outputOffset = (pixelY * imageWidth + pixelX) * 4 + 3;
        output[outputOffset] = alphas[alphaIndex];
      }
    }
  }
  
  /**
   * RGB565 转 RGB888
   */
  private rgb565ToRGB888(rgb565: number): number[] {
    const r = ((rgb565 >> 11) & 0x1F) << 3;
    const g = ((rgb565 >> 5) & 0x3F) << 2;
    const b = (rgb565 & 0x1F) << 3;
    return [r, g, b, 255];
  }
  
  /**
   * 获取图像信息
   */
  getInfo(): {
    width: number;
    height: number;
    version: number;
    compression: string;
    mipmapCount: number;
  } {
    const compressionNames = ['JPEG', 'Paletted', 'DXT1', 'DXT3', 'DXT5', 'Uncompressed'];
    
    // 计算有效Mipmap数量
    let mipmapCount = 0;
    for (let i = 0; i < 16; i++) {
      if (this.header.mipOffsets[i] > 0 && this.header.mipSizes[i] > 0) {
        mipmapCount++;
      }
    }
    
    return {
      width: this.header.width,
      height: this.header.height,
      version: this.header.version,
      compression: compressionNames[this.header.compression] || `Unknown(${this.header.compression})`,
      mipmapCount,
    };
  }
}

/**
 * 快捷函数: 解码BLP为ImageData
 */
export async function decodeBLP(buffer: ArrayBuffer, mipLevel: number = 0): Promise<ImageData> {
  const decoder = new BLPDecoder(buffer);
  return await decoder.decode(mipLevel);
}

/**
 * 快捷函数: 解码BLP为DataURL
 */
export async function decodeBLPToDataURL(buffer: ArrayBuffer, mipLevel: number = 0): Promise<string> {
  const imageData = await decodeBLP(buffer, mipLevel);
  
  // 创建Canvas
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.toDataURL('image/png');
}
