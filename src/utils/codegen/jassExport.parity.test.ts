/**
 * JASS/LUA 代码导出 —— 产物合法性回归守卫。
 *
 * 背景：既有 `codeExport.test.ts` 只用 `toContain('子串')` 断言，**从未验证产物是否是合法
 * JASS**，因此下述 9 个缺陷长期漏网（均经探针实测确认）：
 *   P0 编译失败：① 锚点 relativeTo 输出 frame id（JASS 无此变量）
 *                ② 文本未转义双引号（字符串被截断） ③ 纹理反斜杠未转义
 *   P1 语法错误：④ 帧名含空格/连字符 ⑤ 帧名数字开头 ⑥ 重复帧名重复声明 ⑦ libraryName 未净化
 *   P2 语义/崩溃：⑧ 子帧先于父帧创建（父仍 null） ⑨ parentId 悬空直接抛异常
 *
 * 本文件按缺陷逐条锁死；修复后若回归即红。
 */
import { describe, it, expect } from 'vitest';
import { FrameType, FramePoint, type FrameData, type ProjectData } from '../../../src/types';
import { generateJASSCode, generateLUACode } from '../../../src/utils/codeExport';

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

/** 轻量 JASS 语法体检：引号成对、括号成对、无裸 id 残留。 */
function assertLexicallySane(code: string): void {
  // 引号必须成对（JASS 用 "" 表示字面引号，故成对计数仍成立）
  const quotes = (code.match(/"/g) ?? []).length;
  expect(quotes % 2, `引号数量应为偶数，实际 ${quotes}`).toBe(0);
  // 括号成对
  const opens = (code.match(/\(/g) ?? []).length;
  const closes = (code.match(/\)/g) ?? []).length;
  expect(opens, '圆括号应成对').toBe(closes);
}

describe('P0-① 锚点 relativeTo 必须输出为 JASS 变量名，而非 frame id', () => {
  it('相对锚点引用父帧时使用变量名', () => {
    const parent = mkFrame({ id: 'p1', name: 'ParentFrame' });
    const child = mkFrame({
      id: 'c1', name: 'ChildFrame', parentId: 'p1',
      anchors: [{ point: FramePoint.TOPLEFT, x: 0.1, y: 0.2, relativeTo: 'p1', relativePoint: FramePoint.BOTTOMLEFT }],
    });
    const code = generateJASSCode(mkProject([parent, child]));
    const setPoint = code.split('\n').find((l) => l.includes('FrameSetPoint') && !l.includes('AbsPoint'));
    expect(setPoint).toBeDefined();
    // 第三个参数必须是变量名 ParentFrame，绝不能是 id 'p1'
    expect(setPoint!).toContain('ParentFrame');
    expect(setPoint!).not.toMatch(/,\s*p1\s*,/);
    assertLexicallySane(code);
  });

  it('LUA 路径同样不得泄露 frame id', () => {
    const parent = mkFrame({ id: 'p1', name: 'ParentFrame' });
    const child = mkFrame({
      id: 'c1', name: 'ChildFrame', parentId: 'p1',
      anchors: [{ point: FramePoint.TOPLEFT, x: 0.1, y: 0.2, relativeTo: 'p1', relativePoint: FramePoint.BOTTOMLEFT }],
    });
    const code = generateLUACode(mkProject([parent, child]));
    const setPoint = code.split('\n').find((l) => l.includes('FrameSetPoint'));
    expect(setPoint!).toContain('ParentFrame');
    expect(setPoint!).not.toMatch(/,\s*p1\s*,/);
  });
});

describe('P0-② 文本必须转义双引号', () => {
  it('含引号的文本不会截断字符串', () => {
    const t = mkFrame({ id: 't1', name: 'T1', type: FrameType.TEXT_FRAME, text: 'a"b', textColor: '#FF0000' });
    const code = generateJASSCode(mkProject([t]));
    assertLexicallySane(code);
    const line = code.split('\n').find((l) => l.includes('FrameSetText'));
    expect(line).toBeDefined();
    // JASS 中字面引号写作 ""，故应为 a""b
    expect(line!).toContain('a""b');
  });
});

describe('P0-③ 纹理路径反斜杠必须转义', () => {
  it('backdrop 纹理路径中的 \\ 被转义为 \\\\', () => {
    const bd = mkFrame({ id: 'b1', name: 'B1', type: FrameType.BACKDROP, texture: 'UI\\Widgets\\a.blp' });
    const code = generateJASSCode(mkProject([bd]));
    assertLexicallySane(code);
    const line = code.split('\n').find((l) => l.includes('FrameSetTexture'));
    expect(line).toBeDefined();
    expect(line!).toContain('UI\\\\Widgets\\\\a.blp');
  });
});

describe('P1-④/⑤ 帧名必须净化为合法 JASS 标识符', () => {
  it('含空格与连字符的帧名被净化', () => {
    const f = mkFrame({ id: 'x1', name: 'My Frame-01' });
    const code = generateJASSCode(mkProject([f]));
    const decl = code.split('\n').find((l) => l.includes('framehandle'));
    expect(decl).toBeDefined();
    expect(decl!).not.toContain('My Frame-01');
    // 结晶化后的名字仍应可认出（保留可读性）
    expect(decl!).toMatch(/framehandle\s+[A-Za-z_][A-Za-z0-9_]*\s*=/);
  });

  it('数字开头的帧名被净化', () => {
    const f = mkFrame({ id: 'n1', name: '123Frame' });
    const code = generateJASSCode(mkProject([f]));
    const decl = code.split('\n').find((l) => l.includes('framehandle'));
    expect(decl!).toMatch(/framehandle\s+[A-Za-z_][A-Za-z0-9_]*\s*=/);
  });
});

describe('P1-⑥ 重复帧名不得重复声明', () => {
  it('同名帧只声明一次', () => {
    const a = mkFrame({ id: 'd1', name: 'Dup' });
    const b = mkFrame({ id: 'd2', name: 'Dup' });
    const code = generateJASSCode(mkProject([a, b]));
    const decls = code.split('\n').filter((l) => /framehandle\s+Dup\s*=/.test(l));
    expect(decls.length).toBeLessThanOrEqual(1);
  });
});

describe('P1-⑦ libraryName 必须净化', () => {
  it('含空格/数字的 library 名被净化', () => {
    const f = mkFrame({ id: 'f1', name: 'F1' });
    const code = generateJASSCode(mkProject([f], { libraryName: 'My Lib 2' }));
    const line = code.split('\n').find((l) => l.includes('library '));
    expect(line!).toMatch(/library\s+[A-Za-z_][A-Za-z0-9_]*\s+initializer/);
  });
});

describe('P2-⑧ 父帧必须先于子帧创建', () => {
  it('即使 frames 记录里子帧在前，产物仍父先子后', () => {
    const parent = mkFrame({ id: 'P', name: 'Parent' });
    const child = mkFrame({ id: 'C', name: 'Child', parentId: 'P' });
    const p = {
      frames: { C: child, P: parent }, rootFrameIds: ['P'],
      id: 'p', name: 'p', libraryName: 'Lib',
    } as unknown as ProjectData;
    const code = generateJASSCode(p);
    const lines = code.split('\n');
    const ci = lines.findIndex((l) => l.includes('set Child ='));
    const pi = lines.findIndex((l) => l.includes('set Parent ='));
    expect(pi).toBeGreaterThanOrEqual(0);
    expect(ci).toBeGreaterThanOrEqual(0);
    expect(pi).toBeLessThan(ci);
  });
});

describe('P2-⑨ parentId 悬空不得崩溃', () => {
  it('指向不存在父帧时降级为绝对锚点而非抛异常', () => {
    const c = mkFrame({ id: 'orphan', name: 'Orphan', parentId: 'missing-parent' });
    expect(() => generateJASSCode(mkProject([c]))).not.toThrow();
    const code = generateJASSCode(mkProject([c]));
    // 降级：父为 origin frame，且锚点走 Abs（不引用不存在的变量）
    const setPoint = code.split('\n').filter((l) => l.includes('FrameSetPoint'));
    expect(setPoint.every((l) => !l.includes('missing-parent'))).toBe(true);
  });
});

describe('数组帧（Name[00]/[01]…）共用同一个数组变量', () => {
  it('多个数组元素只声明一次，且为 array 声明', () => {
    const a = mkFrame({ id: 'a0', name: 'Gem[00]' });
    const b = mkFrame({ id: 'a1', name: 'Gem[01]' });
    const code = generateJASSCode(mkProject([a, b]));
    const decls = code.split('\n').filter((l) => /framehandle/i.test(l) && l.includes('Gem'));
    expect(decls.length).toBe(1);
    expect(decls[0]).toContain('array');
  });

  it('数组基名中的数字前缀也被净化', () => {
    const a = mkFrame({ id: 'n0', name: '1 Gem[00]' });
    const code = generateJASSCode(mkProject([a]));
    const decl = code.split('\n').find((l) => l.includes('framehandle'));
    expect(decl!).toMatch(/framehandle\s+array\s+[A-Za-z_][A-Za-z0-9_]*/);
  });

  it('LUA 侧数组帧同样只声明一次且为表', () => {
    const a = mkFrame({ id: 'a0', name: 'Gem[00]' });
    const b = mkFrame({ id: 'a1', name: 'Gem[01]' });
    const code = generateLUACode(mkProject([a, b]));
    const decls = code.split('\n').filter((l) => l.trim() === 'Gem = {}');
    expect(decls.length).toBe(1);
    expect(decls[0]).toContain('{}');
  });

  it('空名帧仍能生成合法变量名', () => {
    const f = mkFrame({ id: 'e1', name: '' });
    const code = generateJASSCode(mkProject([f]));
    const decl = code.split('\n').find((l) => l.includes('framehandle'));
    expect(decl!).toMatch(/framehandle\s+[A-Za-z_][A-Za-z0-9_]*\s*=/);
  });
  it('空名数组帧（name 为空）覆盖 name ?? 的 null 侧', () => {
    const f = mkFrame({ id: 'z1', name: '' });
    const g = mkFrame({ id: 'z2', name: 'X[00]' });
    const code = generateJASSCode(mkProject([f, g]));
    expect(code).toContain('framehandle');
  });

  it('name 为 null 的非数组帧覆盖 f.name ?? 的 null 侧', () => {
    const f = mkFrame({ id: 'q1', name: null as unknown as string });
    const code = generateJASSCode(mkProject([f]));
    expect(code).toContain('framehandle');
  });

  it('非法 FramePoint 回落 FRAMEPOINT_BOTTOMLEFT', () => {
    const p = mkFrame({ id: 'p9', name: 'P9' });
    const c = mkFrame({ id: 'c9', name: 'C9', parentId: 'p9',
      anchors: [{ point: 99 as unknown as FramePoint, x: 0, y: 0, relativeTo: 'p9', relativePoint: 88 as unknown as FramePoint }] });
    const code = generateJASSCode(mkProject([p, c]));
    expect(code).toContain('FRAMEPOINT_BOTTOMLEFT');
  });
});
