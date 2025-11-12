// Lua 代码生成器 - 将项目导出为 Lua 动态创建代码

import type { ProjectData, FrameData, FrameType } from '../types';

/**
 * Lua UI 代码生成器
 */
export class LuaUIGenerator {
  private project: ProjectData;
  
  constructor(project: ProjectData) {
    this.project = project;
  }
  
  /**
   * 生成完整的 Lua 代码 (仅 UI 内容)
   */
  generate(): string {
    const lines: string[] = [];
    
    // 文件头
    lines.push(this.generateHeader());
    lines.push('');
    
    // Frame 创建函数
    lines.push(this.generateCreateFramesFunction());
    
    return lines.join('\n');
  }
  
  /**
   * 生成加载器脚本 (固定内容，只需生成一次)
   */
  generateLoader(): string {
    const lines: string[] = [];
    
    // 文件头
    lines.push(this.generateLoaderHeader());
    lines.push('');
    
    // API 兼容层
    lines.push(this.generateAPICompatLayer());
    lines.push('');
    
    // 常量定义
    lines.push(this.generateConstants());
    lines.push('');
    
    // Frame 存储
    lines.push('-- Frame 存储表');
    lines.push('local UI_Frames = {}');
    lines.push('local UI_FrameCounter = 0');
    lines.push('');
    
    // 辅助函数
    lines.push(this.generateHelperFunctions());
    lines.push('');
    
    // 清理函数
    lines.push(this.generateCleanupFunction());
    lines.push('');
    
    // 重载函数
    lines.push(this.generateReloadFunction());
    lines.push('');
    
    // 初始化函数
    lines.push(this.generateInitFunction());
    
    return lines.join('\n');
  }
  
  /**
   * 生成文件头 (UI内容)
   */
  private generateHeader(): string {
    const frameCount = Object.keys(this.project.frames).length;
    const date = new Date().toLocaleString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    return `--===========================================================================
-- UI Designer - UI内容脚本 (自动生成)
-- 生成时间: ${date}
-- 项目名称: ${this.project.libraryName || 'Untitled'}
-- Origin模式: ${this.project.originMode || 'gameui'}
-- 控件数量: ${frameCount} 个
--===========================================================================
-- ⚠️ 警告: 此文件由 UI Designer 自动生成，请勿手动修改！
-- 此文件由 ui_loader.lua 加载，不要直接运行
--===========================================================================`;
  }
  
  /**
   * 生成加载器文件头
   */
  private generateLoaderHeader(): string {
    return `--===========================================================================
-- UI Designer - 加载器脚本 (固定内容)
-- 此文件负责：
--   1. API兼容层初始化
--   2. 注册 -reload / -rl 命令
--   3. 清理和重载UI
--   4. 加载 ui_generated.lua 中的UI内容
--===========================================================================
-- ⚠️ 注意: 此文件只需初始化一次，不要重复加载
--===========================================================================`;
  }
  
