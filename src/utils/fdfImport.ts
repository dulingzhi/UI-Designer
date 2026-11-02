/**
 * 增强的 FDF 导入功能
 * 
 * 支持保留 FDF 元数据、模板继承、批量导入等
 */

import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile, readDir } from '@tauri-apps/plugin-fs';
import { parseFDFToAST } from './fdf';
import { FDFTransformer } from './fdfTransformer';
import { FrameData, FDFMetadata, FDFTextureData, FDFStringData, FDFBackdropData } from '../types';
import { FDFFrameDefinition, FDFProperty } from './fdfAst';
import { templateManager } from './fdfTemplates';

/**
 * 增强的 FDF 导入（单文件）
 * 保留所有 FDF 元数据
 */
export async function importFromFDFEnhanced(): Promise<FrameData[]> {
  try {
    // 打开文件选择对话框
    const filePath = await open({
      multiple: false,
      filters: [
        {
          name: 'FDF Files',
          extensions: ['fdf'],
        },
      ],
    });

    if (!filePath) {
      console.log('[FDF Import] 用户取消选择');
      return [];
    }

    // 读取文件内容
    const content = await readTextFile(filePath as string);
    
    // 解析为 AST
    const ast = parseFDFToAST(content);
    
    // 转换为 FrameData（基础转换）
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);

    // 增强 FrameData（添加 FDF 元数据）
    // 注意：body 里可能混有 Include 等非 Frame 节点（exportUtils 头部会写 Include），
    // 必须按 FrameDefinition 序号对齐——曾因 body[index] 错位导致 enhance 全被跳过。
    const frameDefs = ast.body.filter((n: any) => n?.type === 'FrameDefinition');
    const enhancedFrames = frames.map((frame: FrameData, index: number) => {
      const astNode = frameDefs[index];
      if (astNode) {
        return enhanceFrameWithFDF(frame, astNode as FDFFrameDefinition);
      }
      return frame;
    });

    console.log(`[FDF Import] 成功导入 ${enhancedFrames.length} 个控件`);
    return enhancedFrames;
  } catch (error) {
    console.error('[FDF Import] 导入失败', error);
    throw error;
  }
}

/**
 * 批量导入 FDF 文件夹
 * 将文件夹中的所有 .fdf 文件导入为模板
 */
export async function importFDFFolder(): Promise<number> {
  try {
    // 打开文件夹选择对话框
    const dirPath = await open({
      directory: true,
      multiple: false,
    });

    if (!dirPath) {
      console.log('[FDF Folder Import] 用户取消选择');
      return 0;
    }

    // 读取文件夹内容
    const entries = await readDir(dirPath as string);
    
    let totalLoaded = 0;
    
    for (const entry of entries) {
      if (entry.isFile && entry.name.endsWith('.fdf')) {
        try {
          const filePath = `${dirPath}/${entry.name}`;
          const count = await templateManager.loadTemplatesFromFile(filePath);
          totalLoaded += count;
          console.log(`[FDF Folder Import] 从 ${entry.name} 加载了 ${count} 个模板`);
        } catch (error) {
          console.error(`[FDF Folder Import] 加载文件失败: ${entry.name}`, error);
        }
      }
    }
    
    console.log(`[FDF Folder Import] 总共加载了 ${totalLoaded} 个模板`);
    return totalLoaded;
  } catch (error) {
    console.error('[FDF Folder Import] 批量导入失败', error);
    throw error;
  }
}

/**
 * 增强 FrameData，添加 FDF 元数据
 */
