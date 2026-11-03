/**
 * FDF 模板管理器
 * 
 * 管理 FDF 模板的注册、解析和应用
 */

import { FDFFrameDefinition, FDFProperty, FDFNodeType } from './fdfAst';
import { parseFDFToAST } from './fdf';
import { FrameData, FDFTemplate, FDFTextureData, FDFStringData, FDFBackdropData } from '../types';
import { readTextFile } from '@tauri-apps/plugin-fs';

/**
 * 决策项 3：模板属性写回可编辑字段的白名单（与 fdfImport.enhanceFrameWithFDF 同语义——
 * 只写"编辑器有对应可编辑字段"的属性；几何 Width/Height 语义复杂不在此列）。
 * 键为 FDF 属性名，值为 FrameData 字段名。
 */
const TEMPLATE_WRITEBACK_FIELDS: Record<string, string> = {
  BackdropBackground: 'backdropBackground',
  BackdropEdgeFile: 'backdropEdgeFile',
  BackdropCornerFile: 'backdropCornerFile',
  BackdropTopFile: 'backdropTopFile',
  BackdropBottomFile: 'backdropBottomFile',
  BackdropLeftFile: 'backdropLeftFile',
  BackdropRightFile: 'backdropRightFile',
  BackdropCornerFlags: 'backdropCornerFlags',
  BackdropBackgroundSize: 'backdropBackgroundSize',
  BackdropBackgroundInsets: 'backdropBackgroundInsets',
  BackdropTileBackground: 'backdropTileBackground',
  ControlBackdrop: 'controlBackdrop',
  ControlDisabledBackdrop: 'controlDisabledBackdrop',
  ControlPushedBackdrop: 'controlPushedBackdrop',
  ControlMouseOverHighlight: 'controlMouseOverHighlight',
  ControlStyle: 'controlStyle',
  HighlightType: 'highlightType',
  HighlightAlphaFile: 'highlightAlphaFile',
  HighlightAlphaMode: 'highlightAlphaMode',
  Text: 'text',
};

/**
 * 把模板 rawProperties 中命中白名单的属性写回可编辑字段。
 * 写回值 = rawProperties 值（字符串），undefined/空串不覆盖（同 fdfImport 惯例）。
 */
function writeBackTemplateFields(frame: FrameData, rawProperties: Record<string, any>): FrameData {
  const patch: Record<string, any> = {};
  for (const [fdfName, fieldName] of Object.entries(TEMPLATE_WRITEBACK_FIELDS)) {
    const v = rawProperties[fdfName];
    if (v !== undefined && v !== '') patch[fieldName] = v;
  }
  return Object.keys(patch).length > 0 ? { ...frame, ...patch } : frame;
}

export class FDFTemplateManager {
  private templates: Map<string, FDFFrameDefinition> = new Map();
  
  /**
   * 注册单个模板
   */
  registerTemplate(name: string, template: FDFFrameDefinition) {
    this.templates.set(name, template);
    console.log(`[TemplateManager] 注册模板: ${name}`);
  }
  
  /**
   * 批量注册模板
   */
  registerTemplates(templates: Map<string, FDFFrameDefinition>) {
    templates.forEach((template, name) => {
      this.registerTemplate(name, template);
    });
  }
  
  /**
   * 获取模板
   */
  getTemplate(name: string): FDFFrameDefinition | undefined {
    return this.templates.get(name);
  }
  
