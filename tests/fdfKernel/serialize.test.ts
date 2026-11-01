/**
 * FDF 声明式核心 —— 序列化往返保真（阶段 B）。
 *
 * 在**真实 vendor 语料**上验证 parse → serialize → parse 的结构稳定性。
 * 关键不变量：
 *  1. 序列化输出可再次 parse 且不再异常。
 *  2. idempotence（不动点）：`serialize(parse(serialize(parse(X)))) === serialize(parse(X))`
 *     —— 经过一次规范化后即稳定，编辑器反复读写不会漂移。
 *  3. 语义等价：parse(serialize(parse(X))) 的 frames/strings/includes 数量与
 *     parse(X) 一致；每个 frame 的 props/children 能按序保真（结构 + 枚举标记）。
 *  4. 字符串转义（含 `\\`、`\"`）往返无损。
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { serializeFdf, serializeFrame } from '../../src/utils/fdfKernelSerializer';

const ROOT = join(process.cwd(), 'vendor', 'UI', 'FrameDef');
function collectFdf(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    const s = statSync(f);
    if (s.isDirectory()) collectFdf(f, acc);
    else if (e.toLowerCase().endsWith('.fdf')) acc.push(f);
  }
  return acc;
}
const files = collectFdf(ROOT);

/** 去掉仅注释/空白/IncludeFile 的桩文件，只对含内容者做严肃往返。 */
function hasContent(src: string): boolean {
  return parseFdf(src).frames.length + parseFdf(src).strings.size > 0;
}

describe('序列化往返保真', () => {
  it('所有含内容的 vendor 文件：serialize 输出可再次 parse 且不抛异常', () => {
    const failures: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'latin1');
      if (!hasContent(src)) continue;
      const a = parseFdf(src);
      const text = serializeFdf(a);
      expect((): void => { parseFdf(text); }).not.toThrow(file);
      failures.length; // no-op
    }
    expect(failures).toEqual([]);
  });

  it('idempotence（不动点）：一次规范化后即稳定', () => {
    const checked: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'latin1');
      if (!hasContent(src)) continue;
      const once = serializeFdf(parseFdf(src));
      const twice = serializeFdf(parseFdf(once));
      expect(twice).toBe(once);
      checked.push(file);
    }
    expect(checked.length).toBeGreaterThanOrEqual(50);
  });

  it('frames/strings/includes 数量在往返后一致', () => {
    for (const file of files) {
      const src = readFileSync(file, 'latin1');
      if (!hasContent(src)) continue;
      const a = parseFdf(src);
      const b = parseFdf(serializeFdf(a));
      expect(b.frames.length).toBe(a.frames.length);
      expect(b.strings.size).toBe(a.strings.size);
      expect(b.includes.length).toBe(a.includes.length);
    }
  });

  it('每个 frame 的 props 能按序保真（key + 参数 + 枚举标记）', () => {
    const visit = (f: any, visitable: (f: any) => void): void => {
      visitable(f);
      for (const c of f.children) visit(c, visitable);
    };
    const filesChecked: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'latin1');
      if (!hasContent(src)) continue;
      const a = parseFdf(src);
      const b = parseFdf(serializeFdf(a));
      const flatEq = (fa: any, fb: any): boolean => {
        if (fa.type !== fb.type) return false;
        if (fa.name !== fb.name) return false;
        if (fa.inherits !== fb.inherits) return false;
        if (fa.withChildren !== fb.withChildren) return false;
        if (fa.children.length !== fb.children.length) return false;
        if (fa.props.length !== fb.props.length) return false;
        for (let i = 0; i < fa.props.length; i++) {
          const pa = fa.props[i], pb = fb.props[i];
          if (pa.key !== pb.key) return false;
          if (pa.args.length !== pb.args.length) return false;
          for (let j = 0; j < pa.args.length; j++) {
            const aa = pa.args[j], ab = pb.args[j];
            if (aa.s !== ab.s || aa.str !== ab.str || aa.n !== ab.n) return false;
          }
        }
        for (let k = 0; k < fa.children.length; k++) if (!flatEq(fa.children[k], fb.children[k])) return false;
        return true;
      };
      const sameCount = a.frames.length === b.frames.length && a.strings.size === b.strings.size;
      let allEq = sameCount;
      for (let i = 0; i < Math.min(a.frames.length, b.frames.length); i++) if (!flatEq(a.frames[i], b.frames[i])) allEq = false;
      // 字符串表逐键比。
      if (allEq) {
        for (const [k, v] of a.strings) if (b.strings.get(k) !== v) allEq = false;
      }
      expect({ file, allEq }).toEqual({ file, allEq: true });
      filesChecked.push(file);
    }
    expect(filesChecked.length).toBeGreaterThanOrEqual(50);
  });

  it('反斜杠路径字符串与字符串表往返无损', () => {
    const src = [
      'IncludeFile "Glue\\Common\\SimpleFrames.fdf",',
      'StringList {',
      '  FRAME_FILE "UI\\Widgets\\Frames\\UI-Frame-Basics.blp",',
      '}',
      'Frame "BACKDROP" "Bd" { BackdropBackground "UI\\Widgets\\Glues\\x.blp", }',
    ].join('\n');
    const a = parseFdf(src);
    const text = serializeFdf(a);
    const b = parseFdf(text);
    // 语料中 0 例字面双引号；反斜杠按字面保留、往返无损（真实 FDF 约定）。
    expect(b.strings.get('FRAME_FILE')).toBe('UI\\Widgets\\Frames\\UI-Frame-Basics.blp');
    expect(b.frames[0].props[0].args[0].s).toBe('UI\\Widgets\\Glues\\x.blp');
    expect(b.includes).toEqual(['Glue\\Common\\SimpleFrames.fdf']);
  });

  it('匿名 Texture/String/Layer 与命名变体往返保留 name/type', () => {
    const root = parseFdf(
      'Frame "FRAME" "Root" { Frame "BACKDROP" "Bd" { BackdropBackground "path.blp", Texture { File "a.blp", } } Frame "TEXT" "T" {} Frame "LAYER" "" {} String "S" { Text "x", } }',
    ).frames[0];
    const text = serializeFrame(root);
    const back = parseFdf(text).frames[0];
    const bd = back.children.find((c: any) => c.name === 'Bd')!;
    const lay = back.children.find((c: any) => c.type === 'LAYER')!;
    expect(bd.children[0].type).toBe('TEXTURE');
    expect(bd.children[0].name).toBe('');
    expect(bd.children[0].props[0].key).toBe('File');
    expect(bd.children[0].props[0].args[0].s).toBe('a.blp');
    expect(lay.type).toBe('LAYER');
    expect(lay.name).toBe('');
  });

  it('INHERITS WITHCHILDREN 往返保留标记', () => {
    const root = parseFdf(
      'Frame "BACKDROP" "Btn" INHERITS WITHCHILDREN "Tpl" { BackdropBackground "x.blp", }',
    ).frames[0];
    expect(root.inherits).toBe('Tpl');
    expect(root.withChildren).toBe(true);
    const text = serializeFrame(root);
    const back = parseFdf(text).frames[0];
    expect(back.inherits).toBe('Tpl');
    expect(back.withChildren).toBe(true);
    expect(text).toContain('INHERITS WITHCHILDREN "Tpl"');
  });
});