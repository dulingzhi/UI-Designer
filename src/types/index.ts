// 核心类型定义

import type { War3Skins } from '../utils/war3SkinsParser';

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
  // 基础容器
  ORIGIN = 0,
  FRAME = 1,
  BACKDROP = 2,
  SIMPLEFRAME = 3,
  
  // 文本控件
  TEXT_FRAME = 4,
  SIMPLEFONTSTRING = 5,
  TEXTAREA = 6,
  
  // 按钮控件
  BUTTON = 7,
  GLUETEXTBUTTON = 8,
  GLUEBUTTON = 9,
  SIMPLEBUTTON = 10,
  BROWSER_BUTTON = 11,
  SCRIPT_DIALOG_BUTTON = 12,
  INVIS_BUTTON = 13,
  
  // 交互控件
  CHECKBOX = 14,
  EDITBOX = 15,
  SLIDER = 16,
  SCROLLBAR = 17,
  LISTBOX = 18,
  MENU = 19,
  POPUPMENU = 20,
  
  // 图形控件
  SPRITE = 21,
  MODEL = 22,
  HIGHLIGHT = 23,
  
  // 状态栏
  SIMPLESTATUSBAR = 24,
  STATUSBAR = 25,
  
  // 其他控件
  CONTROL = 26,
  DIALOG = 27,
  TIMERTEXT = 28,
  
  // 兼容旧枚举值（已废弃，保留向后兼容）
  CHECKLIST_BOX = 100,
  ESC_MENU_BACKDROP = 101,
  OPTIONS_POPUP_MENU_BACKDROP_TEMPLATE = 102,
  QUEST_BUTTON_BASE_TEMPLATE = 103,
  QUEST_BUTTON_DISABLED_BACKDROP_TEMPLATE = 104,
  QUEST_BUTTON_PUSHED_BACKDROP_TEMPLATE = 105,
  HORIZONTAL_BAR = 106,
  HOR_BAR_BACKGROUND = 107,
  HOR_BAR_TEXT = 108,
  HOR_BAR_BACKGROUND_TEXT = 109,
}

// FDF 元数据 - 保留原始 FDF 信息
export interface FDFMetadata {
  inherits?: string;                    // INHERITS 模板名
  includeFile?: string;                 // IncludeFile 路径
  rawProperties?: Record<string, any>;  // 无法映射的原始 FDF 属性
  comment?: string;                     // FDF 注释
  originalFDF?: string;                 // 原始 FDF 文本（用于精确还原）
  setAllPoints?: boolean;               // 是否使用了 SetAllPoints
  isTemplate?: boolean;                 // 是否是模板定义（来自Include文件）
  inheritedChildrenIds?: string[];      // 从模板继承的子控件ID列表（只读）
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
  
  // ========== 显示控制 ==========
  locked?: boolean;
  visible?: boolean;
  tooltip?: boolean | string;
  alpha?: number;                      // 透明度 0-255
  
  // ========== 基础纹理 ==========
  texture?: string;                    // 主纹理路径（支持本地文件、MPQ资源、HTTP等）
  
  // ========== 文本属性 ==========
  text?: string;                       // 文本内容
  textScale?: number;                  // 文本缩放
  textLength?: number;                 // 最大文本长度
  
  // 文本颜色 (RGBA格式，值范围0-1)
  textColor?: string;                  // 主文本颜色
  fontColor?: [number, number, number, number];         // 字体颜色 RGBA
  fontHighlightColor?: [number, number, number, number]; // 高亮颜色
  fontDisabledColor?: [number, number, number, number];  // 禁用颜色
  fontShadowColor?: [number, number, number, number];    // 阴影颜色
  
  // 文本对齐
  horAlign?: 'left' | 'center' | 'right';              // 水平对齐
  verAlign?: 'start' | 'center' | 'flex-end';          // 垂直对齐
  fontJustificationH?: 'JUSTIFYLEFT' | 'JUSTIFYCENTER' | 'JUSTIFYRIGHT';
  fontJustificationV?: 'JUSTIFYTOP' | 'JUSTIFYMIDDLE' | 'JUSTIFYBOTTOM';
  
