// ============================================================
// textLayout — 文本测量/布局/渲染引擎
// ============================================================
// 将 FrameData 的文字属性渲染到 OffscreenCanvas，
// 输出 THREE.CanvasTexture 用于 WebGL 渲染。
// 比 SDF 字体方案简单得多，且支持所有 CSS 字体特性。

import * as THREE from 'three';
import type { FrameData } from '../types';
import { FrameType } from '../types';
import { wc3ToPixelW, wc3ToPixelH } from '../utils/coordinateService';
import { resolveButtonState, type ButtonState } from './buttonState';
import { getResolvedFontFamily } from './fontResolver';

/** 缓存 key = text + style hash → CanvasTexture */
const textTextureCache = new Map<string, THREE.CanvasTexture>();

/** RGBA 数组转 CSS 字符串 */
function rgbaToCSS(rgba: [number, number, number, number] | undefined): string {
  if (!rgba) return '#ffffff';
  return `rgba(${rgba[0]}, ${rgba[1]}, ${rgba[2]}, ${rgba[3] / 255})`;
}

/** 文本内边距: TextAreaInset (WC3 单位) 优先, 否则历史默认 2px. 返回单边像素值(未乘 scale). */
export function getTextInsetPx(frame: FrameData): number {
  if (typeof frame.textAreaInset === 'number') {
    return Math.max(0, wc3ToPixelW(frame.textAreaInset));
  }
  return 2;
}

/**
 * 行高: ChatDisplayLineHeight > TextAreaLineHeight > 历史默认(fontSize * 1.2 / scale).
 * 返回未乘 scale 的像素值; 调用方再乘当前 canvas scale.
 */
export function getTextLineHeightPx(frame: FrameData, baseFontSizePx: number): number {
  const explicit = frame.chatDisplayLineHeight ?? frame.textAreaLineHeight;
  if (typeof explicit === 'number') {
    const lineGap = typeof frame.textAreaLineGap === 'number' ? wc3ToPixelH(frame.textAreaLineGap) : 0;
    return Math.max(1, wc3ToPixelH(explicit) + lineGap);
  }
  return Math.max(1, baseFontSizePx * 1.2);
}

/** 最大可见行数: 仅在 TextAreaMaxLines 设置时裁剪. */
export function applyMaxLines(lines: string[], frame: FrameData): string[] {
  if (typeof frame.textAreaMaxLines !== 'number' || !Number.isFinite(frame.textAreaMaxLines)) {
    return lines;
  }
  return lines.slice(0, Math.max(0, Math.floor(frame.textAreaMaxLines)));
}

/**
 * 预处理渲染文本：应用 TextLength / maxChars / PASSWORDFIELD.
 *
 * 目标是贴近 WC3 的“最终可见文本”，让设计器里的截断结果与游戏一致。
 */
export function getRenderableText(frame: FrameData): string {
  let text = frame.text ?? '';

  const charLimit = frame.maxChars ?? frame.textLength;
  if (typeof charLimit === 'number' && Number.isFinite(charLimit) && charLimit >= 0) {
    text = text.slice(0, Math.max(0, Math.floor(charLimit)));
  }

  if (frame.fontFlags?.includes('PASSWORDFIELD')) {
    text = text.replace(/[^\r\n]/g, '*');
  }

  return text;
}

