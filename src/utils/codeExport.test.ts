import { describe, it, expect } from 'vitest';
import {
  exportProject,
  generateJASSCode,
  generateLUACode,
  generateTypeScriptCode,
} from './codeExport';
import {
  FrameType,
  FramePoint,
  type ProjectData,
  type FrameData,
} from '../types';

function makeProject(overrides: Partial<ProjectData> = {}): ProjectData {
  return {
    version: 2,
    libraryName: 'TestLib',
    originMode: 'gameui',
    exportVersion: 'reforged',
    hideGameUI: false,
    hideHeroBar: false,
    hideMiniMap: false,
    hideResources: false,
    hideButtonBar: false,
    hidePortrait: false,
    hideChat: false,
    frames: {},
    rootFrameIds: [],
    tableArrays: [],
    circleArrays: [],
    ...overrides,
  };
}

function makeFrame(overrides: Partial<FrameData> & { id: string; name: string; type: FrameType }): FrameData {
  return {
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    z: 0,
    parentId: null,
    children: [],
    anchors: [],
    ...overrides,
  };
}

// A single frame fixture that exercises many branches at once.
function richProject(): ProjectData {
  const frames: Record<string, FrameData> = {
    backdrop: makeFrame({ id: 'backdrop', name: 'bg', type: FrameType.BACKDROP, texture: 'tex.blp', anchors: [{ point: FramePoint.TOPLEFT, x: 1, y: 2 }] }),
    backdropNoTex: makeFrame({ id: 'backdropNoTex', name: 'bgnt', type: FrameType.BACKDROP, anchors: [] }),
    button: makeFrame({ id: 'button', name: 'btn', type: FrameType.BUTTON, anchors: [{ point: FramePoint.CENTER, x: 3, y: 4 }] }),
    text: makeFrame({ id: 'text', name: 'txt', type: FrameType.TEXT_FRAME, text: 'Hello', textColor: '#FF0000', textScale: 2, anchors: [{ point: FramePoint.TOP, x: 5, y: 6 }] }),
    textPlain: makeFrame({ id: 'textPlain', name: 'txtp', type: FrameType.TEXT_FRAME, anchors: [] }),
    editbox: makeFrame({ id: 'editbox', name: 'edt', type: FrameType.EDITBOX, anchors: [] }),
    slider: makeFrame({ id: 'slider', name: 'sld', type: FrameType.SLIDER, minValue: 0, maxValue: 50, stepSize: 5, anchors: [] }),
    sliderPlain: makeFrame({ id: 'sliderPlain', name: 'sldp', type: FrameType.SLIDER, anchors: [] }),
    checkbox: makeFrame({ id: 'checkbox', name: 'chk', type: FrameType.CHECKBOX, checked: true, anchors: [] }),
    checkboxOff: makeFrame({ id: 'checkboxOff', name: 'chko', type: FrameType.CHECKBOX, checked: false, anchors: [] }),
    simpleframe: makeFrame({ id: 'simpleframe', name: 'sf', type: FrameType.SIMPLEFRAME, anchors: [] }),
    fontstring: makeFrame({ id: 'fontstring', name: 'fs', type: FrameType.SIMPLEFONTSTRING, text: 'lbl', anchors: [] }),
    fontstringNoText: makeFrame({ id: 'fontstringNoText', name: 'fsnt', type: FrameType.SIMPLEFONTSTRING, anchors: [] }),
    simplebutton: makeFrame({ id: 'simplebutton', name: 'sb', type: FrameType.SIMPLEBUTTON, anchors: [] }),
    gluetextbutton: makeFrame({ id: 'gluetextbutton', name: 'gtb', type: FrameType.GLUETEXTBUTTON, anchors: [] }),
    gluebutton: makeFrame({ id: 'gluebutton', name: 'gbu', type: FrameType.GLUEBUTTON, anchors: [] }),
    scrollbar: makeFrame({ id: 'scrollbar', name: 'scb', type: FrameType.SCROLLBAR, minValue: 0, maxValue: 10, stepSize: 2, anchors: [{ point: FramePoint.RIGHT, x: 0, y: 0, relativeTo: 'btn', relativePoint: FramePoint.LEFT }] }),
    listbox: makeFrame({ id: 'listbox', name: 'lb', type: FrameType.LISTBOX, anchors: [] }),
    menu: makeFrame({ id: 'menu', name: 'mn', type: FrameType.MENU, anchors: [] }),
    popupmenu: makeFrame({ id: 'popupmenu', name: 'pop', type: FrameType.POPUPMENU, anchors: [] }),
    sprite: makeFrame({ id: 'sprite', name: 'spr', type: FrameType.SPRITE, texture: 'spr.blp', anchors: [] }),
    spriteNoTex: makeFrame({ id: 'spriteNoTex', name: 'sprnt', type: FrameType.SPRITE, anchors: [] }),
    highlight: makeFrame({ id: 'highlight', name: 'hl', type: FrameType.HIGHLIGHT, texture: 'hl.blp', anchors: [] }),
    highlightNoTex: makeFrame({ id: 'highlightNoTex', name: 'hlnt', type: FrameType.HIGHLIGHT, anchors: [] }),
    statusbar: makeFrame({ id: 'statusbar', name: 'stb', type: FrameType.STATUSBAR, texture: 'stb.blp', minValue: 0, maxValue: 200, anchors: [] }),
    simplestatusbar: makeFrame({ id: 'simplestatusbar', name: 'ssb', type: FrameType.SIMPLESTATUSBAR, anchors: [] }),
    arrays: makeFrame({ id: 'arrays', name: 'arr[00]', type: FrameType.FRAME, anchors: [] }),
    parented: makeFrame({ id: 'parented', name: 'child', type: FrameType.BROWSER_BUTTON, parentId: 'button', anchors: [] }),
  };
  return makeProject({ frames, rootFrameIds: Object.keys(frames) });
}

