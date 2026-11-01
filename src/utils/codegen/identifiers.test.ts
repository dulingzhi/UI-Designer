import { describe, it, expect } from 'vitest';
import {
  toIdentifier,
  escapeJassString,
  escapeLuaString,
  sanitizeLibraryName,
  sanitizeIdentifier,
  JASS_KEYWORDS,
} from './identifiers';

describe('sanitizeIdentifier — 基础净化', () => {
  it('保留合法标识符不变', () => {
    expect(sanitizeIdentifier('MyFrame')).toBe('MyFrame');
    expect(sanitizeIdentifier('_ok')).toBe('ok');
    expect(sanitizeIdentifier('A1_b2')).toBe('A1_b2');
  });

  it('空格/连字符/点号折成下划线', () => {
    expect(sanitizeIdentifier('My Frame-01')).toBe('My_Frame_01');
    expect(sanitizeIdentifier('a.b.c')).toBe('a_b_c');
  });

  it('连续分隔符折叠为单个下划线', () => {
    expect(sanitizeIdentifier('a  --  b')).toBe('a_b');
  });

  it('数字开头补 F_ 前缀', () => {
    expect(sanitizeIdentifier('123Frame')).toBe('F_123Frame');
  });

  it('空串/纯空白/纯分隔符回落到 Frame', () => {
    expect(sanitizeIdentifier('')).toBe('Frame');
    expect(sanitizeIdentifier('   ')).toBe('Frame');
    expect(sanitizeIdentifier('---')).toBe('Frame');
  });

  it('null/undefined 输入回落到 Frame（覆盖 raw ?? \'\'）', () => {
    expect(sanitizeIdentifier(null as unknown as string)).toBe('Frame');
    expect(sanitizeIdentifier(undefined as unknown as string)).toBe('Frame');
  });
});

describe('toIdentifier — 唯一性与关键字规避', () => {
  it('重名自动加后缀', () => {
    const used = new Set<string>();
    expect(toIdentifier('Dup', used)).toBe('Dup');
    expect(toIdentifier('Dup', used)).toBe('Dup_2');
    expect(toIdentifier('Dup', used)).toBe('Dup_3');
  });

  it('净化后撞名也会加后缀', () => {
    const used = new Set<string>();
    expect(toIdentifier('My Frame', used)).toBe('My_Frame');
    expect(toIdentifier('My-Frame', used)).toBe('My_Frame_2');
  });

  it('规避 JASS 保留字（加下划线后缀）', () => {
    const used = new Set<string>();
    expect(toIdentifier('function', used)).toBe('function_');
    expect(toIdentifier('library', used)).toBe('library_');
    expect(toIdentifier('endfunction', used)).toBe('endfunction_');
  });

  it('保留字判定不区分大小写', () => {
    const used = new Set<string>();
    expect(toIdentifier('Function', used)).toBe('Function_');
  });

  it('可关闭关键字规避', () => {
    const used = new Set<string>();
    expect(toIdentifier('function', used, { avoidKeywords: false })).toBe('function');
  });

  it('可用自定义关键字集合（覆盖 opts.keywords）', () => {
    const used = new Set<string>();
    expect(toIdentifier('custom', used, { keywords: new Set(['custom']) })).toBe('custom_');
  });

  it('空名使用 fallback', () => {
    const used = new Set<string>();
    expect(toIdentifier('', used, { fallback: 'EmptyFrame' })).toBe('EmptyFrame');
  });

  it('空名且未给 fallback 时回落 Frame', () => {
    const used = new Set<string>();
    expect(toIdentifier('', used)).toBe('Frame');
    expect(toIdentifier('   ', used)).toBe('Frame_2'); // 第二次撞名
  });

  it('null/undefined 原始名走 fallback 路径（覆盖 raw ?? \'\'）', () => {
    const used = new Set<string>();
    expect(toIdentifier(null as unknown as string, used)).toBe('Frame');
    expect(toIdentifier(undefined as unknown as string, used, { fallback: 'Fb' })).toBe('Fb');
  });

  it('每次调用都写入 used 集合', () => {
    const used = new Set<string>();
    toIdentifier('X', used);
    expect(used.has('X')).toBe(true);
  });
});

describe('escapeJassString — JASS 字面量转义', () => {
  it('引号双写（JASS 用 "" 表示字面引号）', () => {
    expect(escapeJassString('a"b')).toBe('a""b');
  });

  it('反斜杠加倍（纹理路径）', () => {
    expect(escapeJassString('UI\\Widgets\\a.blp')).toBe('UI\\\\Widgets\\\\a.blp');
  });

  it('换行转成 \\n 字面量（LF / CRLF / 裸 CR）', () => {
    expect(escapeJassString('a\nb')).toBe('a\\nb');
    expect(escapeJassString('a\r\nb')).toBe('a\\nb');
    expect(escapeJassString('a\rb')).toBe('a\\nb');
  });

  it('null/undefined 视为空串', () => {
    expect(escapeJassString(null)).toBe('');
    expect(escapeJassString(undefined)).toBe('');
  });

  it('普通文本不变', () => {
    expect(escapeJassString('Hello World')).toBe('Hello World');
  });
});

describe('escapeLuaString — LUA 字面量转义', () => {
  it('引号用反斜杠转义（与 JASS 双写不同）', () => {
    expect(escapeLuaString('a"b')).toBe('a\\"b');
  });

  it('反斜杠加倍', () => {
    expect(escapeLuaString('UI\\a.blp')).toBe('UI\\\\a.blp');
  });

  it('换行转义（LF / CRLF / 裸 CR）', () => {
    expect(escapeLuaString('a\nb')).toBe('a\\nb');
    expect(escapeLuaString('a\r\nb')).toBe('a\\nb');
    expect(escapeLuaString('a\rb')).toBe('a\\nb');
  });

  it('null/undefined 视为空串（覆盖 raw ?? \'\'）', () => {
    expect(escapeLuaString(null)).toBe('');
    expect(escapeLuaString(undefined)).toBe('');
  });
});

describe('sanitizeLibraryName', () => {
  it('净化空格与数字', () => {
    expect(sanitizeLibraryName('My Lib 2')).toBe('My_Lib_2');
  });

  it('规避保留字', () => {
    expect(sanitizeLibraryName('library')).toBe('library_');
  });

  it('空值回落 Frame', () => {
    expect(sanitizeLibraryName('')).toBe('Frame');
    expect(sanitizeLibraryName(null)).toBe('Frame');
    expect(sanitizeLibraryName(undefined)).toBe('Frame');
  });
});

describe('JASS_KEYWORDS 完整性', () => {
  it('覆盖 JASS 常用关键字', () => {
    for (const kw of [
      'function', 'endfunction', 'library', 'endlibrary', 'globals', 'endglobals',
      'call', 'set', 'local', 'if', 'endif', 'loop', 'endloop', 'return',
      'takes', 'returns', 'nothing', 'array', 'and', 'or', 'not', 'null',
    ]) {
      expect(JASS_KEYWORDS.has(kw)).toBe(true);
    }
  });
});