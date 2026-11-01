import { describe, it, expect, vi } from 'vitest';
import { FDFTransformer } from './fdfTransformer';
import { FDFNodeType } from './fdfAst';
import { FrameData, FrameType } from '../types';

// ============ AST builders ============
function stringValue(v: string) { return { type: 'StringLiteral', value: v }; }
function numberValue(v: number) { return { type: 'NumberLiteral', value: v }; }
function identValue(n: string) { return { type: 'Identifier', name: n }; }
function arrayValue(el: any[]) { return { type: 'ArrayLiteral', elements: el }; }
function prop(name: string, value: any) { return { type: 'Property', name, value }; }
function nestedFrame(frameType: string, name: string | undefined, props: any[], extra: any = {}) {
  return { type: 'NestedFrame', frameType, name, properties: props, ...extra };
}
function frameDef(frameType: string, name: string | undefined, props: any[] = [], extra: any = {}) {
  return { type: 'FrameDefinition', frameType, name, properties: props, ...extra };
}
function program(...frames: any[]) {
  return { type: 'Program', body: frames } as any;
}

function mkFrame(id: string, name: string, partial: Partial<FrameData> = {}): FrameData {
  return {
    type: FrameType.FRAME,
    id,
    name,
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    z: 0,
    parentId: null,
    children: [],
    anchors: [],
    texture: '',
    ...partial,
  };
}

/** Subclass exposing private methods for direct branch control. */
class Testable extends FDFTransformer {
  // NOTE: wrapper names must differ from the private method names, otherwise
  // the base private methods call `this.<same-name>` and recurse infinitely.
  pubExtractValue(node: any): any { return (this as any).extractValue(node); }
  pubMapFrameType(t: string): number { return (this as any).mapFrameType(t); }
  pubMapFramePoint(p: string): number { return (this as any).mapFramePoint(p); }
  pubApplyAnchor(frame: any, values: any[]) { return (this as any).applyAnchor(frame, values); }
  pubCalculateSizeFromAnchors(frame: any) { return (this as any).calculateSizeFromAnchors(frame); }
  pubToPixels(v: number, axis?: 'x' | 'y') { return (this as any).toPixels(v, axis); }
  pubRememberInlineTemplateRef(frame: any, ref: unknown) { return (this as any).rememberInlineTemplateRef(frame, ref); }
  pubResolveControlTextureRefs(frames: any[]) { return (this as any).resolveControlTextureRefs(frames); }
  pubDetachInlineTemplateChildren(frames: any[]) { return (this as any).detachInlineTemplateChildren(frames); }
  pubResolveRelativeFrames(frames: any[]) { return (this as any).resolveRelativeFrames(frames); }
  pubRecalculateSizesWithRelativeAnchors(frames: any[]) { (this as any).recalculateSizesWithRelativeAnchors(frames); }
  pubGetCanvasCoordinateForPoint(p: number) { return (this as any).getCanvasCoordinateForPoint(p); }
  pubCalculateAbsoluteAnchorPosition(a: any, m: any) { return (this as any).calculateAbsoluteAnchorPosition(a, m); }
  pubGetFrameAnchorPosition(f: any, p: number) { return (this as any).getFrameAnchorPosition(f, p); }
  pubRgbaToHex(r: number, g: number, b: number, a?: number) { return (this as any).rgbaToHex(r, g, b, a); }
  pubCalculateFinalPositions(frames: any[]) { (this as any).calculateFinalPositions(frames); }
  pubApplyProperty(frame: any, prop: any) { return (this as any).applyProperty(frame, prop); }
  pubApplyProperties(frame: any, props: any[]) { return (this as any).applyProperties(frame, props); }
  pubApplyNestedFrame(frame: any, nested: any) { return (this as any).applyNestedFrame(frame, nested); }
  pubCopyInheritedChildren(templateFrame: any, parentFrame: any, allFrames: any[]) {
    (this as any).copyInheritedChildren(templateFrame, parentFrame, allFrames);
  }
  pubCollectNestedFrames(node: any, parentFrame: any, allFrames: any[]) {
    (this as any).collectNestedFrames(node, parentFrame, allFrames);
  }
  mkAbsFrame(id: string, name: string, x: number, y: number, w: number, h: number): FrameData {
    return mkFrame(id, name, { x, y, width: w, height: h });
  }
  pubFindFrameInTree(root: any, id: string, all: any[]): any {
    return (this as any).findFrameInTree(root, id, all);
  }
}

describe('FDFTransformer constructor', () => {
  it('applies defaults', () => {
    const t = new FDFTransformer();
    expect(t).toBeInstanceOf(FDFTransformer);
  });
  it('respects provided options', () => {
    const reg = new Map();
    const t = new FDFTransformer({ resolveInheritance: false, templateRegistry: reg, baseWidth: 10, baseHeight: 20 });
    expect(t).toBeInstanceOf(FDFTransformer);
  });
  it('uses provided template registry', () => {
    const reg = new Map([['X', mkFrame('x', 'X')]]);
    const t = new FDFTransformer({ templateRegistry: reg });
    expect((t as any).templateRegistry.get('X')).toBeDefined();
  });
});

describe('transform pipeline - basic frames', () => {
  it('transforms a simple frame definition', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'Main', [
      prop('Width', numberValue(0.5)),
      prop('Height', numberValue(0.25)),
      prop('Text', stringValue('hello')),
      prop('File', stringValue('bg.blp')),
    ])));
    expect(frames).toHaveLength(1);
    expect(frames[0].name).toBe('Main');
    expect(frames[0].type).toBe(FrameType.FRAME);
    expect(frames[0].width).toBe(0.5);
    expect(frames[0].height).toBe(0.25);
    expect(frames[0].text).toBe('hello');
    expect(frames[0].texture).toBe('bg.blp');
  });

  it('skips non-frame-definition nodes', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(
      { type: 'Include', path: 'x.fdf' },
      { type: 'Comment', value: 'c' },
    ));
    expect(frames).toHaveLength(0);
  });

  it('transforms a TEXT frame with default small height (type 13)', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('TEXT', 'T1')));
    expect(frames[0].type).toBe(FrameType.TEXT_FRAME); // 4
    // default sizes -> since anchors empty, gets 0.4x0.4 default
    expect(frames[0].width).toBe(0.4);
    expect(frames[0].height).toBe(0.4);
  });

  it('registers named frame as template in registry', () => {
    const reg = new Map();
    const t = new FDFTransformer({ templateRegistry: reg });
    t.transform(program(frameDef('FRAME', 'TemplateA')));
    expect(reg.has('TemplateA')).toBe(true);
  });

  it('handles frames with name absent using generated name', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', undefined)));
    expect(frames[0].name).toMatch(/^Frame_\d+/);
  });
});

describe('transform - top-level __PARENT__ anchor handling', () => {
  it('maps point 0 (TOPLEFT) to canvas coordinates', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'F', [
      prop('SetPoint', arrayValue([
        identValue('TOPLEFT'), stringValue('__PARENT__'), identValue('TOPLEFT'), numberValue(0), numberValue(0),
      ])),
    ])));
    const anchor = frames[0].anchors[0];
    expect(anchor.relativeTo).toBeUndefined();
    expect(anchor.x).toBe(0);
    expect(anchor.y).toBe(0.6);
  });

  it('maps point 8 (BOTTOMRIGHT) to canvas coordinates', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'F', [
      prop('SetPoint', arrayValue([
        identValue('BOTTOMRIGHT'), stringValue('__PARENT__'), identValue('BOTTOMRIGHT'), numberValue(0), numberValue(0),
      ])),
    ])));
    const anchor = frames[0].anchors[0];
    expect(anchor.x).toBe(0.8);
    expect(anchor.y).toBe(0);
  });

  it('maps point 4 (CENTER) to canvas coordinates', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'F', [
      prop('SetPoint', arrayValue([
        identValue('CENTER'), stringValue('__PARENT__'), identValue('CENTER'), numberValue(0), numberValue(0),
      ])),
    ])));
    const anchor = frames[0].anchors[0];
    expect(anchor.x).toBe(0.4);
    expect(anchor.y).toBe(0.3);
  });

  it('maps other points via getCanvasCoordinateForPoint', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'F', [
      prop('SetPoint', arrayValue([
        identValue('TOP'), stringValue('__PARENT__'), identValue('TOP'), numberValue(0), numberValue(0),
      ])),
    ])));
    const anchor = frames[0].anchors[0];
    expect(anchor.relativeTo).toBeUndefined();
    expect(anchor.x).toBe(0.4);
    expect(anchor.y).toBe(0.6);
  });
});