  /**
   * 生成 API 兼容层
   */
  private generateAPICompatLayer(): string {
    return `--===========================================================================
-- API 兼容层 (War3 1.27 DzAPI / Reforged)
--===========================================================================
local API = {}

-- 尝试加载 DzAPI (War3 1.27 - 需要 require)
local japi_loaded, japi = pcall(require, 'jass.japi')
local common_loaded, common = pcall(require, 'jass.common')

if japi_loaded and japi and japi.DzCreateFrame then
    -- War3 1.27 + DzAPI (通过 require 加载)
    print("|cff00ff00[UI Designer]|r 检测到 DzAPI (War3 1.27 + KKWE)")
    
    -- 导入 JASS Common 函数
    if common_loaded and common then
        CreateTrigger = common.CreateTrigger
        TriggerRegisterPlayerChatEvent = common.TriggerRegisterPlayerChatEvent
        TriggerAddAction = common.TriggerAddAction
        Player = common.Player
    else
        print("|cffffcc00[UI Designer]|r 警告: 无法加载 jass.common")
    end
    
    API.CreateFrame = function(frameType, name, parent, template, id)
        return japi.DzCreateFrame(frameType, parent or API.GetGameUI(), id or 0)
    end
    
    API.CreateSimpleFrame = function(frameType, parent, id)
        return japi.DzCreateSimpleFrame(frameType, parent or API.GetGameUI(), id or 0)
    end
    
    API.CreateFrameByType = function(frameType, name, parent, template, id)
        return japi.DzCreateFrameByTagName(frameType, name, parent or API.GetGameUI(), template or "", id or 0)
    end
    
    -- Model Frame 特殊创建
    API.CreateModelFrame = function(parent)
        return japi.DzFrameAddModel(parent or API.GetGameUI())
    end
    
    API.GetGameUI = function()
        return japi.DzGetGameUI()
    end
    
    API.SetPoint = function(frame, point, relativeFrame, relativePoint, x, y)
        return japi.DzFrameSetPoint(frame, point, relativeFrame, relativePoint, x, y)
    end
    
    API.SetAbsolutePoint = function(frame, point, x, y)
        return japi.DzFrameSetAbsolutePoint(frame, point, x, y)
    end
    
    API.SetSize = function(frame, w, h)
        return japi.DzFrameSetSize(frame, w, h)
    end
    
    API.SetTexture = function(frame, texture, flag)
        return japi.DzFrameSetTexture(frame, texture, flag or 0)
    end
    
    API.SetText = function(frame, text)
        return japi.DzFrameSetText(frame, text)
    end
    
    API.SetTextColor = function(frame, color)
        return japi.DzFrameSetTextColor(frame, color)
    end
    
    API.ShowFrame = function(frame, show)
        return japi.DzFrameShow(frame, show)
    end
    
    API.DestroyFrame = function(frame)
        return japi.DzDestroyFrame(frame)
    end
    
    API.SetAlpha = function(frame, alpha)
        return japi.DzFrameSetAlpha(frame, alpha)
    end
    
    API.SetParent = function(frame, parent)
        return japi.DzFrameSetParent(frame, parent)
    end
    
    API.SetVertexColor = function(frame, color)
        return japi.DzFrameSetVertexColor(frame, color)
    end
    
    API.SetScale = function(frame, scale)
        return japi.DzFrameSetScale(frame, scale)
    end
    
    API.LoadTOC = function(filename)
        return japi.DzLoadToc(filename)
    end
    
    API.GetColor = function(a, r, g, b)
        return japi.DzGetColor(a, r, g, b)
    end
    
    -- 额外的 Frame API
    API.SetFont = function(frame, font, height, flags)
        return japi.DzFrameSetFont(frame, font, height, flags or 0)
    end
    
    API.SetTextAlignment = function(frame, align)
        return japi.DzFrameSetTextAlignment(frame, align)
    end
    
    API.SetAllPoints = function(frame, relativeFrame)
        return japi.DzFrameSetAllPoints(frame, relativeFrame)
    end
    
    API.ClearAllPoints = function(frame)
        return japi.DzFrameClearAllPoints(frame)
    end
    
    API.SetEnable = function(frame, enable)
        return japi.DzFrameSetEnable(frame, enable)
    end
    
    API.GetEnable = function(frame)
        return japi.DzFrameGetEnable(frame)
    end
    
    API.SetTooltip = function(frame, tooltip)
        return japi.DzFrameSetTooltip(frame, tooltip)
    end
    
    API.SetTextSizeLimit = function(frame, size)
        return japi.DzFrameSetTextSizeLimit(frame, size)
    end
    
    API.GetText = function(frame)
        return japi.DzFrameGetText(frame)
    end
    
    API.SetFocus = function(frame, enable)
        return japi.DzFrameSetFocus(frame, enable)
    end
    
    API.GetHeight = function(frame)
        return japi.DzFrameGetHeight(frame)
    end
    
    API.GetWidth = function(frame)
        return japi.DzFrameGetWidth(frame)
    end
    
    API.SetPriority = function(frame, priority)
        return japi.DzFrameSetPriority(frame, priority)
    end
    
    -- Model Frame API
    API.SetModel = function(frame, modelPath, teamColorId)
        return japi.DzFrameSetModel2(frame, modelPath, teamColorId or 0)
    end
    
    API.SetModelAnimation = function(frame, animName)
        return japi.DzFrameSetModelAnimation(frame, animName)
    end
    
    API.SetModelCameraSource = function(frame, x, y, z)
        return japi.DzFrameSetModelCameraSource(frame, x, y, z)
    end
    
    API.SetModelCameraTarget = function(frame, x, y, z)
        return japi.DzFrameSetModelCameraTarget(frame, x, y, z)
    end
    
    -- 文本和字体 API
    API.SetTextAlignment = function(frame, align)
        return japi.DzFrameSetTextAlignment(frame, align)
    end
    
    API.SetVertexColor = function(frame, color)
        return japi.DzFrameSetVertexColor(frame, color)
    end
    
    -- Slider API
    API.SetMinMaxValue = function(frame, minValue, maxValue)
        return japi.DzFrameSetMinMaxValue(frame, minValue, maxValue)
    end
    
    API.SetStepValue = function(frame, step)
        return japi.DzFrameSetStepValue(frame, step)
    end
    
    API.SetValue = function(frame, value)
        return japi.DzFrameSetValue(frame, value)
    end
    
    API.GetValue = function(frame)
        return japi.DzFrameGetValue(frame)
    end
    
    -- 纹理坐标 API
    API.SetTexCoord = function(frame, left, top, right, bottom)
        return japi.DzFrameSetTexCoord(frame, left, top, right, bottom)
    end

elseif BlzCreateFrame then
    -- War3 Reforged (原生 API)
    print("|cff00ff00[UI Designer]|r 检测到 Reforged API (War3 1.31+)")
    
    API.CreateFrame = function(frameType, name, parent, template, id)
        return BlzCreateFrame(frameType, name, parent or API.GetGameUI(), template or "", id or 0)
    end
    
    API.CreateSimpleFrame = function(frameType, parent, id)
        return BlzCreateSimpleFrame(frameType, parent or API.GetGameUI(), id or 0)
    end
    
    API.CreateFrameByType = function(frameType, name, parent, template, id)
        return BlzCreateFrameByType(frameType, name, parent or API.GetGameUI(), template or "", id or 0)
    end
    
    -- Model Frame 特殊创建 (Reforged可能不支持)
    API.CreateModelFrame = function(parent)
        print("|cffffcc00[UI Designer]|r CreateModelFrame 在 Reforged 中可能需要使用其他方式")
        return BlzCreateFrameByType("MODEL", "ModelFrame", parent or API.GetGameUI(), "", 0)
    end
    
    API.GetGameUI = function()
        return BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0)
    end
    
    API.SetPoint = BlzFrameSetPoint
    API.SetAbsolutePoint = BlzFrameSetAbsPoint
    API.SetSize = BlzFrameSetSize
    API.SetTexture = BlzFrameSetTexture
    API.SetText = BlzFrameSetText
    API.SetTextColor = BlzFrameSetTextColor
    API.ShowFrame = BlzFrameSetVisible
    API.DestroyFrame = BlzDestroyFrame
    API.SetAlpha = BlzFrameSetAlpha
    API.SetParent = BlzFrameSetParent
    API.SetVertexColor = BlzFrameSetVertexColor
    API.SetScale = BlzFrameSetScale
    API.LoadTOC = BlzLoadTOCFile
    API.GetColor = function(a, r, g, b)
        return (a << 24) | (r << 16) | (g << 8) | b
    end
    
    -- 额外的 Frame API
    API.SetFont = BlzFrameSetFont
    API.SetTextAlignment = BlzFrameSetTextAlignment
    API.SetAllPoints = BlzFrameSetAllPoints
    API.ClearAllPoints = BlzFrameClearAllPoints
    API.SetEnable = BlzFrameSetEnable
    API.GetEnable = BlzFrameGetEnable
    API.SetTooltip = BlzFrameSetTooltip
    API.SetTextSizeLimit = BlzFrameSetTextSizeLimit
    API.GetText = BlzFrameGetText
    API.SetFocus = BlzFrameSetFocus
    API.GetHeight = BlzFrameGetHeight
    API.GetWidth = BlzFrameGetWidth
    API.SetPriority = BlzFrameSetLevel
    
    -- Model Frame API
    API.SetModel = function(frame, modelPath, teamColorId)
        return BlzFrameSetModel(frame, modelPath, teamColorId or 0)
    end
    
    API.SetModelAnimation = function(frame, animName)
        -- Reforged 可能需要不同的实现
        -- 此处先提供占位实现
        print("|cffffcc00[UI Designer]|r SetModelAnimation 在 Reforged 中可能需要额外支持")
    end
    
    API.SetModelCameraSource = function(frame, x, y, z)
        print("|cffffcc00[UI Designer]|r SetModelCameraSource 在 Reforged 中可能需要额外支持")
    end
    
    API.SetModelCameraTarget = function(frame, x, y, z)
        print("|cffffcc00[UI Designer]|r SetModelCameraTarget 在 Reforged 中可能需要额外支持")
    end
    
    -- 文本和字体 API
    API.SetTextAlignment = BlzFrameSetTextAlignment
    API.SetVertexColor = BlzFrameSetVertexColor
    
    -- Slider API
    API.SetMinMaxValue = function(frame, minValue, maxValue)
        BlzFrameSetMinMaxValue(frame, minValue, maxValue)
    end
    
    API.SetStepValue = function(frame, step)
        BlzFrameSetStepValue(frame, step)
    end
    
    API.SetValue = function(frame, value)
        BlzFrameSetValue(frame, value)
    end
    
    API.GetValue = function(frame)
        return BlzFrameGetValue(frame)
    end
    
    -- 纹理坐标 API (Reforged可能不支持)
    API.SetTexCoord = function(frame, left, top, right, bottom)
        print("|cffffcc00[UI Designer]|r SetTexCoord 在 Reforged 中可能不支持")
    end
    
else
    -- 无 UI API 支持
    print("|cffff0000========================================|r")
    print("|cffff0000  错误: 未检测到 UI API 支持           |r")
    print("|cffffcc00  War3 1.27: 需要安装 KKWE           |r")
    print("|cffffcc00  下载: http://www.kkwai.com/        |r")
    print("|cffffcc00  Reforged: 需要 1.31+ 版本          |r")
    print("|cffff0000========================================|r")
    error("UI API 不可用")
end`;
  }
  
