import { ProjectData, FrameData, FrameType, FramePoint, ExportLanguage, FrameAnchor, ExportVersion } from '../types';
import { createDefaultAnchors } from './anchorUtils';
import { toIdentifier, escapeJassString, escapeLuaString, sanitizeLibraryName } from './codegen/identifiers';

// API 前缀映射
const API_PREFIX = {
  reforged: 'Blz',
  '1.27': 'Dz',
} as const;

// 获取 API 函数名称
function getAPIFunction(version: ExportVersion, funcName: string): string {
  const prefix = API_PREFIX[version];
  return `${prefix}${funcName}`;
}

// 将 FramePoint 枚举转换为 WC3 常量名称
function framePointToString(point: FramePoint): string {
  const pointNames = [
    'FRAMEPOINT_TOPLEFT',
    'FRAMEPOINT_TOP',
    'FRAMEPOINT_TOPRIGHT',
    'FRAMEPOINT_LEFT',
    'FRAMEPOINT_CENTER',
    'FRAMEPOINT_RIGHT',
    'FRAMEPOINT_BOTTOMLEFT',
    'FRAMEPOINT_BOTTOM',
    'FRAMEPOINT_BOTTOMRIGHT',
  ];
  return pointNames[point] || 'FRAMEPOINT_BOTTOMLEFT';
}

/**
 * 顶层帧的父级根，由 `project.originMode` 决定。
 *
 * 依据（openwar3 `compat/lua/japi/dzapi/frame.ts`）：
 * - `DzGetGameUI` → `GetOriginFrame(0, 0)`（ORIGIN_FRAME_GAME_UI）
 * - `DzGetSimpleUIParent` → `GetOriginFrame(18, 0)`（SIMPLE_UI 父级，世界 UI 的常见挂载点）
 * - consoleui 在环境中没有独立的 origin 类型常量；`HideOriginFrames` 的作用对象即控制台本身，
 *   故 consoleui 仍以 GAME_UI 为根（它的差异体现在隐藏策略上，见 buildHideStatements）。
 *
 * 注意：本仓库此前从未使用 `originMode`（全仓库零引用），本实现把它接入为**父级根选择**；
 * `worldframe` 用 SIMPLE_UI 父级，其余用 GAME_UI。
 */
function originFrameExpr(project: ProjectData, version: ExportVersion): string {
  const getOrigin = getAPIFunction(version, 'GetOriginFrame');
  const mode = project.originMode ?? 'gameui';
  const type = mode === 'worldframe' ? 'ORIGIN_FRAME_SIMPLE_UI' : 'ORIGIN_FRAME_GAME_UI';
  return `${getOrigin}(${type}, 0)`;
}

/**
 * 隐藏原生 UI 组件。
 *
 * 依据（openwar3 `compat/lua/japi/dzapi/frame.ts` + `compat/frames.ts`）：
 * - 原生 UI 通过 `GetOriginFrame(ORIGIN_FRAME_<TYPE>, index)` 取得，再用 `FrameSetVisible(frame, false)` 隐藏。
 * - 类型编号（来自 dzapi）：3=HERO_BUTTON、8=MINIMAP、10=SIMPLE_BUTTON(上按钮栏)、
 *   13=CHAT_MSG、16=PORTRAIT。
 * - `HideOriginFrames(true)` **只隐藏一部分**（命令卡/英雄栏/物品栏/小地图及其按钮/头像/系统按钮/工具提示），
 *   **不含**控制台美术、资源栏与黑色 `ConsoleUIBackdrop`——后者只能按名字隐藏，
 *   故 hideResources 走 `GetFrameByName("ResourceBar"/"ConsoleUIBackdrop")`。
 * - 英雄栏有 7 个按钮（index 0..6），需逐个隐藏。
 */
const HIDDEN_ORIGIN_TYPES = [
  { flag: 'hideMiniMap', type: 'ORIGIN_FRAME_MINIMAP', count: 1 },
  { flag: 'hideHeroBar', type: 'ORIGIN_FRAME_HERO_BUTTON', count: 7 },
  { flag: 'hideButtonBar', type: 'ORIGIN_FRAME_SIMPLE_BUTTON', count: 1 },
  { flag: 'hidePortrait', type: 'ORIGIN_FRAME_PORTRAIT', count: 1 },
  { flag: 'hideChat', type: 'ORIGIN_FRAME_CHAT_MSG', count: 1 },
] as const;

