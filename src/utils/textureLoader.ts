/**
 * 纹理加载器
 * 
 * 统一的纹理加载接口，支持：
 * - 本地文件路径 (绝对路径)
 * - WC3 资源路径 (从 MPQ 档案读取)
 * - Data URL (base64 编码)
 * - HTTP URL
 * 
 * 集成了 BLP 解码器和 MPQ 管理器
 */

import { readFile } from '@tauri-apps/plugin-fs';
import { mpqManager } from './mpqManager';
import { decodeBLPToDataURL } from './blpDecoder';

/**
 * WC3 内置纹理名称映射表
 * 将内置纹理名称映射到实际的文件路径
 */
const WC3_BUILTIN_TEXTURES: Record<string, string> = {
  // UI 边框和背景
  'EscMenuBackground': 'UI\\Widgets\\EscMenu\\Human\\background.blp',
  'EscMenuBorder': 'UI\\Widgets\\EscMenu\\Human\\border.blp',
  'ToolTipBackground': 'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp',
  'ToolTipBorder': 'UI\\Widgets\\ToolTips\\Human\\human-tooltip-border.blp',
  'QuestBorder': 'UI\\Widgets\\QuestDialog\\questborder.blp',
  'CommandButton': 'UI\\Widgets\\Console\\Human\\CommandButton\\human-commandbutton.blp',
  'CommandButtonBorder': 'UI\\Widgets\\Console\\Human\\CommandButton\\human-commandbutton-border.blp',
  'CommandButtonDisabled': 'UI\\Widgets\\Console\\Human\\CommandButton\\human-commandbutton-disabled.blp',
  
  // 资源图标
  'GoldIcon': 'UI\\Widgets\\Console\\Human\\gold.blp',
  'LumberIcon': 'UI\\Widgets\\Console\\Human\\lumber.blp',
  'SupplyIcon': 'UI\\Widgets\\Console\\Human\\supply.blp',
  'FoodIcon': 'UI\\Widgets\\Console\\Human\\food.blp',
  
  // 控件元素
  'QuestButtonIcon': 'UI\\Widgets\\BattleNet\\bnet-button-quest.blp',
  'HighlightAlpha': 'UI\\Widgets\\EscMenu\\Human\\editbox-highlight.blp',
  'Feedback': 'Textures\\Feedback.blp',
  'SelectionCircle': 'UI\\Feedback\\SelectionCircle\\SelectionCircle.blp',
  
  // 添加更多内置纹理...
};

/**
 * 纹理类型
 */
export enum TextureType {
  LOCAL_FILE = 'local',      // 本地文件路径
  WC3_PATH = 'wc3',          // WC3 资源路径
  WC3_BUILTIN = 'builtin',   // WC3 内置纹理名称
  DATA_URL = 'data',         // Data URL
  HTTP_URL = 'http',         // HTTP(S) URL
  UNKNOWN = 'unknown',
}

/**
 * 纹理信息
 */
export interface TextureInfo {
  path: string;              // 原始路径
  type: TextureType;         // 纹理类型
  url: string;               // 可用的 URL (Data URL 或 HTTP URL)
  width?: number;            // 宽度
  height?: number;           // 高度
  size?: number;             // 文件大小
  cached: boolean;           // 是否已缓存
}

/**
 * 纹理缓存项
 */
interface TextureCacheEntry {
  url: string;
  info: TextureInfo;
  timestamp: number;
  accessCount: number;
}

/**
 * 纹理加载器类
 */
export class TextureLoader {
  private cache: Map<string, TextureCacheEntry> = new Map();
  private loadingPromises: Map<string, Promise<string>> = new Map();
  private maxCacheSize: number = 100; // 最大缓存数量
  private maxCacheAge: number = 30 * 60 * 1000; // 30分钟过期
  
  /**
   * 判断纹理类型
   */
  getTextureType(path: string): TextureType {
    if (!path) return TextureType.UNKNOWN;
    
    // Data URL
    if (path.startsWith('data:')) {
      return TextureType.DATA_URL;
    }
    
    // HTTP(S) URL
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return TextureType.HTTP_URL;
    }
    
    // 绝对路径 (Windows: C:\, D:\, Linux: /) - 需要在 WC3 路径判断之前
    if (/^[a-zA-Z]:[\\\/]/.test(path) || path.startsWith('/')) {
      return TextureType.LOCAL_FILE;
    }
    
    // WC3 路径 (包含反斜杠或以 UI/Textures 开头)
    if (path.includes('\\') || path.startsWith('UI/') || path.startsWith('Textures/')) {
      return TextureType.WC3_PATH;
    }
    
    // WC3 内置纹理名称 (不含路径分隔符的纯名称)
    if (WC3_BUILTIN_TEXTURES[path]) {
      return TextureType.WC3_BUILTIN;
    }
    
