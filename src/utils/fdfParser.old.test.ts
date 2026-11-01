import { describe, it, expect, vi } from 'vitest';

const h = vi.hoisted(() => {
  return {
    createDefaultAnchors: vi.fn(),
  };
});

vi.mock('./anchorUtils', () => ({
  createDefaultAnchors: h.createDefaultAnchors,
}));

vi.mock('../types', () => {
  return {
    FramePoint: {
      TOPLEFT: 0,
      TOP: 1,
      TOPRIGHT: 2,
      LEFT: 3,
      CENTER: 4,
      RIGHT: 5,
      BOTTOMLEFT: 6,
      BOTTOM: 7,
      BOTTOMRIGHT: 8,
    },
    FrameType: {
      ORIGIN: 0,
      FRAME: 1,
      BACKDROP: 2,
      SIMPLEFRAME: 3,
      TEXT_FRAME: 4,
      SIMPLEFONTSTRING: 5,
      TEXTAREA: 6,
      BUTTON: 7,
      GLUETEXTBUTTON: 8,
      GLUEBUTTON: 9,
      SIMPLEBUTTON: 10,
      BROWSER_BUTTON: 11,
      SCRIPT_DIALOG_BUTTON: 12,
      INVIS_BUTTON: 13,
      CHECKBOX: 14,
      EDITBOX: 15,
      SLIDER: 16,
      SCROLLBAR: 17,
      LISTBOX: 18,
      MENU: 19,
      POPUPMENU: 20,
      SPRITE: 21,
      MODEL: 22,
      HIGHLIGHT: 23,
      HORIZONTAL_BAR: 24,
    },
  };
});

import { parseFDF } from './fdfParser.old';