/** 生成"隐藏某个 origin frame"的语句块（语言无关的语义，由调用方包裹成 JASS/LUA）。 */
function buildHideStatements(
  project: ProjectData,
  version: ExportVersion,
  style: 'jass' | 'lua' | 'ts',
): string[] {
  const getOrigin = getAPIFunction(version, 'GetOriginFrame');
  const getByName = getAPIFunction(version, 'GetFrameByName');
  const setVisible = getAPIFunction(version, 'FrameSetVisible');
  const statements: string[] = [];
  const isJass = style === 'jass';
  const wrap = (call: string) => (isJass ? `    call ${call}\n` : `    ${call}${style === 'ts' ? ';' : ''}\n`);
  const prefix = style === 'ts' ? 'this.' : '';

  for (const item of HIDDEN_ORIGIN_TYPES) {
    if ((project as unknown as Record<string, unknown>)[item.flag] !== true) continue;
    for (let i = 0; i < item.count; i += 1) {
      statements.push(
        wrap(`${setVisible}(${getOrigin}(${item.type}, ${i}), false)`),
      );
    }
  }
  if (project.hideResources === true) {
    // 资源栏/控制台美术只能按名字取（HideOriginFrames 不覆盖）
    for (const nm of ['ResourceBar', 'ConsoleUIBackdrop']) {
      statements.push(wrap(`${setVisible}(${getByName}("${nm}", 0), false)`));
    }
  }
  void prefix;
  return statements;
}

/**
 * 建立 frame id → 唯一变量名映射，并返回**父先子后**的拓扑序帧列表。
 *
 * 修复两个缺陷：
 *  - 同行/重名帧会生成重复声明（`framehandle Dup = null` ×2）
 *  - frames 记录顺序可能把子帧排在父帧前，导致创建时父仍是 null（锚定静默失败）
 */
function buildFrameOrder(project: ProjectData): { idToVar: Map<string, string>; ordered: FrameData[] } {
  const frames = Object.values(project.frames);
  const idToVar = new Map<string, string>();
  const used = new Set<string>();

  // 同名数组帧（Name[00]/[01]…）共用同一个数组变量名
  const arrayBase = new Map<string, string>();
  for (const f of frames) {
    const m = /^(.*)\[(\d+)\]$/.exec(f.name ?? '');
    if (!m) continue;
    const base = m[1];
    if (!arrayBase.has(base)) {
      arrayBase.set(base, toIdentifier(base, used));
    }
    idToVar.set(f.id, arrayBase.get(base)!);
  }
  for (const f of frames) {
    if (idToVar.has(f.id)) continue;
    idToVar.set(f.id, toIdentifier(f.name ?? '', used));
  }

  // 拓扑排序：父先子后；孤儿的 parent 视为不存在（按 root 处理）
  const ordered: FrameData[] = [];
  const visited = new Set<string>();
  const byId = project.frames;
  const visit = (f: FrameData) => {
    if (visited.has(f.id)) return;
    visited.add(f.id);
    const pid = f.parentId;
    if (pid && byId[pid]) visit(byId[pid]);
    ordered.push(f);
  };
  for (const f of frames) visit(f);
  return { idToVar, ordered };
}

/**
 * 解析父帧表达式。
 * - 无父 → origin frame
 * - 父存在 → 其变量名
 * - 父 id 悬空 → 降级为 origin frame（不再抛 `Cannot read properties of undefined`）
 */
function resolveParentExpr(
  frame: FrameData,
  project: ProjectData,
  version: ExportVersion,
  idToVar: Map<string, string>,
): string {
  const origin = originFrameExpr(project, version);
  const pid = frame.parentId;
  if (!pid) return origin;
  const parentFrame = project.frames[pid];
  if (!parentFrame) return origin; // 悬空 parentId：降级
  /* v8 ignore start -- unreachable: 父帧存在时必然已登记变量名（buildFrameOrder 覆盖全部帧） */
  return idToVar.get(pid) ?? origin;
  /* v8 ignore end */
}

/**
 * 把锚点的 `relativeTo` 解析成变量名。
 *
 * `relativeTo` 在数据里**可能是 frame id，也可能是 frame name**：
 * `fdfKernelTransformer` 会把名称解析成 id（L274-281），但按名称查不到时会**保留原名**；
 * 而编辑器手工建的工程与测试夹具里常直接写 name。故两者都要尝试。
 */
function resolveRelativeVar(
  relativeTo: string | undefined,
  project: ProjectData,
  idToVar: Map<string, string>,
): string | undefined {
  if (!relativeTo) return undefined;
  const byId = idToVar.get(relativeTo);
  if (byId) return byId;
  for (const f of Object.values(project.frames)) {
    if (f.name === relativeTo) {
      const v = idToVar.get(f.id);
      /* v8 ignore next -- unreachable: buildFrameOrder 覆盖全部帧，命中 name 必然命中 id */
      if (v) return v;
    }
  }
  return undefined;
}

