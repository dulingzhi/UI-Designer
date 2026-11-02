/**
 * 代码导出「功能完整性」守卫 —— ProjectData / FrameData 字段是否真的落进产物。
 *
 * 背景：`codeExport.ts` 长期只导出一小部分字段。经审计，以下 8 个 ProjectData 字段
 * **完全未被使用**（用户在编辑器勾选后导出即丢失）：
 *   hideHeroBar / hideMiniMap / hideResources / hideButtonBar / hidePortrait / hideChat /
 *   originMode / appInterface   （只有 hideGameUI 被用到）
 * 另有 FrameData 的 visible / horAlign / verAlign / 纹理类字段未导出。
 *
 * 另发现一处 **API 名错误**：本仓库用 `FrameSetStepSize`，但权威实现（openwar3
 * `compat/lua/japi/dzapi/frame.ts` 与 Blz 原生）只有 `FrameSetStepValue`；N 次调用会因
 * 函数不存在而编译失败。
 *
 * 本文件按功能逐条锁死；补齐后转绿。
 */
import { describe, it, expect } from 'vitest';
import { FrameType, type FrameData, type ProjectData } from '../../../src/types';
import { generateJASSCode, generateLUACode, generateTypeScriptCode } from '../../../src/utils/codeExport';

function mkFrame(o: Partial<FrameData> & { id: string; name: string }): FrameData {
  return {
    type: FrameType.FRAME, x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children: [], ...o,
  } as FrameData;
}
function mkProject(frames: FrameData[], o: Partial<ProjectData> = {}): ProjectData {
  const rec: Record<string, FrameData> = {};
  for (const f of frames) rec[f.id] = f;
  return {
    id: 'p', name: 'P', libraryName: 'TestLib',
    frames: rec, rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
    ...o,
  } as ProjectData;
}

describe('API 名正确性（以 openwar3 dzapi/frame.ts + Blz 原生为准）', () => {
  it('步长函数是 FrameSetStepValue，不是 FrameSetStepSize', () => {
    const s = mkFrame({ id: 's1', name: 'Slider1', type: FrameType.SLIDER, minValue: 0, maxValue: 10, stepSize: 2 });
    const code = generateJASSCode(mkProject([s]));
    expect(code).toContain('FrameSetStepValue');
    expect(code).not.toContain('FrameSetStepSize');
  });

  it('SCROLLBAR 的步长同样用 StepValue', () => {
    const sb = mkFrame({ id: 'b1', name: 'Bar1', type: FrameType.SCROLLBAR, minValue: 0, maxValue: 10, stepSize: 1 });
    const code = generateJASSCode(mkProject([sb]));
    expect(code).not.toContain('FrameSetStepSize');
  });
});

describe('ProjectData 隐藏 UI 开关必须落到产物', () => {
  it('hideMiniMap → 隐藏小地图（origin frame type 8）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hideMiniMap: true } as Partial<ProjectData>));
    expect(code).toMatch(/GetOriginFrame\(ORIGIN_FRAME_MINIMAP/);
    expect(code).toContain('FrameSetVisible');
  });

  it('hideHeroBar → 隐藏英雄栏按钮（type 3）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hideHeroBar: true } as Partial<ProjectData>));
    expect(code).toMatch(/GetOriginFrame\(ORIGIN_FRAME_HERO_BUTTON/);
  });

  it('hidePortrait → 隐藏头像（type 16）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hidePortrait: true } as Partial<ProjectData>));
    expect(code).toMatch(/GetOriginFrame\(ORIGIN_FRAME_PORTRAIT/);
  });

  it('hideChat → 隐藏聊天（type 13）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hideChat: true } as Partial<ProjectData>));
    expect(code).toMatch(/GetOriginFrame\(ORIGIN_FRAME_CHAT_MSG/);
  });

  it('hideButtonBar → 隐藏上按钮栏（type 10）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hideButtonBar: true } as Partial<ProjectData>));
    expect(code).toContain('FrameSetVisible');
    expect(code).toMatch(/ORIGIN_FRAME_/);
  });

  it('hideResources → 按名字隐藏 ConsoleUIBackdrop / ResourceBar', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hideResources: true } as Partial<ProjectData>));
    expect(code).toContain('FrameSetVisible');
    expect(code).toMatch(/ResourceBar|ConsoleUIBackdrop|SimpleFrameName/);
  });

  it('未勾选任何隐藏项时产物不含多余的隐藏调用', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f]));
    expect(code).not.toMatch(/GetOriginFrame\(ORIGIN_FRAME_MINIMAP/);
  });

  it('hideGameUI 同时触发 HideOriginFrames 与 EnableUIAutoPosition', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { hideGameUI: true } as Partial<ProjectData>));
    expect(code).toContain('HideOriginFrames');
    expect(code).toContain('EnableUIAutoPosition');
  });
});

describe('originMode 决定父帧根', () => {  it('gameui 用 ORIGIN_FRAME_GAME_UI', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { originMode: 'gameui' } as Partial<ProjectData>));
    expect(code).toContain('ORIGIN_FRAME_GAME_UI');
  });

  it('worldframe 用 SIMPLE_UI 父级（GetOriginFrame(18,0) 的对应常量）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { originMode: 'worldframe' } as Partial<ProjectData>));
    expect(code).toContain('ORIGIN_FRAME_SIMPLE_UI');
    expect(code).not.toContain('ORIGIN_FRAME_GAME_UI');
  });

  it('consoleui 仍以 GAME_UI 为根（环境无独立 origin 常量，如实记录）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { originMode: 'consoleui' } as Partial<ProjectData>));
    // openwar3 的 dzapi 未提供独立 CONSOLE_UI origin 类型；控制台差异只体现在隐藏策略上。
    expect(code).toContain('ORIGIN_FRAME_GAME_UI');
  });
});

describe('隐藏 UI 在 LUA / TS 侧同样生效（三语言一致）', () => {
  it('LUA 侧 hideMiniMap 生成裸调用（无 call 前缀）', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateLUACode(mkProject([f], { hideMiniMap: true } as Partial<ProjectData>));
    expect(code).toContain('ORIGIN_FRAME_MINIMAP');
    expect(code).not.toContain('call ');
  });

  it('TS 侧 hideMiniMap 生成带分号的调用', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateTypeScriptCode(mkProject([f], { hideMiniMap: true } as Partial<ProjectData>));
    expect(code).toContain('ORIGIN_FRAME_MINIMAP');
    expect(code).toContain(';');
  });

  it('LUA/TS 侧 hideResources 也按名字隐藏', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const lua = generateLUACode(mkProject([f], { hideResources: true } as Partial<ProjectData>));
    const ts = generateTypeScriptCode(mkProject([f], { hideResources: true } as Partial<ProjectData>));
    expect(lua).toContain('ResourceBar');
    expect(ts).toContain('ResourceBar');
  });
});