function enhanceFrameWithFDF(frame: FrameData, astNode: FDFFrameDefinition): FrameData {
  // 过滤出 FDFProperty 类型的属性
  const properties = astNode.properties.filter(
    (p): p is FDFProperty => p.type === 'Property'
  );
  
  // 构建 FDF 元数据
  const fdfMetadata: FDFMetadata = {
    inherits: astNode.inherits,
    rawProperties: extractRawProperties(properties),
  };
  
  // 提取 Texture 数据
  const fdfTexture = extractTextureData(properties);
  
  // 提取 String 数据
  const fdfString = extractStringData(properties);
  
  // 提取 Backdrop 数据
  const fdfBackdrop = extractBackdropData(properties);

  // 把 backdrop / 对齐**同时写回可编辑字段**（修复往返断裂：
  // 旧实现只进 fdfMetadata 元数据，属性面板读到空，再导出即丢失）。
  // 注意：undefined 字段不得覆盖——transformer 可能已解析出值（如无值属性
  // BackdropTileBackground → true），undefined 覆盖会把它抹掉。
  const backdropSrc: Partial<FrameData> = fdfBackdrop
    ? {
      backdropBackground: fdfBackdrop.background,
      backdropEdgeFile: fdfBackdrop.edgeFile,
      backdropCornerFile: fdfBackdrop.cornerFile,
      backdropTopFile: fdfBackdrop.topFile,
      backdropBottomFile: fdfBackdrop.bottomFile,
      backdropLeftFile: fdfBackdrop.leftFile,
      backdropRightFile: fdfBackdrop.rightFile,
      backdropCornerFlags: fdfBackdrop.cornerFlags,
      backdropCornerSize: fdfBackdrop.cornerSize,
      backdropBackgroundSize: fdfBackdrop.backgroundSize,
      backdropBackgroundInsets: fdfBackdrop.backgroundInsets,
      backdropTileBackground: fdfBackdrop.tileBackground,
      backdropBlendAll: fdfBackdrop.blendAll,
    }
    : {};
  const backdropFields = Object.fromEntries(
    Object.entries(backdropSrc).filter(([, v]) => v !== undefined),
  ) as Partial<FrameData>;

  // 文本对齐（导出侧 FontJustificationH/V 的逆映射； JUSTIFY* 常量由 name 提供）
  const justifyH = findProperty(properties, 'FontJustificationH');
  const justifyV = findProperty(properties, 'FontJustificationV');
  const alignFields: Partial<FrameData> = {};
  if (justifyH !== null) {
    const h = JUSTIFY_H_REVERSE[String(justifyH).toUpperCase()];
    if (h) alignFields.horAlign = h;
  }
  if (justifyV !== null) {
    const v = JUSTIFY_V_REVERSE[String(justifyV).toUpperCase()];
    if (v) alignFields.verAlign = v;
  }

  // 文本/纹理写回可编辑字段（修复与 backdrop 同款的往返断裂）。
  // SetText 直接读属性而非 fdfString 元数据：空串在元数据里会被 falsy 过滤成 undefined，
  // 而编辑器需要保留「导入了空文本」的语义。
  // 文本属性名兼容：模板定义里是 `Text`（exportUtils 导出此名），运行时调用风格是 `SetText`。
  // 曾因只查 SetText 导致真实产物的剥离从未生效（mock 测试手写 SetText 掩盖了断裂）。
  // 按钮/编辑框帧的文本分别以 ButtonText / EditTextFrame 承载（导出侧同名字段）。
  const setText = findProperty(properties, 'SetText')
    ?? findProperty(properties, 'Text')
    ?? findProperty(properties, 'ButtonText')
    ?? findProperty(properties, 'EditTextFrame');
  const textureFields: Partial<FrameData> = {};
  if (setText !== null) {
    // WC3 把文本颜色内嵌在 Text 里（|cffRRGGBB...|r），无独立模板属性。
    // 剥离还原为 text + textColor，与导出侧的编码互逆；不完整的前缀不剥离（原样保留）。
    const raw = String(setText);
    const colorMatch = raw.match(/^\|cff([0-9a-fA-F]{6})(.*?)\|r$/s);
    if (colorMatch) {
      textureFields.text = colorMatch[2];
      textureFields.textColor = `#${colorMatch[1]}`;
    } else {
      textureFields.text = raw;
    }
  }
  if (fdfTexture) {
    if (fdfTexture.file) textureFields.texture = fdfTexture.file;
    if (fdfTexture.texCoord) textureFields.texCoord = fdfTexture.texCoord;
    if (fdfTexture.alphaMode) textureFields.alphaMode = fdfTexture.alphaMode;
  }

  // 字号写回 textScale：FrameFont（模板属性，第 2 参为字号）优先，
  // 回落 SetFontSize（运行时风格）。名字不匹配曾使 textScale 真实往返断裂。
  const frameFont = findProperty(properties, 'FrameFont');
  const setFontSize = findProperty(properties, 'SetFontSize');
  const fontScale =
    Array.isArray(frameFont) && typeof Number(frameFont[1]) === 'number' && !isNaN(Number(frameFont[1]))
      ? Number(frameFont[1])
      : setFontSize !== null && !isNaN(Number(setFontSize))
        ? Number(setFontSize)
        : undefined;
  if (fontScale !== undefined) {
    textureFields.textScale = fontScale;
  }

  // Control/Highlight/Font 系写回可编辑字段（与导出侧 13+1 字段互逆）。
  // 数值数组需形状校验；非法输入不设置（不臆造）。
  const find = (name: string) => findProperty(properties, name);
  const asNumArray = (v: any): number[] | undefined =>
    Array.isArray(v) && v.every((x) => typeof Number(x) === 'number' && !isNaN(Number(x)))
      ? v.map(Number)
      : undefined;
  const controlFields: Partial<FrameData> = {};
  const stringAssigns: Array<[string, keyof FrameData]> = [
    ['ControlBackdrop', 'controlBackdrop'],
    ['ControlPushedBackdrop', 'controlPushedBackdrop'],
    ['ControlDisabledBackdrop', 'controlDisabledBackdrop'],
    ['ControlMouseOverHighlight', 'controlMouseOverHighlight'],
    ['ControlStyle', 'controlStyle'],
    ['HighlightType', 'highlightType'],
    ['HighlightAlphaFile', 'highlightAlphaFile'],
    ['HighlightAlphaMode', 'highlightAlphaMode'],
  ];
  for (const [name, field] of stringAssigns) {
    const v = find(name);
    if (v !== null && v !== undefined && String(v) !== '') {
      (controlFields as Record<string, unknown>)[field] = String(v);
    }
  }
  const numAssigns: Array<[string, keyof FrameData, number]> = [
    ['FontHighlightColor', 'fontHighlightColor', 4],
    ['FontDisabledColor', 'fontDisabledColor', 4],
    ['FontShadowColor', 'fontShadowColor', 4],
    ['FontShadowOffset', 'fontShadowOffset', 2],
    ['ButtonPushedTextOffset', 'buttonPushedTextOffset', 2],
    ['EditCursorColor', 'editCursorColor', 3],
  ];
  for (const [name, field, len] of numAssigns) {
    const nums = asNumArray(find(name));
    if (nums && nums.length === len) {
      (controlFields as Record<string, unknown>)[field] = nums;
    }
  }

  // SLIDER 系写回（与导出侧 SliderMinValue/MaxValue/InitialValue/StepSize 互逆）。
  // 数值用 !== null 判断：0 是合法值（minValue=0），不得按 falsy 丢弃。
  const sliderAssigns: Array<[string, keyof FrameData]> = [
    ['SliderMinValue', 'minValue'],
    ['SliderMaxValue', 'maxValue'],
    ['SliderInitialValue', 'sliderInitialValue'],
    ['SliderStepSize', 'stepSize'],
  ];
  for (const [name, field] of sliderAssigns) {
    const v = find(name);
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      (controlFields as Record<string, unknown>)[field] = Number(v);
    }
  }

  // 模板引用型写回（与导出互逆；值为模板名字符串）
  const refAssigns: Array<[string, keyof FrameData]> = [
    ['SliderThumbButtonFrame', 'sliderThumbButtonFrameRef'],
    ['ScrollBarIncButtonFrame', 'scrollBarIncButtonFrameRef'],
    ['ScrollBarDecButtonFrame', 'scrollBarDecButtonFrameRef'],
  ];
  for (const [name, field] of refAssigns) {
    const v = find(name);
    if (v !== null && v !== undefined && String(v) !== '') {
      (controlFields as Record<string, unknown>)[field] = String(v);
    }
  }

  return {
    ...frame,
    ...backdropFields,
    ...alignFields,
    ...textureFields,
    ...controlFields,
    fdfMetadata,
    fdfTexture,
    fdfString,
    fdfBackdrop,
  };
}

