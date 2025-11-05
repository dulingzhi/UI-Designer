/**
 * FDF AST 转换器
 * 
 * 将 FDF AST 转换为内部 FrameData 格式
 */

import {
  FDFProgram,
  FDFFrameDefinition,
  FDFNestedFrame,
  FDFProperty,
  FDFPropertyValue,
  FDFNodeType,
  FDFArrayLiteral,
  FDFIdentifier,
  FDFStringLiteral,
  FDFNumberLiteral,
} from './fdfAst';
import { FrameData } from '../types';

/**
 * 转换器选项
 */
export interface TransformOptions {
  /** 是否解析模板继承 */
  resolveInheritance?: boolean;
  /** 模板注册表 */
  templateRegistry?: Map<string, FrameData>;
  /** 基础画布宽度 */
  baseWidth?: number;
  /** 基础画布高度 */
  baseHeight?: number;
}

/**
 * FDF AST 转换器
 */
export class FDFTransformer {
  private options: Required<TransformOptions>;
  private templateRegistry: Map<string, FrameData>;
  
  constructor(options: TransformOptions = {}) {
    this.options = {
      resolveInheritance: options.resolveInheritance ?? true,
      templateRegistry: options.templateRegistry ?? new Map(),
      baseWidth: options.baseWidth ?? 800,
      baseHeight: options.baseHeight ?? 600,
    };
    this.templateRegistry = this.options.templateRegistry;
  }
  
  /**
   * 转换 FDF 程序为 FrameData 数组
   */
  public transform(ast: FDFProgram): FrameData[] {
    const frames: FrameData[] = [];
    
    for (const node of ast.body) {
      if (node.type === FDFNodeType.FRAME_DEFINITION) {
        const frame = this.transformFrame(node);
        frames.push(frame);
        
        // 递归处理嵌套的 Frame
        this.collectNestedFrames(node, frame, frames);
        
        // 注册为模板（如果有名称）
        if (node.name) {
          this.templateRegistry.set(node.name, frame);
        }
      }
    }
    
    return frames;
  }
  
  /**
   * 收集嵌套的 Frame 并建立父子关系
   */
  private collectNestedFrames(node: FDFFrameDefinition, parentFrame: FrameData, allFrames: FrameData[]): void {
    for (const prop of node.properties) {
      if (prop.type === FDFNodeType.NESTED_FRAME) {
        // 检查是否是真正的嵌套 Frame（不是 Texture、String 等特殊块）
        const frameType = prop.frameType.toLowerCase();
        if (frameType !== 'texture' && frameType !== 'string' && frameType !== 'controlstyle') {
          // 将 FDFNestedFrame 转换为 FDFFrameDefinition 格式
          const nestedFrameDef: FDFFrameDefinition = {
            type: FDFNodeType.FRAME_DEFINITION,
            frameType: prop.frameType,
            name: prop.name || `NestedFrame_${Date.now()}`,
            inherits: prop.inherits,
            properties: prop.properties,
            loc: prop.loc,
          };
          
          // 转换嵌套的 Frame
          const childFrame = this.transformFrame(nestedFrameDef);
          
          // 建立父子关系
          childFrame.parentId = parentFrame.id;
          parentFrame.children.push(childFrame.id);
          
          // 添加到数组
          allFrames.push(childFrame);
          
          // 递归处理更深层的嵌套
          this.collectNestedFrames(nestedFrameDef, childFrame, allFrames);
        }
      }
    }
  }
  
  /**
   * 转换 Frame 定义
   */
  private transformFrame(node: FDFFrameDefinition): FrameData {
    // 创建基础 Frame
    const frame: FrameData = {
      id: this.generateId(),
      name: node.name || `Frame_${Date.now()}`,
      type: this.mapFrameType(node.frameType),
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      z: 0,
      parentId: null,
      children: [],
      tooltip: false,
      isRelative: false,
      anchors: [],
      diskTexture: '',
      wc3Texture: '',
    };
    
    // 保存 FDF 元数据（如 inherits）
    if (node.inherits) {
      frame.fdfMetadata = {
        ...frame.fdfMetadata,
        inherits: node.inherits,
      };
    }
    
    // 如果有继承，先应用模板属性
    if (node.inherits && this.options.resolveInheritance) {
      const template = this.templateRegistry.get(node.inherits);
      if (template) {
        Object.assign(frame, { ...template, id: frame.id, name: frame.name });
      }
    }
    
    // 应用属性
    this.applyProperties(frame, node.properties);
    
    return frame;
  }
  