  // 字体设置
  font?: string;                       // 字体名称
  fontSize?: number;                   // 字体大小
  fontFlags?: string[];                // 字体标志 ['FIXEDSIZE', 'THICKOUTLINE']
  fontShadowOffset?: [number, number]; // 阴影偏移 [x, y]
  
  // ========== EDITBOX 属性 ==========
  multiline?: boolean;                 // 多行文本
  maxChars?: number;                   // 最大字符数
  editTextColor?: [number, number, number, number];      // 编辑文本颜色
  editCursorColor?: [number, number, number, number];    // 光标颜色
  editBorderColor?: [number, number, number, number];    // 边框颜色
  
  // ========== SLIDER 属性 ==========
  minValue?: number;                   // 最小值
  maxValue?: number;                   // 最大值
  stepSize?: number;                   // 步进值
  sliderInitialValue?: number;         // 初始值
  sliderLayoutHorizontal?: boolean;    // 水平布局
  sliderLayoutVertical?: boolean;      // 垂直布局
  
  // ========== CHECKBOX 属性 ==========
  checked?: boolean;                   // 勾选状态
  
  // ========== BUTTON 属性 ==========
  controlStyle?: string;               // 控件样式标志 "AUTOTRACK|HIGHLIGHTONMOUSEOVER"
  controlBackdrop?: string;            // 默认背景
  controlPushedBackdrop?: string;      // 按下背景
  controlDisabledBackdrop?: string;    // 禁用背景
  controlMouseOverHighlight?: string;  // 鼠标悬停高亮
  buttonPushedTextOffset?: [number, number]; // 按下文本偏移
  
  // ========== LISTBOX 属性 ==========
  listBoxItems?: string[];             // 列表项
  
  // ========== HIGHLIGHT 属性 ==========
  highlightType?: string;              // 高亮类型
  highlightAlphaFile?: string;         // 高亮Alpha文件
  highlightAlphaMode?: string;         // 高亮混合模式
  
  // ========== BACKDROP 背景属性 ==========
  backdropBackground?: string;         // 背景纹理
  backdropTileBackground?: boolean;    // 平铺背景
  backdropBackgroundSize?: number;     // 背景尺寸
  backdropBackgroundInsets?: [number, number, number, number]; // 背景内边距
  backdropEdgeFile?: string;           // 边框纹理
  backdropCornerFlags?: string;        // 角标志 "UL|UR|BL|BR|T|L|B|R"
  backdropCornerSize?: number;         // 角尺寸
  backdropBlendAll?: boolean;          // 混合所有层
  
  // ========== TEXTURE 属性 ==========
  textureFile?: string;                // 纹理文件路径
  texCoord?: [number, number, number, number]; // 纹理坐标 [left, right, top, bottom]
  alphaMode?: 'ALPHAKEY' | 'BLEND' | 'ADD';    // Alpha混合模式
  decorateFileNames?: boolean;         // 装饰文件名
  
  // ========== 功能属性 ==========
  trigVar?: string;                    // 触发器变量名
  arrayId?: string;                    // 数组ID
  isRelative?: boolean;                // 保留兼容性
  layer?: string;                      // 图层名称
  
  // ===== FDF 扩展数据 =====
  fdfMetadata?: FDFMetadata;           // FDF 元数据
  fdfTexture?: FDFTextureData;         // FDF 纹理数据
  fdfString?: FDFStringData;           // FDF 文本数据
  fdfBackdrop?: FDFBackdropData;       // FDF Backdrop 数据
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
    texture?: string;
    backdropBackground?: string;
    
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
  
  // 种族纹理配置
  currentRace?: 'Human' | 'Orc' | 'NightElf' | 'Undead' | 'Default';
  war3Skins?: War3Skins | null;
  
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
