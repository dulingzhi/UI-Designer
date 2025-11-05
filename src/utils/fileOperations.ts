import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { ProjectData, FrameData } from '../types';
import { createDefaultAnchors } from './anchorUtils';
import { parseFDF } from './fdf';  // 使用新的统一入口

// 数据迁移: 将旧版本的单锚点数据转换为锚点数组
function migrateProjectData(project: ProjectData): ProjectData {
  const migratedFrames: Record<string, FrameData> = {};
  
  // 第一步：确保所有控件都有必要的字段
  for (const [id, frame] of Object.entries(project.frames)) {
    // 如果frame没有anchors字段,从x/y/width/height创建默认锚点
    if (!frame.anchors || frame.anchors.length === 0) {
      migratedFrames[id] = {
        ...frame,
        anchors: createDefaultAnchors(frame.x, frame.y, frame.width, frame.height),
        children: frame.children || [] // 确保有children字段
      };
    } else {
      migratedFrames[id] = {
        ...frame,
        children: frame.children || [] // 确保有children字段
      };
    }
  }
  
  // 第二步：重建父子关系索引（修复可能损坏的children数组）
  // 先清空所有children数组
  for (const frame of Object.values(migratedFrames)) {
    frame.children = [];
  }
  
  // 根据每个控件的parentId重建父控件的children数组
  for (const [id, frame] of Object.entries(migratedFrames)) {
    if (frame.parentId && migratedFrames[frame.parentId]) {
      if (!migratedFrames[frame.parentId].children.includes(id)) {
        migratedFrames[frame.parentId].children.push(id);
      }
    }
  }
  
  return {
    ...project,
    frames: migratedFrames
  };
}

// 保存项目到文件
export async function saveProject(project: ProjectData, filePath?: string): Promise<string | null> {
  try {
    let path: string | null = filePath || null;
    
    // 如果没有提供路径，打开保存对话框
    if (!path) {
      path = await save({
        filters: [{
          name: 'WC3 UI Project',
          extensions: ['w3ui']
        }],
        defaultPath: 'myproject.w3ui'
      });
    }
    
    if (!path) return null; // 用户取消
    
    // 序列化项目数据
    const jsonData = JSON.stringify(project, null, 2);
    
    // 写入文件
    await writeTextFile(path, jsonData);
    
    return path;
  } catch (error) {
    console.error('保存项目失败:', error);
    throw error;
  }
}

// 从文件加载项目
export async function loadProject(): Promise<{ project: ProjectData; path: string } | null> {
  try {
    // 打开文件对话框
    const path = await open({
      filters: [{
        name: 'WC3 UI Project',
        extensions: ['w3ui']
      }],
      multiple: false
    });
    
    if (!path || Array.isArray(path)) return null; // 用户取消或选择了多个文件
    
    return await loadProjectFromPath(path);
  } catch (error) {
    console.error('加载项目失败:', error);
    throw error;
  }
}

// 从指定路径加载项目
export async function loadProjectFromPath(path: string): Promise<{ project: ProjectData; path: string } | null> {
  try {
    // 读取文件内容
    const jsonData = await readTextFile(path);
    
    // 解析 JSON
    let project = JSON.parse(jsonData) as ProjectData;
    
    // 数据迁移: 将旧版本数据转换为新版本
    project = migrateProjectData(project);
    
    return { project, path };
  } catch (error) {
    console.error('从路径加载项目失败:', error);
    throw error;
  }
}

// 导出代码到文件
export async function exportCode(code: string, language: 'jass' | 'lua' | 'ts'): Promise<string | null> {
  try {
    const extensions: Record<string, string[]> = {
      jass: ['j'],
      lua: ['lua'],
      ts: ['ts']
    };
    
    const path = await save({
      filters: [{
        name: `${language.toUpperCase()} File`,
        extensions: extensions[language]
      }],
      defaultPath: `ui_export.${extensions[language][0]}`
    });
    
    if (!path) return null;
    
    await writeTextFile(path, code);
    
    return path;
  } catch (error) {
    console.error('导出代码失败:', error);
    throw error;
  }
}

/**
 * 从FDF文件导入控件
 */
export async function importFromFDF(): Promise<FrameData[] | null> {
  try {
    // 打开FDF文件选择对话框
    const path = await open({
      filters: [{
        name: 'Frame Definition File',
        extensions: ['fdf']
      }],
      multiple: false
    });
    
    if (!path || Array.isArray(path)) return null;
    
    // 读取FDF文件内容
    const fdfContent = await readTextFile(path);
    
    // 解析FDF为FrameData数组
    const frames = parseFDF(fdfContent);
    
    return frames;
  } catch (error) {
    console.error('FDF导入失败:', error);
    throw error;
  }
}