  /**
   * 生成常量定义
   */
  private generateConstants(): string {
    return `--===========================================================================
-- 常量定义
--===========================================================================
local ANCHOR_TOPLEFT = 0
local ANCHOR_TOP = 1
local ANCHOR_TOPRIGHT = 2
local ANCHOR_LEFT = 3
local ANCHOR_CENTER = 4
local ANCHOR_RIGHT = 5
local ANCHOR_BOTTOMLEFT = 6
local ANCHOR_BOTTOM = 7
local ANCHOR_BOTTOMRIGHT = 8

-- 锚点映射
local ANCHOR_MAP = {
    TOPLEFT = ANCHOR_TOPLEFT,
    TOP = ANCHOR_TOP,
    TOPRIGHT = ANCHOR_TOPRIGHT,
    LEFT = ANCHOR_LEFT,
    CENTER = ANCHOR_CENTER,
    RIGHT = ANCHOR_RIGHT,
    BOTTOMLEFT = ANCHOR_BOTTOMLEFT,
    BOTTOM = ANCHOR_BOTTOM,
    BOTTOMRIGHT = ANCHOR_BOTTOMRIGHT
}`;
  }
  
  /**
   * 生成辅助函数
   */
  private generateHelperFunctions(): string {
    return `--===========================================================================
-- 辅助函数
--===========================================================================

-- Frame 计数器
local UI_FrameCounter = 0

-- 注册 Frame
local function RegisterFrame(frame, name, frameType)
    UI_FrameCounter = UI_FrameCounter + 1
    local frameData = {
        handle = frame,
        name = name,
        type = frameType,
        id = UI_FrameCounter
    }
    UI_Frames[name] = frameData
    table.insert(UI_Frames, frameData)
    return frame
end

-- 获取 Frame
local function GetFrame(name)
    local frameData = UI_Frames[name]
    return frameData and frameData.handle or nil
end

-- 获取锚点值
local function GetAnchor(anchorName)
    return ANCHOR_MAP[anchorName] or ANCHOR_CENTER
end

-- 解析颜色字符串 (#RRGGBB 或 #AARRGGBB)
local function ParseColor(colorStr)
    if not colorStr then return nil end
    
    colorStr = colorStr:gsub("#", "")
    local len = #colorStr
    
    if len == 6 then
        -- RGB
        local r = tonumber(colorStr:sub(1, 2), 16)
        local g = tonumber(colorStr:sub(3, 4), 16)
        local b = tonumber(colorStr:sub(5, 6), 16)
        return API.GetColor(255, r, g, b)
    elseif len == 8 then
        -- ARGB
        local a = tonumber(colorStr:sub(1, 2), 16)
        local r = tonumber(colorStr:sub(3, 4), 16)
        local g = tonumber(colorStr:sub(5, 6), 16)
        local b = tonumber(colorStr:sub(7, 8), 16)
        return API.GetColor(a, r, g, b)
    end
    
    return nil
end

-- 导出全局变量供 ui_generated.lua 使用
_G.UI_Designer_API = API
_G.UI_Designer_Frames = UI_Frames
_G.UI_Designer_GetFrame = GetFrame
_G.UI_Designer_RegisterFrame = RegisterFrame
_G.UI_Designer_GetAnchor = GetAnchor
_G.UI_Designer_ParseColor = ParseColor`;
  }
  