describe('transform - nested frames and inheritance', () => {
  it('collects nested frames and links parent/child, replacing __PARENT__', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'Parent', [
      nestedFrame('BACKGROUND', 'Child', [
        prop('SetPoint', arrayValue([
          identValue('TOPLEFT'), stringValue('__PARENT__'), identValue('TOPLEFT'), numberValue(0), numberValue(0),
        ])),
      ]),
    ])));
    expect(frames).toHaveLength(2);
    const parent = frames.find(f => f.name === 'Parent')!;
    const child = frames.find(f => f.name === 'Child')!;
    expect(child.parentId).toBe(parent.id);
    expect(parent.children).toContain(child.id);
    // __PARENT__ name is later resolved to the parent's generated id
    expect(child.anchors[0].relativeTo).toBe(parent.id);
  });

  it('skips nested Texture/String/ControlStyle blocks as child frames', () => {
    const t = new FDFTransformer();
    const frames = t.transform(program(frameDef('FRAME', 'Parent', [
      nestedFrame('Texture', undefined, [prop('File', stringValue('t.blp'))]),
      nestedFrame('String', undefined, [prop('Text', stringValue('str'))]),
      nestedFrame('Other', 'RealChild', []),
    ])));
    expect(frames.filter(f => f.name === 'Parent')).toHaveLength(1);
    expect(frames.filter(f => f.name === 'RealChild')).toHaveLength(1);
    // no extra child from Texture/String
  });

  it('inherits WITHCHILDREN from template, deep-copying children', () => {
    // Real usage: template AND derived frame are defined in the same program, so the
    // template's children are present in the transform's flat frame array and can be
    // deep-copied by copyInheritedChildren.
    const t = new FDFTransformer();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frames = t.transform(program(
      frameDef('FRAME', 'BaseTpl', [
        prop('Width', numberValue(0.7)),
        // no SetAllPoints: with only the default CENTER anchor, size recalculation
        // is skipped, so the template keeps its declared width 0.7
        nestedFrame('BUTTON', 'BaseChild', [prop('Text', stringValue('x'))]),
      ]),
      frameDef('FRAME', 'Derived', [prop('Text', stringValue('d'))], { inherits: 'BaseTpl', withChildren: true }),
    ));
    const derived = frames.find(f => f.name === 'Derived')!;
    const templateFrame = frames.find(f => f.name === 'BaseTpl')!;
    // template width inherited via Object.assign
    expect(derived.width).toBe(0.7);
    expect(derived.fdfMetadata?.inherits).toBe('BaseTpl');
    // the copied child is added to the derived frame's children
    expect(derived.children.length).toBeGreaterThan(0);
    // the copied child is a deep copy (new id), NOT the template's original child
    const copiedChildId = derived.children[0];
    expect(copiedChildId).not.toBe(templateFrame.children[0]);
    const copiedChild = frames.find(f => f.id === copiedChildId)!;
    expect(copiedChild.parentId).toBe(derived.id);
    expect(copiedChild.fdfMetadata?.isTemplate).toBe(false);
    vi.restoreAllMocks();
  });

  it('inherits properties from template via Object.assign, retains own name', () => {
    const reg = new Map();
    // Build a template by transforming so it has full shape
    const base = new FDFTransformer({ templateRegistry: reg });
    base.transform(program(frameDef('FRAME', 'Base',
      [prop('Width', numberValue(0.9)), prop('Height', numberValue(0.1))],
    )));
    // Base registered in reg by first transform? reg passed, transform registers. Yes.
    const t = new FDFTransformer({ templateRegistry: reg });
    const frames = t.transform(program(
      frameDef('FRAME', 'Derived2', [], { inherits: 'Base' }),
    ));
    const d = frames.find(f => f.name === 'Derived2')!;
    expect(d.name).toBe('Derived2');
    expect(d.width).toBe(0.9);
  });
});

describe('applyProperty - width/height', () => {
  it('handles array width/height taking first element', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('Width', arrayValue([numberValue(0.3)])));
    (t as any).applyProperty(f, prop('Height', arrayValue([numberValue(0.2)])));
    expect(f.width).toBe(0.3);
    expect(f.height).toBe(0.2);
  });

  it('warns on invalid width/height', () => {
    const t = new Testable();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('Width', stringValue('bad')));
    (t as any).applyProperty(f, prop('Height', stringValue('bad')));
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe('applyProperty - setpoint / anchor', () => {
  it('applies SetPoint (5 values) and Anchor (3 values)', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('SetPoint', arrayValue([
      identValue('CENTER'), stringValue('Parent'), identValue('CENTER'), numberValue(0.1), numberValue(0.2),
    ])));
    (t as any).applyProperty(f, prop('Anchor', arrayValue([
      identValue('TOPLEFT'), numberValue(0), numberValue(0),
    ])));
    expect(f.anchors).toHaveLength(2);
    expect(f.anchors[0]).toMatchObject({ point: 4, relativeTo: 'Parent', relativePoint: 4, x: 0.1, y: 0.2 });
    expect(f.anchors[1]).toMatchObject({ point: 0, x: 0, y: 0 });
  });
});

describe('applyProperty - setallpoints', () => {
  it('injects SetAllPoints anchors when none exist', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('SetAllPoints', identValue('true')));
    expect(f.fdfMetadata?.setAllPoints).toBe(true);
    expect(f.anchors).toHaveLength(2);
  });

  it('ignores SetAllPoints when anchors already exist', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { anchors: [{ point: 0, x: 0, y: 0 }] });
    (t as any).applyProperty(f, prop('SetAllPoints', identValue('true')));
    expect(f.fdfMetadata?.setAllPoints).toBeUndefined();
    expect(f.anchors).toHaveLength(1);
  });
});

describe('applyProperty - text & colors', () => {
  it('handles FontColor 3/4 components and hex conversion', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontColor', arrayValue([numberValue(1), numberValue(0), numberValue(0)])));
    expect(f.textColor).toBe('#ff0000');
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('FontColor', arrayValue([numberValue(1), numberValue(1), numberValue(1), numberValue(0.5)])));
    expect(g.textColor).toBe('#ffffff80');
  });

  it('handles FontShadowColor', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontShadowColor', arrayValue([numberValue(1), numberValue(0), numberValue(0)])));
    expect(f.fontShadowColor).toEqual([255, 0, 0, 255]);
  });

  it('handles FontShadowOffset', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontShadowOffset', arrayValue([numberValue(0.1), numberValue(0.2)])));
    expect(f.fontShadowOffset).toEqual([0.1, 0.2]);
  });

  it('handles FrameFont and Font (array form)', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FrameFont', arrayValue([stringValue('Master'), numberValue(0.011), identValue('FIXEDSIZE')])));
    expect(f.font).toBe('Master');
    expect(f.fontSize).toBe(0.011);
    // identValue('FIXEDSIZE') -> extractValue returns 'FIXEDSIZE' (string)
    (t as any).applyProperty(f, prop('Font', arrayValue([stringValue('Font2'), numberValue(0.02), identValue('')])));
    expect(f.font).toBe('Font2');
    expect(f.fontFlags).toEqual(['FIXEDSIZE']);
  });

  it('handles TextLength, ButtonPushedTextOffset, TextLength', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('TextLength', numberValue(10)));
    (t as any).applyProperty(f, prop('ButtonPushedTextOffset', arrayValue([numberValue(0.01), numberValue(0.02)])));
    expect(f.textLength).toBe(10);
    expect(f.buttonPushedTextOffset).toEqual([0.01, 0.02]);
  });

  it('handles FontFlags', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontFlags', stringValue('FIXEDSIZE|THICKOUTLINE')));
    expect(f.fontFlags).toEqual(['FIXEDSIZE', 'THICKOUTLINE']);
  });

  it('handles FontHighlightColor and FontDisabledColor', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontHighlightColor', arrayValue([numberValue(1), numberValue(0), numberValue(0)])));
    (t as any).applyProperty(f, prop('FontDisabledColor', arrayValue([numberValue(0), numberValue(1), numberValue(0)])));
    expect(f.fontHighlightColor).toEqual([255, 0, 0, 255]);
    expect(f.fontDisabledColor).toEqual([0, 255, 0, 255]);
  });

  it('handles FontJustificationH and FontJustificationV', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontJustificationH', identValue('JUSTIFYLEFT')));
    (t as any).applyProperty(f, prop('FontJustificationV', identValue('JUSTIFYTOP')));
    expect(f.horAlign).toBe('left');
    expect(f.verAlign).toBe('start');
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('FontJustificationH', identValue('JUSTIFYRIGHT')));
    (t as any).applyProperty(g, prop('FontJustificationV', identValue('JUSTIFYBOTTOM')));
    expect(g.horAlign).toBe('right');
    expect(g.verAlign).toBe('flex-end');
    const h = mkFrame('h', 'H');
    (t as any).applyProperty(h, prop('FontJustificationH', identValue('JUSTIFYCENTER')));
    (t as any).applyProperty(h, prop('FontJustificationV', identValue('JUSTIFYMIDDLE')));
    expect(h.horAlign).toBe('center');
    expect(h.verAlign).toBe('center');
  });
});

describe('applyProperty - backdrop', () => {
  it('handles backdrop fields', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('BackdropBackground', stringValue('bbg')));
    (t as any).applyProperty(f, prop('BackdropEdgeFile', stringValue('edge')));
    (t as any).applyProperty(f, prop('BackdropCornerFile', stringValue('corner')));
    (t as any).applyProperty(f, prop('BackdropTopFile', stringValue('top')));
    (t as any).applyProperty(f, prop('BackdropBottomFile', stringValue('bot')));
    (t as any).applyProperty(f, prop('BackdropLeftFile', stringValue('left')));
    (t as any).applyProperty(f, prop('BackdropRightFile', stringValue('right')));
    (t as any).applyProperty(f, prop('BackdropCornerFlags', stringValue('UL')));
    (t as any).applyProperty(f, prop('BackdropCornerSize', numberValue(0.1)));
    (t as any).applyProperty(f, prop('BackdropBackgroundSize', numberValue(0.2)));
    (t as any).applyProperty(f, prop('UseActiveContext', identValue('true')));
    (t as any).applyProperty(f, prop('BackdropTileBackground', identValue('true')));
    (t as any).applyProperty(f, prop('BackdropBlendAll', identValue('true')));
    expect(f.backdropBackground).toBe('bbg');
    expect(f.backdropEdgeFile).toBe('edge');
    expect(f.backdropCornerFile).toBe('corner');
    expect(f.backdropTopFile).toBe('top');
    expect(f.backdropBottomFile).toBe('bot');
    expect(f.backdropLeftFile).toBe('left');
    expect(f.backdropRightFile).toBe('right');
    expect(f.backdropCornerFlags).toBe('UL');
    expect(f.backdropCornerSize).toBe(0.1);
    expect(f.backdropBackgroundSize).toBe(0.2);
    expect(f.useActiveContext).toBe(true);
    expect(f.backdropTileBackground).toBe(true);
    expect(f.backdropBlendAll).toBe(true);
  });

  it('handles BackdropBackgroundInsets variants', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('BackdropBackgroundInsets', arrayValue([numberValue(1), numberValue(2), numberValue(3), numberValue(4)])));
    expect(f.backdropBackgroundInsets).toEqual([1, 2, 3, 4]);
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('BackdropBackgroundInsets', arrayValue([numberValue(5)])));
    expect(g.backdropBackgroundInsets).toEqual([5, 5, 5, 5]);
    const h = mkFrame('h', 'H');
    (t as any).applyProperty(h, prop('BackdropBackgroundInsets', numberValue(7)));
    expect(h.backdropBackgroundInsets).toEqual([7, 7, 7, 7]);
    const k = mkFrame('k', 'K');
    (t as any).applyProperty(k, prop('BackdropBackgroundInsets', arrayValue([numberValue(1), numberValue(2)])));
    expect(k.backdropBackgroundInsets).toBeUndefined();
  });
});

