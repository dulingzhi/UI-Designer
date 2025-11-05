// 核心类型定义

export enum FramePoint {
  TOPLEFT = 0,
  TOP = 1,
  TOPRIGHT = 2,
  LEFT = 3,
  CENTER = 4,
  RIGHT = 5,
  BOTTOMLEFT = 6,
  BOTTOM = 7,
  BOTTOMRIGHT = 8,
}

// 锚点定义 - 支持相对定位和绝对定位
export interface FrameAnchor {
  point: FramePoint;           // 当前Frame的锚点类型
  x: number;                   // X坐标（绝对坐标或相对偏移）
  y: number;                   // Y坐标（绝对坐标或相对偏移）
  relativeTo?: string;         // 相对于哪个Frame的ID（null表示绝对定位）
  relativePoint?: FramePoint;  // 相对于目标Frame的哪个锚点
}

export enum FrameType {
  ORIGIN = 0,
  BACKDROP = 1,
  BUTTON = 2,
  BROWSER_BUTTON = 3,
  SCRIPT_DIALOG_BUTTON = 4,
  CHECKLIST_BOX = 5,
  ESC_MENU_BACKDROP = 6,
  OPTIONS_POPUP_MENU_BACKDROP_TEMPLATE = 7,
  QUEST_BUTTON_BASE_TEMPLATE = 8,
  QUEST_BUTTON_DISABLED_BACKDROP_TEMPLATE = 9,
  QUEST_BUTTON_PUSHED_BACKDROP_TEMPLATE = 10,
  CHECKBOX = 11,
  INVIS_BUTTON = 12,
  TEXT_FRAME = 13,
  HORIZONTAL_BAR = 14,
  HOR_BAR_BACKGROUND = 15,
  HOR_BAR_TEXT = 16,
  HOR_BAR_BACKGROUND_TEXT = 17,
  TEXTAREA = 18,
  EDITBOX = 19,
  SLIDER = 20,
}

// FDF 元数据 - 保留原始 FDF 信息
export interface FDFMetadata {
  inherits?: string;                    // INHERITS 模板名
  includeFile?: string;                 // IncludeFile 路径
  rawProperties?: Record<string, any>;  // 无法映射的原始 FDF 属性
  comment?: string;                     // FDF 注释
  originalFDF?: string;                 // 原始 FDF 文本（用于精确还原）
}

// FDF 纹理数据
export interface FDFTextureData {
  file: string;
  texCoord?: [number, number, number, number]; // [left, right, top, bottom]
  alphaMode?: 'ALPHAKEY' | 'BLEND' | 'ADD';
  decorateFileNames?: boolean;
}

// FDF 文本数据
export interface FDFStringData {
  content: string;
  font?: string;                        // 字体名称
  fontSize?: number;                    // 字体大小
  fontFlags?: string[];                 // 字体标志 (FIXEDSIZE, THICKOUTLINE)
  shadowOffset?: [number, number];      // 阴影偏移
  shadowColor?: string;                 // 阴影颜色
}

// FDF Backdrop 数据
export interface FDFBackdropData {
  background?: string;                  // 背景纹理
  tileBackground?: boolean;             // 是否平铺背景
  backgroundSize?: number;              // 背景尺寸
  backgroundInsets?: [number, number, number, number]; // [left, top, right, bottom]
  edgeFile?: string;                    // 边框纹理
  cornerFlags?: string;                 // 角标志 "UL|UR|BL|BR|T|L|B|R"
  cornerSize?: number;                  // 角尺寸
  blendAll?: boolean;                   // 混合所有层
}

export interface FrameData {
  id: string;
  name: string;
  type: FrameType;
  
  // 编辑器坐标 (像素，左下角原点)
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  
  // 层级关系
  parentId: string | null;
  children: string[];
  
  // 锚点系统 (用于 FDF 导出)
  anchors: FrameAnchor[];
  
  // 显示控制
  locked?: boolean;
  visible?: boolean;
  tooltip?: boolean;
  
