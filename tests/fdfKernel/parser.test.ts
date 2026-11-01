/**
 * FDF 声明式核心 —— 解析器单测（阶段 A）。
 * 对标 openwar3 parser.ts 的已验证语义，含逗号歧义、注释、数字后缀等。
 */
import { describe, it, expect } from 'vitest';
import { parseFdf, tokenizeFdf } from '../../src/utils/fdfKernelParser';

describe('tokenizeFdf', () => {
  it('识别字符串 / 数字 / 标识符 / 标点', () => {
    const toks = tokenizeFdf('Frame "FRAME" "X" { Width 1.5, Height -0.25, }');
    const kinds = toks.map((t) => `${t.kind}:${t.value}`);
    expect(kinds).toContain('id:Frame');
    expect(kinds).toContain('str:FRAME');
    expect(kinds).toContain('str:X');
    expect(kinds).toContain('id:Width');
    expect(kinds).toContain('num:1.5');
    expect(kinds).toContain('num:-0.25');
    expect(kinds).toContain('punct:{');
    expect(kinds).toContain('punct:}');
  });
  it('解析数字后缀 f 与科学计数法', () => {
    const toks = tokenizeFdf('0.002f 3e2 1.5E-1');
    expect(toks[0].num).toBe(0.002);
    expect(toks[1].num).toBe(300);
    expect(toks[2].num).toBeCloseTo(0.15);
    // 后缀 f 在 token 值中被消费掉。
    expect(toks.map((t) => t.value)).toEqual(['0.002', '3e2', '1.5E-1']);
  });
  it('丢弃行注释与块注释', () => {
    const toks = tokenizeFdf('// line\na /* block */ b');
    expect(toks.map((t) => t.value)).toEqual(['a', 'b']);
  });
});

describe('parseFdf — IncludeFile / StringList / 顶层', () => {
  it('收集 IncludeFile 路径', () => {
    const f = parseFdf('IncludeFile "UI\\FrameDef\\GlobalStrings.fdf",');
    expect(f.includes).toEqual(['UI\\FrameDef\\GlobalStrings.fdf']);
  });
  it('解析 StringList 为 strings 表', () => {
    const f = parseFdf('StringList {\n  FOO "bar",\n  NUM "123",\n}\n');
    expect(f.strings.get('FOO')).toBe('bar');
    expect(f.strings.get('NUM')).toBe('123');
  });
  it('frames 收集顶层 Frame/Texture/Block', () => {
    const f = parseFdf('Frame "FRAME" "A" { }\nTexture "B" { }\nString "S" { }\nLayer "L" { }\n');
    expect(f.frames.map((x) => x.type)).toEqual(['FRAME', 'TEXTURE', 'STRING', 'LAYER']);
  });
});

describe('parseFdf — 逗号歧义（openwar3 核心规则）', () => {
  it('SetPoint 的逗号分隔参数与语句正确切分', () => {
    const f = parseFdf(
      'Frame "FRAME" "P" {\n' +
        '  SetPoint TOPLEFT, "Parent", BOTTOMLEFT, 0.1, 0.2,\n' +
        '  Width 0.5,\n' +
        '}',
    );
    const frame = f.frames[0];
    expect(frame.props.length).toBe(2);
    const sp = frame.props[0];
    expect(sp.key).toBe('SetPoint');
    expect(sp.args.map((a) => a.s)).toEqual(['TOPLEFT', 'Parent', 'BOTTOMLEFT', '0.1', '0.2']);
    // TOPLEFT/BOTTOMLEFT 是封闭裸词；"Parent" 是引号字符串；"Width" 触发下一条语句。
    expect(frame.props[1].key).toBe('Width');
    expect(frame.props[1].args[0].s).toBe('0.5');
  });
  it('裸词锚点参数内部不再被当作语句边界', () => {
    const f = parseFdf(
      'Frame "TEXT" "Lbl" { FrameFont "Fonts\\FrizQuadrata.ttf", 0.01125, JUSTIFYLEFT,\n' +
        '  Text "hello",\n' +
        '}',
    );
    const p = f.frames[0].props;
    const font = p[0];
    expect(font.key).toBe('FrameFont');
    // JUSTIFYLEFT 属于封闭集合 → 留在参数里；"Text" 才触发下一条语句。
    expect(font.args.map((a) => a.s)).toEqual(['Fonts\\FrizQuadrata.ttf', '0.01125', 'JUSTIFYLEFT']);
    expect(p[1].key).toBe('Text');
    expect(p[1].args[0].s).toBe('hello');
  });
});

