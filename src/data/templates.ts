import { FrameData, FrameType } from '../types';
import { createDefaultAnchors } from '../utils/anchorUtils';

/**
 * 预设模板定义
 */
export interface FrameTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'basic' | 'button' | 'text' | 'backdrop' | 'input' | 'bar';
  description: string;
  createFrame: () => Partial<FrameData>;
}

/**
 * 所有预设模板
 */
export const templates: FrameTemplate[] = [
  // ========== 基础容器 (4种) ==========
  {
    id: 'basic-origin',
    name: 'Origin',
    icon: '⊙',
    category: 'basic',
    description: '根容器框架',
    createFrame: () => ({
      name: 'Origin',
      type: FrameType.ORIGIN,
      x: 0,
      y: 0,
      width: 0.8,
      height: 0.6,
      anchors: createDefaultAnchors(0, 0, 0.8, 0.6),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-frame',
    name: 'Frame',
    icon: '□',
    category: 'basic',
    description: '通用框架容器',
    createFrame: () => ({
      name: 'Frame',
      type: FrameType.FRAME,
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.15,
      anchors: createDefaultAnchors(0.1, 0.1, 0.2, 0.15),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-backdrop',
    name: 'Backdrop',
    icon: '▭',
    category: 'basic',
    description: '背景框架',
    createFrame: () => ({
      name: 'Backdrop',
      type: FrameType.BACKDROP,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-simpleframe',
    name: 'SimpleFrame',
    icon: '▢',
    category: 'basic',
    description: '简单框架容器',
    createFrame: () => ({
      name: 'SimpleFrame',
      type: FrameType.SIMPLEFRAME,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.12,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.12),
      texture: '',
      children: [],
    }),
  },

  // ========== 文本控件 (3种) ==========
  {
    id: 'basic-text',
    name: 'Text Frame',
    icon: 'T',
    category: 'basic',
    description: '文本框架',
    createFrame: () => ({
      name: 'Text',
      type: FrameType.TEXT_FRAME,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      text: 'Text',
      textScale: 1,
      textColor: '#FFFFFF',
      horAlign: 'left',
      verAlign: 'start',
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-simplefontstring',
    name: 'SimpleFontString',
    icon: 'S',
    category: 'basic',
    description: '简单字符串',
    createFrame: () => ({
      name: 'SimpleFontString',
      type: FrameType.SIMPLEFONTSTRING,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.03,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.03),
      text: 'Simple Text',
      textScale: 1,
      textColor: '#FFFFFF',
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-textarea',
    name: 'TextArea',
    icon: '📝',
    category: 'basic',
    description: '文本区域',
    createFrame: () => ({
      name: 'TextArea',
      type: FrameType.TEXTAREA,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.08,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.08),
      text: 'Text Area',
      textScale: 1,
      textColor: '#FFFFFF',
      texture: '',
      children: [],
    }),
  },

  // ========== 按钮控件 (7种) ==========
  {
    id: 'basic-button',
    name: 'Button',
    icon: '🔘',
    category: 'basic',
    description: '基础按钮',
    createFrame: () => ({
      name: 'Button',
      type: FrameType.BUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-gluetextbutton',
    name: 'GlueTextButton',
    icon: '🔲',
    category: 'basic',
    description: 'Glue文本按钮',
    createFrame: () => ({
      name: 'GlueTextButton',
      type: FrameType.GLUETEXTBUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.12,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.12, 0.04),
      text: 'Glue Button',
      textScale: 1,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-gluebutton',
    name: 'GlueButton',
    icon: '🔳',
    category: 'basic',
    description: 'Glue按钮',
    createFrame: () => ({
      name: 'GlueButton',
      type: FrameType.GLUEBUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.04),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-simplebutton',
    name: 'SimpleButton',
    icon: '⬜',
    category: 'basic',
    description: '简单按钮',
    createFrame: () => ({
      name: 'SimpleButton',
      type: FrameType.SIMPLEBUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.08,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.08, 0.04),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-scriptdialogbutton',
    name: 'ScriptDialogButton',
    icon: '💬',
    category: 'basic',
    description: '脚本对话框按钮',
    createFrame: () => ({
      name: 'ScriptDialogButton',
      type: FrameType.SCRIPT_DIALOG_BUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.12,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.12, 0.04),
      text: 'Dialog Button',
      textScale: 1,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-browserbutton',
    name: 'BrowserButton',
    icon: '🌐',
    category: 'basic',
    description: '浏览器按钮',
    createFrame: () => ({
      name: 'BrowserButton',
      type: FrameType.BROWSER_BUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.04),
      text: 'Browser',
      textScale: 1,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-invisbutton',
    name: 'InvisButton',
    icon: '👻',
    category: 'basic',
    description: '不可见按钮',
    createFrame: () => ({
      name: 'InvisButton',
      type: FrameType.INVIS_BUTTON,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      texture: '',
      children: [],
    }),
  },

  // ========== 交互控件 (7种) ==========
  {
    id: 'basic-checkbox',
    name: 'Checkbox',
    icon: '☑',
    category: 'basic',
    description: '复选框',
    createFrame: () => ({
      name: 'Checkbox',
      type: FrameType.CHECKBOX,
      x: 0.1,
      y: 0.1,
      width: 0.03,
      height: 0.03,
      anchors: createDefaultAnchors(0.1, 0.1, 0.03, 0.03),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-editbox',
    name: 'EditBox',
    icon: '✏️',
    category: 'basic',
    description: '编辑框',
    createFrame: () => ({
      name: 'EditBox',
      type: FrameType.EDITBOX,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.03,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.03),
      text: '',
      textScale: 1,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-slider',
    name: 'Slider',
    icon: '🎚️',
    category: 'basic',
    description: '滑块',
    createFrame: () => ({
      name: 'Slider',
      type: FrameType.SLIDER,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.025,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.025),
      minValue: 0,
      maxValue: 100,
      stepSize: 1,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-scrollbar',
    name: 'ScrollBar',
    icon: '📜',
    category: 'basic',
    description: '滚动条',
    createFrame: () => ({
      name: 'ScrollBar',
      type: FrameType.SCROLLBAR,
      x: 0.1,
      y: 0.1,
      width: 0.02,
      height: 0.15,
      anchors: createDefaultAnchors(0.1, 0.1, 0.02, 0.15),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-listbox',
    name: 'ListBox',
    icon: '📋',
    category: 'basic',
    description: '列表框',
    createFrame: () => ({
      name: 'ListBox',
      type: FrameType.LISTBOX,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.12,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.12),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-menu',
    name: 'Menu',
    icon: '📂',
    category: 'basic',
    description: '菜单',
    createFrame: () => ({
      name: 'Menu',
      type: FrameType.MENU,
      x: 0.1,
      y: 0.1,
      width: 0.12,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.12, 0.04),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-popupmenu',
    name: 'PopupMenu',
    icon: '▼',
    category: 'basic',
    description: '弹出菜单',
    createFrame: () => ({
      name: 'PopupMenu',
      type: FrameType.POPUPMENU,
      x: 0.1,
      y: 0.1,
      width: 0.12,
      height: 0.04,
      anchors: createDefaultAnchors(0.1, 0.1, 0.12, 0.04),
      texture: '',
      children: [],
    }),
  },

  // ========== 图形控件 (3种) ==========
  {
    id: 'basic-sprite',
    name: 'Sprite',
    icon: '🎨',
    category: 'basic',
    description: '精灵图形 (2D动画模型)',
    createFrame: () => ({
      name: 'Sprite',
      type: FrameType.SPRITE,
      x: 0.1,
      y: 0.1,
      width: 0.08,
      height: 0.08,
      anchors: createDefaultAnchors(0.1, 0.1, 0.08, 0.08),
      texture: '',
      backgroundArt: '', // MDX/MDL 模型文件
      layerStyle: '',
      children: [],
    }),
  },
  {
    id: 'basic-model',
    name: 'Model',
    icon: '🎭',
    category: 'basic',
    description: '3D模型',
    createFrame: () => ({
      name: 'Model',
      type: FrameType.MODEL,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      texture: '',
      backgroundArt: '', // MDX/MDL 模型文件
      layerStyle: 'NOSHADING',
      children: [],
    }),
  },
  {
    id: 'basic-highlight',
    name: 'Highlight',
    icon: '✨',
    category: 'basic',
    description: '高亮效果',
    createFrame: () => ({
      name: 'Highlight',
      type: FrameType.HIGHLIGHT,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      texture: '',
      children: [],
    }),
  },

  // ========== 状态栏 (2种) ==========
  {
    id: 'basic-simplestatusbar',
    name: 'SimpleStatusBar',
    icon: '▬',
    category: 'basic',
    description: '简单状态栏',
    createFrame: () => ({
      name: 'SimpleStatusBar',
      type: FrameType.SIMPLESTATUSBAR,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.015,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.015),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-statusbar',
    name: 'StatusBar',
    icon: '═',
    category: 'basic',
    description: '状态栏',
    createFrame: () => ({
      name: 'StatusBar',
      type: FrameType.STATUSBAR,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.02,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.02),
      texture: '',
      children: [],
    }),
  },

  // ========== 其他控件 (3种) ==========
  {
    id: 'basic-control',
    name: 'Control',
    icon: '⚙️',
    category: 'basic',
    description: '通用控件',
    createFrame: () => ({
      name: 'Control',
      type: FrameType.CONTROL,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-dialog',
    name: 'Dialog',
    icon: '💭',
    category: 'basic',
    description: '对话框',
    createFrame: () => ({
      name: 'Dialog',
      type: FrameType.DIALOG,
      x: 0.1,
      y: 0.1,
      width: 0.3,
      height: 0.2,
      anchors: createDefaultAnchors(0.1, 0.1, 0.3, 0.2),
      texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-timertext',
    name: 'TimerText',
    icon: '⏱️',
    category: 'basic',
    description: '计时器文本',
    createFrame: () => ({
      name: 'TimerText',
      type: FrameType.TIMERTEXT,
      x: 0.1,
      y: 0.1,
      width: 0.08,
      height: 0.03,
      anchors: createDefaultAnchors(0.1, 0.1, 0.08, 0.03),
      text: '00:00',
      textScale: 1,
      textColor: '#FFFFFF',
      texture: '',
      children: [],
    }),
  },

  // ========== 兼容旧模板 ==========
  {
    id: 'basic-horizontalbar',
    name: 'HorizontalBar',
    icon: '▬',
    category: 'basic',
    description: '水平进度条(旧)',
    createFrame: () => ({
      name: 'HorizontalBar',
      type: FrameType.HORIZONTAL_BAR,
      x: 0.1,
      y: 0.1,
      width: 0.15,
      height: 0.02,
      anchors: createDefaultAnchors(0.1, 0.1, 0.15, 0.02),
      texture: '',
      children: [],
    }),
  },

  // ========== 按钮类（预设样式）==========
  {
    id: 'icon-button',
    name: '图标按钮',
    icon: '🔘',
    category: 'button',
    description: '带图标的可点击按钮',
    createFrame: () => ({
      name: '图标按钮',
      type: FrameType.BUTTON,
      x: 0.35,
      y: 0.25,
      width: 0.04,
      height: 0.04,
      anchors: createDefaultAnchors(0.35, 0.25, 0.04, 0.04),
      text: '',
      texture: 'ReplaceableTextures\\CommandButtons\\BTNSelectHeroOn.blp',
      children: [],
    }),
  },
  {
    id: 'script-dialog-button',
    name: '对话框按钮',
    icon: '📝',
    category: 'button',
    description: '带文本的对话框按钮',
    createFrame: () => ({
      name: '对话框按钮',
      type: FrameType.SCRIPT_DIALOG_BUTTON,
      x: 0.3,
      y: 0.25,
      width: 0.15,
      height: 0.04,
      anchors: createDefaultAnchors(0.3, 0.25, 0.15, 0.04),
      text: '按钮',
      textScale: 1.0,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'browser-button',
    name: '浏览器按钮',
    icon: '🔲',
    category: 'button',
    description: '蓝色风格的浏览器按钮',
    createFrame: () => ({
      name: '浏览器按钮',
      type: FrameType.BROWSER_BUTTON,
      x: 0.3,
      y: 0.25,
      width: 0.15,
      height: 0.04,
      anchors: createDefaultAnchors(0.3, 0.25, 0.15, 0.04),
      text: '浏览',
      textScale: 1.0,
      texture: '',
      children: [],
    }),
  },

  // ========== 文本类（预设样式）==========
  {
    id: 'text-frame',
    name: '文本框',
    icon: '📄',
    category: 'text',
    description: '显示文本的框架',
    createFrame: () => ({
      name: '文本',
      type: FrameType.TEXT_FRAME,
      x: 0.25,
      y: 0.25,
      width: 0.2,
      height: 0.05,
      anchors: createDefaultAnchors(0.25, 0.25, 0.2, 0.05),
      text: '文本内容',
      textScale: 1.0,
      textColor: 'rgba(255, 255, 255, 1)',
      texture: '',
      children: [],
    }),
  },
  {
    id: 'title-text',
    name: '标题文本',
    icon: '📌',
    category: 'text',
    description: '大号标题文本',
    createFrame: () => ({
      name: '标题',
      type: FrameType.TEXT_FRAME,
      x: 0.25,
      y: 0.4,
      width: 0.3,
      height: 0.06,
      anchors: createDefaultAnchors(0.25, 0.4, 0.3, 0.06),
      text: '标题文本',
      textScale: 1.5,
      textColor: 'rgba(255, 220, 100, 1)',
      texture: '',
      children: [],
    }),
  },

  // ========== 背景类（预设样式）==========
  {
    id: 'backdrop-panel',
    name: '面板背景',
    icon: '🖼️',
    category: 'backdrop',
    description: '半透明黑色背景面板',
    createFrame: () => ({
      name: '背景面板',
      type: FrameType.BACKDROP,
      x: 0.15,
      y: 0.15,
      width: 0.4,
      height: 0.3,
      anchors: createDefaultAnchors(0.15, 0.15, 0.4, 0.3),
      texture: '',
      textColor: 'rgba(0, 0, 0, 0.7)',
      children: [],
    }),
  },
  {
    id: 'backdrop-border',
    name: '边框背景',
    icon: '🔳',
    category: 'backdrop',
    description: '带边框的装饰性背景',
    createFrame: () => ({
      name: '边框',
      type: FrameType.BACKDROP,
      x: 0.2,
      y: 0.2,
      width: 0.3,
      height: 0.2,
      anchors: createDefaultAnchors(0.2, 0.2, 0.3, 0.2),
      texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-border.blp',
      children: [],
    }),
  },

  // ========== 输入类 ==========
  {
    id: 'edit-box',
    name: '编辑框',
    icon: '✏️',
    category: 'input',
    description: '可编辑的文本输入框',
    createFrame: () => ({
      name: '输入框',
      type: FrameType.EDITBOX,
      x: 0.25,
      y: 0.25,
      width: 0.2,
      height: 0.03,
      anchors: createDefaultAnchors(0.25, 0.25, 0.2, 0.03),
      text: '',
      textScale: 1.0,
      texture: '',
      children: [],
    }),
  },
  {
    id: 'checkbox',
    name: '复选框',
    icon: '☑️',
    category: 'input',
    description: '可勾选的复选框',
    createFrame: () => ({
      name: '复选框',
      type: FrameType.CHECKBOX,
      x: 0.35,
      y: 0.25,
      width: 0.03,
      height: 0.03,
      anchors: createDefaultAnchors(0.35, 0.25, 0.03, 0.03),
      texture: '',
      children: [],
    }),
  },

  // ========== 进度条类 ==========
  {
    id: 'progress-bar',
    name: '进度条',
    icon: '📊',
    category: 'bar',
    description: '水平进度条',
    createFrame: () => ({
      name: '进度条',
      type: FrameType.HORIZONTAL_BAR,
      x: 0.25,
      y: 0.25,
      width: 0.2,
      height: 0.02,
      anchors: createDefaultAnchors(0.25, 0.25, 0.2, 0.02),
      texture: 'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp',
      children: [],
    }),
  },
];

/**
 * 根据类别获取模板
 */
export const getTemplatesByCategory = (category: string): FrameTemplate[] => {
  return templates.filter(t => t.category === category);
};

/**
 * 根据ID获取模板
 */
export const getTemplateById = (id: string): FrameTemplate | undefined => {
  return templates.find(t => t.id === id);
};

/**
 * 获取所有类别
 */
export const getCategories = (): { id: string; name: string; icon: string }[] => {
  return [
    { id: 'basic', name: '基础控件', icon: '🔧' },
    { id: 'button', name: '按钮', icon: '🔘' },
    { id: 'text', name: '文本', icon: '📄' },
    { id: 'backdrop', name: '背景', icon: '🖼️' },
    { id: 'input', name: '输入', icon: '✏️' },
    { id: 'bar', name: '进度条', icon: '📊' },
    { id: 'layout', name: '布局组合', icon: '📦' },
  ];
};

// ========== 布局组合类（多控件模板）==========
/**
 * 组合模板接口 - 包含多个控件的复杂布局
 */
export interface CompositeTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'layout';
  description: string;
  createFrames: () => Partial<FrameData>[];
}

/**
 * 组合模板库
 */
export const compositeTemplates: CompositeTemplate[] = [
  {
    id: 'skillbar-4x3',
    name: '技能栏 (4x3)',
    icon: '🎮',
    category: 'layout',
    description: '4行3列技能按钮布局',
    createFrames: () => {
      const frames: Partial<FrameData>[] = [];
      const buttonSize = 0.035;
      const gap = 0.005;
      const startX = 0.3;
      const startY = 0.2;

      // 创建12个技能按钮
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 3; col++) {
          const index = row * 3 + col;
          frames.push({
            name: `技能按钮${index + 1}`,
            type: FrameType.BUTTON,
            x: startX + col * (buttonSize + gap),
            y: startY + row * (buttonSize + gap),
            width: buttonSize,
            height: buttonSize,
            anchors: createDefaultAnchors(
              startX + col * (buttonSize + gap),
              startY + row * (buttonSize + gap),
              buttonSize,
              buttonSize
            ),
            texture: 'ReplaceableTextures\\CommandButtons\\BTNSelectHeroOn.blp',
            children: [],
          });
        }
      }

      return frames;
    },
  },

  {
    id: 'inventory-3x2',
    name: '背包 (3x2)',
    icon: '🎒',
    category: 'layout',
    description: '3列2行物品槽布局',
    createFrames: () => {
      const frames: Partial<FrameData>[] = [];
      const slotSize = 0.04;
      const gap = 0.005;
      const startX = 0.3;
      const startY = 0.25;

      // 背景
      frames.push({
        name: '背包背景',
        type: FrameType.BACKDROP,
        x: startX - 0.01,
        y: startY - 0.01,
        width: 3 * slotSize + 2 * gap + 0.02,
        height: 2 * slotSize + gap + 0.02,
        anchors: createDefaultAnchors(
          startX - 0.01,
          startY - 0.01,
          3 * slotSize + 2 * gap + 0.02,
          2 * slotSize + gap + 0.02
        ),
        textColor: 'rgba(0, 0, 0, 0.7)',
        children: [],
      });

      // 创建6个物品槽
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 3; col++) {
          const index = row * 3 + col;
          frames.push({
            name: `物品槽${index + 1}`,
            type: FrameType.BUTTON,
            x: startX + col * (slotSize + gap),
            y: startY + row * (slotSize + gap),
            width: slotSize,
            height: slotSize,
            anchors: createDefaultAnchors(
              startX + col * (slotSize + gap),
              startY + row * (slotSize + gap),
              slotSize,
              slotSize
            ),
            texture: 'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp',
            children: [],
          });
        }
      }

      return frames;
    },
  },

  {
    id: 'status-bars',
    name: '状态栏',
    icon: '💚',
    category: 'layout',
    description: 'HP/MP进度条组合',
    createFrames: () => {
      const frames: Partial<FrameData>[] = [];
      const barWidth = 0.15;
      const barHeight = 0.015;
      const startX = 0.3;
      const startY = 0.3;
      const gap = 0.01;

      // HP条背景
      frames.push({
        name: 'HP条背景',
        type: FrameType.BACKDROP,
        x: startX,
        y: startY,
        width: barWidth,
        height: barHeight,
        anchors: createDefaultAnchors(startX, startY, barWidth, barHeight),
        textColor: 'rgba(50, 0, 0, 0.8)',
        texture: '',
        children: [],
      });

      // HP条
      frames.push({
        name: 'HP条',
        type: FrameType.HORIZONTAL_BAR,
        x: startX + 0.002,
        y: startY + 0.002,
        width: barWidth - 0.004,
        height: barHeight - 0.004,
        anchors: createDefaultAnchors(
          startX + 0.002,
          startY + 0.002,
          barWidth - 0.004,
          barHeight - 0.004
        ),
        texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
        textColor: 'rgba(0, 255, 0, 0.8)',
        children: [],
      });

      // MP条背景
      frames.push({
        name: 'MP条背景',
        type: FrameType.BACKDROP,
        x: startX,
        y: startY + barHeight + gap,
        width: barWidth,
        height: barHeight,
        anchors: createDefaultAnchors(
          startX,
          startY + barHeight + gap,
          barWidth,
          barHeight
        ),
        textColor: 'rgba(0, 0, 50, 0.8)',
        texture: '',
        children: [],
      });

      // MP条
      frames.push({
        name: 'MP条',
        type: FrameType.HORIZONTAL_BAR,
        x: startX + 0.002,
        y: startY + barHeight + gap + 0.002,
        width: barWidth - 0.004,
        height: barHeight - 0.004,
        anchors: createDefaultAnchors(
          startX + 0.002,
          startY + barHeight + gap + 0.002,
          barWidth - 0.004,
          barHeight - 0.004
        ),
        texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
        textColor: 'rgba(0, 100, 255, 0.8)',
        children: [],
      });

      return frames;
    },
  },

  {
    id: 'dialog-box',
    name: '对话框',
    icon: '💬',
    category: 'layout',
    description: '标准对话框布局',
    createFrames: () => {
      const frames: Partial<FrameData>[] = [];
      const dialogWidth = 0.3;
      const dialogHeight = 0.2;
      const startX = 0.35;
      const startY = 0.3;

      // 对话框背景
      frames.push({
        name: '对话框背景',
        type: FrameType.BACKDROP,
        x: startX,
        y: startY,
        width: dialogWidth,
        height: dialogHeight,
        anchors: createDefaultAnchors(startX, startY, dialogWidth, dialogHeight),
        texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
        textColor: 'rgba(20, 20, 30, 0.95)',
        children: [],
      });

      // 标题
      frames.push({
        name: '对话框标题',
        type: FrameType.TEXT_FRAME,
        x: startX + 0.01,
        y: startY + 0.01,
        width: dialogWidth - 0.02,
        height: 0.03,
        anchors: createDefaultAnchors(
          startX + 0.01,
          startY + 0.01,
          dialogWidth - 0.02,
          0.03
        ),
        text: '对话框标题',
        textScale: 1.2,
        textColor: 'rgba(255, 220, 100, 1)',
        horAlign: 'center',
        texture: '',
        children: [],
      });

      // 内容文本
      frames.push({
        name: '对话框内容',
        type: FrameType.TEXT_FRAME,
        x: startX + 0.01,
        y: startY + 0.05,
        width: dialogWidth - 0.02,
        height: 0.1,
        anchors: createDefaultAnchors(
          startX + 0.01,
          startY + 0.05,
          dialogWidth - 0.02,
          0.1
        ),
        text: '这里是对话框的内容文本',
        textScale: 1.0,
        textColor: 'rgba(255, 255, 255, 1)',
        texture: '',
        children: [],
      });

      // 确定按钮
      frames.push({
        name: '确定按钮',
        type: FrameType.SCRIPT_DIALOG_BUTTON,
        x: startX + 0.05,
        y: startY + dialogHeight - 0.045,
        width: 0.08,
        height: 0.035,
        anchors: createDefaultAnchors(
          startX + 0.05,
          startY + dialogHeight - 0.045,
          0.08,
          0.035
        ),
        text: '确定',
        textScale: 1.0,
        texture: '',
        children: [],
      });

      // 取消按钮
      frames.push({
        name: '取消按钮',
        type: FrameType.SCRIPT_DIALOG_BUTTON,
        x: startX + dialogWidth - 0.13,
        y: startY + dialogHeight - 0.045,
        width: 0.08,
        height: 0.035,
        anchors: createDefaultAnchors(
          startX + dialogWidth - 0.13,
          startY + dialogHeight - 0.045,
          0.08,
          0.035
        ),
        text: '取消',
        textScale: 1.0,
        texture: '',
        children: [],
      });

      return frames;
    },
  },

  {
    id: 'button-group-horizontal',
    name: '按钮组 (横)',
    icon: '⬌',
    category: 'layout',
    description: '水平排列的3个按钮',
    createFrames: () => {
      const frames: Partial<FrameData>[] = [];
      const buttonWidth = 0.1;
      const buttonHeight = 0.035;
      const gap = 0.01;
      const startX = 0.25;
      const startY = 0.3;

      for (let i = 0; i < 3; i++) {
        frames.push({
          name: `按钮${i + 1}`,
          type: FrameType.SCRIPT_DIALOG_BUTTON,
          x: startX + i * (buttonWidth + gap),
          y: startY,
          width: buttonWidth,
          height: buttonHeight,
          anchors: createDefaultAnchors(
            startX + i * (buttonWidth + gap),
            startY,
            buttonWidth,
            buttonHeight
          ),
          text: `按钮 ${i + 1}`,
          textScale: 1.0,
          texture: '',
          children: [],
        });
      }

      return frames;
    },
  },
];

