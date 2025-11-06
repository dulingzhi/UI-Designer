/**
 * MPQ 档案管理器
 * 
 * 用于加载和访问 Warcraft 3 客户端内的资源文件
 * 支持从多个 MPQ 档案中读取 BLP 纹理、FDF 文件等
 */

import MPQArchive from 'mpq-file';
import { open } from '@tauri-apps/plugin-dialog';
import { exists, readFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

/**
 * War3 1.27 标准 MPQ 档案列表
 */
const WAR3_127_MPQS = [
  'War3.mpq',
  'War3x.mpq',
  'War3xLocal.mpq',
  'War3Patch.mpq',
] as const;

/**
 * MPQ 档案信息
 */
interface MPQArchiveInfo {
  name: string;
  path: string;
  archive: MPQArchive | null;
  fileCount: number;
  loaded: boolean;
  error?: string;
}

/**
 * 文件搜索结果
 */
interface FileSearchResult {
  fileName: string;
  archiveName: string;
  size: number;
}

/**
 * MPQ 档案管理器
 */
export class MPQManager {
  private archives: Map<string, MPQArchiveInfo> = new Map();
  private war3Path: string = '';
  private fileListCache: Map<string, FileSearchResult> = new Map();
  
  /**
   * 设置 Warcraft 3 安装路径
   */
  async setWar3Path(path: string): Promise<void> {
    this.war3Path = path;
    
    // 清空现有档案
    this.unloadAll();
    
    console.log(`[MPQManager] War3 路径已设置: ${path}`);
  }
  
  /**
   * 选择 Warcraft 3 安装目录
   */
  async selectWar3Directory(): Promise<string | null> {
    try {
      const selected = await open({
        directory: true,
        title: '选择 Warcraft 3 安装目录',
      });
      
      if (!selected || Array.isArray(selected)) {
        return null;
      }
      
      // 验证是否为有效的 War3 目录
      const war3ExePath = await join(selected, 'war3.exe');
      const isValid = await exists(war3ExePath);
      
      if (!isValid) {
        throw new Error('所选目录不是有效的 Warcraft 3 安装目录');
      }
      
      await this.setWar3Path(selected);
      return selected;
      
    } catch (error) {
      console.error('[MPQManager] 选择目录失败:', error);
      throw error;
    }
  }
  
  /**
   * 加载所有标准 MPQ 档案
   */
  async loadStandardArchives(): Promise<{ success: number; failed: number }> {
    if (!this.war3Path) {
      throw new Error('未设置 Warcraft 3 路径');
    }
    
    let success = 0;
    let failed = 0;
    
    for (const mpqName of WAR3_127_MPQS) {
      try {
        const loaded = await this.loadArchive(mpqName);
        if (loaded) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[MPQManager] 加载 ${mpqName} 失败:`, error);
        failed++;
      }
    }
    
    console.log(`[MPQManager] MPQ 加载完成: ${success} 成功, ${failed} 失败`);
    return { success, failed };
  }
  
  /**
   * 加载单个 MPQ 档案
   */
  async loadArchive(mpqName: string): Promise<boolean> {
    try {
      const mpqPath = await join(this.war3Path, mpqName);
      
      // 检查文件是否存在
      const fileExists = await exists(mpqPath);
      if (!fileExists) {
        console.warn(`[MPQManager] MPQ 文件不存在: ${mpqPath}`);
        this.archives.set(mpqName, {
          name: mpqName,
          path: mpqPath,
          archive: null,
          fileCount: 0,
          loaded: false,
          error: '文件不存在',
        });
        return false;
      }
      
      // 读取 MPQ 文件
      const buffer = await readFile(mpqPath);
      
      // 创建 MPQ 档案实例
      const archive = new MPQArchive(buffer.buffer);
      
      // 获取文件列表
      const files = archive.getFileList();
      const fileCount = files.length;
      
      // 缓存文件列表
      files.forEach((fileName: string) => {
        this.fileListCache.set(fileName.toLowerCase(), {
          fileName,
          archiveName: mpqName,
          size: 0, // mpq-file 可能不提供大小信息
        });
      });
      
      // 保存档案信息
      this.archives.set(mpqName, {
        name: mpqName,
        path: mpqPath,
        archive,
        fileCount,
        loaded: true,
      });
      
      console.log(`[MPQManager] ✓ ${mpqName} 已加载 (${fileCount} 个文件)`);
      return true;
      
    } catch (error: any) {
      console.error(`[MPQManager] 加载 ${mpqName} 失败:`, error);
      this.archives.set(mpqName, {
        name: mpqName,
        path: '',
        archive: null,
        fileCount: 0,
        loaded: false,
        error: error.message,
      });
      return false;
    }
  }
  
  /**
   * 从 MPQ 中读取文件
   * @param filePath WC3 内部路径，如 "UI\\Widgets\\EscMenu\\Human\\button-background.blp"
   */
  async readFile(filePath: string): Promise<ArrayBuffer | null> {
    // 规范化路径 (统一使用反斜杠)
    const normalizedPath = filePath.replace(/\//g, '\\');
    const lowerPath = normalizedPath.toLowerCase();
    
    // 从缓存中查找文件所在的档案
    const cached = this.fileListCache.get(lowerPath);
    
    if (cached) {
      const archiveInfo = this.archives.get(cached.archiveName);
      if (archiveInfo?.archive) {
        try {
          const buffer = archiveInfo.archive.getFile(normalizedPath);
          return buffer;
        } catch (error) {
          console.error(`[MPQManager] 读取文件失败 (${cached.archiveName}): ${filePath}`, error);
        }
      }
    }
    
    // 如果缓存未命中，遍历所有档案查找
    for (const [archiveName, info] of this.archives.entries()) {
      if (!info.loaded || !info.archive) continue;
      
      try {
        const buffer = info.archive.getFile(normalizedPath);
        if (buffer) {
          console.log(`[MPQManager] ✓ 从 ${archiveName} 读取: ${filePath}`);
          
          // 更新缓存
          this.fileListCache.set(lowerPath, {
            fileName: normalizedPath,
            archiveName,
            size: buffer.byteLength,
          });
          
          return buffer;
        }
      } catch (error) {
        // 文件不在此档案中，继续查找
        continue;
      }
    }
    
    console.warn(`[MPQManager] 文件未找到: ${filePath}`);
    return null;
  }
  
  /**
   * 检查文件是否存在
   */
  async hasFile(filePath: string): Promise<boolean> {
    const normalizedPath = filePath.replace(/\//g, '\\').toLowerCase();
    
    // 先查缓存
    if (this.fileListCache.has(normalizedPath)) {
      return true;
    }
    
    // 尝试读取文件
    const buffer = await this.readFile(filePath);
    return buffer !== null;
  }
  
  /**
   * 搜索文件 (支持通配符)
   * @param pattern 搜索模式，如 "UI\\Widgets\\*.blp"
   */
  searchFiles(pattern: string): FileSearchResult[] {
    const normalizedPattern = pattern.replace(/\//g, '\\').toLowerCase();
    const regexPattern = normalizedPattern
      .replace(/\./g, '\\.')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`, 'i');
    
    const results: FileSearchResult[] = [];
    
    for (const [fileName, info] of this.fileListCache.entries()) {
      if (regex.test(fileName)) {
        results.push(info);
      }
    }
    
    return results;
  }
  
  /**
   * 列出目录中的文件
   * @param directory 目录路径，如 "UI\\Widgets\\EscMenu\\"
   */
  listDirectory(directory: string): FileSearchResult[] {
    const normalizedDir = directory.replace(/\//g, '\\').toLowerCase();
    const pattern = normalizedDir.endsWith('\\') 
      ? `${normalizedDir}*` 
      : `${normalizedDir}\\*`;
    
    return this.searchFiles(pattern);
  }
  
  /**
   * 获取所有 BLP 文件列表
   */
  getAllBLPFiles(): FileSearchResult[] {
    return this.searchFiles('*.blp');
  }
  
  /**
   * 获取 UI 目录下的所有 BLP 文件
   */
  getUIBLPFiles(): FileSearchResult[] {
    return this.searchFiles('UI\\*.blp');
  }
  
  /**
   * 卸载指定档案
   */
  unloadArchive(mpqName: string): void {
    const info = this.archives.get(mpqName);
    if (info) {
      // 从缓存中移除该档案的文件
      for (const [fileName, fileInfo] of this.fileListCache.entries()) {
        if (fileInfo.archiveName === mpqName) {
          this.fileListCache.delete(fileName);
        }
      }
      
      info.archive = null;
      info.loaded = false;
      
      console.log(`[MPQManager] ${mpqName} 已卸载`);
    }
  }
  
  /**
   * 卸载所有档案
   */
  unloadAll(): void {
    this.archives.clear();
    this.fileListCache.clear();
    console.log('[MPQManager] 所有 MPQ 档案已卸载');
  }
  
  /**
   * 获取档案状态信息
   */
  getStatus(): {
    war3Path: string;
    archivesLoaded: number;
    totalFiles: number;
    archives: Array<{
      name: string;
      loaded: boolean;
      fileCount: number;
      error?: string;
    }>;
  } {
    const archives = Array.from(this.archives.values()).map(info => ({
      name: info.name,
      loaded: info.loaded,
      fileCount: info.fileCount,
      error: info.error,
    }));
    
    const archivesLoaded = archives.filter(a => a.loaded).length;
    
    return {
      war3Path: this.war3Path,
      archivesLoaded,
      totalFiles: this.fileListCache.size,
      archives,
    };
  }
  
  /**
   * 导出文件列表到文本
   */
  exportFileList(): string {
    const files = Array.from(this.fileListCache.values())
      .sort((a, b) => a.fileName.localeCompare(b.fileName));
    
    let output = `MPQ 文件列表 (共 ${files.length} 个文件)\n`;
    output += `War3 路径: ${this.war3Path}\n`;
    output += '='.repeat(80) + '\n\n';
    
    let currentArchive = '';
    
    for (const file of files) {
      if (file.archiveName !== currentArchive) {
        currentArchive = file.archiveName;
        output += `\n[${currentArchive}]\n`;
      }
      output += `  ${file.fileName}\n`;
    }
    
    return output;
  }
}

/**
 * 全局 MPQ 管理器实例
 */
export const mpqManager = new MPQManager();

/**
 * 快捷函数: 初始化 MPQ 系统
 */
export async function initializeMPQ(war3Path?: string): Promise<boolean> {
  try {
    if (!war3Path) {
      war3Path = await mpqManager.selectWar3Directory() || undefined;
    }
    
    if (!war3Path) {
      return false;
    }
    
    await mpqManager.setWar3Path(war3Path);
    const result = await mpqManager.loadStandardArchives();
    
    return result.success > 0;
  } catch (error) {
    console.error('[MPQ] 初始化失败:', error);
    return false;
  }
}

/**
 * 快捷函数: 读取 WC3 资源文件
 */
export async function readWC3File(filePath: string): Promise<ArrayBuffer | null> {
  return mpqManager.readFile(filePath);
}
