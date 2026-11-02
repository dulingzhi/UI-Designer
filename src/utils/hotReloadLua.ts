/**
 * 热重载 Lua 同步代码生成（从 useHotReloadSync 抽出，可单测）
 *
 * 语义对齐原 hook 内联实现（不得反转）：
 * - 每帧生成 `local f = _G.UI_Designer_Frames["<id>"]` + handle 判断 + 位置/大小同步
 * - 数值一律 toFixed(6)（JASS/LUA 无科学计数法风险，同 codeExport 口径）
 * - id/text 走 escapeLuaString（防御：id 格式虽受控，双引号仍会破坏 Lua 字符串字面量）
 */
import { escapeLuaString } from './codegen/identifiers';
import { FrameData } from '../types';

/** 生成把全部帧同步到魔兽的 Lua 代码（逐帧 SetAbsolutePoint/SetSize）。 */
export function buildHotReloadLua(frames: Record<string, FrameData>): string {
  let luaCode = '';
  const uiFrames = '_G.UI_Designer_Frames';
  Object.values(frames).forEach(frame => {
    luaCode += `local f = ${uiFrames}["${escapeLuaString(frame.id)}"]\n`;
    luaCode += `if f and f.handle then\n`;
    // 位置同步
    luaCode += `  _G.UI_Designer_API.SetAbsolutePoint(f.handle, _G.UI_Designer_GetAnchor("BOTTOMLEFT"), ${frame.x.toFixed(6)}, ${frame.y.toFixed(6)})\n`;
    // 大小同步
    luaCode += `  _G.UI_Designer_API.SetSize(f.handle, ${frame.width.toFixed(6)}, ${frame.height.toFixed(6)})\n`;
    // 文本同步（仅文本帧携带 text）
    if (frame.text) {
      luaCode += `  _G.UI_Designer_API.SetText(f.handle, "${escapeLuaString(frame.text)}")\n`;
    }
    // 纹理同步（仅设置过 texture 的帧；BlzFrameSetTexture 对 TEXTURE 类帧生效）
    if (frame.texture) {
      luaCode += `  _G.UI_Designer_API.SetTexture(f.handle, "${escapeLuaString(frame.texture)}", 0)\n`;
    }
    luaCode += `end\n`;
  });
  return luaCode;
}
