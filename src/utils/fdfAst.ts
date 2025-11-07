/**
 * FDF (Frame Definition File) 抽象语法树类型定义
 * 
 * 基于 Warcraft III 原生 UI FDF 格式
 */

// ==================== 基础类型 ====================

export type FDFValue = 
  | string 
  | number 
  | boolean 
  | FDFValue[]
  | { [key: string]: FDFValue };

export interface FDFPosition {
  line: number;
  column: number;
}

export interface FDFLocation {
  start: FDFPosition;
  end: FDFPosition;
}

// ==================== AST 节点类型 ====================

export enum FDFNodeType {
  // 顶层
  PROGRAM = 'Program',
  INCLUDE = 'Include',
  COMMENT = 'Comment',
  
  // Frame 定义
  FRAME_DEFINITION = 'FrameDefinition',
  TEXTURE_DEFINITION = 'TextureDefinition',
  STRING_DEFINITION = 'StringDefinition',
  
  // 属性
  PROPERTY = 'Property',
  NESTED_FRAME = 'NestedFrame',
  
  // 值类型
  IDENTIFIER = 'Identifier',
  STRING_LITERAL = 'StringLiteral',
  NUMBER_LITERAL = 'NumberLiteral',
  BOOLEAN_LITERAL = 'BooleanLiteral',
  ARRAY_LITERAL = 'ArrayLiteral',
}

export interface FDFNode {
  type: FDFNodeType;
  loc?: FDFLocation;
}

// ==================== 顶层节点 ====================

export interface FDFProgram extends FDFNode {
  type: FDFNodeType.PROGRAM;
  body: (FDFInclude | FDFFrameDefinition | FDFTextureDefinition | FDFStringDefinition | FDFComment)[];
}

export interface FDFInclude extends FDFNode {
  type: FDFNodeType.INCLUDE;
  path: string;
}

export interface FDFComment extends FDFNode {
  type: FDFNodeType.COMMENT;
  value: string;
  multiline: boolean;
}

// ==================== Frame 定义 ====================

export interface FDFFrameDefinition extends FDFNode {
  type: FDFNodeType.FRAME_DEFINITION;
  frameType: string; // "FRAME", "BACKDROP", "TEXT", "BUTTON", etc.
  name: string;
  inherits?: string; // INHERITS "TemplateName"
  withChildren?: boolean; // INHERITS WITHCHILDREN - 是否继承子控件
  properties: (FDFProperty | FDFNestedFrame)[];
}

export interface FDFTextureDefinition extends FDFNode {
  type: FDFNodeType.TEXTURE_DEFINITION;
  name?: string;
  inherits?: string;
  properties: FDFProperty[];
}

export interface FDFStringDefinition extends FDFNode {
  type: FDFNodeType.STRING_DEFINITION;
  name: string;
  inherits?: string;
  properties: FDFProperty[];
}

// ==================== 嵌套 Frame ====================

export interface FDFNestedFrame extends FDFNode {
  type: FDFNodeType.NESTED_FRAME;
  frameType: string;
  name?: string;
  inherits?: string;
  withChildren?: boolean; // INHERITS WITHCHILDREN
  properties: (FDFProperty | FDFNestedFrame)[];
}

// ==================== 属性 ====================

export interface FDFProperty extends FDFNode {
  type: FDFNodeType.PROPERTY;
  name: string;
  value: FDFPropertyValue;
}

export type FDFPropertyValue = 
  | FDFIdentifier
  | FDFStringLiteral
  | FDFNumberLiteral
  | FDFBooleanLiteral
  | FDFArrayLiteral;

export interface FDFIdentifier extends FDFNode {
  type: FDFNodeType.IDENTIFIER;
  name: string;
}

export interface FDFStringLiteral extends FDFNode {
  type: FDFNodeType.STRING_LITERAL;
  value: string;
}

