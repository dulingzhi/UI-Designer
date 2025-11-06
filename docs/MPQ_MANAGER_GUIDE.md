# MPQ 档案管理器使用文档

## 概述

`MPQManager` 是一个用于读取 Warcraft 3 MPQ (MoPaQ) 档案的管理器，支持从游戏客户端中提取 BLP 纹理、FDF 文件等资源。

## 功能特性

- ✅ 自动加载 War3 1.27 标准 MPQ 档案
- ✅ 文件搜索和通配符匹配
- ✅ 文件缓存和快速查找
- ✅ 目录浏览
- ✅ Tauri 集成 (文件系统访问)
- ✅ 类型安全的 TypeScript API

## 基础用法

### 1. 初始化 MPQ 系统

```typescript
import { mpqManager, initializeMPQ } from '@/utils/mpqManager';

// 方法1: 使用对话框选择 War3 目录
const success = await initializeMPQ();

// 方法2: 手动指定路径
const war3Path = 'C:\\Program Files (x86)\\Warcraft III';
await initializeMPQ(war3Path);

// 方法3: 使用管理器实例
await mpqManager.setWar3Path(war3Path);
await mpqManager.loadStandardArchives();
```

### 2. 读取文件

```typescript
import { readWC3File, mpqManager } from '@/utils/mpqManager';

// 快捷方式
const buffer = await readWC3File('UI\\Widgets\\EscMenu\\Human\\button-background.blp');

// 使用管理器
const buffer2 = await mpqManager.readFile('UI\\FrameDef\\UI\\EscMenuTemplates.fdf');

if (buffer) {
  console.log('文件大小:', buffer.byteLength);
  // 可以传递给 BLP 解码器
  const imageData = await decodeBLP(buffer);
}
```

### 3. 搜索文件

```typescript
// 搜索所有 BLP 文件
const allBLP = mpqManager.getAllBLPFiles();
console.log(`找到 ${allBLP.length} 个 BLP 文件`);

// 搜索 UI 目录下的 BLP
const uiBLP = mpqManager.getUIBLPFiles();

// 使用通配符搜索
const escMenuBLP = mpqManager.searchFiles('UI\\Widgets\\EscMenu\\*.blp');
const allFDF = mpqManager.searchFiles('*.fdf');

// 列出目录
const widgetFiles = mpqManager.listDirectory('UI\\Widgets');
```

### 4. 检查文件

```typescript
const exists = await mpqManager.hasFile('UI\\Widgets\\Console\\Human\\CommandButton-Up.blp');

if (exists) {
  console.log('文件存在于 MPQ 档案中');
}
```

## 集成 BLP 解码器

### 加载并显示 WC3 纹理

```typescript
import { readWC3File } from '@/utils/mpqManager';
import { decodeBLPToDataURL } from '@/utils/blpDecoder';

async function loadWC3Texture(wc3Path: string): Promise<string | null> {
  // 从 MPQ 读取文件
  const buffer = await readWC3File(wc3Path);
  
  if (!buffer) {
    console.error('文件未找到:', wc3Path);
    return null;
  }
  
  // 解码 BLP 为 Data URL
  try {
    const dataURL = await decodeBLPToDataURL(buffer);
    return dataURL;
  } catch (error) {
    console.error('BLP 解码失败:', error);
    return null;
  }
}

// 使用
const imageURL = await loadWC3Texture('UI\\Widgets\\EscMenu\\Human\\button-background.blp');
if (imageURL) {
  // 在 React 中显示
  <img src={imageURL} alt="WC3 Texture" />
}
```

## React 组件示例

### WC3 纹理浏览器

```typescript
import React, { useState, useEffect } from 'react';
import { mpqManager, initializeMPQ } from '@/utils/mpqManager';
import { decodeBLPToDataURL } from '@/utils/blpDecoder';

export const WC3TextureBrowser: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [blpFiles, setBLPFiles] = useState<string[]>([]);
  const [selectedTexture, setSelectedTexture] = useState<string>('');
  const [previewURL, setPreviewURL] = useState<string>('');
  
  // 初始化 MPQ
  const handleInitialize = async () => {
    const success = await initializeMPQ();
    if (success) {
      setInitialized(true);
      
      // 加载 BLP 文件列表
      const files = mpqManager.getUIBLPFiles();
      setBLPFiles(files.map(f => f.fileName));
    }
  };
  
  // 加载预览
  const handleSelectTexture = async (filePath: string) => {
    setSelectedTexture(filePath);
    
    const buffer = await mpqManager.readFile(filePath);
    if (buffer) {
      try {
        const url = await decodeBLPToDataURL(buffer);
        setPreviewURL(url);
      } catch (error) {
        console.error('预览失败:', error);
        setPreviewURL('');
      }
    }
  };
  
  return (
    <div>
      {!initialized ? (
        <button onClick={handleInitialize}>
          加载 Warcraft 3 资源
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* 文件列表 */}
          <div style={{ width: '300px', height: '600px', overflow: 'auto' }}>
            <h3>BLP 纹理 ({blpFiles.length})</h3>
            {blpFiles.map(file => (
              <div
                key={file}
                onClick={() => handleSelectTexture(file)}
                style={{
                  padding: '5px',
                  cursor: 'pointer',
                  background: file === selectedTexture ? '#4a9eff' : 'transparent',
                  color: file === selectedTexture ? 'white' : 'inherit',
                }}
              >
                {file.split('\\').pop()}
              </div>
            ))}
          </div>
          
          {/* 预览 */}
          <div>
            <h3>预览</h3>
            {previewURL ? (
              <div>
                <p>{selectedTexture}</p>
                <img src={previewURL} alt="Preview" style={{ maxWidth: '512px' }} />
              </div>
            ) : (
              <p>选择一个纹理以预览</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
```