  // 基础属性 (简化，主要用于编辑器显示)
  diskTexture?: string;
  wc3Texture?: string;
  backDiskTexture?: string;
  backWc3Texture?: string;
  text?: string;
  textScale?: number;
  textColor?: string;
  horAlign?: 'left' | 'center' | 'right';
  verAlign?: 'start' | 'center' | 'flex-end';
  
  // 特殊控件属性
  multiline?: boolean;      // EDITBOX
  minValue?: number;        // SLIDER
  maxValue?: number;        // SLIDER
  stepSize?: number;        // SLIDER
  checked?: boolean;        // CHECKBOX
  
  // 功能属性
  trigVar?: string;
  arrayId?: string;
  isRelative?: boolean;     // 保留兼容性
  
  // ===== FDF 扩展数据 =====
  fdfMetadata?: FDFMetadata;        // FDF 元数据
  fdfTexture?: FDFTextureData;      // FDF 纹理数据
  fdfString?: FDFStringData;        // FDF 文本数据
  fdfBackdrop?: FDFBackdropData;    // FDF Backdrop 数据
}

export interface TableArrayData {
  id: string;
  name: string;
  rows: number;
  cols: number;
  xGap: number;
  yGap: number;
  elements: string[]; // frame ids
}

export interface CircleArrayData {
  id: string;
  name: string;
  radius: number;
  count: number;
  initialAngle: number;
  elements: string[]; // frame ids
}

// 参考线类型
export interface GuideLine {
  id: string;
  orientation: 'horizontal' | 'vertical';
  position: number; // 在画布中的像素位置
  wc3Position?: number; // WC3坐标位置（可选，用于精确对齐）
  color?: string; // 参考线颜色，默认为蓝色
  locked?: boolean; // 是否锁定（锁定后不能移动或删除）
}

// 样式预设类型
export interface StylePreset {
  id: string;
  name: string;
  description?: string;
  category?: string; // 分类：按钮、文本、背景等
  createdAt: number; // 创建时间戳
  style: {
    // 纹理
    diskTexture?: string;
    wc3Texture?: string;
    backDiskTexture?: string;
    backWc3Texture?: string;
    
    // 文本
    text?: string;
    textScale?: number;
    textColor?: string;
    horAlign?: 'left' | 'center' | 'right';
    verAlign?: 'start' | 'center' | 'flex-end';
    
    // 尺寸
    width?: number;
    height?: number;
    
    // 类型
    type?: FrameType;
  };
}

// 控件组合类型
export interface FrameGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  frameIds: string[]; // 组中包含的控件ID列表
  locked?: boolean; // 是否锁定组（锁定后不能修改成员）
}

// FDF 模板定义（来自 fdfAst.ts）
export interface FDFTemplate {
  name: string;
  frameType: string;
  inherits?: string;
  properties: Record<string, any>;
}

export interface ProjectData {
  version: 2;                  // 项目版本号
  libraryName: string;
  originMode: 'gameui' | 'worldframe' | 'consoleui';
  exportVersion: ExportVersion;
  hideGameUI: boolean;
  hideHeroBar: boolean;
  hideMiniMap: boolean;
  hideResources: boolean;
  hideButtonBar: boolean;
  hidePortrait: boolean;
  hideChat: boolean;
  appInterface: string;
  backgroundImage?: string;
  
  // 核心数据
  frames: Record<string, FrameData>;
  rootFrameIds: string[];
  
  // FDF 模板库
  fdfTemplates?: Record<string, FDFTemplate>;
  
  // 辅助数据
  tableArrays: TableArrayData[];
  circleArrays: CircleArrayData[];
  guides?: GuideLine[];
  stylePresets?: StylePreset[];
  frameGroups?: FrameGroup[];
}

export interface FieldsAllowed {
  text: boolean;
  textBig: boolean;
  type: boolean;
  color: boolean;
  scale: boolean;
  textAlign: boolean;
  textures: boolean;
  backTextures: boolean;
  trigVar: boolean;
  parent: boolean;
  tooltip: boolean;
}

export type ExportLanguage = 'jass' | 'lua' | 'ts';

export type ExportVersion = 'reforged' | '1.27';

export type SelectionMode = 'normal' | 'zoom' | 'drag';