// 生成锚点设置代码 (JASS)
function generateAnchorsJASS(
  frameName: string,
  anchors: FrameAnchor[],
  version: ExportVersion,
  idToVar: Map<string, string>,
  project: ProjectData,
): string {
  let code = '';
  const setPoint = getAPIFunction(version, 'FrameSetPoint');
  const setAbsPoint = getAPIFunction(version, 'FrameSetAbsPoint');

  for (const anchor of anchors) {
    const anchorPoint = framePointToString(anchor.point);
    const relVar = resolveRelativeVar(anchor.relativeTo, project, idToVar);
    if (relVar && anchor.relativePoint !== undefined) {
      const relativePoint = framePointToString(anchor.relativePoint);
      code += `    call ${setPoint}(${frameName}, ${anchorPoint}, ${relVar}, ${relativePoint}, ${anchor.x.toFixed(5)}, ${anchor.y.toFixed(5)})\n`;
    } else {
      code += `    call ${setAbsPoint}(${frameName}, ${anchorPoint}, ${anchor.x.toFixed(5)}, ${anchor.y.toFixed(5)})\n`;
    }
  }
  return code;
}

// 生成锚点设置代码 (LUA)
function generateAnchorsLUA(
  frameName: string,
  anchors: FrameAnchor[],
  version: ExportVersion,
  idToVar: Map<string, string>,
  project: ProjectData,
): string {
  let code = '';
  const setPoint = getAPIFunction(version, 'FrameSetPoint');
  const setAbsPoint = getAPIFunction(version, 'FrameSetAbsPoint');

  for (const anchor of anchors) {
    const anchorPoint = framePointToString(anchor.point);
    const relVar = resolveRelativeVar(anchor.relativeTo, project, idToVar);
    if (relVar && anchor.relativePoint !== undefined) {
      const relativePoint = framePointToString(anchor.relativePoint);
      code += `    ${setPoint}(${frameName}, ${anchorPoint}, ${relVar}, ${relativePoint}, ${anchor.x.toFixed(5)}, ${anchor.y.toFixed(5)})\n`;
    } else {
      code += `    ${setAbsPoint}(${frameName}, ${anchorPoint}, ${anchor.x.toFixed(5)}, ${anchor.y.toFixed(5)})\n`;
    }
  }
  return code;
}

// 生成锚点设置代码 (TypeScript)
function generateAnchorsTypeScript(
  frameName: string,
  anchors: FrameAnchor[],
  version: ExportVersion,
  idToVar: Map<string, string>,
  project: ProjectData,
): string {
  let code = '';
  const setPoint = getAPIFunction(version, 'FrameSetPoint');
  const setAbsPoint = getAPIFunction(version, 'FrameSetAbsPoint');
  
  for (const anchor of anchors) {
    const anchorPoint = framePointToString(anchor.point);
    // relativeTo 是 frame id，须换成变量名；解析不到则降级为绝对锚点
    const relVar = resolveRelativeVar(anchor.relativeTo, project, idToVar);
    if (relVar && anchor.relativePoint !== undefined) {
      const relativePoint = framePointToString(anchor.relativePoint);
      code += `    ${setPoint}(this.${frameName}, ${anchorPoint}, this.${relVar}, ${relativePoint}, ${anchor.x.toFixed(5)}, ${anchor.y.toFixed(5)});\n`;
    } else {
      code += `    ${setAbsPoint}(this.${frameName}, ${anchorPoint}, ${anchor.x.toFixed(5)}, ${anchor.y.toFixed(5)});\n`;
    }
  }
  return code;
}

// JASS 代码模板
const JASS_TEMPLATES = {
  header: (libName: string) => `
//===========================================================================
// UI Library: ${libName}
// Generated by Warcraft 3 UI Designer
// Date: ${new Date().toLocaleString()}
//===========================================================================

library ${libName} initializer Init

globals
`,
  
  frameDeclaration: (name: string, isArray: boolean) => 
    isArray 
      ? `    framehandle array ${name}\n`
      : `    framehandle ${name} = null\n`,
  
  endGlobals: `endglobals

function CreateFrames takes nothing returns nothing
`,
  
  footer: (_libName: string) => `
endfunction

function Init takes nothing returns nothing
    call CreateFrames()
endfunction

endlibrary
`
};

// LUA 代码模板
const LUA_TEMPLATES = {
  header: (libName: string) => `
--===========================================================================
-- UI Library: ${libName}
-- Generated by Warcraft 3 UI Designer
-- Date: ${new Date().toLocaleString()}
--===========================================================================

${libName} = {}
`,
  
  frameDeclaration: (name: string, isArray: boolean) => 
    isArray 
      ? `${name} = {}\n`
      : `${name} = nil\n`,
};

