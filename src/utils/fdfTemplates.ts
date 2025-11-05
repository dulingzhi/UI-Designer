/**
 * FDF 模板管理器
 * 
 * 管理 FDF 模板的注册、解析和应用
 */

import { FDFFrameDefinition } from './fdfAst';
import { parseFDFToAST } from './fdf';
import { FrameData, FDFTemplate } from '../types';
import { readTextFile } from '@tauri-apps/plugin-fs';

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
    
    // TODO: 将 FDFFrameDefinition 的属性应用到 FrameData
    // 这需要使用 fdfTransformer 的逻辑
    
    return {
      ...frame,
      fdfMetadata: {
        ...frame.fdfMetadata,
        inherits: templateName,
      },
    };
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
