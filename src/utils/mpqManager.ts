/**
 * MPQ 档案管理器
 * 
 * 用于加载和访问 Warcraft 3 客户端内的资源文件
 * 支持从多个 MPQ 档案中读取 BLP 纹理、FDF 文件等
 * 
 * 使用 Tauri 后端的 Rust MPQ 库来处理 MPQ 文件
 */

import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { exists } from '@tauri-apps/plugin-fs';

// MPQ 文件信息接口
interface MpqFileInfo {
  name: string;
  size: number;
}

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
  files: MpqFileInfo[];  // 文件列表
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
    
    // 自动加载标准 MPQ 档案
    console.log('[MPQManager] 开始加载 MPQ 档案...');
    const result = await this.loadStandardArchives();
    console.log(`[MPQManager] MPQ 加载结果: ${result.success} 成功, ${result.failed} 失败`);
    console.log(`[MPQManager] 文件缓存大小: ${this.fileListCache.size} 个文件`);
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
    
    console.log(`[MPQManager] 准备加载 ${WAR3_127_MPQS.length} 个 MPQ 档案...`);
    
    let success = 0;
    let failed = 0;
    
    for (const mpqName of WAR3_127_MPQS) {
      console.log(`[MPQManager] 正在加载: ${mpqName}...`);
      try {
        const loaded = await this.loadArchive(mpqName);
        if (loaded) {
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`[MPQManager] 加载 ${mpqName} 异常:`, error);
        failed++;
      }
    }
    
    console.log(`[MPQManager] ========================================`);
    console.log(`[MPQManager] MPQ 加载完成: ${success} 成功, ${failed} 失败`);
    console.log(`[MPQManager] 总文件数: ${this.fileListCache.size}`);
    console.log(`[MPQManager] ========================================`);
    return { success, failed };
  }
  
  /**
   * 加载单个 MPQ 档案
   */
  async loadArchive(mpqName: string): Promise<boolean> {
    try {
      const mpqPath = await join(this.war3Path, mpqName);
      console.log(`[MPQManager]   检查文件: ${mpqPath}`);
      
      console.log(`[MPQManager]   调用 Rust 后端加载 MPQ...`);
      
      // 使用 Tauri 后端加载 MPQ 档案
      const files = await invoke<MpqFileInfo[]>('load_mpq_archive', { path: mpqPath });
      const fileCount = files.length;
      console.log(`[MPQManager]   找到 ${fileCount} 个文件`);
      
      // 缓存文件列表
      let cachedCount = 0;
      files.forEach((file) => {
        this.fileListCache.set(file.name.toLowerCase(), {
          fileName: file.name,
          archiveName: mpqName,
          size: file.size,
        });
        cachedCount++;
      });
      console.log(`[MPQManager]   缓存了 ${cachedCount} 个文件路径`);
      
      // 保存档案信息
      this.archives.set(mpqName, {
        name: mpqName,
        path: mpqPath,
        files,
        fileCount,
        loaded: true,
      });
      
      console.log(`[MPQManager]   ✓✓✓ ${mpqName} 加载成功 (${fileCount} 个文件)`);
      return true;
      
    } catch (error: any) {
      console.error(`[MPQManager]   ✗✗✗ 加载 ${mpqName} 失败:`, error);
      console.error(`[MPQManager]   错误详情:`, error.stack || error.message);
      this.archives.set(mpqName, {
        name: mpqName,
        path: '',
        files: [],
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
      if (archiveInfo?.loaded) {
        try {
          // 使用 Tauri 后端读取文件
          const data = await invoke<number[]>('read_mpq_file', {
            archivePath: archiveInfo.path,
            fileName: normalizedPath
          });
          // 将数字数组转换为 ArrayBuffer
          return new Uint8Array(data).buffer;
        } catch (error: any) {
          // 如果是内部错误，静默失败，不记录日志（避免控制台污染）
          const errorMsg = error?.message || String(error);
          if (errorMsg.includes('内部错误')) {
            // 从缓存中移除这个有问题的文件
            this.fileListCache.delete(lowerPath);
            // 静默返回 null，让调用者处理
            return null;
          }
          // 其他错误才记录
          console.warn(`[MPQManager] 读取文件失败 (${cached.archiveName}): ${filePath}`, errorMsg);
        }
      }
    }
    
    // 如果缓存未命中，遍历所有档案查找（但跳过详细日志）
    for (const [archiveName, info] of this.archives.entries()) {
      if (!info.loaded) continue;
      
      try {
        // 使用 Tauri 后端读取文件
        const data = await invoke<number[]>('read_mpq_file', {
          archivePath: info.path,
          fileName: normalizedPath
        });
        
        if (data && data.length > 0) {
          // 只在成功时记录日志
          // console.log(`[MPQManager] ✓ 从 ${archiveName} 读取: ${filePath}`);
          
          // 更新缓存
          this.fileListCache.set(lowerPath, {
            fileName: normalizedPath,
            archiveName,
            size: data.length,
          });
          
          // 将数字数组转换为 ArrayBuffer
          return new Uint8Array(data).buffer;
        }
      } catch (error: any) {
        // 如果是内部错误，静默跳过
        const errorMsg = error?.message || String(error);
        if (errorMsg.includes('内部错误')) {
          continue;
        }
        // 其他错误继续查找
        continue;
      }
    }
    
    // 只在真正找不到时记录一次警告
    // console.warn(`[MPQManager] 文件未找到: ${filePath}`);
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
   * 列出目录中的文件（不包括子目录）
   * @param directory 目录路径，如 "UI\\Widgets\\EscMenu\\"
   */
  listDirectory(directory: string): FileSearchResult[] {
    const normalizedDir = directory.replace(/\//g, '\\').toLowerCase();
    console.log(`[MPQManager] listDirectory - 目录: ${normalizedDir}`);
    
    const results: FileSearchResult[] = [];
    
    for (const fileInfo of this.fileListCache.values()) {
      const fileName = fileInfo.fileName.toLowerCase();
      
      // 跳过地图文件内部的路径（检查路径的第一部分）
      const firstPart = fileName.split(/[/\\]/)[0];
      if (firstPart && firstPart.match(/\.(w3m|w3x)$/)) {
        continue;
      }
      
      // 检查文件是否在该目录下
      if (!fileName.startsWith(normalizedDir)) {
        continue;
      }
      
      // 获取相对路径
      const relativePath = fileName.substring(normalizedDir.length);
      
      // 只返回直接在该目录下的文件（不在子目录中）
      // 即相对路径中不应该包含 \ 或 /
      if (!relativePath.includes('\\') && !relativePath.includes('/')) {
        results.push(fileInfo);
      }
    }
    
    console.log(`[MPQManager] listDirectory - 找到 ${results.length} 个文件`);
    if (results.length > 0 && results.length <= 5) {
      console.log(`[MPQManager] listDirectory - 文件列表:`, results.map(r => r.fileName));
    }
    return results;
  }

  /**
   * 获取目录树结构
   * @param rootPath 根路径，如 "UI\\" 或 "" (空字符串表示根目录)
   * @returns 目录树节点数组
   */
  getDirectoryTree(rootPath: string = ''): string[] {
    const normalizedRoot = rootPath.replace(/\//g, '\\').toLowerCase();
    const directories = new Set<string>();
    
    // 遍历所有文件，提取目录结构
    for (const fileInfo of this.fileListCache.values()) {
      const fileName = fileInfo.fileName.toLowerCase();
      
      // 如果指定了根路径，只处理该路径下的文件
      if (normalizedRoot && !fileName.startsWith(normalizedRoot)) {
        continue;
      }
      
      // 提取相对于根路径的部分
      const relativePath = normalizedRoot 
        ? fileName.substring(normalizedRoot.length)
        : fileName;
      
      // 分割路径，获取所有目录层级
      const parts = relativePath.split('\\').filter(Boolean);
      
      // 构建所有层级的目录路径
      let currentPath = normalizedRoot;
      for (let i = 0; i < parts.length - 1; i++) { // -1 因为最后一部分是文件名
        currentPath += parts[i] + '\\';
        directories.add(currentPath);
      }
    }
    
    return Array.from(directories).sort();
  }

  /**
   * 获取根目录列表
   */
  getRootDirectories(): string[] {
    console.log(`[MPQManager] getRootDirectories - 文件缓存大小: ${this.fileListCache.size}`);
    const rootDirs = new Set<string>();
    
    for (const fileInfo of this.fileListCache.values()) {
      const fileName = fileInfo.fileName;
      const parts = fileName.split(/[/\\]/).filter(Boolean);
      
      if (parts.length > 0) {
        const rootDir = parts[0];
        
        // 跳过地图文件（以 .w3m 或 .w3x 结尾）
        if (rootDir.toLowerCase().match(/\.(w3m|w3x)$/)) {
          continue;
        }
        
        // 只添加真正的目录（至少有2个路径部分，即包含子路径）
        if (parts.length > 1) {
          rootDirs.add(rootDir + '\\');
        }
      }
    }
    
    const result = Array.from(rootDirs).sort();
    console.log(`[MPQManager] getRootDirectories - 找到 ${result.length} 个根目录:`, result.slice(0, 10));
    return result;
  }

  /**
   * 获取指定目录的直接子目录
   * @param directory 目录路径
   */
  getSubDirectories(directory: string): string[] {
    const normalizedDir = directory.replace(/\//g, '\\').toLowerCase();
    console.log(`[MPQManager] getSubDirectories - 目录: ${normalizedDir}`);
    const subDirs = new Set<string>();
    
    let matchCount = 0;
    for (const fileInfo of this.fileListCache.values()) {
      const fileName = fileInfo.fileName.toLowerCase();
      
      // 跳过地图文件内部的路径（检查路径的第一部分）
      const firstPart = fileName.split(/[/\\]/)[0];
      if (firstPart && firstPart.match(/\.(w3m|w3x)$/)) {
        continue;
      }
      
      // 只处理该目录下的文件
      if (!fileName.startsWith(normalizedDir)) {
        continue;
      }
      
      matchCount++;
      
      // 获取相对路径
      const relativePath = fileName.substring(normalizedDir.length);
      const parts = relativePath.split(/[/\\]/).filter(Boolean);
      
      // 如果有多于1个部分，第一个部分就是子目录
      if (parts.length > 1) {
        subDirs.add(normalizedDir + parts[0] + '\\');
      }
    }
    
    const result = Array.from(subDirs).sort();
    console.log(`[MPQManager] getSubDirectories - 匹配文件: ${matchCount}, 子目录: ${result.length}`, result.slice(0, 5));
    return result;
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
      
      info.files = [];
      info.loaded = false;
      
      console.log(`[MPQManager] ${mpqName} 已卸载`);
    }
  }
  
  /**
   * 卸载所有档案
   */
  unloadAll(): void {
    const archiveCount = this.archives.size;
    const fileCount = this.fileListCache.size;
    
    this.archives.clear();
    this.fileListCache.clear();
    
    // 清理 Rust 后端的缓存
    invoke('clear_mpq_cache').catch(err => {
      console.warn('[MPQManager] 清理后端缓存失败:', err);
    });
    
    console.log(`[MPQManager] 所有 MPQ 档案已卸载 (清除了 ${archiveCount} 个档案, ${fileCount} 个文件)`);
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