/**
 * 提取原始属性（保留 FDF 原始格式）
 */
function extractRawProperties(properties: FDFProperty[]): Record<string, any> {
  const raw: Record<string, any> = {};
  
  properties.forEach(prop => {
    raw[prop.name] = extractPropertyValue(prop.value);
  });
  
  return raw;
}

/**
 * 提取属性值
 */
function extractPropertyValue(value: any): any {
  if (!value) return null;
  
  switch (value.type) {
    case 'StringLiteral':
      return value.value;
    case 'NumberLiteral':
      return value.value;
    case 'Identifier':
      return value.name;
    case 'ArrayLiteral':
      return value.elements.map(extractPropertyValue);
    default:
      return null;
  }
}

/**
 * 提取 Texture 数据
 */
function extractTextureData(properties: FDFProperty[]): FDFTextureData | undefined {
  const textureFile = findProperty(properties, 'SetTexture');
  const texCoord = findProperty(properties, 'SetTexCoord');
  const alphaMode = findProperty(properties, 'SetAlphaMode');
  
  if (!textureFile && !texCoord && !alphaMode) {
    return undefined;
  }
  
  const alphaModeStr = alphaMode ? String(alphaMode).toUpperCase() : undefined;
  // DISABLE 亦为引擎合法取值（IDA ReaderTextureKeyword @ 0x6f09b8a0 显式比较四值）。
  const validAlphaMode = alphaModeStr === 'DISABLE' || alphaModeStr === 'ALPHAKEY' || alphaModeStr === 'BLEND' || alphaModeStr === 'ADD'
    ? alphaModeStr
    : undefined;
  
  return {
    file: textureFile ? String(textureFile) : '',
    texCoord: texCoord ? parseTexCoord(texCoord) : undefined,
    alphaMode: validAlphaMode,
  };
}

