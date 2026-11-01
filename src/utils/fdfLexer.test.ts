import { describe, it, expect } from 'vitest';
import { FDFLexer, TokenType } from './fdfLexer';

describe('FDFLexer constructor', () => {
  it('initializes position/line/column and emits EOF for empty input', () => {
    const lexer = new FDFLexer('');
    expect(lexer).toBeInstanceOf(FDFLexer);
    const tok = lexer.nextToken();
    expect(tok).toEqual({ type: TokenType.EOF, value: '', line: 1, column: 1 });
  });
});

describe('FDFLexer tokenize', () => {
  it('returns empty-ish tokens ending with EOF', () => {
    // tokenize drops NEWLINE tokens
    const tokens = new FDFLexer('').tokenize();
    expect(tokens).toHaveLength(1);
    expect(tokens[0].type).toBe(TokenType.EOF);
  });

  it('tokenizes a realistic FDF snippet', () => {
    const input = [
      'FRAME HelloFrame {',
      '  INHERITS Base',
      '  WITHCHILDREN true',
      '  INCLUDEFILE "file.fdf"',
      '  width 100, height -5.5',
      '}',
    ].join('\n');
    const lexer = new FDFLexer(input);
    const tokens = lexer.tokenize();
    const types = tokens.map(t => t.type);
    expect(types).toContain(TokenType.FRAME);
    expect(types).toContain(TokenType.IDENTIFIER);
    expect(types).toContain(TokenType.LEFT_BRACE);
    expect(types).toContain(TokenType.INHERITS);
    expect(types).toContain(TokenType.WITHCHILDREN);
    expect(types).toContain(TokenType.INCLUDE_FILE);
    expect(types).toContain(TokenType.NUMBER);
    expect(types).toContain(TokenType.COMMA);
    expect(types).toContain(TokenType.RIGHT_BRACE);
    expect(types).toContain(TokenType.EOF);
  });
});

describe('FDFLexer comments', () => {
  it('tokenizes a single-line // comment', () => {
    const lexer = new FDFLexer('// hello world\n');
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.COMMENT);
    expect(tok.value).toBe('hello world');
    expect(tok.line).toBe(1);
    expect(tok.column).toBe(1);
  });

  it('tokenizes a multi-line block comment', () => {
    const lexer = new FDFLexer('/* line1\nline2 */');
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.COMMENT);
    expect(tok.value).toBe('line1\nline2');
  });

  it('handles an unterminated block comment (EOF before closing)', () => {
    const lexer = new FDFLexer('/* no close');
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.COMMENT);
    expect(tok.value).toBe('no close');
  });

  it('returns null from skipComment for non-comment input', () => {
    const lexer = new FDFLexer('abc');
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.IDENTIFIER);
    expect(tok.value).toBe('abc');
  });

  it('skips whitespace then a comment then whitespace', () => {
    const lexer = new FDFLexer('   // hi   \n x');
    const tokens = lexer.tokenize();
    expect(tokens.map(t => t.type)).toEqual([
      TokenType.COMMENT,
      TokenType.IDENTIFIER,
      TokenType.EOF,
    ]);
    expect(tokens[0].value).toBe('hi');
  });
});

describe('FDFLexer strings', () => {
  it('parses a double-quoted string', () => {
    const tok = new FDFLexer('"abc"').nextToken();
    expect(tok.type).toBe(TokenType.STRING);
    expect(tok.value).toBe('abc');
  });

  it('parses a single-quoted string', () => {
    const tok = new FDFLexer("'xyz'").nextToken();
    expect(tok.type).toBe(TokenType.STRING);
    expect(tok.value).toBe('xyz');
  });

  it('parses an empty string', () => {
    const tok = new FDFLexer('""').nextToken();
    expect(tok.type).toBe(TokenType.STRING);
    expect(tok.value).toBe('');
  });

  it('handles an unterminated string (EOF instead of closing quote)', () => {
    const tok = new FDFLexer('"oops').nextToken();
    expect(tok.type).toBe(TokenType.STRING);
    expect(tok.value).toBe('oops');
  });

  it('interprets standard escapes', () => {
    const tok = new FDFLexer('"a\\nb\\tc\\rd\\\\e\\"f\\\'g"').nextToken();
    expect(tok.value).toBe('a\nb\tc\rd\\e"f\'g');
  });

  it('keeps unknown escapes verbatim (backslash + char)', () => {
    const tok = new FDFLexer('"C:\\Project\\File"').nextToken();
    expect(tok.value).toBe('C:\\Project\\File');
  });

  it('keeps a Windows path with trailing backslash before quote as unknown escape', () => {
    // `\P` is unknown -> kept as `\P`; exit loop on quote.
    const tok = new FDFLexer('"\\P"').nextToken();
    expect(tok.value).toBe('\\P');
  });
});