/** 生成文本样式的 cache key */
function makeTextKey(frame: FrameData, pixelW: number, pixelH: number, state: ButtonState): string {
  const renderedText = getRenderableText(frame);
  return JSON.stringify({
    t: renderedText,
    ts: frame.textScale,
    tc: frame.textColor,
    fc: frame.fontColor,
    ff: frame.font,
    fs: frame.fontSize,
    ffl: frame.fontFlags,
    fso: frame.fontShadowOffset,
    fsc: frame.fontShadowColor,
    fjo: frame.fontJustificationOffset,
    ha: frame.horAlign ?? frame.fontJustificationH,
    va: frame.verAlign ?? frame.fontJustificationV,
    w: pixelW,
    h: pixelH,
    etc: frame.editTextColor,
    typ: frame.type,
    tl: frame.textLength,
    mc: frame.maxChars,
    tahi: frame.textAreaLineHeight,
    tag: frame.textAreaLineGap,
    tai: frame.textAreaInset,
    taml: frame.textAreaMaxLines,
    cdlh: frame.chatDisplayLineHeight,
    // 按钮态独立缓存: pushed 加 buttonPushedTextOffset; disabled/mouseover 换颜色.
    st: state,
    bpo: frame.buttonPushedTextOffset,
    fdc: frame.fontDisabledColor,
    fhc: frame.fontHighlightColor,
    mth: frame.menuTextHighlightColor,
  });
}

/** 解析水平对齐方式 */
function getTextAlign(frame: FrameData): CanvasTextAlign {
  if (frame.fontJustificationH === 'JUSTIFYRIGHT' || frame.horAlign === 'right') return 'right';
  if (frame.fontJustificationH === 'JUSTIFYCENTER' || frame.horAlign === 'center') return 'center';
  return 'left';
}

/** 解析垂直对齐方式 → y 起始位置 */
function getTextY(frame: FrameData, canvasH: number, textH: number): number {
  if (frame.fontJustificationV === 'JUSTIFYBOTTOM' || frame.verAlign === 'flex-end') {
    return canvasH - textH;
  }
  if (frame.fontJustificationV === 'JUSTIFYMIDDLE' || frame.verAlign === 'center') {
    return (canvasH - textH) / 2;
  }
  return 0; // TOP
}

/**
 * 渲染帧文字到 CanvasTexture
 * 返回 null 表示该帧无文字
 *
 * @param state Button/Checkbox 预览态 — pushed 时额外应用
 *              buttonPushedTextOffset; disabled/mouseover 时切换文字颜色.
 *              默认 'normal' (非按钮类帧等同于 normal).
 */
