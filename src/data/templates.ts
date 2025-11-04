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
  // ========== 基础控件 ==========
  {
    id: 'basic-backdrop',
    name: 'Backdrop',
    icon: '▭',
    category: 'basic',
    description: '基础背景框架',
    createFrame: () => ({
      name: 'Backdrop',
      type: FrameType.BACKDROP,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      diskTexture: '',
      wc3Texture: '',
      children: [],
    }),
  },
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
      diskTexture: '',
      wc3Texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-text',
    name: 'Text',
    icon: 'T',
    category: 'basic',
    description: '基础文本框',
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
      diskTexture: '',
      wc3Texture: '',
      children: [],
    }),
  },
  {
    id: 'basic-checkbox',
    name: 'Checkbox',
    icon: '☑',
    category: 'basic',
    description: '基础复选框',
    createFrame: () => ({
      name: 'Checkbox',
      type: FrameType.CHECKBOX,
      x: 0.1,
      y: 0.1,
      width: 0.1,
      height: 0.1,
      anchors: createDefaultAnchors(0.1, 0.1, 0.1, 0.1),
      diskTexture: '',
      wc3Texture: '',
      children: [],
    }),
  },

  // ========== 按钮类 ==========
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
      wc3Texture: 'ReplaceableTextures\\CommandButtons\\BTNSelectHeroOn.blp',
      diskTexture: '',
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
      diskTexture: '',
      wc3Texture: '',
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
      diskTexture: '',
      wc3Texture: '',
      children: [],
    }),
  },

  // ========== 文本类 ==========
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
      diskTexture: '',
      wc3Texture: '',
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
      diskTexture: '',
      wc3Texture: '',
      children: [],
    }),
  },

  // ========== 背景类 ==========
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
      wc3Texture: '',
      diskTexture: '',
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
      wc3Texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-border.blp',
      diskTexture: '',
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
      diskTexture: '',
      wc3Texture: '',
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
      diskTexture: '',
      wc3Texture: '',
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
      wc3Texture: 'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp',
      diskTexture: '',
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
            wc3Texture: 'ReplaceableTextures\\CommandButtons\\BTNSelectHeroOn.blp',
            diskTexture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
            wc3Texture: 'UI\\Widgets\\ToolTips\\Human\\human-tooltip-background.blp',
            diskTexture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
        wc3Texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
        textColor: 'rgba(0, 255, 0, 0.8)',
        diskTexture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
        wc3Texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
        textColor: 'rgba(0, 100, 255, 0.8)',
        diskTexture: '',
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
        wc3Texture: 'UI\\Widgets\\EscMenu\\Human\\editbox-background.blp',
        textColor: 'rgba(20, 20, 30, 0.95)',
        diskTexture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
        diskTexture: '',
        wc3Texture: '',
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
          diskTexture: '',
          wc3Texture: '',
          children: [],
        });
      }

      return frames;
    },
  },
];