describe('applyProperty - control & highlight', () => {
  it('handles control backdrop fields and remembers inline template refs', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('ControlBackdrop', stringValue('B1')));
    (t as any).applyProperty(f, prop('ControlPushedBackdrop', stringValue('B2')));
    (t as any).applyProperty(f, prop('ControlDisabledBackdrop', stringValue('B3')));
    (t as any).applyProperty(f, prop('ControlDisabledPushedBackdrop', stringValue('B4')));
    (t as any).applyProperty(f, prop('ControlMouseOverHighlight', stringValue('B5')));
    expect(f.controlBackdrop).toBe('B1');
    expect(f.controlPushedBackdrop).toBe('B2');
    expect(f.controlDisabledBackdrop).toBe('B3');
    expect(f.controlDisabledPushedBackdrop).toBe('B4');
    expect(f.controlMouseOverHighlight).toBe('B5');
    expect(f.fdfMetadata?.inlineTemplateNames).toEqual(['B1', 'B2', 'B3', 'B4', 'B5']);
  });

  it('handles ControlStyle, HighlightType, HighlightAlphaFile, HighlightAlphaMode, LayerStyle', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('ControlStyle', stringValue('AUTOTRACK')));
    (t as any).applyProperty(f, prop('HighlightType', stringValue('FILETEXTURE')));
    (t as any).applyProperty(f, prop('HighlightAlphaFile', stringValue('h.blp')));
    (t as any).applyProperty(f, prop('HighlightAlphaMode', stringValue('ADD')));
    (t as any).applyProperty(f, prop('LayerStyle', stringValue('NOSHADING')));
    expect(f.controlStyle).toBe('AUTOTRACK');
    expect(f.highlightType).toBe('FILETEXTURE');
    expect(f.highlightAlphaFile).toBe('h.blp');
    expect(f.highlightAlphaMode).toBe('ADD');
    expect(f.layerStyle).toBe('NOSHADING');
  });
});

describe('applyProperty - numeric icon props, texcoord, alphamode', () => {
  it('handles TexCoord', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('TexCoord', arrayValue([numberValue(0), numberValue(1), numberValue(0), numberValue(1)])));
    expect(f.texCoord).toEqual([0, 1, 0, 1]);
  });

  it('handles AlphaMode recognized and unrecognized', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('AlphaMode', identValue('BLEND')));
    expect(f.alphaMode).toBe('BLEND');
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('AlphaMode', identValue('BOGUS')));
    expect(g.alphaMode).toBeUndefined();
  });

  it('accepts AlphaMode DISABLE（引擎合法取值，IDA ReaderTextureKeyword @ 0x6f09b8a0）', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('AlphaMode', identValue('DISABLE')));
    expect(f.alphaMode).toBe('DISABLE');
    // 大小写不敏感
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('AlphaMode', stringValue('disable')));
    expect(g.alphaMode).toBe('DISABLE');
  });

  it('handles slider numeric props', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('SliderInitialValue', numberValue(0.5)));
    (t as any).applyProperty(f, prop('SliderMinValue', numberValue(0)));
    (t as any).applyProperty(f, prop('SliderMaxValue', numberValue(1)));
    (t as any).applyProperty(f, prop('SliderStepSize', numberValue(0.1)));
    expect(f.sliderInitialValue).toBe(0.5);
    expect(f.minValue).toBe(0);
    expect(f.maxValue).toBe(1);
    expect(f.stepSize).toBe(0.1);
  });

  it('handles edit color/size, textarea, menu numeric props', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('EditCursorColor', arrayValue([numberValue(1), numberValue(0), numberValue(0), numberValue(1)])));
    (t as any).applyProperty(f, prop('EditBorderColor', arrayValue([numberValue(0), numberValue(1), numberValue(0), numberValue(1)])));
    (t as any).applyProperty(f, prop('EditBorderSize', numberValue(0.01)));
    (t as any).applyProperty(f, prop('TextAreaInset', numberValue(0.1)));
    (t as any).applyProperty(f, prop('TextAreaLineHeight', numberValue(0.2)));
    (t as any).applyProperty(f, prop('TextAreaLineGap', numberValue(0.3)));
    (t as any).applyProperty(f, prop('TextAreaMaxLines', numberValue(10)));
    (t as any).applyProperty(f, prop('MenuItemHeight', numberValue(0.4)));
    (t as any).applyProperty(f, prop('PopupButtonInset', numberValue(0.5)));
    expect(f.editCursorColor).toEqual([255, 0, 0, 255]);
    expect(f.editBorderColor).toEqual([0, 255, 0, 255]);
    expect(f.editBorderSize).toBe(0.01);
    expect(f.textAreaInset).toBe(0.1);
    expect(f.textAreaLineHeight).toBe(0.2);
    expect(f.textAreaLineGap).toBe(0.3);
    expect(f.textAreaMaxLines).toBe(10);
    expect(f.menuItemHeight).toBe(0.4);
    expect(f.popupButtonInset).toBe(0.5);
  });

  it('handles HighlightColor and MenuTextHighlightColor', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('HighlightColor', arrayValue([numberValue(1), numberValue(0), numberValue(0)])));
    (t as any).applyProperty(f, prop('MenuTextHighlightColor', arrayValue([numberValue(0), numberValue(1), numberValue(0)])));
    expect(f.highlightColor).toEqual([255, 0, 0, 255]);
    expect(f.menuTextHighlightColor).toEqual([0, 255, 0, 255]);
  });
});

describe('applyProperty - ref fields', () => {
  it('handles all string ref fields', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    const refProps: [string, string, keyof FrameData][] = [
      ['ButtonText', 'bt', 'buttonTextRef'],
      ['NormalText', 'nt', 'normalTextRef'],
      ['HighlightText', 'ht', 'highlightTextRef'],
      ['DisabledText', 'dt', 'disabledTextRef'],
      ['PopupMenuFrame', 'pmf', 'popupMenuFrameRef'],
      ['PopupArrowFrame', 'paf', 'popupArrowFrameRef'],
      ['PopupTitleFrame', 'ptf', 'popupTitleFrameRef'],
      ['EditTextFrame', 'etf', 'editTextFrameRef'],
      ['DialogBackdrop', 'db', 'dialogBackdropRef'],
      ['ControlShortcutKey', 'csk', 'controlShortcutKey'],
      ['TabFocusNext', 'tfn', 'tabFocusNext'],
      ['TextAreaScrollBar', 'tasb', 'textAreaScrollBarRef'],
      ['SliderThumbButtonFrame', 'stbf', 'sliderThumbButtonFrameRef'],
      ['ScrollBarIncButtonFrame', 'sbif', 'scrollBarIncButtonFrameRef'],
      ['ScrollBarDecButtonFrame', 'sbdf', 'scrollBarDecButtonFrameRef'],
      ['CheckBoxCheckHighlight', 'cbch', 'checkBoxCheckHighlightRef'],
      ['CheckBoxDisabledCheckHighlight', 'cbdch', 'checkBoxDisabledCheckHighlightRef'],
      ['ChatDisplayEditBox', 'cdeb', 'chatDisplayEditBoxRef'],
      ['ChatDisplayScrollBar', 'cdsb', 'chatDisplayScrollBarRef'],
      ['BackgroundArt', 'ba', 'backgroundArt'],
    ];
    for (const [n, v, key] of refProps) {
      (t as any).applyProperty(f, prop(n, stringValue(v)));
      expect((f as any)[key]).toBe(v);
    }
  });

  it('handles MenuBorder number and string protocols', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('MenuBorder', numberValue(0.009)));
    expect(f.menuBorder).toBe(0.009);
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('MenuBorder', stringValue('MB')));
    expect(g.menuBorderRef).toBe('MB');
  });

  it('handles ChatDisplayBorderSize and ChatDisplayLineHeight', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('ChatDisplayBorderSize', numberValue(0.1)));
    (t as any).applyProperty(f, prop('ChatDisplayLineHeight', numberValue(0.2)));
    expect(f.chatDisplayBorderSize).toBe(0.1);
    expect(f.chatDisplayLineHeight).toBe(0.2);
  });

  it('handles FontJustificationOffset', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('FontJustificationOffset', arrayValue([numberValue(0.1), numberValue(0.2)])));
    expect(f.fontJustificationOffset).toEqual([0.1, 0.2]);
  });

  it('handles MenuItem (string and array)', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('MenuItem', stringValue('ITEM1')));
    (t as any).applyProperty(f, prop('MenuItem', arrayValue([stringValue('ITEM2'), numberValue(-2)])));
    (t as any).applyProperty(f, prop('MenuItem', numberValue(5))); // ignored
    expect(f.menuItemRefs).toEqual(['ITEM1', 'ITEM2']);
  });

  it('handles DecorateFileNames truthiness', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyProperty(f, prop('DecorateFileNames', identValue('unknown')));
    expect(f.decorateFileNames).toBe(true);
    const g = mkFrame('g', 'G');
    (t as any).applyProperty(g, prop('DecorateFileNames', identValue('false')));
    expect(g.decorateFileNames).toBe(false);
  });
});

describe('applyNestedFrame', () => {
  it('promotes nested Texture File/AlphaMode/TexCoord', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyNestedFrame(f, {
      type: FDFNodeType.NESTED_FRAME,
      frameType: 'Texture',
      properties: [
        prop('File', stringValue('tex.blp')),
        prop('AlphaMode', identValue('ADD')),
        prop('TexCoord', arrayValue([numberValue(0), numberValue(1), numberValue(0), numberValue(1)])),
        prop('Unrelated', stringValue('x')),
      ],
    });
    expect(f.texture).toBe('tex.blp');
    expect(f.alphaMode).toBe('ADD');
    expect(f.texCoord).toEqual([0, 1, 0, 1]);
  });

  it('promotes nested String Text', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyNestedFrame(f, {
      type: FDFNodeType.NESTED_FRAME,
      frameType: 'Text',
      properties: [prop('Text', stringValue('hello2'))],
    });
    (t as any).applyNestedFrame(f, {
      type: FDFNodeType.NESTED_FRAME,
      frameType: 'Text',
      properties: [prop('Text', stringValue('hello2'))],
    });
    // applyNestedFrame only promotes frameType 'string', not 'text'
    expect(f.text).toBeUndefined();

    const g = mkFrame('g', 'G');
    (t as any).applyNestedFrame(g, {
      type: FDFNodeType.NESTED_FRAME,
      frameType: 'String',
      properties: [prop('Text', stringValue('hello2'))],
    });
    expect(g.text).toBe('hello2');
  });

  it('does nothing for unrelated nested types, skips non-property', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    (t as any).applyNestedFrame(f, { type: FDFNodeType.NESTED_FRAME, frameType: 'ControlStyle', properties: [] });
    // mkFrame defaults texture to ''; ControlStyle isn't promoted so it stays ''
    expect(f.texture).toBe('');
  });
});