describe('codeExport', () => {
  describe('generateJASSCode', () => {
    it('produces a JASS library with header, declarations and frame creation', () => {
      const code = generateJASSCode(richProject());
      expect(code).toContain('library TestLib initializer Init');
      expect(code).toContain('framehandle array arr');
      expect(code).toContain('BlzCreateFrame("BACKDROP"');
      expect(code).toContain('BlzFrameSetAbsPoint(bg, FRAMEPOINT_TOPLEFT, 1.00000, 2.00000)');
      expect(code).toContain('BlzCreateFrame("SliderTemplate"');
      expect(code).toContain('BlzFrameSetMinMaxValue(sld, 0.00, 50.00)');
    });

    it('emits hideGameUI helper calls when enabled', () => {
      const project = richProject();
      project.hideGameUI = true;
      const code = generateJASSCode(project);
      expect(code).toContain('BlzEnableUIAutoPosition(false)');
      expect(code).toContain('BlzHideOriginFrames(true)');
    });

    it('uses Dz API prefix for 1.27 exportVersion', () => {
      const project = richProject();
      project.exportVersion = '1.27';
      const code = generateJASSCode(project);
      expect(code).toContain('DzCreateFrame');
      expect(code).toContain('DzFrameSetSize');
    });

    it('excludes non-[00] array element frames from declarations but creates them', () => {
 // name includes '[' but not '[00]' -> skipped in declaration
      const project = makeProject({
        frames: {
          el: makeFrame({ id: 'el', name: 'arr[1]', type: FrameType.TEXT_FRAME, anchors: [], text: 'x' }),
        },
        rootFrameIds: ['el'],
      });
      const code = generateJASSCode(project);
 // should NOT declare arr[1] variable
      expect(code).not.toContain('framehandle array arr[1]');
      const lua = generateLUACode(project);
      expect(lua).not.toContain('arr[1] = nil');
      expect(lua).not.toContain('arr[1] = {}');
      const ts = generateTypeScriptCode(project);
      expect(ts).not.toContain('private arr[1]');
    });
  });

  describe('generateLUACode', () => {
    it('produces Lua code with declarations and CreateFrames', () => {
      const code = generateLUACode(richProject());
      expect(code).toContain('TestLib = {}');
      expect(code).toContain('-- Frame declarations');
      expect(code).toContain('arr = {}');
      expect(code).toContain('function CreateFrames()');
      expect(code).toContain('CreateFrames()');
      expect(code).toContain('BlzCreateFrameByType("TEXT"');
    });

    it('emits hideGameUI helpers when enabled', () => {
      const project = richProject();
      project.hideGameUI = true;
      const code = generateLUACode(project);
      expect(code).toContain('BlzEnableUIAutoPosition(false)');
      expect(code).toContain('BlzHideOriginFrames(true)');
    });

    it('defaults backdrop texture when none provided', () => {
      const project = makeProject({
        frames: {
          b: makeFrame({ id: 'b', name: 'b', type: FrameType.BACKDROP, anchors: [] }),
        },
        rootFrameIds: ['b'],
      });
      const code = generateLUACode(project);
      expect(code).toContain('UI\\\\Widgets\\\\EscMenu\\\\Human\\\\background.blp');
    });

    it('uses Dz prefix for 1.27', () => {
      const project = makeProject({
        exportVersion: '1.27',
        frames: {
          b: makeFrame({ id: 'b', name: 'b', type: FrameType.BUTTON, anchors: [] }),
        },
        rootFrameIds: ['b'],
      });
      const code = generateLUACode(project);
      expect(code).toContain('DzCreateFrame');
      expect(code).toContain('DzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0)');
    });
  });

  describe('generateTypeScriptCode', () => {
    it('produces a TS class with declared members and createFrames', () => {
      const code = generateTypeScriptCode(richProject());
      expect(code).toContain('export class TestLib {');
      expect(code).toContain('private arr: framehandle[] = [];');
      expect(code).toContain('private bg: framehandle | null = null;');
      expect(code).toContain('this.createFrames();');
      expect(code).toContain('const ui = new TestLib();');
      expect(code).toContain('BlzFrameSetText(this.txt, "|cffFF0000Hello|r")');
    });

    it('renders Reforged vs 1.27 in the header', () => {
      const ref = generateTypeScriptCode(richProject());
      expect(ref).toContain('Version: Reforged');
      const old = generateTypeScriptCode({ ...richProject(), exportVersion: '1.27' });
      expect(old).toContain('Version: 1.27');
    });
  });

  describe('exportProject', () => {
    it('routes jass/lua/ts and throws for unknown language', () => {
      expect(exportProject(richProject(), 'jass')).toContain('library TestLib');
      expect(exportProject(richProject(), 'lua')).toContain('function CreateFrames()');
      expect(exportProject(richProject(), 'ts')).toContain('export class TestLib');
      expect(() => exportProject(richProject(), 'whoknows' as never)).toThrowError('Unsupported language: whoknows');
    });
  });

  describe('anchor handling branches', () => {
    it('generates relative SetPoint when relativeTo and relativePoint set', () => {
      const project = makeProject({
        frames: {
          p: makeFrame({ id: 'p', name: 'parent', type: FrameType.FRAME, anchors: [] }),
          c: makeFrame({
            id: 'c', name: 'child', type: FrameType.POPUPMENU,
            anchors: [{ point: FramePoint.LEFT, x: 1.5, y: 2.5, relativeTo: 'parent', relativePoint: FramePoint.RIGHT }],
          }),
        },
        rootFrameIds: ['p', 'c'],
      });
      const jass = generateJASSCode(project);
      expect(jass).toContain('FrameSetPoint(child, FRAMEPOINT_LEFT, parent, FRAMEPOINT_RIGHT, 1.50000, 2.50000)');
      const lua = generateLUACode(project);
      expect(lua).toContain('FrameSetPoint(child, FRAMEPOINT_LEFT, parent, FRAMEPOINT_RIGHT, 1.50000, 2.50000)');
      const ts = generateTypeScriptCode(project);
 // TS 生成的是 class 内部代码，相对引用必须是 this.parent（旧断言写成裸 parent，IDE 会报未定义）
      expect(ts).toContain('FrameSetPoint(this.child, FRAMEPOINT_LEFT, this.parent, FRAMEPOINT_RIGHT, 1.50000, 2.50000)');
    });

    it('treats relativeTo with undefined relativePoint as absolute in all generators', () => {
      const project = makeProject({
        frames: {
          f: makeFrame({
            id: 'f', name: 'ff', type: FrameType.POPUPMENU,
            anchors: [{ point: FramePoint.BOTTOM, x: 5, y: 6, relativeTo: 'parentX' }],
          }),
        },
        rootFrameIds: ['f'],
      });
 // relativePoint undefined -> absolute branch
      const jass = generateJASSCode(project);
      expect(jass).toContain('FrameSetAbsPoint(ff, FRAMEPOINT_BOTTOM');
      const lua = generateLUACode(project);
      expect(lua).toContain('FrameSetAbsPoint(ff, FRAMEPOINT_BOTTOM');
      const ts = generateTypeScriptCode(project);
      expect(ts).toContain('FrameSetAbsPoint(this.ff, FRAMEPOINT_BOTTOM');
    });

    it('treats undefined relativeTo as absolute in all generators', () => {
      const project = makeProject({
        frames: {
          f: makeFrame({
            id: 'f', name: 'aa', type: FrameType.POPUPMENU,
            anchors: [{ point: FramePoint.TOPRIGHT, x: 9, y: 8 }],
          }),
        },
        rootFrameIds: ['f'],
      });
      const jass = generateJASSCode(project);
      expect(jass).toContain('FrameSetAbsPoint(aa, FRAMEPOINT_TOPRIGHT');
      const lua = generateLUACode(project);
      expect(lua).toContain('FrameSetAbsPoint(aa, FRAMEPOINT_TOPRIGHT');
      const ts = generateTypeScriptCode(project);
      expect(ts).toContain('FrameSetAbsPoint(this.aa, FRAMEPOINT_TOPRIGHT');
    });

    it('falls back to default anchors when frame.anchors is missing', () => {
      const project = makeProject({
        frames: {
          m: makeFrame({
            id: 'm', name: 'mf', type: FrameType.SLIDER, x: 3, y: 4, width: 10, height: 20,
          }),
        },
        rootFrameIds: ['m'],
      });
 // Delete anchors to force createDefaultAnchors
      delete project.frames.m.anchors;
      const lua = generateLUACode(project);
 // default anchor generation should produce a SetAbsPoint
      expect(lua).toContain('FrameSetSize');
    });

    it('resolves a parent frame by parentId in LUA and TS', () => {
      const project = makeProject({
        frames: {
          p: makeFrame({ id: 'p', name: 'parentF', type: FrameType.FRAME, anchors: [] }),
          k: makeFrame({ id: 'k', name: 'kid', type: FrameType.SLIDER, parentId: 'p', anchors: [] }),
        },
        rootFrameIds: ['p', 'k'],
      });
      const lua = generateLUACode(project);
      expect(lua).toContain('BlzCreateFrame("SliderTemplate", parentF, 0, 0)');
      const ts = generateTypeScriptCode(project);
      expect(ts).toContain('this.parentF');
    });
  });

  describe('default switch branches and fallbacks', () => {
    const unknownFrame = () => makeFrame({
      id: 'u', name: 'unk', type: 999 as unknown as FrameType, x: 7, y: 8, width: 30, height: 40,
    });

    it('falls back to FRAME creation for unknown frame types in JASS', () => {
      const project = makeProject({ frames: { u: unknownFrame() }, rootFrameIds: ['u'] });
      const code = generateJASSCode(project);
      expect(code).toContain('set unk = BlzCreateFrameByType("FRAME", "unk"');
    });

    it('falls back to FRAME creation for unknown frame types in LUA', () => {
      const project = makeProject({ frames: { u: unknownFrame() }, rootFrameIds: ['u'] });
      const code = generateLUACode(project);
      expect(code).toContain('unk = BlzCreateFrameByType("FRAME", "unk"');
    });

    it('falls back to FRAME creation for unknown frame types in TS', () => {
      const project = makeProject({ frames: { u: unknownFrame() }, rootFrameIds: ['u'] });
      const code = generateTypeScriptCode(project);
      expect(code).toContain('this.unk = BlzCreateFrameByType("FRAME", "unk"');
    });

    it('uses framePointToString fallback for an invalid anchor point', () => {
      const project = makeProject({
        frames: {
          p: makeFrame({
            id: 'p', name: 'pf', type: FrameType.FRAME,
            anchors: [{ point: 999 as unknown as FramePoint, x: 0, y: 0 }],
          }),
        },
        rootFrameIds: ['p'],
      });
      const code = generateJASSCode(project);
      expect(code).toContain('FRAMEPOINT_BOTTOMLEFT');
    });

    it('defaults exportVersion to reforged when undefined', () => {
      const project = makeProject({
        exportVersion: undefined as never,
        frames: { b: makeFrame({ id: 'b', name: 'b', type: FrameType.BUTTON, anchors: [] }) },
        rootFrameIds: ['b'],
      });
      const jass = generateJASSCode(project);
      expect(jass).toContain('BlzCreateFrame');
      const lua = generateLUACode(project);
      expect(lua).toContain('BlzCreateFrame');
      const ts = generateTypeScriptCode(project);
      expect(ts).toContain('Version: Reforged');
    });

    it('exercises default/fallback branches (no anchors, no optionals) across all generators', () => {
      const project = makeProject({
        frames: {
          n_bd: makeFrame({ id: 'n_bd', name: 'nbd', type: FrameType.BACKDROP }),
          n_sl: makeFrame({ id: 'n_sl', name: 'nsl', type: FrameType.SLIDER }),
          n_sb: makeFrame({ id: 'n_sb', name: 'nsb', type: FrameType.SCROLLBAR }),
          n_tx: makeFrame({ id: 'n_tx', name: 'ntx', type: FrameType.TEXT_FRAME, text: 'colored' }),
        },
        rootFrameIds: ['n_bd', 'n_sl', 'n_sb', 'n_tx'],
      });
 // Remove anchors so createDefaultAnchors runs
      for (const id of Object.keys(project.frames)) delete project.frames[id].anchors;

      const jass = generateJASSCode(project);
      expect(jass).toContain('BlzFrameSetMinMaxValue(nsb');
      expect(jass).toContain('BlzFrameSetSize');
      const lua = generateLUACode(project);
      expect(lua).toContain('BlzFrameSetMinMaxValue(nsb');
      const ts = generateTypeScriptCode(project);
 // TS TEXT without textColor -> white fallback
      expect(ts).toContain('FFFFFFcolored');
      expect(ts).toContain('BlzFrameSetMinMaxValue(this.nsb');
    });
  });
});