  /**
   * 生成创建 Frame 的函数
   */
  private generateCreateFramesFunction(): string {
    const lines: string[] = [];
    
    lines.push('--===========================================================================');
    lines.push('-- 创建所有 Frame');
    lines.push('--===========================================================================');
    
    // 按根节点创建
    const rootFrames = this.project.rootFrameIds
      .map(id => this.project.frames[id])
      .filter(f => f);
    
    if (rootFrames.length === 0) {
      lines.push('-- 没有Frame需要创建');
      lines.push('print("|cffffcc00[UI Designer]|r 警告: 项目中没有Frame")');
      return lines.join('\n');
    }
    
    lines.push('-- 获取全局变量 (由 ui_loader.lua 提供)');
    lines.push('local API = _G.UI_Designer_API');
    lines.push('local UI_Frames = _G.UI_Designer_Frames');
    lines.push('local GetFrame = _G.UI_Designer_GetFrame');
    lines.push('local RegisterFrame = _G.UI_Designer_RegisterFrame');
    lines.push('local GetAnchor = _G.UI_Designer_GetAnchor');
    lines.push('local ParseColor = _G.UI_Designer_ParseColor');
    lines.push('');
    lines.push('local gameUI = API.GetGameUI()');
    lines.push('local frameCount = 0');
    lines.push('');
    
    for (const frame of rootFrames) {
      lines.push(...this.generateFrameCode(frame, 0));
    }
    
    lines.push('');
    lines.push('print(string.format("|cff00ff00[UI Designer]|r 创建完成: %d 个Frame", frameCount))');
    
    return lines.join('\n');
  }
  