/**
 * 提取 String 数据
 */
function extractStringData(properties: FDFProperty[]): FDFStringData | undefined {
  const content = findProperty(properties, 'SetText');
  const font = findProperty(properties, 'SetFont');
  const fontSize = findProperty(properties, 'SetFontSize');
  const fontFlags = findProperty(properties, 'SetFontFlags');
  
  if (!content && !font && !fontSize && !fontFlags) {
    return undefined;
  }
  
  // fontFlags 可能是数组或字符串
  let fontFlagsArray: string[] | undefined;
  if (fontFlags) {
    if (Array.isArray(fontFlags)) {
      fontFlagsArray = fontFlags.map(f => String(f));
    } else {
      fontFlagsArray = [String(fontFlags)];
    }
  }
  
  return {
    content: content ? String(content) : '',
    font: font ? String(font) : undefined,
    fontSize: fontSize ? Number(fontSize) : undefined,
    fontFlags: fontFlagsArray,
  };
}

/**
 * 解析 FDF 布尔标识符（TRUE/FALSE，不区分大小写）。
 */
function parseFdfBool(value: any): boolean | undefined {
  if (value === 'TRUE' || value === 'true') return true;
  if (value === 'FALSE' || value === 'false') return false;
  return undefined;
}

/**
 * 解析四元组数值（背景内边距等），全为有限数才有效。
 */
function parseQuad(value: any): [number, number, number, number] | undefined {
  if (Array.isArray(value) && value.length === 4) {
    const nums = value.map(v => Number(v));
    if (nums.every(c => !isNaN(c))) {
      return nums as [number, number, number, number];
    }
  }
  return undefined;
}

/**
 * 提取 Backdrop 数据（元数据 + 可编辑字段双写）。
 *
 * 历史缺陷：本函数原来只读 3 个属性且**只进元数据**，导致
 * 「导入带背景的 FDF → 属性面板为空 → 再导出 → 背景丢失」的往返断裂。
 * 现读取全部 13 个 backdrop 属性；可编辑字段的映射在 enhanceFrameWithFDF 完成。
 */