export function renderTextTexture(
  frame: FrameData,
  pixelW: number,
  pixelH: number,
  state: ButtonState = 'normal',
): THREE.CanvasTexture | null {
  const renderableText = getRenderableText(frame);
  if (!renderableText || pixelW <= 0 || pixelH <= 0) return null;

  const cacheKey = makeTextKey(frame, pixelW, pixelH, state);
  const cached = textTextureCache.get(cacheKey);
  if (cached) return cached;

  // 创建 offscreen canvas (使用 2x 分辨率保证清晰度)
  const scale = 2;
  const cw = Math.ceil(pixelW * scale);
  const ch = Math.ceil(pixelH * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 清除
  ctx.clearRect(0, 0, cw, ch);

  // 字体
  // FDF FrameFont 的高度参数是 WC3 单位 (e.g. 0.011)，与 frame.width / fontShadowOffset
  // 相同。必须经 wc3ToPixelH 转像素，否则 0.011 * 2x scale ≈ 0.022 px = 不可见。
  // 当 fontSize 缺失时，回退到 textScale * 14 px (历史默认，px 单位)。
  const baseFontSize = frame.fontSize
    ? wc3ToPixelH(frame.fontSize)
    : (frame.textScale || 1) * 14;
  const fontSize = baseFontSize * scale;
  const fontFamily = getResolvedFontFamily(frame.font) || frame.font || 'Arial, sans-serif';
  const fontWeight = frame.fontFlags?.includes('BOLD') ? 'bold' : 'normal';
  const fontStyle = frame.fontFlags?.includes('ITALIC') ? 'italic' : 'normal';
  ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

  // 颜色
  let textColor = '#ffffff';
  if (frame.type === FrameType.EDITBOX && frame.editTextColor) {
    textColor = rgbaToCSS(frame.editTextColor);
  } else if (frame.fontColor) {
    textColor = rgbaToCSS(frame.fontColor);
  } else if (frame.textColor) {
    textColor = frame.textColor;
  }

  // Button/Checkbox 状态覆盖: disabled→fontDisabledColor, mouseover→menu/fontHighlightColor.
  // resolveButtonState 统一处理优先级 + 缺省回退.
  const resolved = resolveButtonState(frame, state);
  if (resolved.textColor) {
    textColor = rgbaToCSS(resolved.textColor);
  }

  // 对齐
  const textAlign = getTextAlign(frame);
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'top';

  // 换行处理
  const insetPx = getTextInsetPx(frame);
  const paddedWidth = Math.max(0, cw - insetPx * 2 * scale);
  const wrappedLines = wrapText(ctx, renderableText, paddedWidth);
  const lines = applyMaxLines(wrappedLines, frame);
  const lineHeight = getTextLineHeightPx(frame, baseFontSize) * scale;
  const totalTextH = lines.length * lineHeight;
  const startY = getTextY(frame, ch, totalTextH);

  // X 坐标
  let textX: number;
  if (textAlign === 'center') textX = cw / 2;
  else if (textAlign === 'right') textX = cw - insetPx * scale;
  else textX = insetPx * scale;

  // FontJustificationOffset (WC3 单位, Y-up) — 整段文本基线再做一次微调
  // vendor 真实值如 `0.0 -0.001` (向下微调 1.8 px @ 1800 px/wc3-unit).
  // 对阴影与主文字一并应用 (它们都从同一基线绘制).
  let jx = 0;
  let jy = 0;
  if (frame.fontJustificationOffset) {
    jx = wc3ToPixelW(frame.fontJustificationOffset[0] || 0) * scale;
    jy = -wc3ToPixelH(frame.fontJustificationOffset[1] || 0) * scale;
  }

  // ButtonPushedTextOffset (pushed 态) — 模拟按下时文字跟随按钮下沉.
  // resolved.textOffset 在非 pushed 态时为 [0,0], 不影响结果.
  if (resolved.textOffset[0] !== 0 || resolved.textOffset[1] !== 0) {
    jx += wc3ToPixelW(resolved.textOffset[0]) * scale;
    jy += -wc3ToPixelH(resolved.textOffset[1]) * scale;
  }

  // 阴影
  if (frame.fontShadowOffset && frame.fontShadowColor) {
    ctx.fillStyle = rgbaToCSS(frame.fontShadowColor);
    // FDF FontShadowOffset 是 WC3 单位 (Y-up)。Canvas Y 是向下增长，
    // 故在 Y 轴上取负 (FDF "向下阴影" -0.001 → canvas +正 px)。
    const sx = wc3ToPixelW(frame.fontShadowOffset[0] || 0) * scale;
    const sy = -wc3ToPixelH(frame.fontShadowOffset[1] || 0) * scale;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textX + jx + sx, startY + i * lineHeight + jy + sy);
    }
  }

  // 主文字
  ctx.fillStyle = textColor;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], textX + jx, startY + i * lineHeight + jy);
  }

  // 创建纹理
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  // LRU 缓存（限制 200 条）
  if (textTextureCache.size > 200) {
    const firstKey = textTextureCache.keys().next().value;
    if (firstKey !== undefined) {
      textTextureCache.get(firstKey)?.dispose();
      textTextureCache.delete(firstKey);
    }
  }
  textTextureCache.set(cacheKey, texture);
  return texture;
}

/** 简单换行：按像素宽度折行 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) return [text];

  const paragraphs = text.split('\n');
  const result: string[] = [];

  for (const para of paragraphs) {
    const words = para.split('');
    let line = '';

    for (const char of words) {
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        result.push(line);
        line = char;
      } else {
        line = test;
      }
    }
    result.push(line);
  }

  return result;
}

/** 清理缓存 */
export function disposeTextCache(): void {
  for (const tex of textTextureCache.values()) {
    tex.dispose();
  }
  textTextureCache.clear();
}