  /**
   * 生成单个 Frame 的代码
   */
  private generateFrameCode(frame: FrameData, level: number): string[] {
    const lines: string[] = [];
    const indent = '    '.repeat(level);
    const frameName = this.escapeLuaString(frame.name);
    
    lines.push(`${indent}-- ${frame.name} (${this.getFrameTypeName(frame.type)})`);
    lines.push(`${indent}do`);
    
    // 确定父控件
    const parentRef = frame.parentId 
      ? `GetFrame("${this.escapeLuaString(this.project.frames[frame.parentId].name)}")`
      : 'gameUI';
    
    // 创建 Frame - MODEL类型需要特殊处理
    const frameTypeName = this.getFrameTypeName(frame.type);
    if (frame.type === 22) { // 22 = MODEL
      lines.push(`${indent}    -- MODEL 需要使用特殊API创建`);
      lines.push(`${indent}    local frame = API.CreateModelFrame(${parentRef})`);
    } else {
      lines.push(`${indent}    local frame = API.CreateFrameByType("${frameTypeName}", "${frameName}", ${parentRef}, "", 0)`);
    }
    lines.push(`${indent}    RegisterFrame(frame, "${frameName}", "${frameTypeName}")`);
    lines.push(`${indent}    frameCount = frameCount + 1`);
    lines.push('');
    
    // 设置位置和大小
    lines.push(`${indent}    -- 位置和大小`);
    lines.push(`${indent}    API.SetAbsolutePoint(frame, GetAnchor("BOTTOMLEFT"), ${frame.x.toFixed(6)}, ${frame.y.toFixed(6)})`);
    lines.push(`${indent}    API.SetSize(frame, ${frame.width.toFixed(6)}, ${frame.height.toFixed(6)})`);
    lines.push('');
    
    // 设置纹理
    if (frame.texture) {
      lines.push(`${indent}    -- 纹理`);
      lines.push(`${indent}    API.SetTexture(frame, "${this.escapeLuaString(frame.texture)}", 0)`);
      lines.push('');
    }
    
    // 设置 Backdrop 背景
    if (frame.backdropBackground) {
      lines.push(`${indent}    -- Backdrop 背景纹理`);
      lines.push(`${indent}    -- 注意: Backdrop的边框、平铺等高级属性需要通过FDF模板定义`);
      lines.push(`${indent}    -- 当前仅支持设置背景纹理`);
      lines.push(`${indent}    API.SetTexture(frame, "${this.escapeLuaString(frame.backdropBackground)}", 0)`);
      lines.push('');
    }
    
    // Backdrop边框纹理(如果支持的话)
    if (frame.backdropEdgeFile) {
      lines.push(`${indent}    -- Backdrop 边框纹理`);
      lines.push(`${indent}    -- 警告: 边框可能需要FDF模板支持`);
      lines.push(`${indent}    API.SetTexture(frame, "${this.escapeLuaString(frame.backdropEdgeFile)}", 1)`);
      lines.push('');
    }
    
    // 设置文本
    if (frame.text) {
      lines.push(`${indent}    -- 文本`);
      lines.push(`${indent}    API.SetText(frame, "${this.escapeLuaString(frame.text)}")`);
      
      // 文本颜色
      if (frame.textColor) {
        lines.push(`${indent}    local color = ParseColor("${frame.textColor}")`);
        lines.push(`${indent}    if color then API.SetTextColor(frame, color) end`);
      }
      
      // 字体颜色 (RGBA)
      if (frame.fontColor) {
        const [r, g, b, a] = frame.fontColor;
        const color = `API.GetColor(${Math.round(a * 255)}, ${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
        lines.push(`${indent}    API.SetTextColor(frame, ${color})`);
      }
      
      // 文本缩放
      if (frame.textScale && frame.textScale !== 1) {
        lines.push(`${indent}    API.SetScale(frame, ${frame.textScale.toFixed(3)})`);
      }
      
      // 文本对齐
      if (frame.fontJustificationH) {
        const alignMap: Record<string, number> = {
          'JUSTIFYLEFT': 0,
          'JUSTIFYCENTER': 1,
          'JUSTIFYRIGHT': 2
        };
        const align = alignMap[frame.fontJustificationH] ?? 0;
        lines.push(`${indent}    API.SetTextAlignment(frame, ${align})`);
      }
      
      // 字体设置
      if (frame.font && frame.fontSize) {
        const flags = frame.fontFlags?.join('|') || '0';
        lines.push(`${indent}    API.SetFont(frame, "${this.escapeLuaString(frame.font)}", ${(frame.fontSize / 1000).toFixed(3)}, ${flags})`);
      }
      
      // 文本长度限制
      if (frame.maxChars || frame.textLength) {
        const limit = frame.maxChars || frame.textLength || 0;
        lines.push(`${indent}    API.SetTextSizeLimit(frame, ${limit})`);
      }
      
      lines.push('');
    }
    
    // 设置透明度
    if (frame.alpha !== undefined && frame.alpha !== 255 && frame.alpha !== 1) {
      const alphaValue = frame.alpha > 1 ? Math.round(frame.alpha) : Math.round(frame.alpha * 255);
      lines.push(`${indent}    API.SetAlpha(frame, ${alphaValue})`);
      lines.push('');
    }
    
    // MODEL Frame: 设置3D模型
    if (frame.type === 22 && frame.backgroundArt) { // 22 = MODEL
      lines.push(`${indent}    -- Model 设置`);
      lines.push(`${indent}    API.SetModel(frame, "${this.escapeLuaString(frame.backgroundArt)}", 0)`);
      
      // 相机设置 - 将角度转换为相机位置
      if (frame.cameraYaw !== undefined || frame.cameraPitch !== undefined || frame.cameraDistance !== undefined) {
        const distance = frame.cameraDistance || 300;
        const yaw = frame.cameraYaw || 0;
        const pitch = frame.cameraPitch || 0;
        
        // 球坐标转笛卡尔坐标
        const x = distance * Math.cos(pitch) * Math.sin(yaw);
        const y = -distance * Math.cos(pitch) * Math.cos(yaw);
        const z = distance * Math.sin(pitch);
        
        lines.push(`${indent}    API.SetModelCameraSource(frame, ${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
        lines.push(`${indent}    API.SetModelCameraTarget(frame, 0, 0, 0)`);
      }
      
      lines.push('');
    }
    
    // SPRITE Frame: 设置sprite模型
    if (frame.type === 21 && frame.backgroundArt) { // 21 = SPRITE
      lines.push(`${indent}    -- Sprite 模型`);
      lines.push(`${indent}    API.SetModel(frame, "${this.escapeLuaString(frame.backgroundArt)}", 0)`);
      lines.push('');
    }
    
    // SLIDER Frame: 设置滑动条属性
    if (frame.type === 16) { // 16 = SLIDER
      if (frame.minValue !== undefined && frame.maxValue !== undefined) {
        lines.push(`${indent}    -- Slider 范围`);
        lines.push(`${indent}    API.SetMinMaxValue(frame, ${frame.minValue}, ${frame.maxValue})`);
      }
      if (frame.stepSize !== undefined) {
        lines.push(`${indent}    API.SetStepValue(frame, ${frame.stepSize})`);
      }
      if (frame.sliderInitialValue !== undefined) {
        lines.push(`${indent}    API.SetValue(frame, ${frame.sliderInitialValue})`);
      }
      lines.push('');
    }
    
    // 纹理坐标设置
    if (frame.texCoord) {
      lines.push(`${indent}    -- 纹理坐标`);
      const [left, right, top, bottom] = frame.texCoord;
      lines.push(`${indent}    API.SetTexCoord(frame, ${left}, ${top}, ${right}, ${bottom})`);
      lines.push('');
    }
    
    // 顶点颜色设置
    if (frame.fontColor && (frame.type === 2 || frame.type === 24)) { // BACKDROP 或 SIMPLESTATUSBAR
      const [r, g, b, a] = frame.fontColor;
      const color = `API.GetColor(${Math.round(a * 255)}, ${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
      lines.push(`${indent}    -- 顶点颜色`);
      lines.push(`${indent}    API.SetVertexColor(frame, ${color})`);
      lines.push('');
    }
    
    // 设置可见性
    if (frame.visible === false) {
      lines.push(`${indent}    API.ShowFrame(frame, false)`);
      lines.push('');
    }
    
    // 递归创建子控件
    if (frame.children && frame.children.length > 0) {
      lines.push(`${indent}    -- 子控件`);
      for (const childId of frame.children) {
        const child = this.project.frames[childId];
        if (child) {
          lines.push(...this.generateFrameCode(child, level + 1));
        }
      }
    }
    
    lines.push(`${indent}end`);
    lines.push('');
    
    return lines;
  }
  
  /**
   * 获取 Frame 类型名称
   */
  private getFrameTypeName(type: FrameType): string {
    // 映射到实际的 Frame 类型名
    const typeMap: Record<number, string> = {
      0: 'ORIGIN',
      1: 'FRAME',
      2: 'BACKDROP',
      3: 'SIMPLEFRAME',
      4: 'TEXT',
      5: 'SIMPLEFONTSTRING',
      6: 'TEXTAREA',
      7: 'BUTTON',
      8: 'GLUETEXTBUTTON',
      9: 'GLUEBUTTON',
      10: 'SIMPLEBUTTON',
      11: 'BROWSER_BUTTON',
      12: 'SCRIPT_DIALOG_BUTTON',
      13: 'INVIS_BUTTON',
      14: 'CHECKBOX',
      15: 'EDITBOX',
      16: 'SLIDER',
      17: 'SCROLLBAR',
      18: 'LISTBOX',
      19: 'MENU',
      20: 'POPUPMENU',
      21: 'SPRITE',
      22: 'MODEL',
      23: 'HIGHLIGHT',
      24: 'SIMPLESTATUSBAR',
      25: 'STATUSBAR',
      26: 'CONTROL',
      27: 'DIALOG',
      28: 'TIMERTEXT',
    };
    
    return typeMap[type] || 'FRAME';
  }
  
  /**
   * 生成清理函数
   */
  private generateCleanupFunction(): string {
    return `--===========================================================================
-- 清理所有 Frame
--===========================================================================
local function CleanupAllFrames()
    for i = #UI_Frames, 1, -1 do
        local frameData = UI_Frames[i]
        if frameData and frameData.handle then
            pcall(function()
                API.DestroyFrame(frameData.handle)
            end)
        end
        UI_Frames[i] = nil
    end
    
    -- 清空命名表
    for k in pairs(UI_Frames) do
        if type(k) == "string" then
            UI_Frames[k] = nil
        end
    end
    
    collectgarbage()
    print("|cff888888[UI Designer]|r 已清理所有 Frame")
end`;
  }
  
  /**
   * 生成重载函数
   */
  private generateReloadFunction(): string {
    const uiGeneratedPath = '.\\\UI-Designer\\\\ui_generated.lua';
    
    return `--===========================================================================
-- 重载 UI
--===========================================================================
local function ReloadUI()
    local startTime = os.clock()
    
    -- 清理旧 UI
    CleanupAllFrames()
    
    -- 重新加载 UI 内容脚本
    local success, err = pcall(function()
        local f = io.open([[${uiGeneratedPath}]], 'r')
        local content = f:read('*a')
        f:close()
        load(content)()
    end)
    
    if success then
        local elapsed = (os.clock() - startTime) * 1000
        print(string.format("|cff00ff00[UI Designer]|r UI已重载 (%.1fms)", elapsed))
    else
        print("|cffff0000[UI Designer]|r UI重载失败:")
        print("|cffff0000" .. tostring(err) .. "|r")
    end
end`;
  }
  
  /**
   * 生成初始化函数
   */
  /**
   * 生成初始化函数
   */
  private generateInitFunction(): string {
    const uiGeneratedPath = '.\\\\UI-Designer\\\\ui_generated.lua';
    
    return `--===========================================================================
-- 初始化
--===========================================================================
print("|cff00ffff" .. string.rep("=", 60) .. "|r")
print("|cffffcc00           UI Designer - 动态UI系统 v1.0              |r")
print("|cff00ffff" .. string.rep("=", 60) .. "|r")

-- 注册重载命令
local t = CreateTrigger()
TriggerRegisterPlayerChatEvent(t, Player(0), "-reload", true)
TriggerRegisterPlayerChatEvent(t, Player(0), "-rl", true)
TriggerAddAction(t, ReloadUI)
print("|cff00ff00[UI Designer]|r 命令: -reload 或 -rl  刷新UI")

-- 首次加载 UI
local success, err = pcall(function()
    local f = io.open([[${uiGeneratedPath}]], 'r')
    local content = f:read('*a')
    f:close()
    load(content)()
end)

if success then
    print("|cff00ff00[UI Designer]|r UI加载成功")
else
    print("|cffff0000[UI Designer]|r UI加载失败:")
    print("|cffff0000" .. tostring(err) .. "|r")
end

print("|cff00ffff" .. string.rep("=", 60) .. "|r")`;
  }
  
  /**
   * 转义 Lua 字符串
   */
  private escapeLuaString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
  }
}

/**
 * 导出函数 - 生成 UI 内容脚本
 */
export function exportProjectToLua(project: ProjectData): string {
  const generator = new LuaUIGenerator(project);
  return generator.generate();
}

/**
 * 生成加载器脚本 (固定内容)
 */
export function generateLoaderScript(project: ProjectData): string {
  const generator = new LuaUIGenerator(project);
  return generator.generateLoader();
}
