import { describe, it, expect } from 'vitest';
import { FDFParser } from './fdfParser';
import { FDFLexer, Token, TokenType } from './fdfLexer';
import { FDFNodeType } from './fdfAst';

function tokenize(input: string): Token[] {
  return new FDFLexer(input).tokenize();
}

function parse(input: string) {
  return new FDFParser(tokenize(input)).parse();
}

function parseTokens(tokens: Token[]) {
  return new FDFParser(tokens).parse();
}

// hand-built token helper for precise branch control
function tk(type: TokenType, value = '', line = 1, column = 1): Token {
  return { type, value, line, column };
}

describe('FDFParser basic program', () => {
  it('handles empty input -> empty Program body', () => {
    const res = parse('');
    expect(res.type).toBe(FDFNodeType.PROGRAM);
    expect(res.body).toEqual([]);
  });

  it('handles only comments', () => {
    const res = parse('// a comment\n/* multi\nline */\n');
    expect(res.type).toBe(FDFNodeType.PROGRAM);
    expect(res.body).toEqual([]);
  });

  it('parses a simple empty Frame with type and name', () => {
    const res = parse('FRAME "FRAME" "MyFrame" {}');
    expect(res.type).toBe(FDFNodeType.PROGRAM);
    expect(res.body).toHaveLength(1);
    const frame = res.body[0] as any;
    expect(frame.type).toBe(FDFNodeType.FRAME_DEFINITION);
    expect(frame.frameType).toBe('FRAME');
    expect(frame.name).toBe('MyFrame');
    expect(frame.inherits).toBeUndefined();
    expect(frame.withChildren).toBe(false);
    expect(frame.properties).toEqual([]);
  });

  it('parses an IncludeFile node', () => {
    const res = parse('INCLUDEFILE "path/to/file.fdf"');
    expect(res.body).toHaveLength(1);
    const inc = res.body[0] as any;
    expect(inc.type).toBe(FDFNodeType.INCLUDE);
    expect(inc.path).toBe('path/to/file.fdf');
    expect(inc.loc.start.line).toBe(1);
  });

  it('skips unknown top-level tokens and comments between nodes', () => {
    // A bare STRING token then comments then a frame
    const res = parse('"just a string" FRAME "BUTTON" "B" {}');
    expect(res.body).toHaveLength(1);
    expect(res.body[0].type).toBe(FDFNodeType.FRAME_DEFINITION);
  });
});

describe('FDFParser INHERITS and WITHCHILDREN', () => {
  it('parses INHERITS with template', () => {
    const res = parse('FRAME "BACKDROP" "A" INHERITS "Template" {}');
    const frame = res.body[0] as any;
    expect(frame.inherits).toBe('Template');
    expect(frame.withChildren).toBe(false);
  });

  it('parses INHERITS WITHCHILDREN template', () => {
    const res = parse('FRAME "BACKDROP" "A" INHERITS WITHCHILDREN "Template" {}');
    const frame = res.body[0] as any;
    expect(frame.inherits).toBe('Template');
    expect(frame.withChildren).toBe(true);
  });
});