  /**
   * 应用属性到 Frame
   */
  private applyProperties(frame: FrameData, properties: (FDFProperty | FDFNestedFrame)[]): void {
    for (const prop of properties) {
      if (prop.type === FDFNodeType.PROPERTY) {
        this.applyProperty(frame, prop);
      } else if (prop.type === FDFNodeType.NESTED_FRAME) {
        this.applyNestedFrame(frame, prop);
      }
    }
  }
  
  /**
   * 应用单个属性
   */
  private applyProperty(frame: FrameData, prop: FDFProperty): void {
    const name = prop.name;
    const value = this.extractValue(prop.value);
    
    switch (name.toLowerCase()) {
      case 'width':
        frame.width = this.toPixels(value as number);
        break;
        
      case 'height':
        frame.height = this.toPixels(value as number);
        break;
        
      case 'setpoint':
      case 'anchor':
        if (Array.isArray(value)) {
          this.applyAnchor(frame, value);
        }
        break;
        
      case 'setallpoints':
        // SetAllPoints 表示填充整个父窗口
        frame.anchors = [
          { point: 0, x: 0, y: 0 }, // TOPLEFT
          { point: 8, x: this.options.baseWidth, y: this.options.baseHeight } // BOTTOMRIGHT
        ];
        frame.width = this.options.baseWidth;
        frame.height = this.options.baseHeight;
        break;
        
      // 文本相关
      case 'text':
        frame.text = value as string;
        break;
        
      case 'fontcolor':
        if (Array.isArray(value) && value.length >= 4) {
          const [r, g, b, a] = value as number[];
          frame.textColor = this.rgbaToHex(r, g, b, a);
        }
        break;
        
      case 'fontjustificationh':
        if (typeof value === 'string') {
          const hAlign = value.toLowerCase();
          if (hAlign.includes('left')) frame.horAlign = 'left';
          else if (hAlign.includes('center')) frame.horAlign = 'center';
          else if (hAlign.includes('right')) frame.horAlign = 'right';
        }
        break;
        
      case 'fontjustificationv':
        if (typeof value === 'string') {
          const vAlign = value.toLowerCase();
          if (vAlign.includes('top')) frame.verAlign = 'start';
          else if (vAlign.includes('middle')) frame.verAlign = 'center';
          else if (vAlign.includes('bottom')) frame.verAlign = 'flex-end';
        }
        break;
        
      // Backdrop 相关
      case 'backdropbackground':
      case 'file':
        frame.diskTexture = value as string;
        frame.wc3Texture = value as string;
        break;
        
      case 'texcoord':
        // 纹理坐标暂不处理，WC3 使用不同的系统
        break;
        
      case 'alphamode':
        // Alpha 模式暂不处理
        break;
        
      // 其他属性暂不处理
      default:
        // 可以扩展以支持更多属性
        break;
    }
  }
  
  /**
   * 应用嵌套 Frame (Texture, String 等)
   */
  private applyNestedFrame(frame: FrameData, nested: FDFNestedFrame): void {
    if (nested.frameType.toLowerCase() === 'texture') {
      // 应用 Texture 属性
      for (const prop of nested.properties) {
        if (prop.type === FDFNodeType.PROPERTY) {
          const name = prop.name;
          const value = this.extractValue(prop.value);
          
          if (name.toLowerCase() === 'file') {
            frame.diskTexture = value as string;
            frame.wc3Texture = value as string;
          }
        }
      }
    } else if (nested.frameType.toLowerCase() === 'string') {
      // 应用 String 属性
      for (const prop of nested.properties) {
        if (prop.type === FDFNodeType.PROPERTY) {
          const name = prop.name;
          const value = this.extractValue(prop.value);
          
          if (name.toLowerCase() === 'text') {
            frame.text = value as string;
          }
        }
      }
    }
  }
  
  /**
   * 应用锚点
   */
  private applyAnchor(frame: FrameData, values: any[]): void {
    // SetPoint TOPLEFT, ParentFrame, TOPLEFT, 0.0, 0.0
    // 或 Anchor TOPLEFT, 0.0, 0.0
    
    if (values.length >= 3) {
      const pointStr = String(values[0]).toUpperCase();
      const point = this.mapFramePoint(pointStr);
      
      if (values.length === 3) {
        // Anchor point, x, y
        const x = this.toPixels(values[1] as number);
        const y = this.toPixels(values[2] as number);
        frame.anchors.push({ point, x, y });
        frame.x = x;
        frame.y = y;
      } else if (values.length >= 5) {
        // SetPoint point, relativeTo, relativePoint, x, y
        const relativeToName = values[1] as string;
        const relativePointStr = String(values[2]).toUpperCase();
        const relativePoint = this.mapFramePoint(relativePointStr);
        const relativeX = this.toPixels(values[3] as number);
        const relativeY = this.toPixels(values[4] as number);
        
        frame.anchors.push({
          point,
          relativeTo: relativeToName,
          relativePoint,
          x: relativeX,
          y: relativeY,
        });
      }
    }
  }
  