    return TextureType.UNKNOWN;
  }
  
  /**
   * 加载纹理
   * @param path 纹理路径
   * @param forceReload 强制重新加载（忽略缓存）
   * @returns Data URL 或 HTTP URL
   */
  async loadTexture(path: string, forceReload: boolean = false): Promise<string> {
    if (!path) {
      throw new Error('纹理路径不能为空');
    }
    
    // 检查缓存
    if (!forceReload) {
      const cached = this.getFromCache(path);
      if (cached) {
        return cached.url;
      }
    }
    
    // 检查是否正在加载
    if (this.loadingPromises.has(path)) {
      return this.loadingPromises.get(path)!;
    }
    
    // 开始加载
    const loadPromise = this._loadTexture(path);
    this.loadingPromises.set(path, loadPromise);
    
    try {
      const url = await loadPromise;
      return url;
    } finally {
      this.loadingPromises.delete(path);
    }
  }
  
  /**
   * 实际的加载逻辑
   */
  private async _loadTexture(path: string): Promise<string> {
    const type = this.getTextureType(path);
    
    let url: string;
    let size: number | undefined;
    
    try {
      switch (type) {
        case TextureType.DATA_URL:
          // Data URL 直接使用
          url = path;
          break;
          
        case TextureType.HTTP_URL:
          // HTTP URL 直接使用
          url = path;
          break;
          
        case TextureType.WC3_BUILTIN:
          // 内置纹理名称 - 转换为实际路径后加载
          const actualPath = WC3_BUILTIN_TEXTURES[path];
          url = await this.loadWC3Texture(actualPath);
          break;
          
        case TextureType.WC3_PATH:
          // 从 MPQ 读取并解码
          url = await this.loadWC3Texture(path);
          break;
          
        case TextureType.LOCAL_FILE:
          // 读取本地文件
          url = await this.loadLocalTexture(path);
          break;
          
        default:
          throw new Error(`不支持的纹理路径: ${path}`);
      }
      
      // 缓存结果
      this.addToCache(path, url, type, size);
      
      return url;
      
    } catch (error) {
      // 只在非常规错误时记录详细日志
      // "WC3 纹理未找到" 是正常情况（某些文件在 listfile 中但实际不存在或无法读取）
      if (error instanceof Error && !error.message.includes('WC3 纹理未找到')) {
        console.error(`[TextureLoader] 加载失败: ${path}`, error);
      }
      throw error;
    }
  }
  
  /**
   * 加载 WC3 纹理 (从 MPQ)
   */
  private async loadWC3Texture(wc3Path: string): Promise<string> {
    // 规范化路径
    const normalizedPath = wc3Path.replace(/\//g, '\\');
    
    // 从 MPQ 读取
    const buffer = await mpqManager.readFile(normalizedPath);
    
    if (!buffer) {
      // 静默失败，不记录日志（很多文件在 listfile 中但无法读取）
      throw new Error(`WC3 纹理未找到: ${wc3Path}`);
    }
    
    // 检查是否为 BLP 格式
    if (normalizedPath.toLowerCase().endsWith('.blp')) {
      // 解码 BLP
      return await decodeBLPToDataURL(buffer);
    } else {
      // 其他格式 (TGA, PNG, JPG) - 创建 Blob URL
      const blob = new Blob([buffer], { type: this.getMimeType(normalizedPath) });
      return URL.createObjectURL(blob);
    }
  }
  
  /**
   * 加载本地纹理文件
   */
  private async loadLocalTexture(filePath: string): Promise<string> {
    try {
      // 读取文件
      const buffer = await readFile(filePath);
      
      // 检查是否为 BLP 格式
      if (filePath.toLowerCase().endsWith('.blp')) {
        // 解码 BLP
        return await decodeBLPToDataURL(buffer.buffer);
      } else {
        // 其他格式 - 创建 Blob URL
        const blob = new Blob([buffer], { type: this.getMimeType(filePath) });
        return URL.createObjectURL(blob);
      }
    } catch (error) {
      throw new Error(`读取本地文件失败: ${filePath}`);
    }
  }
  
  /**
   * 获取 MIME 类型
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'bmp': return 'image/bmp';
      case 'webp': return 'image/webp';
      case 'tga': return 'image/tga';
      case 'blp': return 'image/blp';
      default: return 'application/octet-stream';
    }
  }
  
  /**
   * 从缓存获取
   */
  private getFromCache(path: string): TextureCacheEntry | null {
    const entry = this.cache.get(path);
    
    if (!entry) {
      return null;
    }
    
    // 检查是否过期
    const age = Date.now() - entry.timestamp;
    if (age > this.maxCacheAge) {
      this.cache.delete(path);
      // 释放 Blob URL
      if (entry.url.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url);
      }
      return null;
    }
    
    // 更新访问计数
    entry.accessCount++;
    
    return entry;
  }
  
  /**
   * 添加到缓存
   */
  private addToCache(path: string, url: string, type: TextureType, size?: number): void {
    // 检查缓存大小
    if (this.cache.size >= this.maxCacheSize) {
      this.evictLRU();
    }
    
    this.cache.set(path, {
      url,
      info: {
        path,
        type,
        url,
        size,
        cached: true,
      },
      timestamp: Date.now(),
      accessCount: 1,
    });
  }
  
  /**
   * LRU 缓存清理
   */
  private evictLRU(): void {
    let lruPath: string | null = null;
    let lruScore = Infinity;
    
    // 找到访问次数最少且最久未访问的项
    for (const [path, entry] of this.cache.entries()) {
      const score = entry.accessCount * 1000 + (Date.now() - entry.timestamp);
      if (score < lruScore) {
        lruScore = score;
        lruPath = path;
      }
    }
    
    if (lruPath) {
      const entry = this.cache.get(lruPath);
      this.cache.delete(lruPath);
      
      // 释放 Blob URL
      if (entry && entry.url.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url);
      }
    }
  }
  
  /**
   * 预加载纹理列表
   */
  async preloadTextures(paths: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    
    const promises = paths.map(async (path) => {
      try {
        const url = await this.loadTexture(path);
        results.set(path, url);
      } catch (error) {
        console.error(`[TextureLoader] 预加载失败: ${path}`, error);
      }
    });
    
    await Promise.all(promises);
    
    return results;
  }
  
  /**
   * 获取纹理信息
   */
  async getTextureInfo(path: string): Promise<TextureInfo> {
    const cached = this.getFromCache(path);
    
    if (cached) {
      return cached.info;
    }
    
    const type = this.getTextureType(path);
    const url = await this.loadTexture(path);
    
    return {
      path,
      type,
      url,
      cached: this.cache.has(path),
    };
  }
  
  /**
   * 检查纹理是否存在
   */
  async hasTexture(path: string): Promise<boolean> {
    const type = this.getTextureType(path);
    
    switch (type) {
      case TextureType.WC3_BUILTIN:
        // 内置纹理 - 检查映射后的实际路径
        const actualPath = WC3_BUILTIN_TEXTURES[path];
        return await mpqManager.hasFile(actualPath.replace(/\//g, '\\'));
      
      case TextureType.WC3_PATH:
        return await mpqManager.hasFile(path.replace(/\//g, '\\'));
        
      case TextureType.DATA_URL:
      case TextureType.HTTP_URL:
        return true;
        
      case TextureType.LOCAL_FILE:
        try {
          await readFile(path);
          return true;
        } catch {
          return false;
        }
        
      default:
        return false;
    }
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    // 释放所有 Blob URL
    for (const entry of this.cache.values()) {
      if (entry.url.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url);
      }
    }
    
    this.cache.clear();
    console.log('[TextureLoader] 缓存已清空');
  }
  
  /**
   * 移除指定缓存
   */
  removeFromCache(path: string): void {
    const entry = this.cache.get(path);
    
    if (entry) {
      if (entry.url.startsWith('blob:')) {
        URL.revokeObjectURL(entry.url);
      }
      this.cache.delete(path);
    }
  }
  
  /**
   * 获取缓存状态
   */
  getCacheStatus(): {
    size: number;
    maxSize: number;
    entries: Array<{
      path: string;
      type: TextureType;
      size?: number;
      accessCount: number;
      age: number;
    }>;
  } {
    const entries = Array.from(this.cache.entries()).map(([path, entry]) => ({
      path,
      type: entry.info.type,
      size: entry.info.size,
      accessCount: entry.accessCount,
      age: Date.now() - entry.timestamp,
    }));
    
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      entries,
    };
  }
  
  /**
   * 设置缓存选项
   */
  setCacheOptions(options: { maxSize?: number; maxAge?: number }): void {
    if (options.maxSize !== undefined) {
      this.maxCacheSize = options.maxSize;
    }
    
    if (options.maxAge !== undefined) {
      this.maxCacheAge = options.maxAge;
    }
  }
}

/**
 * 全局纹理加载器实例
 */
export const textureLoader = new TextureLoader();

/**
 * 快捷函数: 加载纹理
 */
export async function loadTexture(path: string): Promise<string> {
  return textureLoader.loadTexture(path);
}

/**
 * 快捷函数: 预加载纹理
 */
export async function preloadTextures(paths: string[]): Promise<Map<string, string>> {
  return textureLoader.preloadTextures(paths);
}

/**
 * 快捷函数: 检查纹理是否存在
 */
export async function hasTexture(path: string): Promise<boolean> {
  return textureLoader.hasTexture(path);
}
