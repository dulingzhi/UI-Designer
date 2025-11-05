/**
 * 增强的 FDF 导入功能
 * 
 * 支持保留 FDF 元数据、模板继承、批量导入等
 */

import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { parseFDFToAST } from './fdf';
import { FDFTransformer } from './fdfTransformer';
import { FrameData, FDFMetadata, FDFTextureData, FDFStringData, FDFBackdropData } from '../types';
import { FDFFrameDefinition, FDFProperty } from './fdfAst';
import { templateManager } from './fdfTemplates';

/**
 * 增强的 FDF 导入（单文件）
 * 保留所有 FDF 元数据
 */
export async function importFromFDFEnhanced(): Promise<FrameData[]> {
  try {
    // 打开文件选择对话框
    const filePath = await open({
      multiple: false,
      filters: [
        {
          name: 'FDF Files',
          extensions: ['fdf'],
        },
      ],
    });

    if (!filePath) {
      console.log('[FDF Import] 用户取消选择');
      return [];
    }

    // 读取文件内容
    const content = await readTextFile(filePath as string);
    
    // 解析为 AST
    const ast = parseFDFToAST(content);
    
    // 转换为 FrameData（基础转换）
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);
    
    // 增强 FrameData（添加 FDF 元数据）
    const enhancedFrames = frames.map((frame: FrameData, index: number) => {
      const astNode = ast.body[index];
      if (astNode?.type === 'FrameDefinition') {
        return enhanceFrameWithFDF(frame, astNode as FDFFrameDefinition);
      }
      return frame;
    });
    
    console.log(`[FDF Import] 成功导入 ${enhancedFrames.length} 个控件`);
    return enhancedFrames;
  } catch (error) {
    console.error('[FDF Import] 导入失败', error);
    throw error;
  }
}

/**
 * 批量导入 FDF 文件夹
 * 将文件夹中的所有 .fdf 文件导入为模板
 */
export async function importFDFFolder(): Promise<number> {
  try {
    // 打开文件夹选择对话框
    const dirPath = await open({
      directory: true,
      multiple: false,
    });

    if (!dirPath) {
      console.log('[FDF Folder Import] 用户取消选择');
      return 0;
    }

    // 读取文件夹内容
    const entries = await readDir(dirPath as string);
    
    let totalLoaded = 0;
    
    for (const entry of entries) {
      if (entry.isFile && entry.name.endsWith('.fdf')) {
        try {
          const filePath = `${dirPath}/${entry.name}`;
          const count = await templateManager.loadTemplatesFromFile(filePath);
          totalLoaded += count;
          console.log(`[FDF Folder Import] 从 ${entry.name} 加载了 ${count} 个模板`);
        } catch (error) {
          console.error(`[FDF Folder Import] 加载文件失败: ${entry.name}`, error);
        }
      }
    }
    
    console.log(`[FDF Folder Import] 总共加载了 ${totalLoaded} 个模板`);
    return totalLoaded;
  } catch (error) {
    console.error('[FDF Folder Import] 批量导入失败', error);
    throw error;
  }
}

/**
 * 增强 FrameData，添加 FDF 元数据
 */
function enhanceFrameWithFDF(frame: FrameData, astNode: FDFFrameDefinition): FrameData {
  // 过滤出 FDFProperty 类型的属性
  const properties = astNode.properties.filter(
    (p): p is FDFProperty => p.type === 'Property'
  );
  
  // 构建 FDF 元数据
  const fdfMetadata: FDFMetadata = {
    inherits: astNode.inherits,
    rawProperties: extractRawProperties(properties),
  };
  
  // 提取 Texture 数据
  const fdfTexture = extractTextureData(properties);
  
  // 提取 String 数据
  const fdfString = extractStringData(properties);
  
  // 提取 Backdrop 数据
  const fdfBackdrop = extractBackdropData(properties);
  
  return {
    ...frame,
    fdfMetadata,
    fdfTexture,
    fdfString,
    fdfBackdrop,
  };
}

/**
 * 提取原始属性（保留 FDF 原始格式）
 */
function extractRawProperties(properties: FDFProperty[]): Record<string, any> {
  const raw: Record<string, any> = {};
  
  properties.forEach(prop => {
    if (prop.type === 'Property') {
      raw[prop.name] = extractPropertyValue(prop.value);
    }
  });
  
  return raw;
}

/**
 * 提取属性值
 */
