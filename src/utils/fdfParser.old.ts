import { FrameData, FrameType, FramePoint, FrameAnchor } from '../types';
import { createDefaultAnchors } from './anchorUtils';

/**
 * FDF解析器 - 将FDF文件内容解析为FrameData对象
 */

interface ParsedFrame {
  type: string;
  name: string;
  properties: Map<string, any>;
  children: ParsedFrame[];
}

/**
 * 将FDF类型名称转换为FrameType枚举
 */
function fdfTypeToFrameType(fdfType: string): FrameType {
  const typeMap: Record<string, FrameType> = {
    'BACKDROP': FrameType.BACKDROP,
    'BUTTON': FrameType.BUTTON,
    'BROWSEBUTTON': FrameType.BROWSER_BUTTON,
    'SCRIPTDIALOGBUTTON': FrameType.SCRIPT_DIALOG_BUTTON,
    'TEXT': FrameType.TEXT_FRAME,
    'TEXTFRAME': FrameType.TEXT_FRAME,
    'EDITBOX': FrameType.EDITBOX,
    'TEXTAREA': FrameType.TEXTAREA,
    'SLIDER': FrameType.SLIDER,
    'CHECKBOX': FrameType.CHECKBOX,
    'SIMPLECHECKBOX': FrameType.CHECKBOX,
    'HORIZONTALBAR': FrameType.HORIZONTAL_BAR,
  };
  
  const normalizedType = fdfType.toUpperCase().replace(/\s+/g, '');
  return typeMap[normalizedType] || FrameType.BACKDROP;
}

/**
 * 将FDF锚点名称转换为FramePoint枚举
 */
function fdfPointToFramePoint(point: string): FramePoint {
  const pointMap: Record<string, FramePoint> = {
    'TOPLEFT': FramePoint.TOPLEFT,
    'TOP': FramePoint.TOP,
    'TOPRIGHT': FramePoint.TOPRIGHT,
    'LEFT': FramePoint.LEFT,
    'CENTER': FramePoint.CENTER,
    'RIGHT': FramePoint.RIGHT,
    'BOTTOMLEFT': FramePoint.BOTTOMLEFT,
    'BOTTOM': FramePoint.BOTTOM,
    'BOTTOMRIGHT': FramePoint.BOTTOMRIGHT,
  };
  
  return pointMap[point.toUpperCase()] || FramePoint.TOPLEFT;
}

/**
 * 解析FDF文件内容的主函数
 */
export function parseFDF(content: string): FrameData[] {
  try {
    // 预处理：移除注释和空行
    const lines = content.split('\n').map(line => {
      // 移除单行注释
      const commentIndex = line.indexOf('//');
      if (commentIndex >= 0) {
        line = line.substring(0, commentIndex);
      }
      return line.trim();
    }).filter(line => line.length > 0 && !line.startsWith('IncludeFile'));

    // 将所有行合并成一个字符串，便于解析
    const cleanContent = lines.join(' ');

    // 解析所有Frame定义
    const parsedFrames = parseFrameDefinitions(cleanContent);

    // 转换为FrameData对象
    const frames: FrameData[] = [];
    const idCounter = { value: 1 };
    
    for (const parsed of parsedFrames) {
      convertToFrameData(parsed, frames, null, idCounter);
    }

    return frames;
  } catch (error) {
    console.error('FDF解析错误:', error);
    throw new Error(`FDF解析失败: ${error}`);
  }
}

/**
 * 从字符串中解析所有Frame定义
 */
