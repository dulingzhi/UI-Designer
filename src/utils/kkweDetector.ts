// KKWE 检测器 - 检测 KKWE 安装并提供启动功能

import { invoke } from '@tauri-apps/api/core';
import { exists } from '@tauri-apps/plugin-fs';
import { mpqManager } from './mpqManager';

export interface KKWEInfo {
  installed: boolean;
  kkwePath?: string;
  launcherPath?: string;
  war3Path?: string;
}

/**
 * 检测 KKWE 安装
 */
export async function detectKKWE(): Promise<KKWEInfo> {
  try {
    // 获取用户名
    const username = await invoke<string>('get_username');
    const kkweBasePath = `C:\\Users\\${username}\\AppData\\Local\\KKWE`;
    
    const kkwePath = `${kkweBasePath}\\KKWE.exe`;
    const launcherPath = `${kkweBasePath}\\bin\\YDWEConfig.exe`;
    
    // 检查文件是否存在
    const kkweExists = await exists(kkwePath);
    const launcherExists = await exists(launcherPath);
    
    if (!kkweExists || !launcherExists) {
      return { installed: false };
    }
    
    // 从 MPQManager 获取 War3 路径
    const war3Path = mpqManager.getWar3Path();
    
    return {
      installed: true,
      kkwePath,
      launcherPath,
      war3Path: war3Path || undefined
    };
  } catch (error) {
    console.error('[KKWE] 检测失败:', error);
    return { installed: false };
  }
}

/**
 * 使用 KKWE 启动地图
 * @param mapPath 地图文件的绝对路径
 * @param kkweInfo KKWE 信息对象
 */
export async function launchMapWithKKWE(
  mapPath: string, 
  kkweInfo: KKWEInfo
): Promise<void> {
  if (!kkweInfo.installed || !kkweInfo.launcherPath) {
    throw new Error('KKWE 未安装或启动器路径无效');
  }
  
  // 规范化路径（统一使用反斜杠）
  const normalizedMapPath = mapPath.replace(/\//g, '\\');
  
  // 调用 Tauri 命令启动进程
  await invoke('launch_kkwe', {
    launcherPath: kkweInfo.launcherPath,
    mapPath: normalizedMapPath
  });
  
  console.log(`[KKWE] 启动地图: ${normalizedMapPath}`);
}