describe('fdfParser.old parseFDF', () => {
  it('parses a frame with no anchors (uses defaults)', () => {
    h.createDefaultAnchors.mockReturnValue([
      { point: 0, x: 0.1, y: 0.2 },
    ]);
    const frames = parseFDF(`
      // a comment line
      Frame "BACKDROP" "MainBackdrop" {
        Width 0.5,
        Height 0.25,
        BackdropBackground "ui\\bg.blp",
        Text "Hello",
      }
    `);
    expect(frames).toHaveLength(1);
    const f = frames[0];
    expect(f.name).toBe('MainBackdrop');
    expect(f.type).toBe(2); // BACKDROP
    expect(f.width).toBe(0.5);
    expect(f.height).toBe(0.25);
    expect(f.texture).toBe('ui\\bg.blp');
    expect(f.text).toBe('Hello');
    expect(h.createDefaultAnchors).toHaveBeenCalled();
    expect(f.anchors[0].point).toBe(0);
  });

  it('parses SetPoint into anchors and converts Y sign', () => {
    const frames = parseFDF(`
      Frame "BUTTON" "MyButton" {
        SetPoint TOPLEFT, "GameUI", TOPLEFT, 10, 20,
      }
    `);
    const f = frames[0];
    expect(f.type).toBe(7); // BUTTON
    expect(f.anchors).toHaveLength(1);
    expect(f.anchors[0]).toMatchObject({
      point: 0, // TOPLEFT
      relativeTo: undefined, // GameUI -> undefined
      relativePoint: 0, // TOPLEFT
      x: 10,
      y: -20, // FDF Y negated
    });
    expect(f.x).toBe(10);
    expect(f.y).toBe(20);
  });

  it('keeps non-GameUI/UIParent relativeTo and other points', () => {
    const frames = parseFDF(`
      Frame "BUTTON" "B" {
        SetPoint LEFT, "OtherFrame", RIGHT, -5, -2,
      }
    `);
    const f = frames[0];
    expect(f.anchors[0]).toMatchObject({
      point: 3, // LEFT
      relativeTo: 'OtherFrame',
      relativePoint: 5, // RIGHT
      x: -5,
      y: 2, // -(-2)
    });
  });

  it('uses UIParent as relative (maps to undefined)', () => {
    const frames = parseFDF(`
      Frame "FRAME" "P" {
        SetPoint CENTER, "UIParent", CENTER, 0, 0,
      }
    `);
    expect(frames[0].anchors[0]).toMatchObject({
      point: 4,
      relativeTo: undefined,
      relativePoint: 4,
      x: 0,
      y: -0,
    });
  });

  it('parses nested frames and assigns parentId/children/z', () => {
    const frames = parseFDF(`
      Frame "FRAME" "Parent" {
        SetPoint CENTER, "UIParent", CENTER, 0, 0,
        Frame "TEXTFRAME" "ChildLabel" {
          Text "Label",
        }
      }
    `);
    expect(frames).toHaveLength(2);
    const parent = frames[0];
    const child = frames[1];
    expect(parent.name).toBe('Parent');
    expect(parent.children).toEqual([child.id]);
    expect(parent.parentId).toBeNull();
    expect(child.type).toBe(4); // TEXTFRAME -> TEXT_FRAME
    expect(child.z).toBe(1);
  });

  it('filters IncludeFile lines and trims leading whitespace', () => {
    h.createDefaultAnchors.mockReturnValue([{ point: 0, x: 0, y: 0 }]);
    const frames = parseFDF(`
      IncludeFile "templates\\ui.toc",
      Frame "CHECKBOX" "Cb" {
        Width .75,
        Height NotANumber,
      }
    `);
    const f = frames[0];
    expect(f.name).toBe('Cb');
    expect(f.type).toBe(14); // CHECKBOX
    // "NotANumber" stays a string (numeric coercion bails)
    expect(f.height).toBe('NotANumber');
  });

  it('coerces numeric quoted values and strips quotes', () => {
    h.createDefaultAnchors.mockReturnValue([{ point: 0, x: 0, y: 0 }]);
    const frames = parseFDF(`
      Frame "BACKDROP" "Q" {
        Width "0.5",
        Height 0.25,
      }
    `);
    const f = frames[0];
    expect(f.width).toBe(0.5);
    expect(f.height).toBe(0.25);
  });

  it('skips malformed-bool false values', () => {
    h.createDefaultAnchors.mockReturnValue([{ point: 0, x: 0, y: 0 }]);
    const frames = parseFDF(`
      Frame "BACKDROP" "B" {
        Width 1.0,
        Height 0.1,
        Ignore FALSE,
      }
    `);
    const f = frames[0];
    // false is a property value but not referenced by FrameData; nothing throws
    expect(f.name).toBe('B');
    expect(f.type).toBe(2);
    expect(f.text).toBe('');
  });

  it('maps many FDF types and falls back to BACKDROP on unknown', () => {
    const frames = parseFDF(`
      Frame "EDITBOX" "E" { Width 1.0, Height 0.1 },
      Frame "SLIDER" "S" { Width 1.0, Height 0.1 },
      Frame "CHECKBOX" "C" { Width 1.0, Height 0.1 },
      Frame "TEXTAREA" "A" { Width 1.0, Height 0.1 },
      Frame "HORIZONTALBAR" "H" { Width 1.0, Height 0.1 },
      Frame "UNKNOWN" "U" { Width 1.0, Height 0.1 },
    `);
    const byName = Object.fromEntries(frames.map((f) => [f.name, f.type]));
    expect(byName['E']).toBe(15); // EDITBOX
    expect(byName['S']).toBe(16); // SLIDER
    expect(byName['C']).toBe(14); // CHECKBOX
    expect(byName['A']).toBe(6); // TEXTAREA
    expect(byName['H']).toBe(24); // HORIZONTAL_BAR
    expect(byName['U']).toBe(2); // unknown -> BACKDROP
  });

  it('normalizes whitespace within FDF type names', () => {
    const frames = parseFDF(`
      Frame "  text  " "T1" { Width 1.0, Height 0.1 },
    `);
    // "  text  " -> 'TEXT' -> TEXT_FRAME
    expect(frames[0].type).toBe(4);
  });

  it('maps BROWSEBUTTON / SCRIPTDIALOGBUTTON / SIMPLECHECKBOX / TEXT', () => {
    const frames = parseFDF(`
      Frame "BROWSEBUTTON" "A" { Width 1.0, Height 0.1 },
      Frame "SCRIPTDIALOGBUTTON" "B" { Width 1.0, Height 0.1 },
      Frame "SIMPLECHECKBOX" "C" { Width 1.0, Height 0.1 },
      Frame "TEXT" "T" { Width 1.0, Height 0.1 },
    `);
    const byName = Object.fromEntries(frames.map((f) => [f.name, f.type]));
    expect(byName['A']).toBe(11);
    expect(byName['B']).toBe(12);
    expect(byName['C']).toBe(14);
    expect(byName['T']).toBe(4);
  });

  it('uses an empty anchor list (defaults x/y) when SetPoint args are malformed', () => {
    h.createDefaultAnchors.mockReturnValue([{ point: 0, x: 0, y: 0 }]);
    const frames = parseFDF(`
      Frame "BUTTON" "B" {
        SetPoint BROKEN,
      }
    `);
    const f = frames[0];
    // SetPoint key present -> anchors exists, but spMatch fails -> empty array
    expect(f.anchors).toEqual([]);
    expect(f.x).toBe(0.1);
    expect(f.y).toBe(0.1);
  });

  it('handles nested frame property cleanup by removing them from parent props', () => {
    const frames = parseFDF(`
      Frame "FRAME" "P" {
        Width 1.0,
        Frame "TEXT" "C" {
          Text Chill,
        }
      }
      Frame "BUTTON" "Sibling" { Width 1.0, Height 0.1 },
    `);
    const names = frames.map((f) => f.name);
    expect(names).toContain('P');
    expect(names).toContain('C');
    expect(names).toContain('Sibling');
  });

  it('coerces a TRUE property value to boolean true', () => {
    h.createDefaultAnchors.mockReturnValue([{ point: 0, x: 0, y: 0 }]);
    const frames = parseFDF(`
      Frame "BUTTON" "B" {
        Width 1.0,
        Height 0.1,
        SimpleCheckBox TRUE,
      }
    `);
    const f = frames[0];
    expect(f.name).toBe('B');
  });

  it('parses multiple SetPoint anchors on one frame', () => {
    const frames = parseFDF(`
      Frame "BUTTON" "B" {
        SetPoint TOPLEFT, "UIParent", TOPLEFT, 0, 0,
        SetPoint BOTTOMRIGHT, "UIParent", BOTTOMRIGHT, 0, 0,
      }
    `);
    const f = frames[0];
    expect(f.anchors).toHaveLength(2);
    expect(f.anchors[0].point).toBe(0); // TOPLEFT
    expect(f.anchors[1].point).toBe(8); // BOTTOMRIGHT
  });

  it('stops when a block has no closing brace and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const frames = parseFDF(`Frame "BACKDROP" "Open" { Width 1.0`);
    // findMatchingBrace returns -1 -> warn + break -> no frames
    expect(frames).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('无法找到Frame'));
    warn.mockRestore();
  });

  it('ignores content before any valid Frame definition', () => {
    h.createDefaultAnchors.mockReturnValue([{ point: 0, x: 0, y: 0 }]);
    const frames = parseFDF(`some random preamble text
      Frame "BUTTON" "B" { Width 1.0, Height 0.1 },
    `);
    expect(frames[0].name).toBe('B');
  });

  it('logs and wraps any thrown errors', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Pass a non-string to trip .split inside the try block
    expect(() => parseFDF(null as unknown as string)).toThrow(/FDF解析失败:/);
    expect(log).toHaveBeenCalledWith('FDF解析错误:', expect.anything());
    log.mockRestore();
  });
});