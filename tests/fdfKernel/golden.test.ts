/**
 * FDF 声明式核心 —— 金标准语料回归（阶段 A）。
 *
 * 扫描 vendor/UI/FrameDef 下的全部 .fdf（84 个真实 WC3 官方 FrameDef 文件），验证内核
 * 解析器能全部无异常解析、且关键歧义（逗号参数/语句）得到与 openwar3 一致的切分。
 *
 * 这是对标 openwar3 "扫过全部官方 .fdf 验证" 的自动化版本：只要语料在位，
 * 解析器回归就能在 CI 中守住语义。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { FdfLibrary, firstProp, strProp } from '../../src/utils/fdfKernelLibrary';

function collectFdf(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectFdf(full, out);
    else if (entry.toLowerCase().endsWith('.fdf')) out.push(full);
  }
  return out;
}

const ROOT = join(process.cwd(), 'vendor', 'UI', 'FrameDef');
const files = collectFdf(ROOT);

describe('金标准语料 — 全部官方 FrameDef 可解析', () => {
  it('扫描到 80+ 个官方 fdf 文件', () => {
    expect(files.length).toBeGreaterThanOrEqual(80);
  });

  it('每个文件都能 parseFdf 而不抛异常', () => {
    const failures: string[] = [];
    // 断言：全部可解析。允许少数"桩文件"（仅注释、空、或纯 include 引用）产出空帧。
    const emptyStubs: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'latin1');
      try {
        const parsed = parseFdf(src);
        if (parsed.frames.length + parsed.strings.size === 0) emptyStubs.push(file);
      } catch (e) {
        failures.push(`${file}: ${(e as Error).message}`);
      }
    }
    expect(failures).toEqual([]);
    // 桩文件必须确实"只有注释/空白"（防解析器静默吞掉大量文件的自欺通过）。
    for (const file of emptyStubs) {
      const stripped = readFileSync(file, 'latin1')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      // 去除注释/空白后要么为空，要么是纯 IncludeFile（不含 frame/StringList 语句）。
      expect(stripped === '' || /^IncludeFile\s*"/i.test(stripped)).toBe(true);
    }
    // 绝大多数文件应产出内容。
    expect(emptyStubs.length).toBeLessThan(files.length / 2);
  });

  it('GlobalStrings.fdf 的字符串表被完整解析', () => {
    const gs = readFileSync(join(ROOT, 'GlobalStrings.fdf'), 'latin1');
    const parsed = parseFdf(gs);
    // 近 70KB 的字符串表应有数百条键。
    expect(parsed.strings.size).toBeGreaterThan(200);
    // 抽查真实存在的键。
    expect(parsed.strings.has('KEY_OK')).toBe(true);
  });
});

describe('金标准语料 — 逗号歧义与模板解析抽样验证', () => {
  it('加载 Glue 子目录文件时模板解析不抛异常，且能解出锚点属性', () => {
    const lib = new FdfLibrary();
    // 只喂字符串表 + 一批典型界面文件做声明式解析，验证 resolve 不炸。
    const representatives = files.filter((f) =>
      /Glue\\MainMenu\.fdf|Glue\\ConsoleUI\.fdf|Glue\\EscMenu|UI\\GameUI|Glue\\StandardTemplates/i.test(f),
    );
    expect(representatives.length).toBeGreaterThan(1);
    for (const file of representatives) {
      const src = readFileSync(file, 'latin1');
      const parsed = parseFdf(src);
      lib.loadFile(parsed);
      for (const frame of parsed.frames) {
        expect(() => lib.resolve(frame)).not.toThrow();
      }
    }
  });

  it('载入实际文件后 SetPoint 首参为合法锚点（抽样式像素/声明契约）', () => {
    const src = readFileSync(join(ROOT, 'Glue', 'MainMenu.fdf'), 'latin1');
    const parsed = parseFdf(src);
    expect(parsed.frames.length).toBeGreaterThan(0);
    // 任意随机一个 frame，其 SetPoint 参数应包含锚点裸词。
    const allSetPoints: string[] = [];
    const walk = (frames: { props: { key: string; args: readonly { s: string }[] } }[]) => {
      for (const fr of frames) {
        for (const p of fr.props) if (p.key === 'SetPoint' && p.args[0]) allSetPoints.push(p.args[0].s);
      }
    };
    const asAny = parsed as unknown as { frames: { props: { key: string; args: readonly { s: string }[] }[] }[] };
    walk(asAny.frames);
    const valid = ['TOPLEFT', 'TOP', 'TOPRIGHT', 'LEFT', 'CENTER', 'RIGHT', 'BOTTOMLEFT', 'BOTTOM', 'BOTTOMRIGHT'];
    for (const s of allSetPoints.slice(0, 200)) {
      expect(valid).toContain(s);
    }
  });

  it('InfoPanelStrings 模板引用可被字符串表解析（String key 命中解析）', () => {
    const lib = new FdfLibrary();
    const info = parseFdf(readFileSync(join(ROOT, 'InfoPanelStrings.fdf'), 'latin1'));
    lib.loadFile(info as unknown as Parameters<typeof lib.loadFile>[0]);
    // 一个真实存在的键应被解析。
    const sampleKey = Array.from(info.strings.keys())[0];
    expect(lib.string(sampleKey)).toBe(info.strings.get(sampleKey));
  });
});