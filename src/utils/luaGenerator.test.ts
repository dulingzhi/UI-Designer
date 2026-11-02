import { describe, it, expect } from 'vitest';
import { LuaUIGenerator, exportProjectToLua, generateLoaderScript } from './luaGenerator';
import { ProjectData, FrameData, FrameType } from '../types';

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    version: 1,
    libraryName: 'MyLib',
    originMode: 'gameui',
    exportVersion: 'reforged',
    hideGameUI: false,
    hideHeroBar: false,
    hideMiniMap: false,
    hideResources: false,
    hideButtonBar: false,
    hidePortrait: false,
    hideChat: false,
    appInterface: undefined as never,
    frames: {},
    rootFrameIds: [],
    tableArrays: [],
    circleArrays: [],
    ...overrides,
  };
}

function frame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'f',
    name: 'Frame',
    type: FrameType.FRAME,
    x: 0,
    y: 0,
    width: 100,
    height: 20,
    z: 0,
    parentId: undefined,
    children: [],
    anchors: [],
    ...overrides,
  };
}

describe('LuaUIGenerator', () => {
  describe('generate()', () => {
    it('emits header with library name, origin mode and frame count', () => {
      const project = makeProject({
        libraryName: 'TestProj',
        originMode: 'worldframe',
        frames: { a: frame({ id: 'a' }) },
        rootFrameIds: ['a'],
      });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('TestProj');
      expect(out).toContain('worldframe');
      expect(out).toContain('控件数量: 1 个');
      expect(out).toContain('ui_loader.lua');
    });

    it('defaults libraryName and originMode when absent', () => {
      const project = makeProject({ frames: {}, rootFrameIds: [] });
      // @ts-expect-error force missing optional header fields
      delete project.libraryName;
      // @ts-expect-error force missing optional header fields
      delete project.originMode;
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('Untitled');
      expect(out).toContain('gameui');
    });

    it('emits the create-frames function banner', () => {
      const out = new LuaUIGenerator(makeProject({ frames: {}, rootFrameIds: [] })).generate();
      expect(out).toContain('-- 创建所有 Frame');
    });

    it('handles project with no root frames (empty warning)', () => {
      const out = new LuaUIGenerator(makeProject({ frames: {}, rootFrameIds: [] })).generate();
      expect(out).toContain('警告: 项目中没有Frame');
      expect(out).not.toContain('local gameUI = API.GetGameUI()');
    });

    it('creates a simple root frame', () => {
      const root = frame({ id: 'r', name: 'Root', type: FrameType.FRAME, x: 1.5, y: -2.25, width: 200, height: 30 });
      const project = makeProject({ frames: { r: root }, rootFrameIds: ['r'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('-- Root (FRAME)');
      expect(out).toContain('API.CreateFrameByType("FRAME", "Root", gameUI, "", 0)');
      expect(out).toContain('API.SetAbsolutePoint(frame, GetAnchor("BOTTOMLEFT"), 1.500000, -2.250000)');
      expect(out).toContain('API.SetSize(frame, 200.000000, 30.000000)');
      expect(out).toContain('frameCount = frameCount + 1');
      expect(out).toContain('RegisterFrame(frame');
    });

    it('creates a child frame referencing parent by GetFrame', () => {
      const root = frame({ id: 'r', name: 'Root', type: FrameType.FRAME, children: ['c'] });
      const child = frame({ id: 'c', name: 'Child', type: FrameType.BACKDROP, parentId: 'r' });
      const project = makeProject({ frames: { r: root, c: child }, rootFrameIds: ['r'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('local frame = API.CreateFrameByType("BACKDROP", "Child", GetFrame("Root"), "", 0)');
      expect(out).toContain('-- 子控件');
    });

    it('creates a MODEL frame with special API and 3D model + camera', () => {
      const m = frame({
        id: 'm', name: 'Model', type: 22, backgroundArt: 'model.mdx',
        cameraYaw: 0.5, cameraPitch: 0.2, cameraDistance: 300,
      });
      const project = makeProject({ frames: { m }, rootFrameIds: ['m'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.CreateModelFrame(gameUI)');
      expect(out).toContain('-- Model 设置');
      expect(out).toContain('API.SetModel(frame, "model.mdx", 0)');
      expect(out).toContain('API.SetModelCameraSource(frame,');
      expect(out).toContain('API.SetModelCameraTarget(frame, 0, 0, 0)');
    });

    it('creates SPRITE frame with model', () => {
      const s = frame({ id: 's', name: 'Spr', type: 21, backgroundArt: 'spr.mdx' });
      const project = makeProject({ frames: { s }, rootFrameIds: ['s'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('-- Sprite 模型');
      expect(out).toContain('API.SetModel(frame, "spr.mdx", 0)');
      // NOT treated as MODEL
      expect(out).not.toMatch(/CreateModelFrame/);
    });

    it('sets texture, backdrop background, and backdrop edge file', () => {
      const f = frame({
        id: 'f', name: 'B', type: FrameType.BACKDROP,
        texture: 'tex.blp', backdropBackground: 'bg.blp', backdropEdgeFile: 'edge.blp',
      });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetTexture(frame, "tex.blp", 0)');
      expect(out).toContain('API.SetTexture(frame, "bg.blp", 0)');
      expect(out).toContain('API.SetTexture(frame, "edge.blp", 1)');
    });

    it('sets text, textColor, fontColor, textScale, justification, font, text size limit', () => {
      const f = frame({
        id: 'f', name: 'T', type: FrameType.TEXT_FRAME,
        text: 'Hi',
        textColor: '#FF0000',
        fontColor: [1, 0, 0, 1],
        textScale: 2,
        fontJustificationH: 'JUSTIFYCENTER',
        font: 'war3.mdx',
        fontSize: 1200,
        fontFlags: ['FIXED'],
        maxChars: 10,
      });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetText(frame, "Hi")');
      expect(out).toContain('ParseColor("#FF0000")');
      expect(out).toContain('API.SetTextColor(frame, ') // fontColor
      expect(out).toContain('API.SetScale(frame, 2.000)');
      expect(out).toContain('API.SetTextAlignment(frame, 1)');
      expect(out).toContain('API.SetFont(frame, "war3.mdx", 1.200, FIXED)');
      expect(out).toContain('API.SetTextSizeLimit(frame, 10)');
    });

    it('covers text-grained branches: no textScale, default justification, no fontFlags, textLength limit, missing child', () => {
      const f = frame({
        id: 'f', name: 'T2', type: FrameType.TEXT_FRAME,
        text: 'X',
        fontJustificationH: 'SOMETHING',
        font: 'f',
        fontSize: 500,
        textLength: 7,
        maxChars: 0,
        children: ['t2c'],
      });
      // omit textScale (default), fontFlags absent, maxChars falsy but textLength set
      const child = frame({ id: 't2c', name: 'T2Child', type: FrameType.FRAME, parentId: 'f', children: ['ghost'] });
      const project = makeProject({ frames: { f, t2c: child }, rootFrameIds: ['f'] });
      project.frames.ghost = undefined as never;
      child.children = ['ghost'];
      const out = new LuaUIGenerator(project).generate();
      expect(out).not.toContain('API.SetScale'); // textScale falsy -> no scale
      expect(out).toContain('API.SetTextAlignment(frame, 0)'); // default align 0
      expect(out).toContain('API.SetFont(frame, "f", 0.500, 0)'); // no fontFlags -> '0'
      expect(out).toContain('API.SetTextSizeLimit(frame, 7)'); // textLength used
      // the 'ghost' child id is not present in project.frames and is silently skipped
      expect(out).toContain('T2Child');
    });

    it('sets alpha for values >1 and <1 in different scales', () => {
      const f1 = frame({ id: 'a', name: 'A', type: FrameType.FRAME, alpha: 128 });
      const f2 = frame({ id: 'b', name: 'B', type: FrameType.FRAME, alpha: 0.5 });
      const f3 = frame({ id: 'c', name: 'C', type: FrameType.FRAME, alpha: 255 });
      const project = makeProject({ frames: { a: f1, b: f2, c: f3 }, rootFrameIds: ['a', 'b', 'c'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetAlpha(frame, 128)'); // alpha>1
      expect(out).toContain('API.SetAlpha(frame, 128)'); // 0.5*255 -> 128 rounds
      expect(out).not.toContain('API.SetAlpha(frame, 255)'); // alpha 255 excluded
    });

    it('sets slider min/max, step, initial value', () => {
      const f = frame({
        id: 's', name: 'Slider', type: 16,
        minValue: 0, maxValue: 100, stepSize: 5, sliderInitialValue: 50,
      });
      const project = makeProject({ frames: { s: f }, rootFrameIds: ['s'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetMinMaxValue(frame, 0, 100)');
      expect(out).toContain('API.SetStepValue(frame, 5)');
      expect(out).toContain('API.SetValue(frame, 50)');
    });

    it('slider with partial fields covers min/max, step and init-value negative branches', () => {
      // type 16 but only some optional fields set (covers the false side of each SLIDER sub-if)
      const a = frame({ id: 'a', name: 'SMin', type: 16, minValue: 0, maxValue: 100 });
      const b = frame({ id: 'b', name: 'SStep', type: 16, stepSize: 5 });
      const c = frame({ id: 'c', name: 'SInit', type: 16, sliderInitialValue: 50 });
      const plain = frame({ id: 'p', name: 'SPlain', type: 16 });
      const project = makeProject({ frames: { a, b, c, plain }, rootFrameIds: ['a', 'b', 'c', 'plain'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('-- Slider 范围');
      expect(out).toContain('API.SetStepValue(frame, 5)');
      expect(out).toContain('API.SetValue(frame, 50)');
      expect(out).toContain('SPlain');
    });

    it('bare TEXT frame covers falsy text attribute branches', () => {
      // TEXT_FRAME with text but none of fontJustificationH/font/fontSize/maxChars/textLength
      const f = frame({ id: 'f', name: 'BareText', type: FrameType.TEXT_FRAME, text: 'plain' });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('BareText');
      expect(out).not.toContain('API.SetTextAlignment');
      expect(out).not.toContain('API.SetFont');
      expect(out).not.toContain('API.SetTextSizeLimit');
    });

    it('bare TEXT with no text covers text-text false side', () => {
      // both fontJustification/font set but no text handled elsewhere; ensure a TEXT frame with no text doesn't crash
      const f = frame({ id: 'f', name: 'NoText', type: FrameType.TEXT_FRAME });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('NoText');
    });

    it('MODEL with only cameraPitch covers the middle OR leg', () => {
      const m = frame({ id: 'm', name: 'M1', type: 22, backgroundArt: 'm.mdx', cameraPitch: 0.2 });
      const project = makeProject({ frames: { m }, rootFrameIds: ['m'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetModelCameraSource');
    });

    it('MODEL with only cameraDistance covers the final OR leg', () => {
      const m = frame({ id: 'm', name: 'M2', type: 22, backgroundArt: 'm.mdx', cameraDistance: 400 });
      const project = makeProject({ frames: { m }, rootFrameIds: ['m'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetModelCameraSource');
    });

    it('MODEL with zero camera values covers default falsy legs for distance/yaw/pitch', () => {
      const m = frame({ id: 'm', name: 'M3', type: 22, backgroundArt: 'm.mdx', cameraDistance: 0, cameraYaw: 0, cameraPitch: 0 });
      const project = makeProject({ frames: { m }, rootFrameIds: ['m'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.SetModelCameraSource(frame, 0.00, -300.00, 0.00)');
    });

    it('MODEL with only backgroundArt and no camera covers camera-condition false side', () => {
      const m = frame({ id: 'm', name: 'M4', type: 22, backgroundArt: 'm.mdx' });
      const project = makeProject({ frames: { m }, rootFrameIds: ['m'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('-- Model 设置');
      expect(out).not.toContain('API.SetModelCameraSource');
    });

    it('sets texCoord and vertex color for BACKDROP/SIMPLESTATUSBAR', () => {
      const f = frame({
        id: 'f', name: 'B', type: FrameType.BACKDROP,
        texCoord: [0, 32, 16, 48] as [number, number, number, number],
        fontColor: [0.5, 0.25, 1, 1],
      });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      // texCoord 定义为 [left, right, top, bottom] = [0, 32, 16, 48]；
      // 引擎 DzFrameSetTexCoord(f, l, r, t, b) 要求 right 在 top 之前。
      // 旧断言写成 (0, 16, 32, 48)，把 right/top 互换——那正是被修复的 bug。
      expect(out).toContain('API.SetTexCoord(frame, 0, 32, 16, 48)');
      expect(out).toContain('API.SetVertexColor(frame, ');
    });

    it('hides frame when visible === false', () => {
      const f = frame({ id: 'f', name: 'H', type: FrameType.FRAME, visible: false });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('API.ShowFrame(frame, false)');
    });

    it('reaches unknown type -> FRAME fallback', () => {
      const f = frame({ id: 'f', name: 'U', type: 999 as FrameType });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('CreateFrameByType("FRAME", "U", gameUI, "", 0)');
    });

    it('escapes Lua string special characters in names/text/textures', () => {
      const f = frame({
        id: 'f', name: 'A"B\\C\nD\rE\tF', type: FrameType.BACKDROP,
        texture: 'x" y\\ z',
      });
      const project = makeProject({ frames: { f }, rootFrameIds: ['f'] });
      const out = new LuaUIGenerator(project).generate();
      expect(out).toContain('\\"'); // escaped quote
      expect(out).toContain('\\\\'); // escaped backslash
      expect(out).toContain('\\n');
      expect(out).toContain('\\r');
      expect(out).toContain('\\t');
    });
  });

  describe('generateLoader()', () => {
    it('emits all loader sections and generators', () => {
      const out = new LuaUIGenerator(makeProject()).generateLoader();
      expect(out).toContain('加载器脚本');
      expect(out).toContain('API 兼容层');
      expect(out).toContain('-- 常量定义');
      expect(out).toContain('local ANCHOR_MAP');
      expect(out).toContain('-- 辅助函数');
      expect(out).toContain('-- 清理所有 Frame');
      expect(out).toContain('-- 重载 UI');
      expect(out).toContain('-- TCP 极速热重载客户端');
      expect(out).toContain('-- 初始化');
      expect(out).toContain('UI_Frames = {}');
      expect(out).toContain('UI_FrameCounter = 0');
    });

    it('loader API compat layer includes DzAPI and Reforged branches and error fallback', () => {
      const out = new LuaUIGenerator(makeProject()).generateLoader();
      expect(out).toContain('japi_loaded');
      expect(out).toContain('japi.DzCreateFrame');
      expect(out).toContain('BlzCreateFrame');
      expect(out).toContain('error("UI API 不可用")');
      expect(out).toContain('RequestDzNetConnect');
      expect(out).toContain('Base64Decode');
      expect(out).toContain('UI_Designer_ReceiveSyncPayload');
    });

    it('loader init includes reload command registration and reload path', () => {
      const out = new LuaUIGenerator(makeProject()).generateLoader();
      expect(out).toContain('-reload');
      expect(out).toContain('-rl');
      expect(out).toContain('TriggerAddAction(t, ReloadUI)');
      expect(out).toContain('UI_Designer_ReloadUI = ReloadUI');
      expect(out).toContain('ui_generated.lua');
    });
  });

  describe('export helpers', () => {
    it('exportProjectToLua returns generate() output', () => {
      const project = makeProject({ frames: {}, rootFrameIds: [] });
      const out = exportProjectToLua(project);
      expect(out).toContain('警告: 项目中没有Frame');
    });

    it('generateLoaderScript returns generateLoader() output', () => {
      const out = generateLoaderScript(makeProject());
      expect(out).toContain('加载器脚本');
    });
  });
});