function parseFrameDefinitions(content: string): ParsedFrame[] {
  const frames: ParsedFrame[] = [];
  let pos = 0;

  while (pos < content.length) {
    // 查找 Frame 定义
    const frameMatch = content.substring(pos).match(/Frame\s+"([^"]+)"\s+"([^"]+)"\s*\{/);
    if (!frameMatch) break;

    const matchStart = pos + (frameMatch.index || 0);
    const type = frameMatch[1];
    const name = frameMatch[2];

    // 找到对应的结束大括号
    const blockStart = matchStart + frameMatch[0].length;
    const blockEnd = findMatchingBrace(content, blockStart);

    if (blockEnd === -1) {
      console.warn(`无法找到Frame "${name}" 的结束括号`);
      break;
    }

    // 解析Frame内容
    const blockContent = content.substring(blockStart, blockEnd);
    const properties = parseProperties(blockContent);
    const children = parseFrameDefinitions(blockContent);

    frames.push({
      type,
      name,
      properties,
      children,
    });

    pos = blockEnd + 1;
  }

  return frames;
}

/**
 * 查找匹配的结束大括号
 */
function findMatchingBrace(content: string, start: number): number {
  let depth = 1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * 解析Frame的属性
 */
function parseProperties(content: string): Map<string, any> {
  const properties = new Map<string, any>();

  // 移除嵌套的Frame定义（只保留当前层级的属性）
  let cleanContent = content;
  const frameRegex = /Frame\s+"[^"]+"\s+"[^"]+"\s*\{/g;
  let match;
  const framesToRemove: Array<{start: number, end: number}> = [];
  
  while ((match = frameRegex.exec(content)) !== null) {
    const start = match.index;
    const end = findMatchingBrace(content, start + match[0].length);
    if (end !== -1) {
      framesToRemove.push({start, end: end + 1});
    }
  }

  // 从后往前移除，避免索引变化
  framesToRemove.reverse().forEach(({start, end}) => {
    cleanContent = cleanContent.substring(0, start) + cleanContent.substring(end);
  });

  // 解析属性行
  const propRegex = /(\w+)\s+([^,]+),?/g;
  while ((match = propRegex.exec(cleanContent)) !== null) {
    const key = match[1];
    let value: any = match[2].trim();

    // 移除引号
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }

    // 尝试转换为数字
    if (!isNaN(parseFloat(value)) && isFinite(value)) {
      value = parseFloat(value);
    }

    // 处理布尔值
    if (value === 'TRUE' || value === 'true') value = true;
    if (value === 'FALSE' || value === 'false') value = false;

    // SetPoint特殊处理
    if (key === 'SetPoint') {
      if (!properties.has('anchors')) {
        properties.set('anchors', []);
      }
      const anchorMatch = value.match(/(\w+)\s*,\s*"([^"]+)"\s*,\s*(\w+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)/);
      if (anchorMatch) {
        properties.get('anchors').push({
          point: anchorMatch[1],
          relativeTo: anchorMatch[2],
          relativePoint: anchorMatch[3],
          x: parseFloat(anchorMatch[4]),
          y: parseFloat(anchorMatch[5]),
        });
      }
    } else {
      properties.set(key, value);
    }
  }

  return properties;
}

/**
 * 将ParsedFrame转换为FrameData
 */
function convertToFrameData(
  parsed: ParsedFrame,
  frames: FrameData[],
  parentId: string | null,
  idCounter: { value: number }
): string {
  const id = `frame_${idCounter.value++}`;
  const props = parsed.properties;

  // 获取基本属性
  const width = props.get('Width') || 0.1;
  const height = props.get('Height') || 0.1;

  // 解析锚点
  let anchors: FrameAnchor[] = [];
  let x = 0.1;
  let y = 0.1;

  if (props.has('anchors')) {
    const fdfAnchors = props.get('anchors');
    anchors = fdfAnchors.map((a: any) => ({
      point: fdfPointToFramePoint(a.point),
      relativeTo: a.relativeTo === 'GameUI' || a.relativeTo === 'UIParent' ? undefined : a.relativeTo,
      relativePoint: fdfPointToFramePoint(a.relativePoint),
      x: a.x,
      y: -a.y, // FDF使用负Y，需要转换
    }));

    // 从第一个锚点推算位置
    if (anchors.length > 0) {
      x = anchors[0].x;
      y = -anchors[0].y;
    }
  } else {
    // 没有锚点时创建默认锚点
    anchors = createDefaultAnchors(x, y, width, height);
  }

  // 创建FrameData对象
  const frameData: FrameData = {
    id,
    name: parsed.name,
    type: fdfTypeToFrameType(parsed.type),
    x,
    y,
    width,
    height,
    z: frames.length,
    parentId,
    children: [],
    tooltip: false,
    isRelative: false,
    anchors,
    texture: props.get('BackdropBackground') || props.get('BackdropTexture') || '',
    text: props.get('Text') || props.get('ButtonText') || props.get('EditTextFrame') || '',
    textScale: props.get('FontSize') || 1.0,
    textColor: '#FFFFFF',
  };

  frames.push(frameData);

  // 递归处理子Frame
  for (const child of parsed.children) {
    const childId = convertToFrameData(child, frames, id, idCounter);
    frameData.children.push(childId);
  }

  return id;
}
