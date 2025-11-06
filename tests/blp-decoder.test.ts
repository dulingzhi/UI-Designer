/**
 * BLP 解码器测试
 * 
 * 测试各种BLP格式的解码功能
 */

import { BLPDecoder, decodeBLP, decodeBLPToDataURL } from '../src/utils/blpDecoder';
import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * 测试 BLP 文件解析
 */
async function testBLPDecoder() {
  console.log('='.repeat(60));
  console.log('BLP 解码器功能测试');
  console.log('='.repeat(60));
  
  // 测试1: 创建虚拟BLP1 Paletted格式
  console.log('\n[测试1] BLP1 Paletted 格式解析');
  const blp1Buffer = createMockBLP1Paletted(64, 64);
  
  try {
    const decoder1 = new BLPDecoder(blp1Buffer);
    const info1 = decoder1.getInfo();
    
    console.log('✓ 文件头解析成功');
    console.log(`  - 版本: BLP${info1.version}`);
    console.log(`  - 尺寸: ${info1.width}x${info1.height}`);
    console.log(`  - 压缩: ${info1.compression}`);
    console.log(`  - Mipmap数: ${info1.mipmapCount}`);
    
    // 尝试解码
    const imageData = decoder1.decode(0);
    console.log(`✓ 图像解码成功: ${imageData.width}x${imageData.height}`);
    console.log(`  - 数据大小: ${imageData.data.length} 字节`);
    
  } catch (error: any) {
    console.error('✗ 测试失败:', error.message);
  }
  
  // 测试2: BLP2 DXT1格式
  console.log('\n[测试2] BLP2 DXT1 格式解析');
  const blp2Buffer = createMockBLP2DXT1(64, 64);
  
  try {
    const decoder2 = new BLPDecoder(blp2Buffer);
    const info2 = decoder2.getInfo();
    
    console.log('✓ 文件头解析成功');
    console.log(`  - 版本: BLP${info2.version}`);
    console.log(`  - 尺寸: ${info2.width}x${info2.height}`);
    console.log(`  - 压缩: ${info2.compression}`);
    
    const imageData = decoder2.decode(0);
    console.log(`✓ DXT1解码成功: ${imageData.width}x${imageData.height}`);
    
  } catch (error: any) {
    console.error('✗ 测试失败:', error.message);
  }
  
  // 测试3: 错误格式检测
  console.log('\n[测试3] 错误格式检测');
  const invalidBuffer = new ArrayBuffer(100);
  const invalidView = new DataView(invalidBuffer);
  invalidView.setUint32(0, 0x50474E89); // PNG魔数
  
  try {
    new BLPDecoder(invalidBuffer);
    console.error('✗ 应该抛出错误但没有');
  } catch (error: any) {
    console.log('✓ 正确检测到无效格式:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
}

/**
 * 创建模拟的 BLP1 Paletted 格式文件
 */
function createMockBLP1Paletted(width: number, height: number): ArrayBuffer {
  const headerSize = 156;
  const paletteSize = 256 * 4;
  const dataSize = width * height;
  const totalSize = headerSize + paletteSize + dataSize;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  
  // 写入文件头
  view.setUint8(0, 'B'.charCodeAt(0));
  view.setUint8(1, 'L'.charCodeAt(0));
  view.setUint8(2, 'P'.charCodeAt(0));
  view.setUint8(3, '1'.charCodeAt(0));
  
  view.setUint32(4, 1, true);      // compression: Paletted
  view.setUint32(8, 0, true);      // alphaDepth: 0
  view.setUint32(12, width, true);
  view.setUint32(16, height, true);
  view.setUint32(20, 0, true);     // alphaEncoding
  view.setUint32(24, 1, true);     // hasMipmaps
  
  // Mipmap offsets
  view.setUint32(28, headerSize + paletteSize, true); // mip0 offset
  for (let i = 1; i < 16; i++) {
    view.setUint32(28 + i * 4, 0, true);
  }
  
  // Mipmap sizes
  view.setUint32(92, dataSize, true); // mip0 size
  for (let i = 1; i < 16; i++) {
    view.setUint32(92 + i * 4, 0, true);
  }
  
  // 写入调色板 (256色渐变)
  const paletteOffset = 156;
  for (let i = 0; i < 256; i++) {
    view.setUint8(paletteOffset + i * 4 + 0, i); // B
    view.setUint8(paletteOffset + i * 4 + 1, i); // G
    view.setUint8(paletteOffset + i * 4 + 2, i); // R
    view.setUint8(paletteOffset + i * 4 + 3, 255); // A
  }
  
  // 写入索引数据 (渐变图案)
  const dataOffset = headerSize + paletteSize;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = Math.floor((x / width) * 255);
      view.setUint8(dataOffset + y * width + x, index);
    }
  }
  
  return buffer;
}

/**
 * 创建模拟的 BLP2 DXT1 格式文件
 */
function createMockBLP2DXT1(width: number, height: number): ArrayBuffer {
  const headerSize = 148;
  const blockCountX = Math.ceil(width / 4);
  const blockCountY = Math.ceil(height / 4);
  const dataSize = blockCountX * blockCountY * 8; // DXT1: 8字节/块
  const totalSize = headerSize + dataSize;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  
  // 写入文件头
  view.setUint8(0, 'B'.charCodeAt(0));
  view.setUint8(1, 'L'.charCodeAt(0));
  view.setUint8(2, 'P'.charCodeAt(0));
  view.setUint8(3, '2'.charCodeAt(0));
  
  view.setUint8(4, 2);            // compression: DXT1
  view.setUint8(5, 0);            // alphaDepth
  view.setUint8(6, 0);            // alphaEncoding
  view.setUint8(7, 1);            // hasMipmaps
  view.setUint32(8, width, true);
  view.setUint32(12, height, true);
  
  // Mipmap offsets
  view.setUint32(16, headerSize, true); // mip0 offset
  for (let i = 1; i < 16; i++) {
    view.setUint32(16 + i * 4, 0, true);
  }
  
  // Mipmap sizes
  view.setUint32(80, dataSize, true); // mip0 size
  for (let i = 1; i < 16; i++) {
    view.setUint32(80 + i * 4, 0, true);
  }
  
  // 写入DXT1数据 (简单填充)
  const dataOffset = headerSize;
  for (let i = 0; i < blockCountX * blockCountY; i++) {
    // 每个块8字节
    view.setUint16(dataOffset + i * 8, 0xFFFF, true);     // color0: 白色
    view.setUint16(dataOffset + i * 8 + 2, 0x0000, true); // color1: 黑色
    view.setUint32(dataOffset + i * 8 + 4, 0x00000000, true); // indices: 全用color0
  }
  
  return buffer;
}

/**
 * 性能测试
 */
async function performanceTest() {
  console.log('\n' + '='.repeat(60));
  console.log('性能测试');
  console.log('='.repeat(60));
  
  const sizes = [64, 128, 256, 512];
  
  for (const size of sizes) {
    const buffer = createMockBLP2DXT1(size, size);
    const decoder = new BLPDecoder(buffer);
    
    const startTime = performance.now();
    decoder.decode(0);
    const endTime = performance.now();
    
    const duration = (endTime - startTime).toFixed(2);
    console.log(`${size}x${size} DXT1解码: ${duration}ms`);
  }
}

// 运行测试
testBLPDecoder().then(() => {
  return performanceTest();
}).catch(error => {
  console.error('测试失败:', error);
  process.exit(1);
});