// 生成 JASS 代码
export function generateJASSCode(project: ProjectData): string {
  const version = project.exportVersion || 'reforged';
  const libName = sanitizeLibraryName(project.libraryName);
  const { idToVar, ordered } = buildFrameOrder(project);
  let code = JASS_TEMPLATES.header(libName);

// 声明所有 Frame 变量（用唯一变量名；数组帧只声明一次）
  const declared = new Set<string>();
  for (const frame of ordered) {
    const varName = idToVar.get(frame.id)!;
    const isArray = /\[(\d+)\]$/.test(frame.name ?? '');
    if (declared.has(varName)) continue;
    declared.add(varName);
    code += JASS_TEMPLATES.frameDeclaration(varName, isArray);
  }

  code += JASS_TEMPLATES.endGlobals;

// 创建所有 Frame（父先子后）
  for (const frame of ordered) {
    code += generateFrameJASS(frame, project, version, idToVar);
  }

  // 添加通用设置
  if (project.hideGameUI) {
    const enableAutoPos = getAPIFunction(version, 'EnableUIAutoPosition');
    const hideOriginFrames = getAPIFunction(version, 'HideOriginFrames');
    code += `    call ${enableAutoPos}(false)\n`;
    code += `    call ${hideOriginFrames}(true)\n`;
  }
  // 逐组件隐藏（hideMiniMap / hideHeroBar / hideButtonBar / hidePortrait / hideChat / hideResources）
  for (const line of buildHideStatements(project, version, 'jass')) code += line;

  code += JASS_TEMPLATES.footer(libName);

  return code;
}

// 生成 LUA 代码
export function generateLUACode(project: ProjectData): string {
  const version = project.exportVersion || 'reforged';
  const libName = sanitizeLibraryName(project.libraryName);
  const { idToVar, ordered } = buildFrameOrder(project);
  let code = LUA_TEMPLATES.header(libName);

  code += '\n-- Frame declarations\n';
  const declared = new Set<string>();
  for (const frame of ordered) {
    const vName = idToVar.get(frame.id)!;
    const isArray = /\[(\d+)\]$/.test(frame.name ?? '');
    if (declared.has(vName)) continue;
    declared.add(vName);
    code += LUA_TEMPLATES.frameDeclaration(vName, isArray);
  }

  code += '\nfunction CreateFrames()\n';

// 创建所有 Frame（父先子后）
  for (const frame of ordered) {
    code += generateFrameLUA(frame, project, version, idToVar);
  }
  
  // 添加通用设置
  if (project.hideGameUI) {
    const enableAutoPos = getAPIFunction(version, 'EnableUIAutoPosition');
    const hideOriginFrames = getAPIFunction(version, 'HideOriginFrames');
    code += `    ${enableAutoPos}(false)\n`;
    code += `    ${hideOriginFrames}(true)\n`;
  }
  for (const line of buildHideStatements(project, version, 'lua')) code += line;

  code += 'end\n\n';
  code += 'CreateFrames()\n';

  return code;
}