  /**
   * 检查模板是否存在
   */
  hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }
  
  /**
   * 获取所有模板名称
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }
  
  /**
   * 从 FDF 文件加载模板库
   */
  async loadTemplatesFromFile(fdfPath: string): Promise<number> {
    try {
      const content = await readTextFile(fdfPath);
      return this.loadTemplatesFromText(content);
    } catch (error) {
      console.error(`[TemplateManager] 加载模板文件失败: ${fdfPath}`, error);
      throw error;
    }
  }
  
  /**
   * 从 FDF 文本加载模板
   */
  loadTemplatesFromText(fdfText: string): number {
    try {
      const ast = parseFDFToAST(fdfText);
      let count = 0;
      
      ast.body.forEach(node => {
        if (node.type === 'FrameDefinition') {
          this.registerTemplate(node.name, node);
          count++;
        }
      });
      
      console.log(`[TemplateManager] 从 FDF 文本加载了 ${count} 个模板`);
      return count;
    } catch (error) {
      console.error('[TemplateManager] 解析 FDF 文本失败', error);
      throw error;
    }
  }
  
  /**
   * 解析 INHERITS 继承链
   * 返回合并后的属性（子类覆盖父类）
   */
  resolveInheritance(frameName: string): FDFFrameDefinition | null {
    const visited = new Set<string>();
    const inheritanceChain: FDFFrameDefinition[] = [];
    
    let currentName: string | undefined = frameName;
    
    // 沿继承链向上查找
    while (currentName) {
      if (visited.has(currentName)) {
        console.error(`[TemplateManager] 检测到循环继承: ${currentName}`);
        return null;
      }
      
      const template = this.getTemplate(currentName);
      if (!template) {
        console.warn(`[TemplateManager] 模板不存在: ${currentName}`);
        break;
      }
      
      visited.add(currentName);
      inheritanceChain.push(template);
      currentName = template.inherits;
    }
    
    // 从父类到子类合并属性
    if (inheritanceChain.length === 0) return null;
    
    const merged = { ...inheritanceChain[inheritanceChain.length - 1] };
    
    for (let i = inheritanceChain.length - 2; i >= 0; i--) {
      const child = inheritanceChain[i];
      // 合并属性（子类覆盖父类）
      merged.properties = [...merged.properties, ...child.properties];
    }
    
    return merged;
  }
  
  /**
   * 应用模板到 FrameData
   */
  applyTemplate(frame: FrameData, templateName: string): FrameData {
    const resolved = this.resolveInheritance(templateName);
    if (!resolved) {
      console.warn(`[TemplateManager] 无法解析模板: ${templateName}`);
      return frame;
    }
    
    const properties = resolved.properties.filter(
      (p): p is FDFProperty => p.type === FDFNodeType.PROPERTY
    );
    
    const rawProperties: Record<string, any> = {};
    properties.forEach(prop => {
      rawProperties[prop.name] = extractPropValue(prop.value);
    });
    
    const fdfTexture = extractTemplateTexture(properties);
    const fdfString = extractTemplateString(properties);
    const fdfBackdrop = extractTemplateBackdrop(properties);
    
    const withMetadata: FrameData = {
      ...frame,
      fdfMetadata: {
        ...frame.fdfMetadata,
        inherits: templateName,
        rawProperties,
      },
      ...(fdfTexture && { fdfTexture }),
      ...(fdfString && { fdfString }),
      ...(fdfBackdrop && { fdfBackdrop }),
    };
    // 决策项 3：继承属性真写回可编辑字段——属性面板可见、导出按字段一致
    return writeBackTemplateFields(withMetadata, rawProperties);
  }
  
  /**
   * 导出模板为简化格式（用于保存到项目文件）
   */
  exportTemplates(): Record<string, FDFTemplate> {
    const exported: Record<string, FDFTemplate> = {};
    
    this.templates.forEach((template, name) => {
      exported[name] = {
        name: template.name,
        frameType: template.frameType,
        inherits: template.inherits,
        properties: this.serializeProperties(template.properties),
      };
    });
    
    return exported;
  }
  
  /**
   * 序列化属性（简化存储）
   */
  private serializeProperties(properties: any[]): Record<string, any> {
    const serialized: Record<string, any> = {};
    
    properties.forEach(prop => {
      if (prop.type === 'Property') {
        serialized[prop.name] = this.extractPropertyValue(prop.value);
      }
    });
    
    return serialized;
  }
  
  /**
   * 提取属性值
   */
  private extractPropertyValue(value: any): any {
    if (!value) return null;
    
    switch (value.type) {
      case 'StringLiteral':
        return value.value;
      case 'NumberLiteral':
        return value.value;
      case 'Identifier':
        return value.name;
      case 'ArrayLiteral':
        return value.elements.map((el: any) => this.extractPropertyValue(el));
      default:
        return null;
    }
  }
  
  /**
   * 清除所有模板
   */
  clear() {
    this.templates.clear();
    console.log('[TemplateManager] 已清除所有模板');
  }
  
  /**
   * 获取模板统计信息
   */
  getStats() {
    return {
      total: this.templates.size,
      names: this.getTemplateNames(),
    };
  }
}