function extractPropertyValue(value: any): any {
  if (!value) return null;
  
  switch (value.type) {
    case 'StringLiteral':
      return value.value;
    case 'NumberLiteral':
      return value.value;
    case 'Identifier':
      return value.name;
    case 'ArrayLiteral':
      return value.elements.map(extractPropertyValue);
    default:
      return null;
  }
}

/**
 * 提取 Texture 数据
 */
function extractTextureData(properties: FDFProperty[]): FDFTextureData | undefined {
  const textureFile = findProperty(properties, 'SetTexture');
  const texCoord = findProperty(properties, 'SetTexCoord');
  const alphaMode = findProperty(properties, 'SetAlphaMode');
  
  if (!textureFile && !texCoord && !alphaMode) {
    return undefined;
  }
  
  const alphaModeStr = alphaMode ? String(alphaMode).toUpperCase() : undefined;
  const validAlphaMode = alphaModeStr === 'ALPHAKEY' || alphaModeStr === 'BLEND' || alphaModeStr === 'ADD' 
    ? alphaModeStr 
    : undefined;
  
  return {
    file: textureFile ? String(textureFile) : '',
    texCoord: texCoord ? parseTexCoord(texCoord) : undefined,
    alphaMode: validAlphaMode,
  };
}

/**
 * 提取 String 数据
 */
function extractStringData(properties: FDFProperty[]): FDFStringData | undefined {
  const content = findProperty(properties, 'SetText');
  const font = findProperty(properties, 'SetFont');
  const fontSize = findProperty(properties, 'SetFontSize');
  const fontFlags = findProperty(properties, 'SetFontFlags');
  
  if (!content && !font && !fontSize && !fontFlags) {
    return undefined;
  }
  
  // fontFlags 可能是数组或字符串
  let fontFlagsArray: string[] | undefined;
  if (fontFlags) {
    if (Array.isArray(fontFlags)) {
      fontFlagsArray = fontFlags.map(f => String(f));
    } else {
      fontFlagsArray = [String(fontFlags)];
    }
  }
  
  return {
    content: content ? String(content) : '',
    font: font ? String(font) : undefined,
    fontSize: fontSize ? Number(fontSize) : undefined,
    fontFlags: fontFlagsArray,
  };
}

/**
 * 提取 Backdrop 数据
 */
function extractBackdropData(properties: FDFProperty[]): FDFBackdropData | undefined {
  const background = findProperty(properties, 'BackdropBackground');
  const edgeFile = findProperty(properties, 'BackdropEdgeFile');
  const cornerFlags = findProperty(properties, 'BackdropCornerFlags');
  
  if (!background && !edgeFile && !cornerFlags) {
    return undefined;
  }
  
  return {
    background: background ? String(background) : undefined,
    edgeFile: edgeFile ? String(edgeFile) : undefined,
    cornerFlags: cornerFlags ? String(cornerFlags) : undefined,
  };
}

/**
 * 查找属性值
 */
function findProperty(properties: FDFProperty[], name: string): any {
  const prop = properties.find(p => p.type === 'Property' && p.name === name);
  if (!prop || prop.type !== 'Property') return null;
  return extractPropertyValue(prop.value);
}

/**
 * 解析 TexCoord（4 个浮点数）
 */
function parseTexCoord(value: any): [number, number, number, number] | undefined {
  if (Array.isArray(value) && value.length === 4) {
    const coords = value.map(v => Number(v));
    if (coords.every(c => !isNaN(c))) {
      return coords as [number, number, number, number];
    }
  }
  return undefined;
}

/**
 * 从文本导入 FDF（不打开对话框）
 * 用于测试和编程式导入
 */
export function importFromFDFText(fdfText: string): FrameData[] {
  try {
    const ast = parseFDFToAST(fdfText);
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);
    
    const enhancedFrames = frames.map((frame: FrameData, index: number) => {
      const astNode = ast.body[index];
      if (astNode?.type === 'FrameDefinition') {
        return enhanceFrameWithFDF(frame, astNode as FDFFrameDefinition);
      }
      return frame;
    });
    
    return enhancedFrames;
  } catch (error) {
    console.error('[FDF Import] 从文本导入失败', error);
    throw error;
  }
}

/**
 * 应用模板到 FrameData
 * 如果 frame 有 INHERITS，自动展开继承
 */
export function applyTemplateInheritance(frame: FrameData): FrameData {
  const inherits = frame.fdfMetadata?.inherits;
  if (!inherits) return frame;
  
  return templateManager.applyTemplate(frame, inherits);
}

/**
 * 批量应用模板继承
 */
export function applyTemplateInheritanceToAll(frames: FrameData[]): FrameData[] {
  return frames.map(applyTemplateInheritance);
}
