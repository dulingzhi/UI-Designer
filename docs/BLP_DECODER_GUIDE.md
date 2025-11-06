# BLP 解码器使用文档

## 概述

`BLPDecoder` 是一个纯 TypeScript 实现的 BLP (Blizzard Picture) 图像格式解码器，支持 Warcraft 3 和 World of Warcraft 使用的各种 BLP 格式。

## 支持的格式

### BLP1 (Warcraft 3 / WoW Classic)
- ✅ **JPEG 压缩** - 使用浏览器原生 JPEG 解码
- ✅ **Paletted (调色板)** - 256色索引图像
- ✅ **Alpha 通道** - 支持 1/4/8 位 Alpha

### BLP2 (WoW TBC+)
- ✅ **DXT1** - S3TC 压缩 (无Alpha或1位Alpha)
- ✅ **DXT3** - S3TC 压缩 (4位显式Alpha)
- ✅ **DXT5** - S3TC 压缩 (8位插值Alpha)

### 特性
- 🚀 **纯前端实现** - 无需后端服务
- 📦 **零依赖** - 使用原生 Web API
- 🎯 **Mipmap 支持** - 可选择解码任意层级
- ⚡ **高性能** - DXT 解码 512x512 < 3ms

## 基础用法

### 1. 导入模块

```typescript
import { BLPDecoder, decodeBLP, decodeBLPToDataURL } from '@/utils/blpDecoder';
```

### 2. 解码为 ImageData

```typescript
// 从 ArrayBuffer 解码
const buffer: ArrayBuffer = ...; // 从文件读取
const imageData = await decodeBLP(buffer);

console.log(imageData.width, imageData.height);
console.log(imageData.data); // Uint8ClampedArray RGBA数据
```

### 3. 解码为 Data URL

```typescript
// 直接获取可用于 <img> 的 Data URL
const dataURL = await decodeBLPToDataURL(buffer);

// 在 React 中使用
<img src={dataURL} alt="BLP Image" />
```

### 4. 使用解码器类

```typescript
const decoder = new BLPDecoder(buffer);

// 获取图像信息
const info = decoder.getInfo();
console.log(info);
// {
//   width: 256,
//   height: 256,
//   version: 2,
//   compression: 'DXT1',
//   mipmapCount: 9
// }

// 解码不同 Mipmap 级别
const fullSize = decoder.decode(0);   // 原始尺寸
const half = decoder.decode(1);        // 宽高各减半
const quarter = decoder.decode(2);     // 宽高各1/4
```

## 在 Tauri 中使用

### 读取本地 BLP 文件

```typescript
import { open } from '@tauri-apps/plugin-dialog';
import { readBinaryFile } from '@tauri-apps/plugin-fs';
import { decodeBLPToDataURL } from '@/utils/blpDecoder';

async function loadBLPFile() {
  // 选择文件
  const path = await open({
    filters: [{ name: 'BLP Image', extensions: ['blp'] }]
  });
  
  if (!path || Array.isArray(path)) return;
  
  // 读取二进制数据
  const buffer = await readBinaryFile(path);
  
  // 解码为 Data URL
  const dataURL = await decodeBLPToDataURL(buffer.buffer);
  
  return dataURL;
}
```

### 在 Canvas 中渲染

```typescript
async function renderBLPToCanvas(buffer: ArrayBuffer, canvas: HTMLCanvasElement) {
  const decoder = new BLPDecoder(buffer);
  const imageData = decoder.decode(0);
  
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
}
```

## 完整示例

### React 组件 - BLP 图像预览器

```typescript
import React, { useState } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { readBinaryFile } from '@tauri-apps/plugin-fs';
import { BLPDecoder, decodeBLPToDataURL } from '@/utils/blpDecoder';

export const BLPViewer: React.FC = () => {
  const [imageURL, setImageURL] = useState<string>('');
  const [info, setInfo] = useState<any>(null);
  
  const handleLoadBLP = async () => {
    const path = await open({
      filters: [{ name: 'BLP', extensions: ['blp'] }]
    });
    
    if (!path || Array.isArray(path)) return;
    
    try {
      const buffer = await readBinaryFile(path);
      
      // 获取图像信息
      const decoder = new BLPDecoder(buffer.buffer);
      setInfo(decoder.getInfo());
      
      // 解码为 Data URL
      const url = await decodeBLPToDataURL(buffer.buffer);
      setImageURL(url);
      
    } catch (error) {
      console.error('BLP加载失败:', error);
      alert('无法加载BLP文件');
    }
  };
  
  return (
    <div>
      <button onClick={handleLoadBLP}>加载 BLP 文件</button>
      
      {info && (
        <div>
          <h3>图像信息</h3>
          <p>尺寸: {info.width}x{info.height}</p>
          <p>格式: BLP{info.version} - {info.compression}</p>
          <p>Mipmap: {info.mipmapCount} 层</p>
        </div>
      )}
      
      {imageURL && (
        <img src={imageURL} alt="BLP Preview" />
      )}
    </div>
  );
};
```