export interface FDFNumberLiteral extends FDFNode {
  type: FDFNodeType.NUMBER_LITERAL;
  value: number;
}

export interface FDFBooleanLiteral extends FDFNode {
  type: FDFNodeType.BOOLEAN_LITERAL;
  value: boolean;
}

export interface FDFArrayLiteral extends FDFNode {
  type: FDFNodeType.ARRAY_LITERAL;
  elements: FDFPropertyValue[];
}

// ==================== 辅助类型 ====================

/**
 * 所有支持的 Frame 类型
 */
export const FDF_FRAME_TYPES = [
  'FRAME',
  'BACKDROP',
  'TEXT',
  'BUTTON',
  'GLUETEXTBUTTON',
  'GLUEBUTTON',
  'HIGHLIGHT',
  'SPRITE',
  'MODEL',
  'SLIDER',
  'SIMPLEFRAME',
  'SIMPLEBUTTON',
  'SIMPLEFONTSTRING',
  'SIMPLESTATUSBAR',
  'EDITBOX',
  'SCROLLBAR',
  'LISTBOX',
  'MENU',
  'POPUPMENU',
  'CHECKBOX',
  'DIALOG',
  'CONTROL',
] as const;

export type FDFFrameType = typeof FDF_FRAME_TYPES[number];

/**
 * 所有支持的属性名称
 */
export const FDF_PROPERTIES = {
  // 通用属性
  Width: 'number',
  Height: 'number',
  SetAllPoints: 'boolean',
  DecorateFileNames: 'boolean',
  
  // 锚点相关
  Anchor: 'array', // [point, x, y] or [point, relativeTo, relativePoint, x, y]
  SetPoint: 'array', // [point, relativeTo, relativePoint, x, y]
  
  // 文本相关
  Text: 'string',
  Font: 'array', // [fontName, height, flags]
  FrameFont: 'array', // [fontName, height, flags]
  FontJustificationH: 'identifier', // JUSTIFYLEFT, JUSTIFYCENTER, JUSTIFYRIGHT
  FontJustificationV: 'identifier', // JUSTIFYTOP, JUSTIFYMIDDLE, JUSTIFYBOTTOM
  FontFlags: 'string',
  FontColor: 'array', // [r, g, b, a]
  FontHighlightColor: 'array',
  FontDisabledColor: 'array',
  FontShadowColor: 'array',
  FontShadowOffset: 'array', // [x, y]
  TextLength: 'number',
  
  // Backdrop 相关
  BackdropTileBackground: 'boolean',
  BackdropBackground: 'string',
  BackdropCornerFlags: 'string', // "UL|UR|BL|BR|T|L|B|R"
  BackdropCornerSize: 'number',
  BackdropBackgroundSize: 'number',
  BackdropBackgroundInsets: 'array', // [left, top, right, bottom]
  BackdropEdgeFile: 'string',
  BackdropBlendAll: 'boolean',
  
  // Texture 相关
  File: 'string',
  TexCoord: 'array', // [left, right, top, bottom]
  AlphaMode: 'string', // "ALPHAKEY", "BLEND", "ADD"
  
  // Button 相关
  ControlStyle: 'string', // "AUTOTRACK|HIGHLIGHTONMOUSEOVER"
  ButtonPushedTextOffset: 'array', // [x, y]
  ControlBackdrop: 'string',
  ControlPushedBackdrop: 'string',
  ControlDisabledBackdrop: 'string',
  ControlDisabledPushedBackdrop: 'string',
  ControlMouseOverHighlight: 'string',
  
  // Highlight 相关
  HighlightType: 'string', // "FILETEXTURE"
  HighlightAlphaFile: 'string',
  HighlightAlphaMode: 'string', // "ADD", "BLEND"
  
  // 其他
  Texture: 'nested', // 嵌套 Texture 块
  String: 'nested', // 嵌套 String 块
} as const;

export type FDFPropertyName = keyof typeof FDF_PROPERTIES;