  /**
   * 映射 Frame Point 字符串到枚举
   */
  private mapFramePoint(point: string): number {
    const FramePoint: Record<string, number> = {
      'TOPLEFT': 0,
      'TOP': 1,
      'TOPRIGHT': 2,
      'LEFT': 3,
      'CENTER': 4,
      'RIGHT': 5,
      'BOTTOMLEFT': 6,
      'BOTTOM': 7,
      'BOTTOMRIGHT': 8,
    };
    
    return FramePoint[point] ?? 0;
  }
  
  /**
   * 提取属性值
   */
  private extractValue(node: FDFPropertyValue): any {
    switch (node.type) {
      case FDFNodeType.STRING_LITERAL:
        return (node as FDFStringLiteral).value;
        
      case FDFNodeType.NUMBER_LITERAL:
        return (node as FDFNumberLiteral).value;
        
      case FDFNodeType.IDENTIFIER:
        const id = (node as FDFIdentifier).name;
        if (id === 'true') return true;
        if (id === 'false') return false;
        return id;
        
      case FDFNodeType.ARRAY_LITERAL:
        return (node as FDFArrayLiteral).elements.map(el => this.extractValue(el));
        
      default:
        return null;
    }
  }
  
  /**
   * 映射 Frame 类型到内部类型
   */
  private mapFrameType(fdfType: string): number {
    const type = fdfType.toUpperCase();
    
    // 导入 FrameType 枚举
    const FrameType = {
      ORIGIN: 0,
      BACKDROP: 1,
      BUTTON: 2,
      BROWSER_BUTTON: 3,
      SCRIPT_DIALOG_BUTTON: 4,
      CHECKLIST_BOX: 5,
      ESC_MENU_BACKDROP: 6,
      OPTIONS_POPUP_MENU_BACKDROP_TEMPLATE: 7,
      QUEST_BUTTON_BASE_TEMPLATE: 8,
      QUEST_BUTTON_DISABLED_BACKDROP_TEMPLATE: 9,
      QUEST_BUTTON_PUSHED_BACKDROP_TEMPLATE: 10,
      CHECKBOX: 11,
      INVIS_BUTTON: 12,
      TEXT_FRAME: 13,
      HORIZONTAL_BAR: 14,
      HOR_BAR_BACKGROUND: 15,
      HOR_BAR_TEXT: 16,
      HOR_BAR_BACKGROUND_TEXT: 17,
      TEXTAREA: 18,
      EDITBOX: 19,
      SLIDER: 20,
    };
    
    switch (type) {
      case 'BACKDROP':
      case 'SIMPLEFRAME':
        return FrameType.BACKDROP;
        
      case 'TEXT':
      case 'SIMPLEFONTSTRING':
        return FrameType.TEXT_FRAME;
        
      case 'BUTTON':
      case 'GLUETEXTBUTTON':
      case 'GLUEBUTTON':
      case 'SIMPLEBUTTON':
        return FrameType.BUTTON;
        
      case 'SPRITE':
      case 'MODEL':
        return FrameType.BACKDROP; // 使用 BACKDROP 作为通用容器
        
      case 'EDITBOX':
        return FrameType.EDITBOX;
        
      case 'CHECKBOX':
        return FrameType.CHECKBOX;
        
      case 'SLIDER':
        return FrameType.SLIDER;
        
      default:
        return FrameType.BACKDROP; // 默认使用 BACKDROP
    }
  }
  
  /**
   * 将相对尺寸转换为像素（假设 0-1 范围是相对于基础尺寸）
   */
  private toPixels(value: number): number {
    if (value >= -1 && value <= 1) {
      // 相对值，转换为绝对值
      return value * this.options.baseWidth;
    }
    return value;
  }
  
  /**
   * 将 RGBA 转换为 Hex 颜色
   */
  private rgbaToHex(r: number, g: number, b: number, a: number = 1): string {
    const toHex = (n: number) => {
      const hex = Math.round(n * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    if (a < 1) {
      return hex + toHex(a);
    }
    return hex;
  }
  
  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
