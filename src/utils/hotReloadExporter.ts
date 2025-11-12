// 热重载导出器 - 导出 Lua 文件并管理热重载流程

import { writeTextFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { exportProjectToLua, generateLoaderScript } from './luaGenerator';
import { detectKKWE, launchMapWithKKWE } from './kkweDetector';
import type { ProjectData } from '../types';

export interface HotReloadConfig {
  enabled: boolean;
  outputPath: string;        // 生成的 UI 内容 Lua 文件路径
  loaderPath: string;        // 加载器 Lua 文件路径
  testMapPath: string;       // 测试地图路径
  autoLaunch: boolean;       // 导出后自动启动游戏
  debounceMs: number;        // 防抖延迟
}

/**
 * 获取默认的热重载配置
 * 根据War3路径和用户文档路径生成默认路径
 */
function getDefaultHotReloadConfig(): HotReloadConfig {
  // 尝试从localStorage获取War3路径
  const war3Path = localStorage.getItem('war3_install_path');
  
  let outputPath: string;
  let loaderPath: string;
  let testMapPath: string;
  
  if (war3Path) {
    // War3 1.27 路径 (从设置中获取的War3安装目录)
    // 规范化路径，确保使用反斜杠
    const normalizedPath = war3Path.replace(/\//g, '\\').replace(/\\+$/, '');
    outputPath = `${normalizedPath}\\UI-Designer\\ui_generated.lua`;
    loaderPath = `${normalizedPath}\\UI-Designer\\ui_loader.lua`;
    testMapPath = `${normalizedPath}\\Maps\\Test\\test.w3x`;
  } else {
    // War3 Reforged 路径 (默认文档目录)
    // 尝试从环境变量获取用户名，否则使用默认值
    const username = localStorage.getItem('system_username') || '81468';
    outputPath = `C:\\Users\\${username}\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_generated.lua`;
    loaderPath = `C:\\Users\\${username}\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_loader.lua`;
    testMapPath = `C:\\Users\\${username}\\Documents\\Warcraft III\\Maps\\Test\\test.w3x`;
  }
  
  return {
    enabled: false,
    outputPath,
    loaderPath,
    testMapPath,
    autoLaunch: false,
    debounceMs: 500
  };
}

export const DEFAULT_HOT_RELOAD_CONFIG: HotReloadConfig = getDefaultHotReloadConfig();

export class HotReloadExporter {
  private config: HotReloadConfig;
  private debounceTimer: number | null = null;
  private isExporting = false;
  
  constructor(config: HotReloadConfig) {
    this.config = config;
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<HotReloadConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  /**
   * 导出项目为 Lua 文件 (包含加载器和UI内容)
   * @param project 项目数据
   * @param force 强制导出，忽略 enabled 配置（用于手动导出和启动游戏）
   */
  async export(project: ProjectData, force: boolean = false): Promise<void> {
    // 只有自动导出时才检查 enabled 配置
    if (!force && !this.config.enabled) {
      console.log('[热重载] 自动导出已禁用，跳过导出');
      return;
    }
    
    if (this.isExporting) {
      console.log('[热重载] 正在导出，跳过重复请求');
      return;
    }
    
    try {
      this.isExporting = true;
      
      console.log(`[热重载] 开始导出 (${force ? '手动/启动' : '自动'})...`);
      
      // 确保目录存在
      const outputDir = this.config.outputPath.substring(0, this.config.outputPath.lastIndexOf('\\'));
      console.log(`[热重载] 确保目录存在: ${outputDir}`);
      
      try {
        await mkdir(outputDir, { recursive: true });
        console.log('[热重载] ✅ 目录已创建或已存在');
      } catch (error) {
        console.error('[热重载] 创建目录失败:', error);
        throw new Error(`创建目录失败: ${error}`);
      }
      
      // 生成 UI 内容 Lua 代码
      console.log('[热重载] 开始生成 UI 内容...');
      const uiCode = exportProjectToLua(project);
      
      // 写入 UI 内容文件
      console.log(`[热重载] 写入 UI 内容: ${this.config.outputPath}`);
      try {
        await writeTextFile(this.config.outputPath, uiCode);
        console.log(`[热重载] ✅ UI 内容导出成功`);
      } catch (error) {
        console.error('[热重载] 写入 UI 内容失败:', error);
        throw new Error(`写入 UI 内容失败: ${error}`);
      }
      
      // 生成加载器脚本 (仅在加载器不存在时生成)
      console.log('[热重载] 检查加载器是否存在:', this.config.loaderPath);
      
      let loaderExists = false;
      try {
        loaderExists = await exists(this.config.loaderPath);
        console.log('[热重载] 加载器存在性检查结果:', loaderExists);
      } catch (error) {
        console.error('[热重载] 检查加载器存在性失败:', error);
        console.log('[热重载] 跳过检查，直接生成加载器');
        loaderExists = false;
      }
      
      if (!loaderExists) {
        console.log('[热重载] 首次运行，生成加载器脚本...');
        const loaderCode = generateLoaderScript(project);
        try {
          await writeTextFile(this.config.loaderPath, loaderCode);
          console.log(`[热重载] ✅ 加载器脚本已生成: ${this.config.loaderPath}`);
        } catch (error) {
          console.error('[热重载] 写入加载器失败:', error);
          throw new Error(`写入加载器失败: ${error}`);
        }
      }
      
      console.log('[热重载] ✅ 导出完成');
      
      // 自动启动游戏 (War3 1.27)
      if (this.config.autoLaunch) {
        console.log('[热重载] 检测 KKWE...');
        const kkweInfo = await detectKKWE();
        if (kkweInfo.installed) {
          console.log('[热重载] 启动 War3 测试...');
          await launchMapWithKKWE(this.config.testMapPath, kkweInfo);
          console.log('[热重载] ✅ War3 已启动');
        } else {
          console.warn('[热重载] ⚠️ KKWE 未安装，跳过自动启动');
        }
      }
    } catch (error) {
      console.error('[热重载] ❌ 导出失败:', error);
      throw error;
    } finally {
      this.isExporting = false;
    }
  }
  
  /**
   * 带防抖的导出
   */
  exportDebounced(project: ProjectData): void {
    if (!this.config.enabled) {
      return;
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    
    console.log(`[热重载] 防抖延迟 ${this.config.debounceMs}ms...`);
    
    this.debounceTimer = window.setTimeout(() => {
      this.export(project).catch(error => {
        console.error('[热重载] 防抖导出失败:', error);
      });
    }, this.config.debounceMs);
  }
  
  /**
   * 取消待处理的导出
   */
  cancelPendingExport(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      console.log('[热重载] 取消待处理的导出');
    }
  }
}

// 单例导出器
let globalExporter: HotReloadExporter | null = null;

/**
 * 获取全局导出器实例
 */
export function getHotReloadExporter(config?: HotReloadConfig): HotReloadExporter {
  if (!globalExporter) {
    globalExporter = new HotReloadExporter(config || DEFAULT_HOT_RELOAD_CONFIG);
  } else if (config) {
    globalExporter.updateConfig(config);
  }
  return globalExporter;
}