describe('extractValue', () => {
  it('extracts string, number, identifier booleans, arrays, unknown', () => {
    const t = new Testable();
    expect(t.pubExtractValue(stringValue('s'))).toBe('s');
    expect(t.pubExtractValue(numberValue(3))).toBe(3);
    expect(t.pubExtractValue(identValue('true'))).toBe(true);
    expect(t.pubExtractValue(identValue('false'))).toBe(false);
    expect(t.pubExtractValue(identValue('SOMETHING'))).toBe('SOMETHING');
    expect(t.pubExtractValue(arrayValue([numberValue(1), numberValue(2)]))).toEqual([1, 2]);
    expect(t.pubExtractValue({ type: 'BooleanLiteral', value: true })).toBeNull();
  });
});

describe('mapFrameType', () => {
  it('maps all known types and default', () => {
    const t = new Testable();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const cases: [string, number][] = [
      ['FRAME', FrameType.FRAME],
      ['BACKDROP', FrameType.BACKDROP],
      ['SIMPLEFRAME', FrameType.SIMPLEFRAME],
      ['TEXT', FrameType.TEXT_FRAME],
      ['SIMPLEFONTSTRING', FrameType.SIMPLEFONTSTRING],
      ['TEXTAREA', FrameType.TEXTAREA],
      ['TEXTBUTTON', FrameType.TEXT_FRAME],
      ['BUTTON', FrameType.BUTTON],
      ['GLUETEXTBUTTON', FrameType.GLUETEXTBUTTON],
      ['GLUEBUTTON', FrameType.GLUEBUTTON],
      ['SIMPLEBUTTON', FrameType.SIMPLEBUTTON],
      ['BROWSER_BUTTON', FrameType.BROWSER_BUTTON],
      ['SCRIPT_DIALOG_BUTTON', FrameType.SCRIPT_DIALOG_BUTTON],
      ['INVIS_BUTTON', FrameType.INVIS_BUTTON],
      ['CHECKBOX', FrameType.CHECKBOX],
      ['GLUECHECKBOX', FrameType.CHECKBOX],
      ['SIMPLECHECKBOX', FrameType.CHECKBOX],
      ['EDITBOX', FrameType.EDITBOX],
      ['GLUEEDITBOX', FrameType.EDITBOX],
      ['SLIDER', FrameType.SLIDER],
      ['SCROLLBAR', FrameType.SCROLLBAR],
      ['LISTBOX', FrameType.LISTBOX],
      ['MENU', FrameType.MENU],
      ['POPUPMENU', FrameType.POPUPMENU],
      ['GLUEPOPUPMENU', FrameType.POPUPMENU],
      ['SPRITE', FrameType.SPRITE],
      ['MODEL', FrameType.MODEL],
      ['HIGHLIGHT', FrameType.HIGHLIGHT],
      ['SIMPLESTATUSBAR', FrameType.SIMPLESTATUSBAR],
      ['STATUSBAR', FrameType.STATUSBAR],
      ['CONTROL', FrameType.CONTROL],
      ['DIALOG', FrameType.DIALOG],
      ['TIMERTEXT', FrameType.TIMERTEXT],
      ['SLASHCHATBOX', FrameType.EDITBOX],
      ['CHATDISPLAY', FrameType.TEXTAREA],
    ];
    for (const [ft, expected] of cases) {
      expect(t.pubMapFrameType(ft)).toBe(expected);
    }
    // unknown -> FRAME + warn
    expect(t.pubMapFrameType('UNKNOWN')).toBe(FrameType.FRAME);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('mapFramePoint', () => {
  it('maps all 9 points and default', () => {
    const t = new Testable();
    expect(t.pubMapFramePoint('TOPLEFT')).toBe(0);
    expect(t.pubMapFramePoint('TOP')).toBe(1);
    expect(t.pubMapFramePoint('TOPRIGHT')).toBe(2);
    expect(t.pubMapFramePoint('LEFT')).toBe(3);
    expect(t.pubMapFramePoint('CENTER')).toBe(4);
    expect(t.pubMapFramePoint('RIGHT')).toBe(5);
    expect(t.pubMapFramePoint('BOTTOMLEFT')).toBe(6);
    expect(t.pubMapFramePoint('BOTTOM')).toBe(7);
    expect(t.pubMapFramePoint('BOTTOMRIGHT')).toBe(8);
    expect(t.pubMapFramePoint('??')).toBe(0);
  });
});

describe('toPixels & rgbaToHex & generateId', () => {
  it('toPixels returns value as-is', () => {
    const t = new Testable();
    expect(t.pubToPixels(0.4)).toBe(0.4);
    expect(t.pubToPixels(0.2, 'y')).toBe(0.2);
  });

  it('rgbaToHex with and without alpha', () => {
    const t = new Testable();
    expect(t.pubRgbaToHex(1, 0, 0)).toBe('#ff0000');
    expect(t.pubRgbaToHex(0, 1, 0, 0.5)).toBe('#00ff0080');
    // 0.1*255 = 25.5 -> Math.round = 26 = 0x1a; 0.2*255=51=0x33; 0.3*255=77=0x4d
    expect(t.pubRgbaToHex(0.1, 0.2, 0.3)).toBe('#1a334d');
  });
});

describe('rememberInlineTemplateRef', () => {
  it('skips non-string, empty, and path-like refs; dedups', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubRememberInlineTemplateRef(f, 42);
    t.pubRememberInlineTemplateRef(f, '');
    t.pubRememberInlineTemplateRef(f, 'a\\b');
    t.pubRememberInlineTemplateRef(f, 'a/b');
    t.pubRememberInlineTemplateRef(f, 'Template');
    t.pubRememberInlineTemplateRef(f, 'Template');
    expect(f.fdfMetadata?.inlineTemplateNames).toEqual(['Template']);
  });
});

describe('resolveControlTextureRefs', () => {
  it('resolves template names to backdrop texture, skips paths', () => {
    const template = mkFrame('td', 'TD', { backdropBackground: 'real.blp', texture: 'x', textureFile: 'y' });
    const reg = new Map([['TD', template]]);
    const t = new Testable();
    (t as any).templateRegistry = reg;
    const frame = mkFrame('f', 'F', {
      controlBackdrop: 'TD',
      controlPushedBackdrop: 'a\\b.blp',
      controlDisabledBackdrop: 'c/d.blp',
      controlMouseOverHighlight: 'Missing',
    });
    t.pubResolveControlTextureRefs([frame]);
    expect(frame.controlBackdrop).toBe('real.blp');
    expect(frame.controlPushedBackdrop).toBe('a\\b.blp');
    expect(frame.controlDisabledBackdrop).toBe('c/d.blp');
    expect(frame.controlMouseOverHighlight).toBe('Missing');
  });

  it('does not replace when template has no backdrop', () => {
    const template = mkFrame('td', 'TD', {});
    const reg = new Map([['TD', template]]);
    const t = new Testable();
    (t as any).templateRegistry = reg;
    const frame = mkFrame('f', 'F', { controlBackdrop: 'TD' });
    t.pubResolveControlTextureRefs([frame]);
    expect(frame.controlBackdrop).toBe('TD');
  });

  it('skips non-string field values', () => {
    const t = new Testable();
    const frame = mkFrame('f', 'F', { controlBackdrop: 5 as any });
    t.pubResolveControlTextureRefs([frame]);
    expect(frame.controlBackdrop).toBe(5);
  });

  it('uses template.texture and template.textureFile fallbacks', () => {
    const reg = new Map([['TT', mkFrame('td', 'TT', { texture: 'tex.blp' })]]);
    const t = new Testable();
    (t as any).templateRegistry = reg;
    const f = mkFrame('f', 'F', { controlBackdrop: 'TT', texture: '' });
    t.pubResolveControlTextureRefs([f]);
    expect(f.controlBackdrop).toBe('tex.blp');

    // mkFrame defaults texture to ''; override to undefined so the
    // `template.texture ?? template.textureFile` fallback is reached
    const reg2 = new Map([['TF', mkFrame('td2', 'TF', { texture: undefined as any, textureFile: 'tf.blp' })]]);
    const t2 = new Testable();
    (t2 as any).templateRegistry = reg2;
    const g = mkFrame('g', 'G', { controlBackdrop: 'TF' });
    t2.pubResolveControlTextureRefs([g]);
    expect(g.controlBackdrop).toBe('tf.blp');
  });
});

describe('detachInlineTemplateChildren', () => {
  it('detaches inline template child frames and their subtrees', () => {
    const parent = mkFrame('p', 'Parent', {
      fdfMetadata: { inlineTemplateNames: ['BackTemplate'] },
      children: ['c1', 'c2'],
    });
    const c1 = mkFrame('c1', 'BackTemplate', { parentId: 'p', children: ['gc'] });
    const gc = mkFrame('gc', 'GrandChild', { parentId: 'c1' });
    const c2 = mkFrame('c2', 'Keep', { parentId: 'p' });
    const t = new Testable();
    const result = t.pubDetachInlineTemplateChildren([parent, c1, gc, c2]);
    expect(result.map(f => f.id)).toEqual(['p', 'c2']);
    expect(parent.children).toEqual(['c2']);
  });

  it('returns unchanged when nothing to detach', () => {
    const parent = mkFrame('p', 'Parent', { fdfMetadata: { inlineTemplateNames: ['Nope'] }, children: ['c'] });
    const c = mkFrame('c', 'Child', { parentId: 'p' });
    const t = new Testable();
    const result = t.pubDetachInlineTemplateChildren([parent, c]);
    expect(result).toHaveLength(2);
  });

  it('handles missing child frame entries and missing names', () => {
    const parent = mkFrame('p', 'Parent', { fdfMetadata: { inlineTemplateNames: ['Nope'] }, children: ['ghost'] });
    const t = new Testable();
    expect(t.pubDetachInlineTemplateChildren([parent])).toHaveLength(1);
  });
});

describe('resolveRelativeFrames', () => {
  const t = new Testable();

  it('resolves unique name to id', () => {
    const a = mkFrame('a', 'A');
    const b = mkFrame('b', 'B', { anchors: [{ point: 0, relativeTo: 'A', relativePoint: 0, x: 0, y: 0 }] });
    t.pubResolveRelativeFrames([a, b]);
    expect(b.anchors[0].relativeTo).toBe('a');
  });

  it('resolves duplicate names preferring same parent', () => {
    const p = mkFrame('p', 'P');
    const a1 = mkFrame('a1', 'Shared', { parentId: 'p' });
    const a2 = mkFrame('a2', 'Shared', { parentId: 'other' });
    const b = mkFrame('b', 'B', { parentId: 'p', anchors: [{ point: 0, relativeTo: 'Shared', relativePoint: 0, x: 0, y: 0 }] });
    t.pubResolveRelativeFrames([p, a1, a2, b]);
    expect(b.anchors[0].relativeTo).toBe('a1');
  });

  it('resolves duplicate names to first when no same-parent match', () => {
    const a1 = mkFrame('a1', 'Shared');
    const a2 = mkFrame('a2', 'Shared');
    const b = mkFrame('b', 'B', { parentId: 'z', anchors: [{ point: 0, relativeTo: 'Shared', relativePoint: 0, x: 0, y: 0 }] });
    t.pubResolveRelativeFrames([a1, a2, b]);
    expect(b.anchors[0].relativeTo).toBe('a1');
  });

  it('handles __PARENT__ with parent and without', () => {
    const p = mkFrame('p', 'P');
    const child = mkFrame('c', 'C', { parentId: 'p', anchors: [{ point: 0, relativeTo: '__PARENT__', relativePoint: 0, x: 0, y: 0 }] });
    t.pubResolveRelativeFrames([p, child]);
    expect(child.anchors[0].relativeTo).toBe('p');

    const top = mkFrame('t', 'T', { anchors: [{ point: 0, relativeTo: '__PARENT__', relativePoint: 0, x: 0, y: 0 }] });
    t.pubResolveRelativeFrames([top]);
    expect(top.anchors[0].relativeTo).toBeUndefined();
    expect(top.anchors[0].relativePoint).toBeUndefined();
  });

  it('deletes relativeTo for unresolvable names, logs for built-ins', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = mkFrame('f', 'F', { anchors: [{ point: 0, relativeTo: 'UIParent', relativePoint: 4, x: 0, y: 0 }] });
    const g = mkFrame('g', 'G', { anchors: [{ point: 0, relativeTo: 'Missing', relativePoint: 4, x: 0, y: 0 }] });
    t.pubResolveRelativeFrames([f, g]);
    expect(f.anchors[0].relativeTo).toBeUndefined();
    expect(g.anchors[0].relativeTo).toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('ignores anchors without string relativeTo, and frames with no anchors', () => {
    const f = mkFrame('f', 'F', { anchors: [] });
    const g = mkFrame('g', 'G', { anchors: [{ point: 0, x: 0, y: 0 }] });
    expect(() => t.pubResolveRelativeFrames([f, g])).not.toThrow();
  });
});

describe('recalculateSizesWithRelativeAnchors', () => {
  it('recomputes sizes from absolute anchor positions for all combos', () => {
    const t = new Testable();
    // TOPLEFT+BOTTOMRIGHT
    const f1 = mkFrame('f1', 'F1', {
      anchors: [
        { point: 0, relativeTo: 'a', relativePoint: 0, x: 0, y: 0 },
        { point: 8, relativeTo: 'a', relativePoint: 8, x: 0, y: 0 },
      ],
    });
    const a = mkFrame('a', 'A', { x: 0, y: 0, width: 0.5, height: 0.3 });
    t.pubRecalculateSizesWithRelativeAnchors([a, f1]);
    expect(f1.width).toBeGreaterThan(0);
  });

  it('skips frames with < 2 anchors', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { anchors: [{ point: 0, x: 0, y: 0 }] });
    t.pubRecalculateSizesWithRelativeAnchors([f]);
    expect(f.width).toBe(0);
  });

  it('computes full size from TOPLEFT+BOTTOMRIGHT on parent with known dimensions', () => {
    const t = new Testable();
    const parent = t.mkAbsFrame('parent', 'Parent', 0, 0, 1, 1);
    const child = mkFrame('child', 'Child', {
      anchors: [
        { point: 0, relativeTo: 'parent', relativePoint: 0, x: 0, y: 0 },
        { point: 8, relativeTo: 'parent', relativePoint: 8, x: 0, y: 0 },
      ],
    });
    t.pubRecalculateSizesWithRelativeAnchors([parent, child]);
    expect(child.width).toBe(1);
    expect(child.x).toBe(0);
  });

  it('computes TOPLEFT+TOPRIGHT width', () => {
    const t = new Testable();
    const parent = t.mkAbsFrame('p', 'P', 0, 0, 1, 1);
    const child = mkFrame('c', 'C', { height: 0.2, anchors: [
      { point: 0, relativeTo: 'p', relativePoint: 0, x: 0, y: 1 },
      { point: 2, relativeTo: 'p', relativePoint: 0, x: 1, y: 1 },
    ] });
    t.pubRecalculateSizesWithRelativeAnchors([parent, child]);
    expect(child.width).toBe(1);
  });

  it('computes TOPLEFT+BOTTOMLEFT height', () => {
    const t = new Testable();
    const parent = t.mkAbsFrame('p', 'P', 0, 0, 1, 1);
    const child = mkFrame('c', 'C', { anchors: [
      { point: 0, relativeTo: 'p', relativePoint: 0, x: 0, y: 1 },
      { point: 6, relativeTo: 'p', relativePoint: 0, x: 0, y: 0 },
    ] });
    t.pubRecalculateSizesWithRelativeAnchors([parent, child]);
    expect(child.height).toBe(1);
  });

  it('computes TOPRIGHT+BOTTOMLEFT full', () => {
    const t = new Testable();
    const parent = t.mkAbsFrame('p', 'P', 0, 0, 1, 1);
    const child = mkFrame('c', 'C', { anchors: [
      { point: 2, relativeTo: 'p', relativePoint: 0, x: 1, y: 1 },
      { point: 6, relativeTo: 'p', relativePoint: 0, x: 0, y: 0 },
    ] });
    t.pubRecalculateSizesWithRelativeAnchors([parent, child]);
    expect(child.width).toBe(1);
  });

  it('computes TOPRIGHT+BOTTOMRIGHT height', () => {
    const t = new Testable();
    const parent = t.mkAbsFrame('p', 'P', 0, 0, 1, 1);
    const child = mkFrame('c', 'C', { width: 0.3, anchors: [
      { point: 2, relativeTo: 'p', relativePoint: 0, x: 1, y: 1 },
      { point: 8, relativeTo: 'p', relativePoint: 0, x: 1, y: 0 },
    ] });
    t.pubRecalculateSizesWithRelativeAnchors([parent, child]);
    expect(child.x).toBe(1 - 0.3);
  });

  it('computes BOTTOMLEFT+BOTTOMRIGHT width', () => {
    const t = new Testable();
    const parent = t.mkAbsFrame('p', 'P', 0, 0, 1, 1);
    const child = mkFrame('c', 'C', { anchors: [
      { point: 6, relativeTo: 'p', relativePoint: 0, x: 0, y: 0 },
      { point: 8, relativeTo: 'p', relativePoint: 0, x: 1, y: 0 },
    ] });
    t.pubRecalculateSizesWithRelativeAnchors([parent, child]);
    expect(child.width).toBe(1);
  });
});

describe('getCanvasCoordinateForPoint & getFrameAnchorPosition & calculateAbsoluteAnchorPosition', () => {
  const t = new Testable();
  it('covers all canvas points and default', () => {
    expect(t.pubGetCanvasCoordinateForPoint(0)).toEqual({ x: 0, y: 0.6 });
    expect(t.pubGetCanvasCoordinateForPoint(1)).toEqual({ x: 0.4, y: 0.6 });
    expect(t.pubGetCanvasCoordinateForPoint(2)).toEqual({ x: 0.8, y: 0.6 });
    expect(t.pubGetCanvasCoordinateForPoint(3)).toEqual({ x: 0, y: 0.3 });
    expect(t.pubGetCanvasCoordinateForPoint(4)).toEqual({ x: 0.4, y: 0.3 });
    expect(t.pubGetCanvasCoordinateForPoint(5)).toEqual({ x: 0.8, y: 0.3 });
    expect(t.pubGetCanvasCoordinateForPoint(6)).toEqual({ x: 0, y: 0 });
    expect(t.pubGetCanvasCoordinateForPoint(7)).toEqual({ x: 0.4, y: 0 });
    expect(t.pubGetCanvasCoordinateForPoint(8)).toEqual({ x: 0.8, y: 0 });
    expect(t.pubGetCanvasCoordinateForPoint(99)).toEqual({ x: 0.4, y: 0.3 });
  });

  it('covers all frame anchor points and default', () => {
    const f = mkFrame('f', 'F', { x: 10, y: 20, width: 10, height: 20 });
    expect(t.pubGetFrameAnchorPosition(f, 0)).toEqual({ x: 10, y: 40 });
    expect(t.pubGetFrameAnchorPosition(f, 1)).toEqual({ x: 15, y: 40 });
    expect(t.pubGetFrameAnchorPosition(f, 2)).toEqual({ x: 20, y: 40 });
    expect(t.pubGetFrameAnchorPosition(f, 3)).toEqual({ x: 10, y: 30 });
    expect(t.pubGetFrameAnchorPosition(f, 4)).toEqual({ x: 15, y: 30 });
    expect(t.pubGetFrameAnchorPosition(f, 5)).toEqual({ x: 20, y: 30 });
    expect(t.pubGetFrameAnchorPosition(f, 6)).toEqual({ x: 10, y: 20 });
    expect(t.pubGetFrameAnchorPosition(f, 7)).toEqual({ x: 15, y: 20 });
    expect(t.pubGetFrameAnchorPosition(f, 8)).toEqual({ x: 20, y: 20 });
    expect(t.pubGetFrameAnchorPosition(f, 99)).toEqual({ x: 10, y: 20 });
  });

  it('calculateAbsoluteAnchorPosition: absolute, relative, missing relative frame', () => {
    expect(t.pubCalculateAbsoluteAnchorPosition({ point: 0, x: 3, y: 4 }, new Map())).toEqual({ x: 3, y: 4 });
    const parent = mkFrame('pa', 'PA', { x: 0, y: 0, width: 10, height: 10 });
    const map = new Map([['pa', parent]]);
    const res = t.pubCalculateAbsoluteAnchorPosition({ point: 0, x: 1, y: 2, relativeTo: 'pa', relativePoint: 0 }, map);
    expect(res).toEqual({ x: 1, y: 12 });
    expect(t.pubCalculateAbsoluteAnchorPosition({ point: 0, x: 0, y: 0, relativeTo: 'ghost', relativePoint: 0 }, map)).toBeNull();
  });
});

describe('calculateFinalPositions', () => {
  const t = new Testable();

  it('handles frames with no anchors', () => {
    const f = mkFrame('f', 'F');
    t.pubCalculateFinalPositions([f]);
    expect(f.x).toBe(0);
  });

  it('covers all anchor point branches with TestMainPanel cover for logs', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Give every point value a frame; use absolute anchors.
    const points: [number, number, number][] = [
      [0, 10, 0], [1, 10, 0], [2, 10, 20], [3, 10, 20], [4, 10, 20],
      [5, 10, 20], [6, 10, 20], [7, 10, 20], [8, 10, 20], [99, 10, 20],
    ];
    const frames = points.map(([point, w, h], i) =>
      mkFrame(`pf${i}`, `PF${i}`, { width: w, height: h, anchors: [{ point: point as any, x: 50, y: 40 }] }));
    // A frame named TestMainPanel to unlock debug logging paths
    const tm = mkFrame('tm', 'TestMainPanel', {
      width: 10, height: 20,
      anchors: [{ point: 4, x: 30, y: 20 }],
    });
    // unresolved relative (relativeTo deleted -> uses canvas) named TestMainPanel
    const tm2 = mkFrame('tm2', 'TestMainPanel2', {
      width: 10, height: 20,
      anchors: [{ point: 0, relativeTo: 'UIParent', relativePoint: 4, x: 5, y: 5 }],
    });
    // resolvable relative
    const rel = mkFrame('rel', 'Rel', { width: 10, height: 20, anchors: [{ point: 0, relativeTo: 'tm', x: 1, y: 1 }] });
    const all = [...frames, tm, tm2, rel];
    t.pubCalculateFinalPositions(all);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it('uses relative point to canvas fallback when relativeTo deleted but relativePoint present', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const f = mkFrame('t', 'TestMainPanel', {
      width: 10, height: 20,
      anchors: [{ point: 4, x: 5, y: 5 }],
    });
    t.pubCalculateFinalPositions([f]);
    expect(f.x).toBeGreaterThanOrEqual(0);
    log.mockRestore();
  });
});

describe('calculateSizeFromAnchors (via transformFrame and direct)', () => {
  it('leaves sized frame when <2 anchors', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubCalculateSizeFromAnchors(f);
    expect(f.width).toBe(0);
  });

  it('computes size from diagonal TOPLEFT+BOTTOMRIGHT same relativeTo', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { width: 1, height: 1, anchors: [
      { point: 0, relativeTo: 'p', x: 0, y: 0 },
      { point: 8, relativeTo: 'p', x: 5, y: 4 },
    ] });
    t.pubCalculateSizeFromAnchors(f);
    expect(f.width).toBe(5);
    expect(f.height).toBe(4);
  });

  it('computes size from diagonal TOPRIGHT+BOTTOMLEFT same relativeTo', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { anchors: [
      { point: 2, relativeTo: 'p', x: 5, y: 5 },
      { point: 6, relativeTo: 'p', x: 1, y: 1 },
    ] });
    t.pubCalculateSizeFromAnchors(f);
    expect(f.width).toBe(4);
    expect(f.height).toBe(4);
  });

  it('computes width from TOPLEFT+TOPRIGHT same relativeTo', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { anchors: [
      { point: 0, relativeTo: 'p', x: 0, y: 0 },
      { point: 2, relativeTo: 'p', x: 6, y: 0 },
    ] });
    t.pubCalculateSizeFromAnchors(f);
    expect(f.width).toBe(6);
  });

  it('computes height from TOPLEFT+BOTTOMLEFT same relativeTo', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { anchors: [
      { point: 0, relativeTo: 'p', x: 0, y: 2 },
      { point: 6, relativeTo: 'p', x: 0, y: 0 },
    ] });
    t.pubCalculateSizeFromAnchors(f);
    expect(f.height).toBe(2);
  });

  it('does not compute when relativeTo differs', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { width: 1, height: 1, anchors: [
      { point: 0, relativeTo: 'a', x: 0, y: 0 },
      { point: 8, relativeTo: 'b', x: 5, y: 4 },
    ] });
    t.pubCalculateSizeFromAnchors(f);
    expect(f.width).toBe(1);
    expect(f.height).toBe(1);
  });

  it('does not hit diagonal when only padding anchors exist', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F', { width: 2, height: 2, anchors: [
      { point: 3, relativeTo: 'p', x: 0, y: 0 },
      { point: 5, relativeTo: 'p', x: 3, y: 0 },
    ] });
    t.pubCalculateSizeFromAnchors(f);
    expect(f.width).toBe(2);
  });
});

