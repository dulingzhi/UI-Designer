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
import { FrameData, FrameAnchor } from '../types';

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
    const allFramesFlat: FrameData[] = []; // 扁平化的所有Frame列表(包括嵌套Frame)
    
    for (const node of ast.body) {
      if (node.type === FDFNodeType.FRAME_DEFINITION) {
        const frame = this.transformFrame(node);
        frames.push(frame);
        
        // 添加到扁平列表
        allFramesFlat.push(frame);
        
        // 对于顶层 Frame，如果锚点引用了 __PARENT__，需要特殊处理
        // （顶层 Frame 没有父元素，应该相对于画布定位）
        if (frame.anchors && frame.anchors.length > 0) {
          for (const anchor of frame.anchors) {
            if (anchor.relativeTo === '__PARENT__') {
              // 顶层 Frame 没有父元素，使用画布的绝对坐标
              delete anchor.relativeTo;
              delete anchor.relativePoint;
              
              // 根据锚点类型设置画布坐标
              if (anchor.point === 0) {
                // TOPLEFT → 画布左上角 (0, 0.6)
                anchor.x = 0;
                anchor.y = 0.6;
              } else if (anchor.point === 8) {
                // BOTTOMRIGHT → 画布右下角 (0.8, 0)
                anchor.x = 0.8;
                anchor.y = 0;
              } else if (anchor.point === 4) {
                // CENTER → 画布中心 (0.4, 0.3)
                anchor.x = 0.4;
                anchor.y = 0.3;
              } else {
                // 其他锚点类型，根据 FramePoint 计算画布坐标
                const canvasCoords = this.getCanvasCoordinateForPoint(anchor.point);
                anchor.x = canvasCoords.x;
                anchor.y = canvasCoords.y;
              }
            }
          }
        }
        
        // 递归处理嵌套的 Frame，并添加到 allFramesFlat
        this.collectNestedFrames(node, frame, allFramesFlat);
        
        // 注册为模板（如果有名称）
        if (node.name) {
          this.templateRegistry.set(node.name, frame);
        }
      }
    }
    
    // 后处理：将锚点的 relativeTo 从名称映射到 ID
    // 使用 allFramesFlat 确保能找到所有 Frame（包括嵌套）
    this.resolveRelativeFrames(allFramesFlat);
    
    // 第二次尺寸计算：现在所有 Frame 都已创建，可以正确计算相对锚点的尺寸
    this.recalculateSizesWithRelativeAnchors(allFramesFlat);
    
    // ⚠️ 重要: 必须返回 allFramesFlat 而不是 frames
    // frames 只包含顶层Frame,会导致嵌套Frame丢失
    // allFramesFlat 包含所有Frame(顶层 + 嵌套)
    return allFramesFlat;
  }
  
  /**
   * 收集嵌套的 Frame 并建立父子关系
   * @param node 父Frame的定义节点
   * @param parentFrame 父Frame对象
   * @param allFrames 扁平化的所有Frame数组(包括顶层和嵌套),会被修改
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
          
          // 将所有锚点中的 __PARENT__ 替换为父元素名称
          // （不仅是 SetAllPoints，其他情况也可能有 __PARENT__ 占位符）
          if (childFrame.anchors && childFrame.anchors.length > 0) {
            for (const anchor of childFrame.anchors) {
              if (anchor.relativeTo === '__PARENT__') {
                anchor.relativeTo = parentFrame.name;
              }
            }
          }
          
          // 添加到扁平数组(重要:使所有Frame可被名称查找)
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
    // 根据 Frame 类型确定默认尺寸（使用相对单位）
    const frameType = this.mapFrameType(node.frameType);
    let defaultWidth = 0.1;   // 默认宽度 0.1（相对单位）
    let defaultHeight = 0.1;  // 默认高度 0.1（相对单位）
    
    // TEXT 类型的 Frame 通常较小
    // FrameType.TEXT_FRAME = 13
    if (frameType === 13) {
      defaultWidth = 0.1;     // 宽度 0.1
      defaultHeight = 0.012;  // 高度约 0.012（文本的常见高度）
    }
    
    // 创建基础 Frame
    const frame: FrameData = {
      id: this.generateId(),
      name: node.name || `Frame_${Date.now()}`,
      type: frameType,
      x: 0,
      y: 0,
      width: defaultWidth,
      height: defaultHeight,
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
        // 继承模板属性，但保留 id、name，并重置 anchors 和 children
        // anchors 应该由子 Frame 自己定义，不应该从模板继承（避免引用冲突）
        const { id: _id, name: _name, anchors: _anchors, children: _children, ...templateProps } = template;
        Object.assign(frame, templateProps);
        // 深拷贝 anchors（如果需要的话，但通常不需要）
        // frame.anchors = template.anchors.map(a => ({ ...a }));
      }
    }
    
    // 应用属性
    this.applyProperties(frame, node.properties);
    
    // 如果没有明确的宽高，尝试从锚点计算
    this.calculateSizeFromAnchors(frame);
    
    // 如果 Frame 没有锚点，添加默认居中锚点
    // 在 WC3 中，没有 SetPoint 的 Frame 默认在父元素中居中
    if (frame.anchors.length === 0) {
      // 如果使用默认尺寸（0.1x0.1），给它一个更合理的默认配置
      if (frame.width === 0.1 && frame.height === 0.1) {
        frame.width = 0.4;   // 0.4 相对单位（画布宽度 0.8 的 50%）
        frame.height = 0.4;  // 0.4 相对单位（画布高度 0.6 的 67%）
      }
      
      // 添加 CENTER 锚点，相对于父元素居中
      // 注意：这里暂时不设置 relativeTo，将在 collectNestedFrames 中设置
      frame.anchors = [{
        point: 4, // CENTER
        relativeTo: '__PARENT__', // 占位符，后续会被替换
        relativePoint: 4, // CENTER
        x: 0,
        y: 0,
      }];
    }
    
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
        // FDF 解析器可能将多个属性值合并成数组，取第一个元素
        const widthValue = Array.isArray(value) ? value[0] : value;
        if (typeof widthValue === 'number') {
          frame.width = this.toPixels(widthValue, 'x');
        } else {
          console.warn(`[FDF Transformer] Invalid width value for frame ${frame.name}:`, value, typeof value);
        }
        break;
      
      case 'height':
        // FDF 解析器可能将多个属性值合并成数组，取第一个元素
        const heightValue = Array.isArray(value) ? value[0] : value;
        if (typeof heightValue === 'number') {
          frame.height = this.toPixels(heightValue, 'y');
        } else {
          console.warn(`[FDF Transformer] Invalid height value for frame ${frame.name}:`, value, typeof value);
        }
        break;      case 'setpoint':
      case 'anchor':
        if (Array.isArray(value)) {
          this.applyAnchor(frame, value);
        }
        break;
        
      case 'setallpoints':
        // SetAllPoints 表示填充整个父窗口
        // 在嵌套 Frame 中，这意味着相对于父元素的 TOPLEFT 和 BOTTOMRIGHT
        // 我们创建一个特殊标记，稍后会被处理
        frame.fdfMetadata = {
          ...frame.fdfMetadata,
          setAllPoints: true,  // 标记这个 Frame 使用了 SetAllPoints
        };
        // 暂时创建相对于父元素的锚点（父元素名称稍后会被填充）
        frame.anchors = [
          { point: 0, relativeTo: '__PARENT__', relativePoint: 0, x: 0, y: 0 }, // TOPLEFT
          { point: 8, relativeTo: '__PARENT__', relativePoint: 8, x: 0, y: 0 }  // BOTTOMRIGHT
        ];
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
        const x = this.toPixels(values[1] as number, 'x');
        const y = this.toPixels(values[2] as number, 'y');
        frame.anchors.push({ point, x, y });
        frame.x = x;
        frame.y = y;
      } else if (values.length >= 5) {
        // SetPoint point, relativeTo, relativePoint, x, y
        const relativeToName = values[1] as string;
        const relativePointStr = String(values[2]).toUpperCase();
        const relativePoint = this.mapFramePoint(relativePointStr);
        const relativeX = this.toPixels(values[3] as number, 'x');
        const relativeY = this.toPixels(values[4] as number, 'y');
        
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
   * 根据锚点计算 Frame 尺寸
   * 当 Frame 有对角锚点（如 TOPLEFT + BOTTOMRIGHT）时，可以计算出尺寸
   */
  private calculateSizeFromAnchors(frame: FrameData): void {
    if (!frame.anchors || frame.anchors.length < 2) {
      return;
    }
    
    // 查找对角锚点组合
    const hasTopLeft = frame.anchors.some(a => a.point === 0); // TOPLEFT
    const hasTopRight = frame.anchors.some(a => a.point === 2); // TOPRIGHT
    const hasBottomLeft = frame.anchors.some(a => a.point === 6); // BOTTOMLEFT
    const hasBottomRight = frame.anchors.some(a => a.point === 8); // BOTTOMRIGHT
    
    // TOPLEFT + BOTTOMRIGHT 或 TOPRIGHT + BOTTOMLEFT
    if ((hasTopLeft && hasBottomRight) || (hasTopRight && hasBottomLeft)) {
      const topLeft = frame.anchors.find(a => a.point === 0);
      const bottomRight = frame.anchors.find(a => a.point === 8);
      const topRight = frame.anchors.find(a => a.point === 2);
      const bottomLeft = frame.anchors.find(a => a.point === 6);
      
      if (topLeft && bottomRight) {
        // 计算宽高（如果锚点是相对于同一个父元素）
        if (topLeft.relativeTo === bottomRight.relativeTo) {
          frame.width = Math.abs(bottomRight.x - topLeft.x);
          frame.height = Math.abs(bottomRight.y - topLeft.y);
        }
      } else if (topRight && bottomLeft) {
        if (topRight.relativeTo === bottomLeft.relativeTo) {
          frame.width = Math.abs(bottomLeft.x - topRight.x);
          frame.height = Math.abs(bottomLeft.y - topRight.y);
        }
      }
    }
    
    // TOPLEFT + TOPRIGHT（可以计算宽度）
    if (hasTopLeft && hasTopRight) {
      const topLeft = frame.anchors.find(a => a.point === 0);
      const topRight = frame.anchors.find(a => a.point === 2);
      if (topLeft && topRight && topLeft.relativeTo === topRight.relativeTo) {
        frame.width = Math.abs(topRight.x - topLeft.x);
      }
    }
    
    // TOPLEFT + BOTTOMLEFT（可以计算高度）
    if (hasTopLeft && hasBottomLeft) {
      const topLeft = frame.anchors.find(a => a.point === 0);
      const bottomLeft = frame.anchors.find(a => a.point === 6);
      if (topLeft && bottomLeft && topLeft.relativeTo === bottomLeft.relativeTo) {
        frame.height = Math.abs(bottomLeft.y - topLeft.y);
      }
    }
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
      // 基础容器
      ORIGIN: 0,
      FRAME: 1,
      BACKDROP: 2,
      SIMPLEFRAME: 3,
      
      // 文本控件
      TEXT_FRAME: 4,
      SIMPLEFONTSTRING: 5,
      TEXTAREA: 6,
      
      // 按钮控件
      BUTTON: 7,
      GLUETEXTBUTTON: 8,
      GLUEBUTTON: 9,
      SIMPLEBUTTON: 10,
      BROWSER_BUTTON: 11,
      SCRIPT_DIALOG_BUTTON: 12,
      INVIS_BUTTON: 13,
      
      // 交互控件
      CHECKBOX: 14,
      EDITBOX: 15,
      SLIDER: 16,
      SCROLLBAR: 17,
      LISTBOX: 18,
      MENU: 19,
      POPUPMENU: 20,
      
      // 图形控件
      SPRITE: 21,
      MODEL: 22,
      HIGHLIGHT: 23,
      
      // 状态栏
      SIMPLESTATUSBAR: 24,
      STATUSBAR: 25,
      
      // 其他控件
      CONTROL: 26,
      DIALOG: 27,
      TIMERTEXT: 28,
    };
    
    switch (type) {
      // 基础容器
      case 'FRAME':
        return FrameType.FRAME;
      case 'BACKDROP':
        return FrameType.BACKDROP;
      case 'SIMPLEFRAME':
        return FrameType.SIMPLEFRAME;
      
      // 文本控件
      case 'TEXT':
        return FrameType.TEXT_FRAME;
      case 'SIMPLEFONTSTRING':
        return FrameType.SIMPLEFONTSTRING;
      case 'TEXTAREA':
        return FrameType.TEXTAREA;
      
      // 按钮控件
      case 'BUTTON':
        return FrameType.BUTTON;
      case 'GLUETEXTBUTTON':
        return FrameType.GLUETEXTBUTTON;
      case 'GLUEBUTTON':
        return FrameType.GLUEBUTTON;
      case 'SIMPLEBUTTON':
        return FrameType.SIMPLEBUTTON;
      case 'BROWSER_BUTTON':
        return FrameType.BROWSER_BUTTON;
      case 'SCRIPT_DIALOG_BUTTON':
        return FrameType.SCRIPT_DIALOG_BUTTON;
      case 'INVIS_BUTTON':
        return FrameType.INVIS_BUTTON;
      
      // 交互控件
      case 'CHECKBOX':
        return FrameType.CHECKBOX;
      case 'EDITBOX':
        return FrameType.EDITBOX;
      case 'SLIDER':
        return FrameType.SLIDER;
      case 'SCROLLBAR':
        return FrameType.SCROLLBAR;
      case 'LISTBOX':
        return FrameType.LISTBOX;
      case 'MENU':
        return FrameType.MENU;
      case 'POPUPMENU':
        return FrameType.POPUPMENU;
      
      // 图形控件
      case 'SPRITE':
        return FrameType.SPRITE;
      case 'MODEL':
        return FrameType.MODEL;
      case 'HIGHLIGHT':
        return FrameType.HIGHLIGHT;
      
      // 状态栏
      case 'SIMPLESTATUSBAR':
        return FrameType.SIMPLESTATUSBAR;
      case 'STATUSBAR':
        return FrameType.STATUSBAR;
      
      // 其他控件
      case 'CONTROL':
        return FrameType.CONTROL;
      case 'DIALOG':
        return FrameType.DIALOG;
      case 'TIMERTEXT':
        return FrameType.TIMERTEXT;
      
      default:
        return FrameType.FRAME; // 默认使用 FRAME
    }
  }
  
  /**
   * 将相对尺寸转换为像素（假设 0-1 范围是相对于基础尺寸）
   */
  /**
   * 处理 FDF 坐标值
   * FDF 中的值已经是相对坐标（0.0-1.0），编辑器内部也使用相对坐标
   * 所以直接返回，不需要任何转换
   * @param value FDF 中的数值
   * @param _axis 'x' 或 'y' 轴（保留参数以保持兼容性）
   * @returns 相对坐标值
   */
  private toPixels(value: number, _axis: 'x' | 'y' = 'x'): number {
    // 编辑器内部坐标系统：
    // - X 轴: 0.0 - 0.8 (相对单位)
    // - Y 轴: 0.0 - 0.6 (相对单位)
    // FDF 也使用相对单位，所以直接返回
    return value;
  }
  
  /**
   * 解析锚点的 relativeTo 引用
   * 将 Frame 名称映射到 Frame ID
   */
  private resolveRelativeFrames(frames: FrameData[]): void {
    // 构建名称到 ID 的映射
    const nameToId = new Map<string, string>();
    for (const frame of frames) {
      nameToId.set(frame.name, frame.id);
    }
    
    // 解析所有锚点的 relativeTo
    for (const frame of frames) {
      if (frame.anchors && frame.anchors.length > 0) {
        for (const anchor of frame.anchors) {
          if (anchor.relativeTo && typeof anchor.relativeTo === 'string') {
            // 查找相对引用的 Frame ID
            const targetId = nameToId.get(anchor.relativeTo);
            if (targetId) {
              // 将名称替换为 ID
              anchor.relativeTo = targetId;
            } else {
              console.warn(`[FDF Transformer] Cannot resolve relativeTo: ${anchor.relativeTo} for frame ${frame.name}`);
            }
          }
        }
      }
    }
  }
  
  /**
   * 重新计算包含相对锚点的 Frame 的尺寸
   * 在所有 Frame 创建完成后调用，确保相对引用的 Frame 已经有正确的尺寸
   */
  private recalculateSizesWithRelativeAnchors(frames: FrameData[]): void {
    // 构建 ID 到 Frame 的映射
    const idToFrame = new Map<string, FrameData>();
    for (const frame of frames) {
      idToFrame.set(frame.id, frame);
    }
    
    // 重新计算每个 Frame 的尺寸
    for (const frame of frames) {
      if (frame.anchors && frame.anchors.length >= 2) {
        // 查找对角锚点
        const hasTopLeft = frame.anchors.some(a => a.point === 0); // TOPLEFT
        const hasTopRight = frame.anchors.some(a => a.point === 2); // TOPRIGHT
        const hasBottomLeft = frame.anchors.some(a => a.point === 6); // BOTTOMLEFT
        const hasBottomRight = frame.anchors.some(a => a.point === 8); // BOTTOMRIGHT
        
        // 获取锚点
        const topLeft = frame.anchors.find(a => a.point === 0);
        const topRight = frame.anchors.find(a => a.point === 2);
        const bottomLeft = frame.anchors.find(a => a.point === 6);
        const bottomRight = frame.anchors.find(a => a.point === 8);
        
        // TOPLEFT + BOTTOMRIGHT（完整尺寸）
        if (hasTopLeft && hasBottomRight && topLeft && bottomRight) {
          const tlPos = this.calculateAbsoluteAnchorPosition(topLeft, idToFrame);
          const brPos = this.calculateAbsoluteAnchorPosition(bottomRight, idToFrame);
          if (tlPos && brPos) {
            frame.width = Math.abs(brPos.x - tlPos.x);
            frame.height = Math.abs(tlPos.y - brPos.y); // Y 轴向上
            frame.x = Math.min(tlPos.x, brPos.x);
            frame.y = Math.min(tlPos.y, brPos.y);
          }
        }
        // TOPLEFT + TOPRIGHT（宽度）
        else if (hasTopLeft && hasTopRight && topLeft && topRight) {
          const tlPos = this.calculateAbsoluteAnchorPosition(topLeft, idToFrame);
          const trPos = this.calculateAbsoluteAnchorPosition(topRight, idToFrame);
          if (tlPos && trPos) {
            frame.width = Math.abs(trPos.x - tlPos.x);
            frame.x = Math.min(tlPos.x, trPos.x);
            frame.y = Math.min(tlPos.y, trPos.y) - frame.height; // 左下角
          }
        }
        // TOPLEFT + BOTTOMLEFT（高度）
        else if (hasTopLeft && hasBottomLeft && topLeft && bottomLeft) {
          const tlPos = this.calculateAbsoluteAnchorPosition(topLeft, idToFrame);
          const blPos = this.calculateAbsoluteAnchorPosition(bottomLeft, idToFrame);
          if (tlPos && blPos) {
            frame.height = Math.abs(tlPos.y - blPos.y);
            frame.x = Math.min(tlPos.x, blPos.x);
            frame.y = Math.min(tlPos.y, blPos.y);
          }
        }
        // TOPRIGHT + BOTTOMLEFT（完整尺寸，对角）
        else if (hasTopRight && hasBottomLeft && topRight && bottomLeft) {
          const trPos = this.calculateAbsoluteAnchorPosition(topRight, idToFrame);
          const blPos = this.calculateAbsoluteAnchorPosition(bottomLeft, idToFrame);
          if (trPos && blPos) {
            frame.width = Math.abs(trPos.x - blPos.x);
            frame.height = Math.abs(trPos.y - blPos.y);
            frame.x = Math.min(trPos.x, blPos.x);
            frame.y = Math.min(trPos.y, blPos.y);
          }
        }
      }
    }
  }
  
  /**
   * 获取锚点类型对应的画布坐标
   */
  private getCanvasCoordinateForPoint(point: number): { x: number; y: number } {
    // FramePoint 枚举值：
    // 0: TOPLEFT, 1: TOP, 2: TOPRIGHT
    // 3: LEFT, 4: CENTER, 5: RIGHT
    // 6: BOTTOMLEFT, 7: BOTTOM, 8: BOTTOMRIGHT
    
    const canvasWidth = 0.8;
    const canvasHeight = 0.6;
    
    switch (point) {
      case 0: // TOPLEFT
        return { x: 0, y: canvasHeight };
      case 1: // TOP
        return { x: canvasWidth / 2, y: canvasHeight };
      case 2: // TOPRIGHT
        return { x: canvasWidth, y: canvasHeight };
      case 3: // LEFT
        return { x: 0, y: canvasHeight / 2 };
      case 4: // CENTER
        return { x: canvasWidth / 2, y: canvasHeight / 2 };
      case 5: // RIGHT
        return { x: canvasWidth, y: canvasHeight / 2 };
      case 6: // BOTTOMLEFT
        return { x: 0, y: 0 };
      case 7: // BOTTOM
        return { x: canvasWidth / 2, y: 0 };
      case 8: // BOTTOMRIGHT
        return { x: canvasWidth, y: 0 };
      default:
        return { x: canvasWidth / 2, y: canvasHeight / 2 }; // 默认居中
    }
  }
  
  /**
   * 计算锚点的绝对位置
   * 如果是相对锚点，递归计算相对 Frame 的位置
   */
  private calculateAbsoluteAnchorPosition(
    anchor: FrameAnchor,
    idToFrame: Map<string, FrameData>
  ): { x: number; y: number } | null {
    if (!anchor.relativeTo) {
      // 绝对锚点
      return { x: anchor.x, y: anchor.y };
    }
    
    // 相对锚点
    const relativeFrame = idToFrame.get(anchor.relativeTo);
    if (!relativeFrame) {
      return null;
    }
    
    // 获取相对 Frame 上的锚点位置
    const relativePoint = anchor.relativePoint !== undefined ? anchor.relativePoint : 0; // 默认 TOPLEFT
    const relativePos = this.getFrameAnchorPosition(relativeFrame, relativePoint);
    
    // 加上偏移
    return {
      x: relativePos.x + anchor.x,
      y: relativePos.y + anchor.y,
    };
  }
  
  /**
   * 获取 Frame 上某个锚点的位置
   */
  private getFrameAnchorPosition(frame: FrameData, point: number): { x: number; y: number } {
    const { x, y, width, height } = frame;
    
    switch (point) {
      case 0: // TOPLEFT
        return { x, y: y + height };
      case 1: // TOP
        return { x: x + width / 2, y: y + height };
      case 2: // TOPRIGHT
        return { x: x + width, y: y + height };
      case 3: // LEFT
        return { x, y: y + height / 2 };
      case 4: // CENTER
        return { x: x + width / 2, y: y + height / 2 };
      case 5: // RIGHT
        return { x: x + width, y: y + height / 2 };
      case 6: // BOTTOMLEFT
        return { x, y };
      case 7: // BOTTOM
        return { x: x + width / 2, y };
      case 8: // BOTTOMRIGHT
        return { x: x + width, y };
      default:
        return { x, y };
    }
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