// 全局单例
export const templateManager = new FDFTemplateManager();

// ==================== 模板属性提取辅助函数 ====================

function extractPropValue(value: any): any {
  if (!value) return null;
  switch (value.type) {
    case FDFNodeType.STRING_LITERAL: return value.value;
    case FDFNodeType.NUMBER_LITERAL: return value.value;
    case FDFNodeType.IDENTIFIER: return value.name;
    case FDFNodeType.ARRAY_LITERAL: return value.elements.map(extractPropValue);
    default: return null;
  }
}

function findProp(properties: FDFProperty[], name: string): any {
  const prop = properties.find(p => p.name === name);
  if (!prop) return null;
  return extractPropValue(prop.value);
}

function extractTemplateTexture(properties: FDFProperty[]): FDFTextureData | undefined {
  const file = findProp(properties, 'SetTexture');
  const texCoord = findProp(properties, 'SetTexCoord');
  const alphaMode = findProp(properties, 'SetAlphaMode');
  if (!file && !texCoord && !alphaMode) return undefined;
  
  const am = alphaMode ? String(alphaMode).toUpperCase() : undefined;
  return {
    file: file ? String(file) : '',
    texCoord: Array.isArray(texCoord) && texCoord.length === 4
      ? texCoord.map(Number) as [number, number, number, number] : undefined,
    // DISABLE 亦为引擎合法取值（IDA ReaderTextureKeyword @ 0x6f09b8a0 显式比较四值）。
    alphaMode: (am === 'DISABLE' || am === 'ALPHAKEY' || am === 'BLEND' || am === 'ADD') ? am : undefined,
  };
}

function extractTemplateString(properties: FDFProperty[]): FDFStringData | undefined {
  const content = findProp(properties, 'SetText');
  const font = findProp(properties, 'SetFont');
  const fontSize = findProp(properties, 'SetFontSize');
  const fontFlags = findProp(properties, 'SetFontFlags');
  if (!content && !font && !fontSize && !fontFlags) return undefined;
  return {
    content: content ? String(content) : '',
    font: font ? String(font) : undefined,
    fontSize: fontSize ? Number(fontSize) : undefined,
    fontFlags: fontFlags
      ? (Array.isArray(fontFlags) ? fontFlags.map(String) : [String(fontFlags)])
      : undefined,
  };
}

function extractTemplateBackdrop(properties: FDFProperty[]): FDFBackdropData | undefined {
  const background = findProp(properties, 'BackdropBackground');
  const edgeFile = findProp(properties, 'BackdropEdgeFile');
  const cornerFlags = findProp(properties, 'BackdropCornerFlags');
  const cornerSize = findProp(properties, 'BackdropCornerSize');
  const tileBackground = findProp(properties, 'BackdropTileBackground');
  const backgroundSize = findProp(properties, 'BackdropBackgroundSize');
  const backgroundInsets = findProp(properties, 'BackdropBackgroundInsets');
  const blendAll = findProp(properties, 'BackdropBlendAll');
  if (!background && !edgeFile && !cornerFlags) return undefined;
  return {
    background: background ? String(background) : undefined,
    edgeFile: edgeFile ? String(edgeFile) : undefined,
    cornerFlags: cornerFlags ? String(cornerFlags) : undefined,
    cornerSize: cornerSize ? Number(cornerSize) : undefined,
    tileBackground: tileBackground != null ? Boolean(tileBackground) : undefined,
    backgroundSize: backgroundSize ? Number(backgroundSize) : undefined,
    backgroundInsets: Array.isArray(backgroundInsets) && backgroundInsets.length === 4
      ? backgroundInsets.map(Number) as [number, number, number, number] : undefined,
    blendAll: blendAll != null ? Boolean(blendAll) : undefined,
  };
}