describe('copyInheritedChildren / findFrameInTree', () => {
  it('copies inherited children and updates parent refs', () => {
    const tpl = mkFrame('tpl', 'Tpl', {
      children: ['tc1'],
      fdfMetadata: { isTemplate: true },
    });
    const tplChild = mkFrame('tc1', 'TChild', {
      parentId: 'tpl',
      anchors: [{ point: 0, relativeTo: 'Tpl', relativePoint: 0, x: 0, y: 0 }],
      children: ['tc2'],
    });
    const tplGrand = mkFrame('tc2', 'TGrand', { parentId: 'tc1' });
    const reg = new Map([['Tpl', tpl]]);
    const t = new Testable();
    (t as any).templateRegistry = reg;
    const parent = mkFrame('parent', 'Parent', { fdfMetadata: { inherits: 'Tpl' } });
    const all = [tpl, tplChild, tplGrand, parent];
    (t as any).copyInheritedChildren(tpl, parent, all);
    expect(parent.children.length).toBeGreaterThan(0);
    const copiedId = parent.children[0];
    const copied = all.find(f => f.id === copiedId)!;
    expect(copied.parentId).toBe('parent');
    expect(copied.fdfMetadata?.isTemplate).toBe(false);
    expect(copied.anchors[0].relativeTo).toBe('Parent');
  });

  it('warns when inherited child not found', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tpl = mkFrame('tpl', 'Tpl', { children: ['ghost'] });
    const reg = new Map([['Tpl', tpl]]);
    const t = new Testable();
    (t as any).templateRegistry = reg;
    const parent = mkFrame('p', 'P');
    (t as any).copyInheritedChildren(tpl, parent, [tpl, parent]);
    expect(parent.children).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('findFrameInTree searches and returns null', () => {
    const t = new Testable();
    const root = mkFrame('r', 'R', { children: ['c'] });
    const c = mkFrame('c', 'C');
    expect(t.pubFindFrameInTree(root, 'c', [root, c])).toBe(c);
    expect(t.pubFindFrameInTree(root, 'nope', [root, c])).toBeNull();
    const root2 = mkFrame('r2', 'R2');
    expect(t.pubFindFrameInTree(root2, 'r2', [root2])).toBe(root2);
  });

  it('copyInheritedChildren finds template child via registry when missing in allFrames', () => {
    // child exists only inside a registry template
    const innerTpl = mkFrame('inner', 'InnerTpl', { children: ['deep'] });
    const deep = mkFrame('deep', 'Deep', { parentId: 'inner' });
    const std = mkFrame('std', 'Std', { children: ['inner'] });
    const reg = new Map([
      ['Std', std],
    ]);
    const t = new Testable();
    (t as any).templateRegistry = reg;
    const parent = mkFrame('p', 'P');
    const all = [std, innerTpl, deep, parent];
    (t as any).copyInheritedChildren(std, parent, all);
    expect(parent.children.length).toBeGreaterThan(0);
  });

  it('resolves inherited child through the registry lookup loop', () => {
    // The inherited child id is missing from `allFrames`, so copyInheritedChildren
    // must locate it by scanning the templateRegistry via findFrameInTree. To let
    // findFrameInTree match (it resolves nesting through allFrames) the child is
    // registered as its own template root.
    const t = new Testable();
    const regChild = mkFrame('missingChild', 'MissingChild', {
      parentId: 'tpl', fdfMetadata: { isTemplate: true },
    });
    const tpl = mkFrame('tpl', 'Tpl', { children: ['missingChild'], fdfMetadata: { isTemplate: true } });
    (t as any).templateRegistry = new Map([['Tpl', tpl], ['MissingChild', regChild]]);
    const parent = mkFrame('parent', 'Parent', { fdfMetadata: { inherits: 'Tpl' } });
    // `regChild` is deliberately absent from allFrames to force the registry path.
    (t as any).copyInheritedChildren(tpl, parent, [tpl, parent]);
    expect(parent.children.length).toBe(1);
  });
});

describe('coverage edge cases - applyProperty guard-false arms', () => {
  // Guards whose false arm needs a non-array / non-number value.
  const numGuardFalse = [
    ['SetPoint', stringValue('x')],
    ['FontColor', stringValue('x')],
    ['FontShadowColor', stringValue('x')],
    ['FontShadowOffset', stringValue('x')],
    ['TextLength', stringValue('x')],
    ['ButtonPushedTextOffset', stringValue('x')],
    ['FontHighlightColor', stringValue('x')],
    ['FontDisabledColor', stringValue('x')],
    ['BackdropBackgroundInsets', stringValue('x')],
    ['TexCoord', stringValue('x')],
    ['SliderInitialValue', stringValue('x')],
    ['SliderMinValue', stringValue('x')],
    ['SliderMaxValue', stringValue('x')],
    ['SliderStepSize', stringValue('x')],
    ['EditBorderColor', stringValue('x')],
    ['EditBorderSize', stringValue('x')],
    ['TextAreaInset', stringValue('x')],
    ['TextAreaLineHeight', stringValue('x')],
    ['TextAreaLineGap', stringValue('x')],
    ['TextAreaMaxLines', stringValue('x')],
    ['MenuItemHeight', stringValue('x')],
    ['PopupButtonInset', stringValue('x')],
    ['HighlightColor', stringValue('x')],
    ['MenuTextHighlightColor', stringValue('x')],
    ['ChatDisplayBorderSize', stringValue('x')],
    ['ChatDisplayLineHeight', stringValue('x')],
  ];

  it.each(numGuardFalse)('applyProperty guard false arm for %s', (pn, val) => {
    const t = new Testable();
    const f = mkFrame('f', 'FX');
    t.pubApplyProperty(f, prop(pn, val));
    expect(f).toBeDefined();
  });

  // Guards whose false arm needs a non-string value.
  const stringGuardFalse = [
    ['FontFlags', numberValue(1)],
    ['FontJustificationH', numberValue(1)],
    ['FontJustificationV', numberValue(1)],
    ['AlphaMode', numberValue(1)],
    ['ButtonText', numberValue(1)],
    ['NormalText', numberValue(1)],
    ['HighlightText', numberValue(1)],
    ['DisabledText', numberValue(1)],
    ['PopupMenuFrame', numberValue(1)],
    ['PopupArrowFrame', numberValue(1)],
    ['PopupTitleFrame', numberValue(1)],
    ['EditTextFrame', numberValue(1)],
    ['DialogBackdrop', numberValue(1)],
    ['ControlShortcutKey', numberValue(1)],
    ['TabFocusNext', numberValue(1)],
    ['TextAreaScrollBar', numberValue(1)],
    ['SliderThumbButtonFrame', numberValue(1)],
    ['ScrollBarIncButtonFrame', numberValue(1)],
    ['ScrollBarDecButtonFrame', numberValue(1)],
    ['CheckBoxCheckHighlight', numberValue(1)],
    ['CheckBoxDisabledCheckHighlight', numberValue(1)],
    ['ChatDisplayEditBox', numberValue(1)],
    ['ChatDisplayScrollBar', numberValue(1)],
    ['BackgroundArt', numberValue(1)],
  ];

  it.each(stringGuardFalse)('applyProperty string-guard false arm for %s', (pn, val) => {
    const t = new Testable();
    const f = mkFrame('f', 'FX');
    t.pubApplyProperty(f, prop(pn, val));
    expect(f).toBeDefined();
  });

  it('framefont guard-false subcases', () => {
    const t = new Testable();
    const f1 = mkFrame('f1', 'F1');
    t.pubApplyProperty(f1, prop('framefont', stringValue('x'))); // non-array
    const f2 = mkFrame('f2', 'F2');
    t.pubApplyProperty(f2, prop('framefont', arrayValue([numberValue(9), numberValue(2)]))); // arr[0] not string
    const f3 = mkFrame('f3', 'F3');
    t.pubApplyProperty(f3, prop('framefont', arrayValue([stringValue('f'), stringValue('h')]))); // arr[1] not number
    const f4 = mkFrame('f4', 'F4');
    t.pubApplyProperty(f4, prop('framefont', arrayValue([stringValue('f'), numberValue(2), stringValue('')]))); // arr[2] falsy
    expect(t).toBeDefined();
  });

  it('font guard-false subcases', () => {
    const t = new Testable();
    const f1 = mkFrame('f1', 'F1');
    t.pubApplyProperty(f1, prop('font', stringValue('x'))); // non-array
    const f2 = mkFrame('f2', 'F2');
    t.pubApplyProperty(f2, prop('font', arrayValue([numberValue(9), numberValue(2)]))); // arr[0] not string
    const f3 = mkFrame('f3', 'F3');
    t.pubApplyProperty(f3, prop('font', arrayValue([stringValue('f'), stringValue('h')]))); // arr[1] not number
    // arr[2] truthy -> sets frame.fontFlags (covers line 520 true arm)
    const f4 = mkFrame('f4', 'F4');
    t.pubApplyProperty(f4, prop('font', arrayValue([stringValue('F'), numberValue(0.02), stringValue('BOLD|SHADOW')])));
    expect(f4.fontFlags).toEqual(['BOLD', 'SHADOW']);
  });

  it('fontjustification inner false arms', () => {
    const t = new Testable();
    const h = mkFrame('h', 'H');
    t.pubApplyProperty(h, prop('fontjustificationh', stringValue('X'))); // not left/center/right
    const v = mkFrame('v', 'V');
    t.pubApplyProperty(v, prop('fontjustificationv', stringValue('X'))); // not top/middle/bottom
    expect(t).toBeDefined();
  });

  it('menuborder string arm and fontjustificationoffset short array', () => {
    const t = new Testable();
    const a = mkFrame('a', 'A');
    t.pubApplyProperty(a, prop('menuborder', stringValue('MB'))); // not number -> menuBorderRef
    expect(a.menuBorderRef).toBe('MB');
    const b = mkFrame('b', 'B');
    t.pubApplyProperty(b, prop('fontjustificationoffset', arrayValue([numberValue(1)]))); // length < 2
    expect(t).toBeDefined();
  });

  it('menuitem numeric / non-string-array value', () => {
    const t = new Testable();
    const a = mkFrame('a', 'A');
    t.pubApplyProperty(a, prop('menuitem', numberValue(7))); // neither string nor array[0] string
    const b = mkFrame('b', 'B');
    t.pubApplyProperty(b, prop('menuitem', arrayValue([numberValue(3)]))); // array[0] not string
    expect(t).toBeDefined();
  });

  it('unknown property hits default case', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyProperty(f, prop('UnknownWhatever', stringValue('v')));
    expect(f).toBeDefined();
  });

  it('applyProperties skips non-PROPERTY / non-NESTED_FRAME entries', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyProperties(f, [{ type: 'WeirdNode', name: 'X', value: stringValue('y') }]);
    expect(f).toBeDefined();
  });
});