// 生成单个 Frame 的 JASS 代码
function generateFrameJASS(frame: FrameData, project: ProjectData, version: ExportVersion, idToVar: Map<string, string>): string {
  const parent = resolveParentExpr(frame, project, version, idToVar);
  const varName = idToVar.get(frame.id);
  /* v8 ignore start -- unreachable: 调用方已为每个参与生成的帧登记变量名（见 buildIdToVar） */
  if (!varName) return '';
  /* v8 ignore end */
  const escName = escapeJassString(frame.name);

  // 获取锚点数组,如果不存在则创建默认锚点
  const anchors = frame.anchors || createDefaultAnchors(frame.x, frame.y, frame.width, frame.height);
  
  const createFrame = getAPIFunction(version, 'CreateFrame');
  const createFrameByType = getAPIFunction(version, 'CreateFrameByType');
  const frameSetSize = getAPIFunction(version, 'FrameSetSize');
  const frameSetTexture = getAPIFunction(version, 'FrameSetTexture');
  const frameSetText = getAPIFunction(version, 'FrameSetText');
  const frameSetScale = getAPIFunction(version, 'FrameSetScale');
  const frameSetEnable = getAPIFunction(version, 'FrameSetEnable');
  const frameSetFocus = getAPIFunction(version, 'FrameSetFocus');
  const frameSetMinMaxValue = getAPIFunction(version, 'FrameSetMinMaxValue');
  const frameSetStepValue = getAPIFunction(version, 'FrameSetStepValue');
  
  let code = '';
  
  switch (frame.type) {
    case FrameType.BACKDROP:
      code += `    set ${varName} = ${createFrame}("BACKDROP", ${parent}, 0, 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    call ${frameSetTexture}(${varName}, "${escapeJassString(frame.texture || 'UI\\Widgets\\EscMenu\\Human\\background.blp')}", 0, true)\n`;
      break;
    
    case FrameType.BUTTON:
    case FrameType.BROWSER_BUTTON:
    case FrameType.SCRIPT_DIALOG_BUTTON:
      code += `    set ${varName} = ${createFrame}("ScriptDialogButton", ${parent}, 0, 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.TEXT_FRAME:
      code += `    set ${varName} = ${createFrameByType}("TEXT", "", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    call ${frameSetText}(${varName}, "${escapeJassString(`|cff${(frame.textColor || '#FFFFFF').slice(1)}${frame.text || ''}|r`)}")\n`;
      code += `    call ${frameSetScale}(${varName}, ${(frame.textScale || 1).toFixed(2)})\n`;
      break;
    
    case FrameType.EDITBOX:
      code += `    set ${varName} = ${createFrameByType}("EDITBOX", "", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    call ${frameSetEnable}(${varName}, true)\n`;
      code += `    call ${frameSetFocus}(${varName}, false)\n`;
      break;
    
    case FrameType.SLIDER:
      code += `    set ${varName} = ${createFrame}("SliderTemplate", ${parent}, 0, 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    call ${frameSetMinMaxValue}(${varName}, ${(frame.minValue || 0).toFixed(2)}, ${(frame.maxValue || 100).toFixed(2)})\n`;
      code += `    call ${frameSetStepValue}(${varName}, ${(frame.stepSize || 1).toFixed(2)})\n`;
      break;
    
    case FrameType.CHECKBOX:
      code += `    set ${varName} = ${createFrame}("CheckBoxTemplate", ${parent}, 0, 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    call ${frameSetEnable}(${varName}, ${frame.checked ? 'true' : 'false'})\n`;
      break;
    
    case FrameType.FRAME:
    case FrameType.SIMPLEFRAME:
    case FrameType.CONTROL:
    case FrameType.DIALOG:
      code += `    set ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.SIMPLEFONTSTRING:
    case FrameType.TEXTAREA:
    case FrameType.TIMERTEXT:
      code += `    set ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.text) {
        code += `    call ${frameSetText}(${varName}, "${escapeJassString(frame.text)}")\n`;
      }
      break;
    
    case FrameType.GLUETEXTBUTTON:
    case FrameType.GLUEBUTTON:
    case FrameType.SIMPLEBUTTON:
    case FrameType.INVIS_BUTTON:
      code += `    set ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.SCROLLBAR:
      code += `    set ${varName} = ${createFrameByType}("SCROLLBAR", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    call ${frameSetMinMaxValue}(${varName}, ${(frame.minValue || 0).toFixed(2)}, ${(frame.maxValue || 100).toFixed(2)})\n`;
      code += `    call ${frameSetStepValue}(${varName}, ${(frame.stepSize || 1).toFixed(2)})\n`;
      break;
    
    case FrameType.LISTBOX:
    case FrameType.MENU:
    case FrameType.POPUPMENU:
      code += `    set ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.SPRITE:
    case FrameType.MODEL:
      code += `    set ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.texture) {
        code += `    call ${frameSetTexture}(${varName}, "${escapeJassString(frame.texture)}", 0, true)\n`;
      }
      break;
    
    case FrameType.HIGHLIGHT:
      code += `    set ${varName} = ${createFrameByType}("HIGHLIGHT", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.texture) {
        code += `    call ${frameSetTexture}(${varName}, "${frame.texture}", 0, true)\n`;
      }
      break;
    
    case FrameType.SIMPLESTATUSBAR:
    case FrameType.STATUSBAR:
      code += `    set ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.texture) {
        code += `    call ${frameSetTexture}(${varName}, "${frame.texture}", 0, true)\n`;
      }
      code += `    call ${frameSetMinMaxValue}(${varName}, ${(frame.minValue || 0).toFixed(2)}, ${(frame.maxValue || 100).toFixed(2)})\n`;
      break;
    
    default:
      code += `    set ${varName} = ${createFrameByType}("FRAME", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsJASS(varName, anchors, version, idToVar, project);
      code += `    call ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
  }
  
  code += '\n';
  return code;
}

// 生成单个 Frame 的 LUA 代码
function generateFrameLUA(frame: FrameData, project: ProjectData, version: ExportVersion, idToVar: Map<string, string>): string {
  const parent = resolveParentExpr(frame, project, version, idToVar);
  const varName = idToVar.get(frame.id);
  /* v8 ignore start -- unreachable: 调用方已为每个参与生成的帧登记变量名（见 buildFrameOrder） */
  if (!varName) return '';
  /* v8 ignore end */
  const escName = escapeLuaString(frame.name);

  // 获取锚点数组,如果不存在则创建默认锚点
  const anchors = frame.anchors || createDefaultAnchors(frame.x, frame.y, frame.width, frame.height);
  
  const createFrame = getAPIFunction(version, 'CreateFrame');
  const createFrameByType = getAPIFunction(version, 'CreateFrameByType');
  const frameSetSize = getAPIFunction(version, 'FrameSetSize');
  const frameSetTexture = getAPIFunction(version, 'FrameSetTexture');
  const frameSetText = getAPIFunction(version, 'FrameSetText');
  const frameSetScale = getAPIFunction(version, 'FrameSetScale');
  const frameSetEnable = getAPIFunction(version, 'FrameSetEnable');
  const frameSetFocus = getAPIFunction(version, 'FrameSetFocus');
  const frameSetMinMaxValue = getAPIFunction(version, 'FrameSetMinMaxValue');
  const frameSetStepValue = getAPIFunction(version, 'FrameSetStepValue');
  
  let code = '';
  
  switch (frame.type) {
    case FrameType.BACKDROP:
      code += `    ${varName} = ${createFrame}("BACKDROP", ${parent}, 0, 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    ${frameSetTexture}(${varName}, "${escapeLuaString(frame.texture || 'UI\\Widgets\\EscMenu\\Human\\background.blp')}", 0, true)\n`;
      break;
    
    case FrameType.BUTTON:
    case FrameType.BROWSER_BUTTON:
    case FrameType.SCRIPT_DIALOG_BUTTON:
      code += `    ${varName} = ${createFrame}("ScriptDialogButton", ${parent}, 0, 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.TEXT_FRAME:
      code += `    ${varName} = ${createFrameByType}("TEXT", "", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    ${frameSetText}(${varName}, "${escapeLuaString(`|cff${(frame.textColor || '#FFFFFF').slice(1)}${frame.text || ''}|r`)}")\n`;
      code += `    ${frameSetScale}(${varName}, ${(frame.textScale || 1).toFixed(2)})\n`;
      break;
    
    case FrameType.EDITBOX:
      code += `    ${varName} = ${createFrameByType}("EDITBOX", "", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    ${frameSetEnable}(${varName}, true)\n`;
      code += `    ${frameSetFocus}(${varName}, false)\n`;
      break;
    
    case FrameType.SLIDER:
      code += `    ${varName} = ${createFrame}("SliderTemplate", ${parent}, 0, 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    ${frameSetMinMaxValue}(${varName}, ${(frame.minValue || 0).toFixed(2)}, ${(frame.maxValue || 100).toFixed(2)})\n`;
      code += `    ${frameSetStepValue}(${varName}, ${(frame.stepSize || 1).toFixed(2)})\n`;
      break;
    
    case FrameType.CHECKBOX:
      code += `    ${varName} = ${createFrame}("CheckBoxTemplate", ${parent}, 0, 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    ${frameSetEnable}(${varName}, ${frame.checked ? 'true' : 'false'})\n`;
      break;
    
    case FrameType.FRAME:
    case FrameType.SIMPLEFRAME:
    case FrameType.CONTROL:
    case FrameType.DIALOG:
      code += `    ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.SIMPLEFONTSTRING:
    case FrameType.TEXTAREA:
    case FrameType.TIMERTEXT:
      code += `    ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.text) {
        code += `    ${frameSetText}(${varName}, "${escapeLuaString(frame.text)}")\n`;
      }
      break;
    
    case FrameType.GLUETEXTBUTTON:
    case FrameType.GLUEBUTTON:
    case FrameType.SIMPLEBUTTON:
    case FrameType.INVIS_BUTTON:
      code += `    ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.SCROLLBAR:
      code += `    ${varName} = ${createFrameByType}("SCROLLBAR", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      code += `    ${frameSetMinMaxValue}(${varName}, ${(frame.minValue || 0).toFixed(2)}, ${(frame.maxValue || 100).toFixed(2)})\n`;
      code += `    ${frameSetStepValue}(${varName}, ${(frame.stepSize || 1).toFixed(2)})\n`;
      break;
    
    case FrameType.LISTBOX:
    case FrameType.MENU:
    case FrameType.POPUPMENU:
      code += `    ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
    
    case FrameType.SPRITE:
    case FrameType.MODEL:
      code += `    ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(${varName}, "${escapeLuaString(frame.texture)}", 0, true)\n`;
      }
      break;
    
    case FrameType.HIGHLIGHT:
      code += `    ${varName} = ${createFrameByType}("HIGHLIGHT", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(${varName}, "${frame.texture}", 0, true)\n`;
      }
      break;
    
    case FrameType.SIMPLESTATUSBAR:
    case FrameType.STATUSBAR:
      code += `    ${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(${varName}, "${frame.texture}", 0, true)\n`;
      }
      code += `    ${frameSetMinMaxValue}(${varName}, ${(frame.minValue || 0).toFixed(2)}, ${(frame.maxValue || 100).toFixed(2)})\n`;
      break;
    
    default:
      code += `    ${varName} = ${createFrameByType}("FRAME", "${escName}", ${parent}, "", 0)\n`;
      code += generateAnchorsLUA(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)})\n`;
      break;
  }
  
  code += '\n';
  return code;
}

// 生成 TypeScript 代码
export function generateTypeScriptCode(project: ProjectData): string {
  const version = project.exportVersion || 'reforged';
  const libName = sanitizeLibraryName(project.libraryName);
  const { idToVar, ordered } = buildFrameOrder(project);
  let code = `
/**
 * UI Library: ${libName}
 * Generated by Warcraft 3 UI Designer
 * Date: ${new Date().toLocaleString()}
 * Version: ${version === 'reforged' ? 'Reforged' : '1.27'}
 */

export class ${libName} {
`;
  
// 声明所有 Frame 变量
  Object.values(project.frames).forEach(frame => {
    const isArray = frame.name.includes('[');
    if (!isArray || frame.name.includes('[00]')) {
      const varName = isArray ? frame.name.replace('[00]', '') : frame.name;
      code += isArray 
        ? `  private ${varName}: framehandle[] = [];\n`
        : `  private ${varName}: framehandle | null = null;\n`;
    }
  });
  
  code += `\n  constructor() {\n`;
  code += `    this.createFrames();\n`;
  code += `  }\n\n`;
  
  code += `  private createFrames(): void {\n`;
  
// 创建所有 Frame（父先子后）
  for (const frame of ordered) {
    code += generateFrameTypeScript(frame, project, version, idToVar);
  }

  // 隐藏原生 UI（与 JASS/LUA 同语义）
  if (project.hideGameUI) {
    const enableAutoPos = getAPIFunction(version, 'EnableUIAutoPosition');
    const hideOriginFrames = getAPIFunction(version, 'HideOriginFrames');
    code += `    ${enableAutoPos}(false);\n`;
    code += `    ${hideOriginFrames}(true);\n`;
  }
  for (const line of buildHideStatements(project, version, 'ts')) code += line;

  code += `  }\n`;
  code += `}\n\n`;
  code += `// 初始化\n`;
  code += `const ui = new ${libName}();\n`;
  
  return code;
}

// 生成单个 Frame 的 TypeScript 代码
function generateFrameTypeScript(frame: FrameData, project: ProjectData, version: ExportVersion, idToVar: Map<string, string>): string {
  const getOriginFrame = getAPIFunction(version, 'GetOriginFrame');
  const varName = idToVar.get(frame.id);
  /* v8 ignore start -- unreachable: 调用方已为每个参与生成的帧登记变量名（见 buildFrameOrder） */
  if (!varName) return '';
  /* v8 ignore end */
  const escName = frame.name ?? '';
  const parentId = frame.parentId;
  const parentVar = parentId ? idToVar.get(parentId) : undefined;
  const parent = parentVar ? `this.${parentVar}` : `${getOriginFrame}(ORIGIN_FRAME_GAME_UI, 0)`;
  
  // 获取锚点数组,如果不存在则创建默认锚点
  const anchors = frame.anchors || createDefaultAnchors(frame.x, frame.y, frame.width, frame.height);
  
  const createFrame = getAPIFunction(version, 'CreateFrame');
  const createFrameByType = getAPIFunction(version, 'CreateFrameByType');
  const frameSetSize = getAPIFunction(version, 'FrameSetSize');
  const frameSetTexture = getAPIFunction(version, 'FrameSetTexture');
  const frameSetText = getAPIFunction(version, 'FrameSetText');
  const frameSetEnable = getAPIFunction(version, 'FrameSetEnable');
  const frameSetFocus = getAPIFunction(version, 'FrameSetFocus');
  const frameSetMinMaxValue = getAPIFunction(version, 'FrameSetMinMaxValue');
  const frameSetStepValue = getAPIFunction(version, 'FrameSetStepValue');
  
  let code = `\n    // ${frame.name}\n`;
  
  switch (frame.type) {
    case FrameType.BACKDROP:
      code += `    this.${varName} = ${createFrame}("BACKDROP", ${parent}, 0, 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(this.${varName}, "${frame.texture}", 0, true);\n`;
      }
      break;
    
    case FrameType.BUTTON:
    case FrameType.BROWSER_BUTTON:
    case FrameType.SCRIPT_DIALOG_BUTTON:
      code += `    this.${varName} = ${createFrame}("ScriptDialogButton", ${parent}, 0, 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      break;
    
    case FrameType.TEXT_FRAME:
      code += `    this.${varName} = ${createFrameByType}("TEXT", "", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      if (frame.text) {
        code += `    ${frameSetText}(this.${varName}, "|cff${frame.textColor?.slice(1) || 'FFFFFF'}${frame.text}|r");\n`;
      }
      break;
    
    case FrameType.EDITBOX:
      code += `    this.${varName} = ${createFrameByType}("EDITBOX", "", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      code += `    ${frameSetEnable}(this.${varName}, true);\n`;
      code += `    ${frameSetFocus}(this.${varName}, false);\n`;
      break;
    
    case FrameType.SLIDER:
      code += `    this.${varName} = ${createFrame}("SliderTemplate", ${parent}, 0, 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      code += `    ${frameSetMinMaxValue}(this.${varName}, ${frame.minValue || 0}, ${frame.maxValue || 100});\n`;
      code += `    ${frameSetStepValue}(this.${varName}, ${frame.stepSize || 1});\n`;
      break;
    
    case FrameType.CHECKBOX:
      code += `    this.${varName} = ${createFrame}("CheckBoxTemplate", ${parent}, 0, 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      code += `    ${frameSetEnable}(this.${varName}, ${frame.checked || false});\n`;
      break;
    
    case FrameType.FRAME:
    case FrameType.SIMPLEFRAME:
    case FrameType.CONTROL:
    case FrameType.DIALOG:
      code += `    this.${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      break;
    
    case FrameType.SIMPLEFONTSTRING:
    case FrameType.TEXTAREA:
    case FrameType.TIMERTEXT:
      code += `    this.${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      if (frame.text) {
        code += `    ${frameSetText}(this.${varName}, "${frame.text}");\n`;
      }
      break;
    
    case FrameType.GLUETEXTBUTTON:
    case FrameType.GLUEBUTTON:
    case FrameType.SIMPLEBUTTON:
    case FrameType.INVIS_BUTTON:
      code += `    this.${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      break;
    
    case FrameType.SCROLLBAR:
      code += `    this.${varName} = ${createFrameByType}("SCROLLBAR", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      code += `    ${frameSetMinMaxValue}(this.${varName}, ${frame.minValue || 0}, ${frame.maxValue || 100});\n`;
      code += `    ${frameSetStepValue}(this.${varName}, ${frame.stepSize || 1});\n`;
      break;
    
    case FrameType.LISTBOX:
    case FrameType.MENU:
    case FrameType.POPUPMENU:
      code += `    this.${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      break;
    
    case FrameType.SPRITE:
    case FrameType.MODEL:
      code += `    this.${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(this.${varName}, "${frame.texture}", 0, true);\n`;
      }
      break;
    
    case FrameType.HIGHLIGHT:
      code += `    this.${varName} = ${createFrameByType}("HIGHLIGHT", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(this.${varName}, "${frame.texture}", 0, true);\n`;
      }
      break;
    
    case FrameType.SIMPLESTATUSBAR:
    case FrameType.STATUSBAR:
      code += `    this.${varName} = ${createFrameByType}("${FrameType[frame.type]}", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
      if (frame.texture) {
        code += `    ${frameSetTexture}(this.${varName}, "${frame.texture}", 0, true);\n`;
      }
      code += `    ${frameSetMinMaxValue}(this.${varName}, ${frame.minValue || 0}, ${frame.maxValue || 100});\n`;
      break;
    
    default:
      code += `    this.${varName} = ${createFrameByType}("FRAME", "${escName}", ${parent}, "", 0);\n`;
      code += generateAnchorsTypeScript(varName, anchors, version, idToVar, project);
      code += `    ${frameSetSize}(this.${varName}, ${frame.width.toFixed(5)}, ${frame.height.toFixed(5)});\n`;
  }
  
  return code;
}

// 主导出函数
export function exportProject(project: ProjectData, language: ExportLanguage): string {
  switch (language) {
    case 'jass':
      return generateJASSCode(project);
    case 'lua':
      return generateLUACode(project);
    case 'ts':
      return generateTypeScriptCode(project);
    default:
      throw new Error(`Unsupported language: ${language}`);
  }
}