describe('FDFLexer numbers', () => {
  it('parses an integer', () => {
    const tok = new FDFLexer('123').nextToken();
    expect(tok).toMatchObject({ type: TokenType.NUMBER, value: '123', line: 1, column: 1 });
  });

  it('parses a negative integer', () => {
    const tok = new FDFLexer('-42').nextToken();
    expect(tok.type).toBe(TokenType.NUMBER);
    expect(tok.value).toBe('-42');
  });

  it('parses a decimal', () => {
    const tok = new FDFLexer('3.14').nextToken();
    expect(tok.type).toBe(TokenType.NUMBER);
    expect(tok.value).toBe('3.14');
  });

  it('leaves a lone dot as the stop (no digits after)', () => {
    // '1.' -> '1' number, then '.' hits default-skip. nextToken re-enters.
    const lexer = new FDFLexer('1.');
    const first = lexer.nextToken();
    expect(first.type).toBe(TokenType.NUMBER);
    expect(first.value).toBe('1');
    const second = lexer.nextToken();
    expect(second.type).toBe(TokenType.EOF); // '.' skipped via unknown-char recursion
  });

  it('parses scientific notation with lowercase e', () => {
    const tok = new FDFLexer('1e3').nextToken();
    expect(tok.value).toBe('1e3');
  });

  it('parses scientific notation with uppercase E and sign', () => {
    const tok = new FDFLexer('1E-4').nextToken();
    expect(tok.value).toBe('1E-4');
  });

  it('parses scientific notation with positive sign', () => {
    const tok = new FDFLexer('1e+2').nextToken();
    expect(tok.value).toBe('1e+2');
  });

  it('swallows a C-style f/F float suffix (value unchanged)', () => {
    const tok = new FDFLexer('0.5f').nextToken();
    expect(tok.type).toBe(TokenType.NUMBER);
    expect(tok.value).toBe('0.5');
  });

  it('does not swallow f from a real identifier like final', () => {
    const lexer = new FDFLexer('final');
    const tok = lexer.nextToken();
    // 'f' is a letter so readIdentifier path is used; not a number suffix.
    expect(tok.type).toBe(TokenType.IDENTIFIER);
    expect(tok.value).toBe('final');
  });

  it('does not swallow F suffix when followed by an alnum char', () => {
    // '2F3' -> number '2', then 'F3' identifier. F not swallowed since peek '3' is alnum.
    const lexer = new FDFLexer('2F3');
    expect(lexer.nextToken().value).toBe('2');
    expect(lexer.nextToken().value).toBe('F3');
  });
});

describe('FDFLexer identifiers and keywords', () => {
  it('keyword matching is case-insensitive for FRAME', () => {
    expect(new FDFLexer('frame').nextToken().type).toBe(TokenType.FRAME);
    expect(new FDFLexer('FRAME').nextToken().type).toBe(TokenType.FRAME);
  });

  it('maps INHERITS keyword', () => {
    expect(new FDFLexer('inherits').nextToken().type).toBe(TokenType.INHERITS);
  });

  it('maps WITHCHILDREN keyword', () => {
    expect(new FDFLexer('WithChildren').nextToken().type).toBe(TokenType.WITHCHILDREN);
  });

  it('maps INCLUDEFILE keyword (no underscore)', () => {
    expect(new FDFLexer('includeFile').nextToken().type).toBe(TokenType.INCLUDE_FILE);
  });

  it('produces IDENTIFIER for a plain name', () => {
    const tok = new FDFLexer('my_thing_2').nextToken();
    expect(tok.type).toBe(TokenType.IDENTIFIER);
    expect(tok.value).toBe('my_thing_2');
  });
});

describe('FDFLexer symbols and unknown chars', () => {
  it('reads left brace', () => {
    const tok = new FDFLexer('{').nextToken();
    expect(tok).toMatchObject({ type: TokenType.LEFT_BRACE, value: '{' });
  });

  it('reads right brace', () => {
    const tok = new FDFLexer('}').nextToken();
    expect(tok).toMatchObject({ type: TokenType.RIGHT_BRACE, value: '}' });
  });

  it('reads comma', () => {
    const tok = new FDFLexer(',').nextToken();
    expect(tok).toMatchObject({ type: TokenType.COMMA, value: ',' });
  });

  it('recurses past an unknown character to the next token', () => {
    const lexer = new FDFLexer(';abc');
    const tok = lexer.nextToken();
    // ';' hits default, advance, recurse -> reads 'abc'
    expect(tok.type).toBe(TokenType.IDENTIFIER);
    expect(tok.value).toBe('abc');
  });

  it('returns NEWLINE, and tokenize drops it', () => {
    const lexer = new FDFLexer('a\nb');
    const first = lexer.nextToken();
    expect(first.type).toBe(TokenType.IDENTIFIER);
    expect(first.value).toBe('a');
    expect(first.line).toBe(1);
    const nl = lexer.nextToken();
    expect(nl.type).toBe(TokenType.NEWLINE);
    expect(nl.value).toBe('\n');
    // next token is b on line 2
    const second = lexer.nextToken();
    expect(second.type).toBe(TokenType.IDENTIFIER);
    expect(second.value).toBe('b');
    expect(second.line).toBe(2);
  });

  it('tracks column across spaces', () => {
    const lexer = new FDFLexer('  {}');
    const lbrace = lexer.nextToken();
    expect(lbrace).toMatchObject({ type: TokenType.LEFT_BRACE, column: 3 });
  });

  it('tracks line across newlines inside a string', () => {
    const lexer = new FDFLexer('"a\nb"');
    const tok = lexer.nextToken();
    expect(tok.type).toBe(TokenType.STRING);
    expect(tok.value).toBe('a\nb');
    // inner newline advanced line to 2
    const end = lexer.nextToken();
    expect(end.line).toBe(2);
  });
});