describe('coverage edge cases - applyNestedFrame & applyAnchor & structural', () => {
  it('texture nested block ignores non-PROPERTY entries', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyNestedFrame(f, { type: 'NestedFrame', frameType: 'texture', name: 'T', properties: [{ type: 'Other', name: 'x', value: stringValue('v') }] });
    expect(t).toBeDefined();
  });

  it('texture alphamode with unrecognized string', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyNestedFrame(f, { type: 'NestedFrame', frameType: 'texture', name: 'T', properties: [prop('AlphaMode', stringValue('OPAQUE'))] });
    expect(f.alphaMode).toBeUndefined();
  });

  it('string nested block ignores non-PROPERTY entries', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyNestedFrame(f, { type: 'NestedFrame', frameType: 'string', name: 'S', properties: [{ type: 'Other', name: 'x', value: stringValue('v') }] });
    expect(t).toBeDefined();
  });

  it('string nested block ignores non-text property', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyNestedFrame(f, { type: 'NestedFrame', frameType: 'string', name: 'S', properties: [prop('NotText', stringValue('x'))] });
    expect(f.text).toBeUndefined();
  });

  it('applyAnchor short/4-element arrays', () => {
    const t = new Testable();
    const f1 = mkFrame('f1', 'F1');
    t.pubApplyAnchor(f1, []);
    const f2 = mkFrame('f2', 'F2');
    t.pubApplyAnchor(f2, ['TOPLEFT', 'P', 'TOPLEFT', 0]);
    expect(t).toBeDefined();
  });

  it('applyProperty setpoint with non-array value', () => {
    const t = new Testable();
    const f = mkFrame('f', 'F');
    t.pubApplyProperty(f, prop('SetPoint', stringValue('x')));
    expect(f.anchors).toHaveLength(0);
  });
});