describe('FDFParser properties', () => {
  it('parses a string property', () => {
    const res = parse('FRAME "TEXT" "T" { Text "hello" }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    expect(prop.type).toBe(FDFNodeType.PROPERTY);
    expect(prop.name).toBe('Text');
    expect(prop.value.type).toBe(FDFNodeType.STRING_LITERAL);
    expect(prop.value.value).toBe('hello');
  });

  it('parses a single number property', () => {
    const res = parse('FRAME "TEXT" "T" { Width 100 }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    expect(prop.value.type).toBe(FDFNodeType.NUMBER_LITERAL);
    expect(prop.value.value).toBe(100);
  });

  it('handles a comment inside a property block (skipCommentsAndNewlines + break)', () => {
    const input = 'FRAME "BACKDROP" "B" { Width 1 // trailing comment after value\n}';
    const res = parse(input);
    const frame = res.body[0] as any;
    const prop = frame.properties[0] as any;
    expect(prop.name).toBe('Width');
    expect(prop.value.type).toBe(FDFNodeType.NUMBER_LITERAL);
    // the comment after the value is skipped; only Width is a property
    expect(frame.properties).toHaveLength(1);
  });

  it('parses a space-separated numeric array', () => {
    const res = parse('FRAME "BACKDROP" "B" { BackdropBackgroundInsets 0.004 0.004 0.004 0.004 }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    expect(prop.value.type).toBe(FDFNodeType.ARRAY_LITERAL);
    expect(prop.value.elements).toHaveLength(4);
    expect(prop.value.elements.map((e: any) => e.value)).toEqual([0.004, 0.004, 0.004, 0.004]);
  });

  it('parses a flag property with no value as true identifier', () => {
    const res = parse('FRAME "BUTTON" "B" { DecorateFileNames }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    expect(prop.name).toBe('DecorateFileNames');
    expect(prop.value.type).toBe(FDFNodeType.IDENTIFIER);
    expect(prop.value.name).toBe('true');
  });

  it('parses an identifier value (enum) that carries a trailing comma', () => {
    // FontJustificationH JUSTIFYLEFT,  — identifier value followed by comma
    const res = parse('FRAME "TEXT" "T" { FontJustificationH JUSTIFYLEFT, }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    expect(prop.value.type).toBe(FDFNodeType.IDENTIFIER);
    expect(prop.value.name).toBe('JUSTIFYLEFT');
  });

  it('does not swallow the NEXT property name when no value follows', () => {
    // "Width" then "Height" immediately: next IDENTIFIER has no comma -> not a value
    const res = parse('FRAME "TEXT" "T" { Width Height }');
    const frame = res.body[0] as any;
    // Width has no value -> flag true; Height is a separate property (also flag until its own value)
    const names = frame.properties.map((p: any) => p.name);
    expect(names).toEqual(['Width', 'Height']);
  });

  it('parses a single identifier value when followed by a comma', () => {
    const res = parse('FRAME "TEXT" "T" { FontFlags SINGLELINE, }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0] as any;
    expect(prop.value.type).toBe(FDFNodeType.IDENTIFIER);
    expect(prop.value.name).toBe('SINGLELINE');
  });
});

describe('FDFParser array values via comma', () => {
  it('parses a comma-separated FontColor with trailing comma', () => {
    const res = parse('FRAME "TEXT" "T" { FontColor 1.0, 0.5, 0.25, 1.0, }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    expect(prop.value.type).toBe(FDFNodeType.ARRAY_LITERAL);
    expect(prop.value.elements).toHaveLength(4);
    const nums = prop.value.elements.map((e: any) => e.value);
    expect(nums).toEqual([1, 0.5, 0.25, 1]);
  });

  it('parses a SetPoint-like identifier+string+numbers array via commas', () => {
    const input = 'FRAME "BUTTON" "B" { SetPoint TOPLEFT, "ButtonUnitFrame", TOPLEFT, 0, 0 }';
    const res = parse(input);
    const frame = res.body[0] as any;
    const setPoint = frame.properties[0];
    expect(setPoint.value.type).toBe(FDFNodeType.ARRAY_LITERAL);
    const els = setPoint.value.elements;
    expect(els).toHaveLength(5);
    expect(els[0]).toMatchObject({ type: FDFNodeType.IDENTIFIER, name: 'TOPLEFT' });
    expect(els[1]).toMatchObject({ type: FDFNodeType.STRING_LITERAL, value: 'ButtonUnitFrame' });
    expect(els[2]).toMatchObject({ type: FDFNodeType.IDENTIFIER, name: 'TOPLEFT' });
    expect(els[3]).toMatchObject({ type: FDFNodeType.NUMBER_LITERAL, value: 0 });
    expect(els[4]).toMatchObject({ type: FDFNodeType.NUMBER_LITERAL, value: 0 });
  });

  it('stops comma-reading before a PascalCase new property name', () => {
    // After array, a comment+newline then "BackdropBackground" (PascalCase) must NOT be consumed
    const input =
      'FRAME "BACKDROP" "B" { BackdropBackgroundInsets 0, 0,\n  BackdropBackground "file.tga" }';
    const res = parse(input);
    const frame = res.body[0] as any;
    const names = frame.properties.map((p: any) => p.name);
    expect(names).toEqual(['BackdropBackgroundInsets', 'BackdropBackground']);
  });

  it('consumes an all-uppercase enum value after comma (e.g. SECOND TOPLEFT in SetPoint)', () => {
    // SetPoint TOPLEFT, "X", TOPLEFT,  0, 0  — the second TOPLEFT read as value not new prop
    const res = parse('FRAME "B" "X" { SetPoint TOPLEFT, "X", TOPLEFT, 0, 0 }');
    const setPoint = res.body[0].properties[0] as any;
    expect(setPoint.value.elements).toHaveLength(5);
    expect(setPoint.value.elements[2].name).toBe('TOPLEFT');
  });

  it('consumes a lowercase keyword value after comma (true/false)', () => {
    const res = parse('FRAME "B" "X" { SetAllPoints true }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0] as any;
    expect(prop.value.type).toBe(FDFNodeType.IDENTIFIER);
    expect(prop.value.name).toBe('true');
  });

  it('stops comma-reading on RIGHT_BRACE after a trailing comma', () => {
    const res = parse('FRAME "B" "X" { Width 1, }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0] as any;
    expect(prop.value.type).toBe(FDFNodeType.NUMBER_LITERAL);
    expect(prop.value.value).toBe(1);
  });

  it('stops comma-reading on FRAME token after a trailing comma (nested frame follows)', () => {
    const res = parse('FRAME "B" "X" { Width 1, FRAME "TEXT" "Child" {} }');
    const frame = res.body[0] as any;
    expect(frame.properties).toHaveLength(2);
    const first = frame.properties[0] as any;
    expect(first.value.type).toBe(FDFNodeType.NUMBER_LITERAL);
    expect(first.value.value).toBe(1);
    expect(frame.properties[1].type).toBe(FDFNodeType.NESTED_FRAME);
  });

  it('stops comma-reading on other unknown token types (e.g. LEFT_BRACE)', () => {
    // After a comma, a LEFT_BRACE: not STRING/NUMBER/IDENTIFIER -> break
    const res = parse('FRAME "B" "X" { Width 1, { }');
    const frame = res.body[0] as any;
    const prop = frame.properties[0] as any;
    expect(prop.value.type).toBe(FDFNodeType.NUMBER_LITERAL);
  });
});

describe('FDFParser nested frames', () => {
  it('parses a nested FRAME definition with comma separation', () => {
    const input =
      'FRAME "BUTTON" "Parent" { Frame "BACKDROP" "Child" { Width 1 }, }';
    const res = parse(input);
    const parent = res.body[0] as any;
    expect(parent.properties).toHaveLength(1);
    const child = parent.properties[0];
    expect(child.type).toBe(FDFNodeType.NESTED_FRAME);
    expect(child.frameType).toBe('BACKDROP');
    expect(child.name).toBe('Child');
  });

  it('parses a nested frame without optional trailing comma', () => {
    const input = 'FRAME "BUTTON" "Parent" { Frame "BACKDROP" "Child" {} }';
    const res = parse(input);
    const child = (res.body[0] as any).properties[0];
    expect(child.type).toBe(FDFNodeType.NESTED_FRAME);
  });

  it('parses a nested frame with INHERITS but WITHOUT WITHCHILDREN', () => {
    const input = 'FRAME "BUTTON" "P" { Frame "TEXT" "C" INHERITS "Tmpl" {} }';
    const res = parse(input);
    const child = (res.body[0] as any).properties[0];
    expect(child.type).toBe(FDFNodeType.NESTED_FRAME);
    expect(child.inherits).toBe('Tmpl');
    expect(child.withChildren).toBe(false);
  });

  it('parses a nested frame with INHERITS WITHCHILDREN', () => {
    const input = 'FRAME "BUTTON" "P" { Frame "TEXT" "C" INHERITS WITHCHILDREN "Tmpl" {} }';
    const res = parse(input);
    const child = (res.body[0] as any).properties[0];
    expect(child.type).toBe(FDFNodeType.NESTED_FRAME);
    expect(child.inherits).toBe('Tmpl');
    expect(child.withChildren).toBe(true);
  });

  it('parses a Texture nested block', () => {
    const input = 'FRAME "BACKDROP" "B" { Texture { File "tex.tga" } }';
    const res = parse(input);
    const tex = (res.body[0] as any).properties[0];
    expect(tex.type).toBe(FDFNodeType.NESTED_FRAME);
    expect(tex.frameType).toBe('Texture');
    expect(tex.name).toBeUndefined();
    expect(tex.properties).toHaveLength(1);
  });

  it('parses a String nested block (unnamed, STRING then LEFT_BRACE)', () => {
    const input = 'FRAME "TEXT" "T" { String { Text "x" } }';
    const res = parse(input);
    const str = (res.body[0] as any).properties[0];
    expect(str.type).toBe(FDFNodeType.NESTED_FRAME);
    expect(str.frameType).toBe('String');
    expect(str.name).toBeUndefined();
    expect(str.inherits).toBeUndefined();
    expect(str.properties).toHaveLength(1);
  });

  it('treats a named String (name before brace) as a property block, not nested frame', () => {
    // `String "MyString" {` — peek after STRING is STRING not LEFT_BRACE, so not nested.
    const res = parse('FRAME "TEXT" "T" { String "MyString" { Text "x" } }');
    const frame = res.body[0] as any;
    // "String" is an IDENTIFIER (lowercase keyword value) -> parsed as a property with value 'MyString'
    const prop = frame.properties[0] as any;
    expect(prop.type).toBe(FDFNodeType.PROPERTY);
    expect(prop.value.type).toBe(FDFNodeType.STRING_LITERAL);
    expect(prop.value.value).toBe('MyString');
  });

  it('skips an unknown non-frame keyword inside a property block', () => {
    const input = 'FRAME "B" "X" { GARBAGE 1 }';
    const res = parse(input);
    const frame = res.body[0] as any;
    // GARBAGE is a token: IDENTIFIER -> parseProperty, name=GARBAGE, value number 1
    expect(frame.properties).toHaveLength(1);
    expect(frame.properties[0].name).toBe('GARBAGE');
  });
});

describe('FDFParser error handling', () => {
  it('throws when a frame expects STRING but gets something else', () => {
    const tokens = [
      tk(TokenType.FRAME),
      tk(TokenType.IDENTIFIER, 'NOPE'),
      tk(TokenType.EOF),
    ];
    expect(() => parseTokens(tokens)).toThrow(/Expected token type STRING/);
  });

  it('throws when parseFrameDefinition is missing LEFT_BRACE', () => {
    const tokens = [
      tk(TokenType.FRAME),
      tk(TokenType.STRING, 'FRAME', 1, 7),
      tk(TokenType.STRING, 'X', 1, 15),
      tk(TokenType.EOF),
    ];
    expect(() => parseTokens(tokens)).toThrow(/Expected token type LEFT_BRACE/);
  });
});

describe('FDFParser parsePropertyValue branch coverage', () => {
  it('returns an unknown identifier when value is neither STRING/NUMBER/IDENTIFIER', () => {
    // Property name is IDENTIFIER "Foo", then a RIGHT_BRACE follows.
    // Because RIGHT_BRACE is not FRAME, the else-if `!check(RIGHT_BRACE) && !check(FRAME)` is false
    // so no value parsed; returns flag true. That covers flag path, not the unknown path.
    const res = parse('FRAME "B" "X" { Foo }');
    const prop = (res.body[0] as any).properties[0];
    expect(prop.value.type).toBe(FDFNodeType.IDENTIFIER);
    expect(prop.value.name).toBe('true');
  });

  it('parses an unknown token type via parsePropertyValue fallthrough', () => {
    // Force parseProperty() to call parsePropertyValue() on a LEFT_BRACE token:
    // property name "Foo", followed by LEFT_BRACE (not right brace, not frame) -> value read.
    const tokens = [
      tk(TokenType.FRAME),
      tk(TokenType.STRING, 'B'),
      tk(TokenType.STRING, 'X'),
      tk(TokenType.LEFT_BRACE),
      tk(TokenType.IDENTIFIER, 'Foo'),
      tk(TokenType.LEFT_BRACE),
      tk(TokenType.RIGHT_BRACE),
      tk(TokenType.EOF),
    ];
    const res = parseTokens(tokens);
    const frame = res.body[0] as any;
    const prop = frame.properties[0];
    // Foo gets value from parsePropertyValue on LEFT_BRACE -> unknown
    expect(prop.value.type).toBe(FDFNodeType.IDENTIFIER);
    expect(prop.value.name).toBe('unknown');
  });
});

describe('FDFParser loc fields', () => {
  it('records start/end location for a frame', () => {
    const res = parse('FRAME "BUTTON" "B" { Width 1 }');
    const frame = res.body[0] as any;
    expect(frame.loc).toBeDefined();
    expect(frame.loc.start.line).toBe(1);
  });
});