function extractBackdropData(properties: FDFProperty[]): FDFBackdropData | undefined {
  const background = findProperty(properties, 'BackdropBackground');
  const edgeFile = findProperty(properties, 'BackdropEdgeFile');
  const cornerFlags = findProperty(properties, 'BackdropCornerFlags');
  const cornerFile = findProperty(properties, 'BackdropCornerFile');
  const topFile = findProperty(properties, 'BackdropTopFile');
  const bottomFile = findProperty(properties, 'BackdropBottomFile');
  const leftFile = findProperty(properties, 'BackdropLeftFile');
  const rightFile = findProperty(properties, 'BackdropRightFile');
  const cornerSize = findProperty(properties, 'BackdropCornerSize');
  const backgroundSize = findProperty(properties, 'BackdropBackgroundSize');
  const backgroundInsets = findProperty(properties, 'BackdropBackgroundInsets');
  const tileBackground = findProperty(properties, 'BackdropTileBackground');
  const blendAll = findProperty(properties, 'BackdropBlendAll');

  if (!background && !edgeFile && !cornerFlags && !cornerFile && !topFile
    && !bottomFile && !leftFile && !rightFile && !cornerSize && !backgroundSize
    && !backgroundInsets && tileBackground === null && blendAll === null) {
    return undefined;
  }

  const insets = backgroundInsets !== null ? parseQuad(backgroundInsets) : undefined;

  return {
    // 字符串属性用 truthy 语义（数值 0 / 空串对纹理路径无意义，丢弃垃圾值）
    background: background ? String(background) : undefined,
    edgeFile: edgeFile ? String(edgeFile) : undefined,
    cornerFile: cornerFile ? String(cornerFile) : undefined,
    topFile: topFile ? String(topFile) : undefined,
    bottomFile: bottomFile ? String(bottomFile) : undefined,
    leftFile: leftFile ? String(leftFile) : undefined,
    rightFile: rightFile ? String(rightFile) : undefined,
    cornerFlags: cornerFlags ? String(cornerFlags) : undefined,
    // 数值属性 0 是合法值，用 !== null 区分
    cornerSize: cornerSize !== null ? Number(cornerSize) : undefined,
    backgroundSize: backgroundSize !== null ? Number(backgroundSize) : undefined,
    backgroundInsets: insets,
    tileBackground: tileBackground !== null ? parseFdfBool(tileBackground) : undefined,
    blendAll: blendAll !== null ? parseFdfBool(blendAll) : undefined,
  };
}

/**
 * 编辑器对齐值 ← FDF Justify 常量（导出侧 justifyHOf/justifyVOf 的逆映射）。
 */
const JUSTIFY_H_REVERSE: Record<string, FrameData['horAlign']> = {
  JUSTIFYLEFT: 'left', JUSTIFYCENTER: 'center', JUSTIFYRIGHT: 'right',
};
const JUSTIFY_V_REVERSE: Record<string, FrameData['verAlign']> = {
  JUSTIFYTOP: 'start', JUSTIFYMIDDLE: 'center', JUSTIFYBOTTOM: 'flex-end',
};

/**
 * 查找属性值
 */
function findProperty(properties: FDFProperty[], name: string): any {
  const prop = properties.find(p => p.type === 'Property' && p.name === name);
  if (!prop || prop.type !== 'Property') return null;
  return extractPropertyValue(prop.value);
}

/**
 * 解析 TexCoord（4 个浮点数）
 */
function parseTexCoord(value: any): [number, number, number, number] | undefined {
  if (Array.isArray(value) && value.length === 4) {
    const coords = value.map(v => Number(v));
    if (coords.every(c => !isNaN(c))) {
      return coords as [number, number, number, number];
    }
  }
  return undefined;
}

/**
 * 从文本导入 FDF（不打开对话框）
 * 用于测试和编程式导入
 */
export function importFromFDFText(fdfText: string): FrameData[] {
  try {
    const ast = parseFDFToAST(fdfText);
    const transformer = new FDFTransformer();
    const frames = transformer.transform(ast);

    // 按 FrameDefinition 序号对齐（body 里可能混有 Include 等节点，见上方说明）
    const frameDefs = ast.body.filter((n: any) => n?.type === 'FrameDefinition');
    const enhancedFrames = frames.map((frame: FrameData, index: number) => {
      const astNode = frameDefs[index];
      if (astNode) {
        return enhanceFrameWithFDF(frame, astNode as FDFFrameDefinition);
      }
      return frame;
    });

    return enhancedFrames;
  } catch (error) {
    console.error('[FDF Import] 从文本导入失败', error);
    throw error;
  }
}

/**
 * 应用模板到 FrameData
 * 如果 frame 有 INHERITS，自动展开继承
 */
export function applyTemplateInheritance(frame: FrameData): FrameData {
  const inherits = frame.fdfMetadata?.inherits;
  if (!inherits) return frame;
  
  return templateManager.applyTemplate(frame, inherits);
}

/**
 * 批量应用模板继承
 */
export function applyTemplateInheritanceToAll(frames: FrameData[]): FrameData[] {
  return frames.map(applyTemplateInheritance);
}
