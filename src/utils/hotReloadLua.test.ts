/**
 * hotReloadLua 单测：热重载 Lua 生成（从 useHotReloadSync 抽出）。
 * 语义锁定：与抽取前 hook 内联实现一致（逐帧 handle 判断 + toFixed(6) + id 转义）。
 */
import { describe, it, expect } from 'vitest';
import { buildHotReloadLua } from './hotReloadLua';
import { FrameData } from '../types';

function frame(over: Partial<FrameData>): FrameData {
  return {
    id: 'f1',
    name: 'Test',
    type: 'FRAME',
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.15,
    children: [],
    ...over,
  } as FrameData;
}

describe('buildHotReloadLua', () => {
  it('空 frames 产出空串', () => {
    expect(buildHotReloadLua({})).toBe('');
  });

  it('单帧生成 handle 判断 + 位置/大小同步（toFixed 6）', () => {
    const lua = buildHotReloadLua({ f1: frame({}) });
    expect(lua).toContain('local f = _G.UI_Designer_Frames["f1"]');
    expect(lua).toContain('if f and f.handle then');
    expect(lua).toContain('SetAbsolutePoint(f.handle, _G.UI_Designer_GetAnchor("BOTTOMLEFT"), 0.100000, 0.200000)');
    expect(lua).toContain('SetSize(f.handle, 0.300000, 0.150000)');
    expect(lua).toContain('end');
  });

  it('多帧按对象序全部生成', () => {
    const lua = buildHotReloadLua({
      a: frame({ id: 'a', x: 1 }),
      b: frame({ id: 'b', x: 2 }),
    });
    expect(lua.match(/local f = /g)?.length).toBe(2);
    expect(lua).toContain('1.000000');
    expect(lua).toContain('2.000000');
  });

  it('id 含双引号时转义（防 Lua 字符串字面量破坏）', () => {
    const lua = buildHotReloadLua({ x: frame({ id: 'we"ird' }) });
    expect(lua).toContain('_G.UI_Designer_Frames["we\\"ird"]');
  });

  it('负数值如实 toFixed（无科学计数法风险）', () => {
    const lua = buildHotReloadLua({ n: frame({ id: 'n', x: -0.5 }) });
    expect(lua).toContain('-0.500000');
  });
});