### WC3 路径选择器

```typescript
import React, { useState } from 'react';
import { mpqManager } from '@/utils/mpqManager';

interface WC3PathSelectorProps {
  value: string;
  onChange: (path: string) => void;
  filter?: 'blp' | 'fdf' | 'all';
}

export const WC3PathSelector: React.FC<WC3PathSelectorProps> = ({
  value,
  onChange,
  filter = 'blp',
}) => {
  const [showBrowser, setShowBrowser] = useState(false);
  const [files, setFiles] = useState<string[]>([]);
  
  const handleBrowse = () => {
    // 加载文件列表
    let fileList;
    if (filter === 'blp') {
      fileList = mpqManager.getAllBLPFiles();
    } else if (filter === 'fdf') {
      fileList = mpqManager.searchFiles('*.fdf');
    } else {
      fileList = Array.from(mpqManager['fileListCache'].values());
    }
    
    setFiles(fileList.map(f => f.fileName));
    setShowBrowser(true);
  };
  
  return (
    <div>
      <input 
        type="text" 
        value={value} 
        onChange={e => onChange(e.target.value)}
        placeholder="UI\\Widgets\\..."
      />
      <button onClick={handleBrowse}>浏览 WC3 资源</button>
      
      {showBrowser && (
        <div className="wc3-file-browser">
          {files.map(file => (
            <div
              key={file}
              onClick={() => {
                onChange(file);
                setShowBrowser(false);
              }}
            >
              {file}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

## 高级用法

### 加载自定义 MPQ

```typescript
// 加载额外的 MPQ 档案 (如地图文件)
await mpqManager.loadArchive('MyCustom.mpq');

// 卸载不需要的档案
mpqManager.unloadArchive('War3xLocal.mpq');
```

### 导出文件列表

```typescript
const fileList = mpqManager.exportFileList();
console.log(fileList);

// 保存到文件
import { writeTextFile } from '@tauri-apps/plugin-fs';
await writeTextFile('mpq_files.txt', fileList);
```

### 获取状态信息

```typescript
const status = mpqManager.getStatus();

console.log('War3 路径:', status.war3Path);
console.log('已加载档案:', status.archivesLoaded);
console.log('总文件数:', status.totalFiles);

status.archives.forEach(archive => {
  console.log(`${archive.name}: ${archive.loaded ? '✓' : '✗'}`);
  console.log(`  文件数: ${archive.fileCount}`);
  if (archive.error) {
    console.log(`  错误: ${archive.error}`);
  }
});
```

## 路径格式

### WC3 内部路径规范

MPQ 档案使用反斜杠 `\` 作为路径分隔符：

```typescript
// ✅ 正确
'UI\\Widgets\\EscMenu\\Human\\button-background.blp'
'UI\\FrameDef\\UI\\EscMenuTemplates.fdf'
'Textures\\Black32.blp'

// ✅ 也支持正斜杠 (会自动转换)
'UI/Widgets/EscMenu/Human/button-background.blp'

// ✗ 错误 (大小写敏感)
'ui\\widgets\\escmenu\\human\\button-background.blp'  // 小写路径可能找不到
```

### 常用资源路径

```typescript
// UI 控件纹理
'UI\\Widgets\\Console\\Human\\CommandButton-Up.blp'
'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp'
'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp'

// 游戏界面
'UI\\Glues\\SinglePlayer\\Campaign-Horde-Exp\\Campaign-Horde-Exp.blp'

// 纯色纹理
'Textures\\Black32.blp'
'Textures\\White32.blp'

// FDF 定义文件
'UI\\FrameDef\\UI\\EscMenuTemplates.fdf'
'UI\\FrameDef\\UI\\ConsoleUI.fdf'
```

## 性能优化

### 1. 文件缓存

MPQ 管理器会自动缓存文件列表和查找结果，重复读取相同文件速度很快。

### 2. 按需加载

只加载需要的 MPQ 档案：

```typescript
// 只加载包含 UI 资源的档案
await mpqManager.loadArchive('War3.mpq');
await mpqManager.loadArchive('War3x.mpq');
```

### 3. 批量操作

```typescript
// 一次性获取所有需要的文件
const textures = [
  'UI\\Widgets\\EscMenu\\Human\\button-background.blp',
  'UI\\Widgets\\Console\\Human\\CommandButton-Up.blp',
  // ...
];

const buffers = await Promise.all(
  textures.map(path => mpqManager.readFile(path))
);
```

## 错误处理

```typescript
try {
  const buffer = await mpqManager.readFile('NonExistent.blp');
  
  if (!buffer) {
    console.error('文件未找到');
  }
} catch (error) {
  console.error('读取失败:', error);
}

// 检查初始化状态
const status = mpqManager.getStatus();
if (status.archivesLoaded === 0) {
  console.error('没有加载任何 MPQ 档案');
}
```

## 已知限制

1. **大小写敏感**: MPQ 文件路径大小写敏感，必须使用正确的大小写
2. **内存占用**: 大量文件会占用较多内存（文件列表缓存）
3. **同步读取**: 当前实现为同步读取，大文件可能阻塞
4. **War3 1.27**: 主要针对 1.27 版本，其他版本可能需要调整

## 测试

运行测试套件：

```bash
npx tsx tests/mpq-manager.test.ts
```

## 技术参考

- [MPQ Archive Format](https://en.wikipedia.org/wiki/MPQ_(file_format))
- [StormLib Documentation](http://www.zezula.net/en/mpq/stormlib.html)
- [mpq-file NPM Package](https://www.npmjs.com/package/mpq-file)

## 许可证

MIT License