describe('parseFdf — Frame 定义', () => {
  it('解析 Frame 类型/名字/INHERITS/WITHCHILDREN，类型大写', () => {
    const f = parseFdf('Frame "gluetextbutton" "CancelButton" INHERITS WITHCHILDREN "ButtonTemplate" {\n}\n');
    const fr = f.frames[0];
    expect(fr.type).toBe('GLUETEXTBUTTON');
    expect(fr.name).toBe('CancelButton');
    expect(fr.inherits).toBe('ButtonTemplate');
    expect(fr.withChildren).toBe(true);
  });
  it('匿名 Texture 块 name 为空', () => {
    const f = parseFdf('Texture { File "UI\\x.blp", }');
    expect(f.frames[0].type).toBe('TEXTURE');
    expect(f.frames[0].name).toBe('');
    expect(f.frames[0].props[0]).toMatchObject({ key: 'File', args: [{ s: 'UI\\x.blp', str: true }] });
  });
  it('嵌套 Frame 子块被解析进 children', () => {
    const f = parseFdf(
      'Frame "FRAME" "Parent" {\n' +
        '  Texture "child" { File "UI\\a.blp", }\n' +
        '  Frame "BACKDROP" "bd" { }\n' +
        '}',
    );
    const fr = f.frames[0];
    expect(fr.children.map((c) => c.type)).toEqual(['TEXTURE', 'BACKDROP']);
    expect(fr.children[0].name).toBe('child');
    expect(fr.children[1].name).toBe('bd');
  });
  it('参数中数字 n 与字符串 str 标记正确', () => {
    const f = parseFdf('Frame "FRAME" "X" { BackdropCornerSize 0.4, }');
    const arg = f.frames[0].props[0].args[0];
    expect(arg.str).toBe(false);
    expect(arg.n).toBeCloseTo(0.4);
  });
});

describe('parseFdf — 边界覆盖分支', () => {
  it('tokenize 数字起始的 数字/. /-x 形式（binary:60 各分支）', () => {
    expect(tokenizeFdf('3')[0].num).toBe(3);            // isNumStart(c)
    expect(tokenizeFdf('.5')[0].num).toBeCloseTo(0.5);   // c === '.'
    expect(tokenizeFdf('-0.5')[0].num).toBeCloseTo(-0.5); // '-' 后接数字
    expect(tokenizeFdf('-.25')[0].num).toBeCloseTo(-0.25); // '-' 后接 '.'
    expect(tokenizeFdf('+3')[0].kind).toBe('num');        // '+' 被跳过，'3' 仍成 num
  });
  it('Frame 无类型引号时类型置空（cond-expr:139 else）', () => {
    const f = parseFdf('Frame { }');
    expect(f.frames[0].type).toBe('');
    expect(f.frames[0].name).toBe('');
  });
  it('无尾随逗号且读到 EOF：readArgs 与 parseBody 均 break（lines 95/115）', () => {
    const f = parseFdf('Frame "FRAME" "A" { Width 0.5');
    const fr = f.frames[0];
    expect(fr.props[0].args[0].n).toBeCloseTo(0.5);
    expect(fr.props.length).toBe(1);
    // 无 body 的 Frame：parseBody 在非 { 处 return（line 111）
    const f2 = parseFdf('Frame "FRAME" "B"');
    expect(f2.frames[0].props.length).toBe(0);
    expect(f2.frames[0].children.length).toBe(0);
  });
  it('体游离逗号与游离数字 token（lines 117/129）', () => {
    const f = parseFdf('Frame "FRAME" "A" { , 0.5 Width 0.5, }');
    const fr = f.frames[0];
    expect(fr.props[0].key).toBe('Width');
    expect(fr.props[0].args[0].n).toBeCloseTo(0.5);
  });
  it('StringList 内游离逗号与非 id 键（lines 171/176）', () => {
    const f = parseFdf('StringList { , 123 "x", FOO "bar", }');
    expect(f.strings.get('FOO')).toBe('bar');
    expect(f.strings.size).toBe(1);
  });
  it('未知顶层 token 被跳过（line 182）', () => {
    const f = parseFdf('Something 123, Frame "FRAME" "A" { }');
    expect(f.frames.map((x) => x.name)).toEqual(['A']);
  });
  it('INHERITS 无 WITHCHILDREN 且无模板串（lines 147/148 假臂）', () => {
    const f = parseFdf('Frame "FRAME" "A" INHERITS { }');
    expect(f.frames[0].inherits).toBeNull();
    expect(f.frames[0].withChildren).toBe(false);
  });
  it('IncludeFile 无字符串（line 161 假臂）', () => {
    const f = parseFdf('IncludeFile, Frame "FRAME" "A" { }');
    expect(f.includes.length).toBe(0);
  });
  it('StringList 无 { 直接跳过（line 166 假臂）', () => {
    const f = parseFdf('StringList no-brace, Frame "FRAME" "A" { }');
    expect(f.strings.size).toBe(0);
  });
  it('StringList 项无参数，args.length 为 0（line 175 假臂）', () => {
    const f = parseFdf('StringList { FOO, BAR "x", }');
    expect(f.strings.has('FOO')).toBe(false);
    expect(f.strings.get('BAR')).toBe('x');
  });
  it('StringList 体到 EOF 无收尾 }（if(k) 假臂，line 170）', () => {
    const f = parseFdf('StringList { HELLO "你好"');
    expect(f.strings.get('HELLO')).toBe('你好');
  });
});