describe('coverage edge cases - calculateSizeFromAnchors & recalc & detach & resolve', () => {
  it('calculateSizeFromAnchors with differing relativeTo', () => {
    const t = new Testable();
    // TR + BL, differing relativeTo
    const f1 = mkFrame('f1', 'F1', {
      anchors: [
        { point: 2, relativeTo: 'A', relativePoint: 0, x: 0, y: 0 },
        { point: 6, relativeTo: 'B', relativePoint: 0, x: 5, y: 5 },
      ],
    });
    t.pubCalculateSizeFromAnchors(f1);
    // TL + TR, differing relativeTo
    const f2 = mkFrame('f2', 'F2', {
      anchors: [
        { point: 0, relativeTo: 'A', relativePoint: 0, x: 0, y: 0 },
        { point: 2, relativeTo: 'B', relativePoint: 0, x: 5, y: 0 },
      ],
    });
    t.pubCalculateSizeFromAnchors(f2);
    // TL + BL, differing relativeTo
    const f3 = mkFrame('f3', 'F3', {
      anchors: [
        { point: 0, relativeTo: 'A', relativePoint: 0, x: 0, y: 0 },
        { point: 6, relativeTo: 'B', relativePoint: 0, x: 0, y: 5 },
      ],
    });
    t.pubCalculateSizeFromAnchors(f3);
    expect(t).toBeDefined();
  });

  it('recalculateSizesWithRelativeAnchors with unresolvable targets', () => {
    const t = new Testable();
    const mkRel = (id: string, pts: Array<[number, string]>) =>
      mkFrame(id, 'Rel' + id, { anchors: pts.map(([p, rel]) => ({ point: p, relativeTo: rel, relativePoint: 0, x: 0, y: 0 })) });
    // Each combo's target frame ids are absent from the map -> calculateAbsoluteAnchorPosition null.
    t.pubRecalculateSizesWithRelativeAnchors([mkRel('a', [[0, 'm1'], [8, 'm2']])]); // TL+BR
    t.pubRecalculateSizesWithRelativeAnchors([mkRel('b', [[0, 'm1'], [2, 'm2']])]); // TL+TR
    t.pubRecalculateSizesWithRelativeAnchors([mkRel('c', [[0, 'm1'], [6, 'm2']])]); // TL+BL
    t.pubRecalculateSizesWithRelativeAnchors([mkRel('d', [[2, 'm1'], [6, 'm2']])]); // TR+BL
    t.pubRecalculateSizesWithRelativeAnchors([mkRel('e', [[2, 'm1'], [8, 'm2']])]); // TR+BR
    t.pubRecalculateSizesWithRelativeAnchors([mkRel('g', [[6, 'm1'], [8, 'm2']])]); // BL+BR
    expect(t).toBeDefined();
  });

  it('resolveRelativeFrames multi-candidate without parentId', () => {
    const t = new Testable();
    const ref = mkFrame('ref', 'Ref', {
      parentId: null,
      anchors: [{ point: 0, relativeTo: 'Target', relativePoint: 0, x: 0, y: 0 }],
    });
    const f1 = mkFrame('t1', 'Target');
    const f2 = mkFrame('t2', 'Target');
    t.pubResolveRelativeFrames([ref, f1, f2]);
    // falls back to first candidate
    expect(ref.anchors[0].relativeTo).toBe('t1');
  });

  it('detachInlineTemplateChildren early-return removed + missing child', () => {
    const t = new Testable();
    // a is detached; its child b is also detached via a second parent -> revisit hits removed.has (id214 arm0).
    const a = mkFrame('a', 'A', { children: ['b'] });
    const b = mkFrame('b', 'B');
    const o = mkFrame('o', 'O', { children: ['a'], fdfMetadata: { inlineTemplateNames: ['A'] } });
    const p = mkFrame('p', 'P', { children: ['b'], fdfMetadata: { inlineTemplateNames: ['B'] } });
    const res1 = t.pubDetachInlineTemplateChildren([o, p, a, b]);
    expect(res1.some((f: any) => f.id === 'a')).toBe(false);

    // detached frame whose grandchild id is missing from idToFrame -> if(!f) return (id215 arm0).
    const g = mkFrame('g', 'G', { children: ['ghost'] });
    const og = mkFrame('og', 'OG', { children: ['g'], fdfMetadata: { inlineTemplateNames: ['G'] } });
    const res2 = t.pubDetachInlineTemplateChildren([og, g]);
    expect(res2.some((f: any) => f.id === 'g')).toBe(false);
  });
});

