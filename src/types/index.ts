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

export interface FrameData {
  id: string;
  name: string;
  type: FrameType;
  x: number;                   // 编辑器内部使用（左下角X坐标）
  y: number;                   // 编辑器内部使用（左下角Y坐标）
  width: number;               // 编辑器内部使用
  height: number;              // 编辑器内部使用
  z: number;
  parentId: string | null;
  children: string[];
  tooltip: boolean;
  isRelative: boolean;
  locked?: boolean;            // 是否锁定（锁定后不能移动/编辑/删除）
  
  // 锚点系统 - 用于代码导出
  anchors: FrameAnchor[];      // 支持多个锚点（通常使用TOPLEFT和BOTTOMRIGHT）
  
  // 兼容旧版本 - 废弃但保留
  anchorPoint?: FramePoint;
  
  // 纹理属性
  diskTexture: string;
  wc3Texture: string;
  backDiskTexture?: string;
  backWc3Texture?: string;
  
  // 文本属性
  text?: string;
  textScale?: number;
  textColor?: string;
  horAlign?: 'left' | 'center' | 'right';
  verAlign?: 'start' | 'center' | 'flex-end';
  
  // EDITBOX 属性
  multiline?: boolean;
  
  // SLIDER 属性
  minValue?: number;
  maxValue?: number;
  stepSize?: number;
  
  // CHECKBOX 属性
  checked?: boolean;
  
  // 功能属性
  trigVar?: string;
  
  // Array属性
  arrayId?: string;
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

export interface ProjectData {
  libraryName: string;
  originMode: 'gameui' | 'worldframe' | 'consoleui';
  hideGameUI: boolean;
  hideHeroBar: boolean;
  hideMiniMap: boolean;
  hideResources: boolean;
  hideButtonBar: boolean;
  hidePortrait: boolean;
  hideChat: boolean;
  appInterface: string;
  backgroundImage?: string; // 画布背景图路径
  frames: Record<string, FrameData>;
  rootFrameIds: string[];
  tableArrays: TableArrayData[];
  circleArrays: CircleArrayData[];
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

export type SelectionMode = 'normal' | 'zoom' | 'drag';