### 纹理加载器集成

```typescript
class TextureLoader {
  private cache = new Map<string, string>();
  
  async loadTexture(path: string): Promise<string> {
    // 检查缓存
    if (this.cache.has(path)) {
      return this.cache.get(path)!;
    }
    
    // 判断文件类型
    if (path.toLowerCase().endsWith('.blp')) {
      const buffer = await readBinaryFile(path);
      const dataURL = await decodeBLPToDataURL(buffer.buffer);
      this.cache.set(path, dataURL);
      return dataURL;
    }
    
    // 其他格式直接返回路径
    return path;
  }
}
```

## 性能优化

### 1. Mipmap 选择

对于缩略图，使用较低的 Mipmap 级别可以大幅提升性能:

```typescript
const decoder = new BLPDecoder(buffer);

// 缩略图: 使用 mipmap level 2 (尺寸为原始的1/4)
const thumbnail = decoder.decode(2);

// 全尺寸预览: 使用 mipmap level 0
const fullSize = decoder.decode(0);
```

### 2. 缓存解码结果

```typescript
const cache = new Map<string, ImageData>();

function getCachedBLP(path: string, buffer: ArrayBuffer): ImageData {
  if (!cache.has(path)) {
    const decoder = new BLPDecoder(buffer);
    cache.set(path, decoder.decode(0));
  }
  return cache.get(path)!;
}
```

### 3. Web Worker 异步解码

对于大量 BLP 文件，可以使用 Web Worker 避免阻塞主线程:

```typescript
// worker.ts
self.onmessage = async (e) => {
  const { buffer, mipLevel } = e.data;
  const decoder = new BLPDecoder(buffer);
  const imageData = decoder.decode(mipLevel);
  self.postMessage({ imageData }, [imageData.data.buffer]);
};

// main.ts
const worker = new Worker('worker.ts');
worker.postMessage({ buffer, mipLevel: 0 });
worker.onmessage = (e) => {
  const { imageData } = e.data;
  // 使用解码结果
};
```

## 错误处理

```typescript
try {
  const decoder = new BLPDecoder(buffer);
  const imageData = decoder.decode(0);
} catch (error) {
  if (error.message.includes('不支持的BLP格式')) {
    console.error('文件不是有效的BLP格式');
  } else if (error.message.includes('不支持的压缩类型')) {
    console.error('BLP压缩格式不支持');
  } else if (error.message.includes('无效的Mipmap级别')) {
    console.error('Mipmap级别超出范围');
  } else {
    console.error('解码失败:', error);
  }
}
```

## 已知限制

1. **JPEG 压缩 (BLP1)**: 
   - 需要浏览器环境 (使用 `Image` 和 `Canvas`)
   - Node.js 环境下无法解码 JPEG 格式

2. **BLP0 格式**: 
   - Warcraft 3 Beta 格式暂不支持

3. **性能**:
   - JPEG 解码需要异步操作 (当前实现有限制)
   - 大尺寸 DXT5 解码可能较慢 (> 1024x1024)

## 测试

运行测试套件:

```bash
npx tsx tests/blp-decoder.test.ts
```

性能基准:
- 64x64 DXT1: ~0.4ms
- 128x128 DXT1: ~1.8ms
- 256x256 DXT1: ~2.3ms
- 512x512 DXT1: ~2.0ms

## 技术参考

- [WoWDev BLP Specification](https://wowdev.wiki/BLP)
- [S3TC/DXT Compression](https://www.khronos.org/opengl/wiki/S3_Texture_Compression)
- [Warcraft 3 File Formats](http://www.wc3jass.com/)

## 许可证

MIT License