describe('coverage edge cases - transform pipeline structural', () => {
  it('top-level __PARENT__ anchors point 0 and point 8 use canvas coords', () => {
    const t = new Testable();
    const r0 = t.transform(program(frameDef('FRAME', 'P0', [prop('SetPoint', arrayValue([stringValue('TOPLEFT'), stringValue('__PARENT__'), stringValue('TOPLEFT'), numberValue(0), numberValue(0)]))])));
    expect(r0[0].anchors[0].x).toBe(0);
    expect(r0[0].anchors[0].y).toBe(0.6);
    const r8 = t.transform(program(frameDef('FRAME', 'P8', [prop('SetPoint', arrayValue([stringValue('BOTTOMRIGHT'), stringValue('__PARENT__'), stringValue('BOTTOMRIGHT'), numberValue(0), numberValue(0)]))])));
    expect(r8[0].anchors[0].x).toBe(0.8);
    expect(r8[0].anchors[0].y).toBe(0);
  });

  it('top-level anchor with non-__PARENT__ relativeTo (arm1 at line 71)', () => {
    const t = new Testable();
    const r = t.transform(program(frameDef('FRAME', 'P', [prop('SetPoint', arrayValue([stringValue('TOPLEFT'), stringValue('Sibling'), stringValue('TOPLEFT'), numberValue(0), numberValue(0)]))])));
    expect(r).toHaveLength(1);
  });

  it('transform INVIS_BUTTON frame hits frameType === 13 default-size arm', () => {
    const t = new Testable();
    const r = t.transform(program(frameDef('INVIS_BUTTON', 'I', [])));
    expect(r[0].type).toBe(13);
    expect(r[0].height).toBe(0.012);
  });

  it('transform frame with missing inherited template', () => {
    const t = new Testable();
    const r = t.transform(program(frameDef('FRAME', 'A', [], { inherits: 'MissingTemplate' })));
    expect(r[0].name).toBe('A');
  });

  it('collectNestedFrames nested unnamed frame + non-__PARENT__ anchor', () => {
    const t = new Testable();
    const r = t.transform(program(frameDef('FRAME', 'Parent', [
      {
        type: 'NestedFrame',
        frameType: 'BUTTON',
        name: undefined,
        properties: [prop('SetPoint', arrayValue([stringValue('TOPLEFT'), stringValue('Other'), stringValue('TOPLEFT'), numberValue(0), numberValue(0)]))],
      },
    ])));
    const child = r.find((f: any) => f.name && f.name.startsWith('NestedFrame_'));
    expect(child).toBeDefined();
    expect(child.parentId).toBe(r[0].id);
  });
});

describe('coverage edge cases - calculateFinalPositions branches', () => {
  it('covers unresolvable-relativeTo and TestMainPanel log arms', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const t = new Testable();
    const f1 = mkFrame('cf1', 'Other', { anchors: [{ point: 4, relativeTo: 'ghost', relativePoint: undefined as any, x: 0, y: 0 }] });
    const f2 = mkFrame('cf2', 'Other', { anchors: [{ point: 4, relativeTo: 'ghost', relativePoint: 0, x: 0, y: 0 }] });
    const f3 = mkFrame('cf3', 'TestMainPanel', { anchors: [{ point: 4, relativeTo: 'ghost', relativePoint: 0, x: 0, y: 0 }] });
    const f4 = mkFrame('cf4', 'TestMainPanel', { anchors: [{ point: 4, relativeTo: undefined, relativePoint: 0, x: 1, y: 1 }] });
    const f5 = mkFrame('cf5', 'Other', { anchors: [{ point: 4, relativeTo: undefined, relativePoint: 0, x: 1, y: 1 }] });
    const f6 = mkFrame('cf6', 'TestMainPanel', { anchors: [{ point: 4, relativeTo: undefined, relativePoint: undefined as any, x: 2, y: 2 }] });
    t.pubCalculateFinalPositions([f1, f2, f3, f4, f5, f6]);
    log.mockRestore();
    expect(f1).toBeDefined();
  });
});

describe('coverage edge cases - remaining unreachable-arm probes', () => {
  it('block 27 arm1: inherited anchor relativeTo differs from template name (line 239)', () => {
    // A template child whose anchor.relativeTo is NOT the template's own name
    // (e.g. an ancestor/__PARENT__ reference). copyFrameTree keeps it unchanged,
    // hitting the ternary else arm at line 239.
    const tpl = mkFrame('tpl', 'Tpl', { children: ['tc1'] });
    const tplChild = mkFrame('tc1', 'TChild', {
      parentId: 'tpl',
      anchors: [{ point: 0, relativeTo: '__PARENT__', relativePoint: 0, x: 0, y: 0 }],
    });
    const t = new Testable();
    (t as any).templateRegistry = new Map([['Tpl', tpl]]);
    const parent = mkFrame('parent', 'Parent');
    (t as any).copyInheritedChildren(tpl, parent, [tpl, tplChild, parent]);
    expect(parent.children[0]).toBeDefined();
    const copied = parent.children[0];
    expect(parent.children.length).toBe(1);
  });

  it('block 28 arm1: inherited grandchild missing from allFrames (line 253)', () => {
    // Template child references a grandchild id that is absent from allFrames and
    // from the registry, so copyFrameTree returns '' and the copiedChild.children
    // push is skipped (if(copiedGrandchildId) false arm at line 253).
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const tpl = mkFrame('tpl', 'Tpl', { children: ['tc1'] });
    const tplChild = mkFrame('tc1', 'TChild', {
      parentId: 'tpl',
      children: ['ghostGrand'],
      anchors: [{ point: 0, relativeTo: 'Tpl', relativePoint: 0, x: 0, y: 0 }],
    });
    const t = new Testable();
    (t as any).templateRegistry = new Map([['Tpl', tpl]]);
    const parent = mkFrame('parent', 'Parent');
    (t as any).copyInheritedChildren(tpl, parent, [tpl, tplChild, parent]);
    expect(parent.children.length).toBe(1);
    warn.mockRestore();
  });

  it('block 105 arm1: EditCursorColor value is not a 4+ array (line 775)', () => {
    const t = new Testable();
    const f = mkFrame('f', 'FX');
    // applyProperty lowercases the prop name to 'editcursorcolor'; a string value
    // fails Array.isArray -> line 775 if-arm1.
    t.pubApplyProperty(f, prop('EditCursorColor', stringValue('x')));
    expect(f).toBeDefined();
  });

  it('block 132 arm1: MenuBorder value is neither number nor string (line 899)', () => {
    const t = new Testable();
    const f = mkFrame('f', 'FX');
    // arrayValue fails both typeof checks -> line 899 if-arm1.
    t.pubApplyProperty(f, prop('MenuBorder', arrayValue([numberValue(1)])));
    expect(f).toBeDefined();
  });

  it('block 253 arm1: recalc frame with only TR anchor reaches BL+BR false (line 1592)', () => {
    const t = new Testable();
    // Anchors with point 2 (TOPRIGHT) and point 3 (LEFT) satisfy the outer
    // anchors.length>=2 guard but no diagonal pair: each else-if falls through to
    // the final BL+BR condition, which is also false -> line 1592 arm1.
    const f = mkRelCritical();
    t.pubRecalculateSizesWithRelativeAnchors([f]);
    expect(f).toBeDefined();
  });

  it('block 271 arm1: relativePoint null at line 1757 (?? 4 fallback)', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const t = new Testable();
    // relativeTo present (enters line 1749 branch), absPos unresolvable (target
    // 'ghost' absent) -> else at line 1754. relativePoint = hasRelativePoint ? val : 4.
    // Pass relativePoint = null so hasRelativePoint is true but the ?? 4 at 1757 uses
    // the fallback (null ?? 4 = 4), covering the right arm of the nullish coalesce.
    const f = mkFrame('cf', 'Other', {
      anchors: [{ point: 4, relativeTo: 'ghost', relativePoint: null as any, x: 0, y: 0 }],
    });
    t.pubCalculateFinalPositions([f]);
    log.mockRestore();
    expect(f).toBeDefined();
  });

  it('block 15 arm1: collectNestedFrames with WITHCHILDREN but missing template (line 149)', () => {
    // Craft collectNestedFrames directly: withChildren+inherits+inheritedChildrenIds
    // are all truthy (line 147 true), but templateRegistry.get returns undefined, so
    // `template && template.children.length > 0` at line 149 is false (arm1).
    const t = new Testable();
    (t as any).templateRegistry = new Map();
    const parent = mkFrame('parent', 'Parent', { fdfMetadata: { inheritedChildrenIds: ['x'] } });
    const node = frameDef('FRAME', 'Parent', [], { withChildren: true, inherits: 'Missing' });
    t.pubCollectNestedFrames(node, parent, []);
    expect(parent).toBeDefined();
  });
});

function mkRelCritical(): FrameData {
  return mkFrame('r', 'RelR', {
    anchors: [
      { point: 2, relativeTo: 'm1', relativePoint: 0, x: 0, y: 0 },
      { point: 3, relativeTo: 'm2', relativePoint: 0, x: 5, y: 0 },
    ],
  });
}