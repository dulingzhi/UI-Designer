import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { fileToFrameData, projectFrame, transformKernelFrames } from '../../src/utils/fdfKernelTransformer';

function readVendor(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'vendor', 'UI', 'FrameDef', rel), 'latin1');
}

describe('fdfKernelTransformer: FrameData 结构契约（对标旧 transformer）', () => {
  it('EscMenuMainPanel：顶层 SetAllPoints → 画布绝对锚点', () => {
    const file = parseFdf(readVendor('UI/EscMenuMainPanel.fdf'));
    const frames = fileToFrameData(file);
    expect(frames.length).toBeGreaterThan(0);
    const main = frames.find((f) => f.name === 'EscMenuMainPanel')!;
    expect(main).toBeDefined();
    expect(main.anchors.length).toBe(2);
    const tl = main.anchors.find((a) => a.point === 0)!; // TOPLEFT
    const br = main.anchors.find((a) => a.point === 8)!; // BOTTOMRIGHT
    expect(tl.relativeTo).toBeUndefined();
    expect(br.relativeTo).toBeUndefined();
    // 顶层画布绝对坐标
    expect(tl.x).toBe(0);
    expect(tl.y).toBe(0.6);
    expect(br.x).toBe(0.8);
    expect(br.y).toBe(0);
  });

  it('EscMenuMainPanel：内含相对画布坐标，且 HelpButton Width 为相对单位（非像素）', () => {
    const frames = fileToFrameData(parseFdf(readVendor('UI/EscMenuMainPanel.fdf')));
    const helpButton = frames.find((f) => f.name === 'HelpButton')!;
    expect(helpButton).toBeDefined();
    expect(helpButton.width).toBe(0.11);
    expect(helpButton.width).toBeLessThan(1); // 确保不是像素值
  });

  it('嵌套 SetAllPoints 应生成 (0,8) 双锚点且 relativeTo = 父元素 ID', () => {
    const file = parseFdf(
      [
        'Frame "FRAME" "Root" {',
        '  Frame "FRAME" "Child" { SetAllPoints, }',
        '}',
      ].join('\n')
    );
    const frames = fileToFrameData(file);
    const child = frames.find((f) => f.name === 'Child')!;
    const parent = frames.find((f) => f.name === 'Root')!;
    expect(child.fdfMetadata?.setAllPoints).toBe(true);
    expect(child.anchors.length).toBe(2);
    const tl = child.anchors.find((a) => a.point === 0)!;
    const br = child.anchors.find((a) => a.point === 8)!;
    expect(tl.relativeTo).toBe(parent.id);
    expect(br.relativeTo).toBe(parent.id);
    expect(tl.relativePoint).toBe(0);
    expect(br.relativePoint).toBe(8);
    expect(tl.x).toBe(0);
    expect(tl.y).toBe(0);
    expect(br.x).toBe(0);
    expect(br.y).toBe(0);
  });

  it('relativeTo 应从名称解析为 Frame ID', () => {
    const frames = fileToFrameData(parseFdf(readVendor('UI/EscMenuMainPanel.fdf')));
    const pause = frames.find((f) => f.name === 'PauseButton')!;
    const main = frames.find((f) => f.name === 'EscMenuMainPanel')!;
    expect(pause).toBeDefined();
    const topAnchor = pause.anchors.find((a) => a.point === 1); // TOP
    expect(topAnchor).toBeDefined();
    expect(topAnchor!.relativeTo).toBe(main.id); // 应解析为 ID
  });

  it('projectFrame：同类帧投影稳定（type/name/anchors 结构可对比）', () => {
    const frames = fileToFrameData(parseFdf(readVendor('UI/EscMenuMainPanel.fdf')));
    const main = frames.find((f) => f.name === 'EscMenuMainPanel')!;
    const proj = projectFrame(main);
    expect(proj.name).toBe('EscMenuMainPanel');
    expect(proj.type).toBe(proj.type);
    expect(proj.anchors.length).toBe(2);
    expect(proj.setAllPoints).toBe(true);
  });

  it('未命名/匿名 Texture 不作为 FrameData（与渲染器结构契约一致）', () => {
    const file = parseFdf('Frame "BACKDROP" "Bd" { Texture { File "a.blp", } Frame "TEXT" "T" {} }');
    const frames = fileToFrameData(file);
    const bd = frames.find((f) => f.name === 'Bd')!;
    // TEXTURE 特殊块不进入 FrameData 子节点，只有 TEXT
    const childNames = bd.children.map((id) => frames.find((f) => f.id === id)?.name);
    expect(childNames).toEqual(['T']);
  });

  it('顶层 CENTER 锚点 relativeTo=__PARENT__ → 画布中心绝对坐标 (0.4, 0.3)', () => {
    const file = parseFdf(['Frame "FRAME" "C" { SetPoint CENTER, "__PARENT__", CENTER, 0, 0, }'].join('\n'));
    const frames = fileToFrameData(file);
    const c = frames.find((f) => f.name === 'C')!;
    expect(c).toBeDefined();
    expect(c.anchors.length).toBe(1);
    const center = c.anchors[0];
    expect(center.point).toBe(4); // CENTER
    expect(center.relativeTo).toBeUndefined(); // __PARENT__ 已替换为画布绝对坐标
    expect(center.x).toBe(0.4);
    expect(center.y).toBe(0.3);
  });

  it('SetPoint 缺相对名（curtailed）→ 相对名缺省 __PARENT__/自身点、缺坐标回落 0', () => {
    // 无相对名字符串、无坐标的 SetPoint：相对名装饰与坐标都走缺省路径。
    const file = parseFdf(['Frame "FRAME" "Root" {', '  Frame "FRAME" "Child" { SetPoint CENTER, }', '}'].join('\n'));
    const frames = fileToFrameData(file);
    const child = frames.find((f) => f.name === 'Child')!;
    expect(child).toBeDefined();
    expect(child.anchors.length).toBe(1);
    const a = child.anchors[0];
    expect(a.point).toBe(4);
    expect(a.relativeTo).toBe(child.parentId); // rel 为 null → __PARENT__ → 父 ID
    expect(a.relativePoint).toBe(4); // rel 为 null → relPoint 回落 myPoint
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
  });

  it('SetPoint 缺坐标对 → 相对名存在但 dx/dy 回落 0', () => {
    const file = parseFdf(
      ['Frame "FRAME" "Root" {', '  Frame "FRAME" "Child" { SetPoint TOP, "Root", TOP, }', '}'].join('\n')
    );
    const frames = fileToFrameData(file);
    const child = frames.find((f) => f.name === 'Child')!;
    const a = child.anchors[0];
    expect(a.relativePoint).toBe(1); // TOP
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
  });

  it('Anchor 缺数值坐标（空字符串参数）→ x/y 回落 0（嵌套避免顶层画布绝对化）', () => {
    const file = parseFdf(
      ['Frame "FRAME" "Root" {', '  Frame "FRAME" "A" { Anchor CENTER, "", "", }', '}'].join('\n')
    );
    const frames = fileToFrameData(file);
    const a = frames.find((f) => f.name === 'A')!.anchors[0];
    expect(a.point).toBe(4);
    expect(a.x).toBe(0);
    expect(a.y).toBe(0);
  });

  it('匿名子帧：name 回落空串（f.name||\'\'）且不登记名称映射', () => {
    const file = parseFdf(
      ['Frame "FRAME" "Root" {', '  Frame "FRAME" { Width 0.1, Height 0.1 }', '  Frame "TEXT" "T" { Text "hi", }', '}'].join('\n')
    );
    const frames = fileToFrameData(file);
    // 匿名子帧 NAME=''
    const anon = frames.find((f) => f.parentId === frames.find((r) => r.name === 'Root')!.id && f.name === '');
    expect(anon).toBeDefined();
    // TEXT 子帧 height 走 TEXT_FRAME 特殊化
    const t = frames.find((f) => f.name === 'T')!;
    expect(t).toBeDefined();
    expect(t.type).toBe(4); // TEXT_FRAME
    expect(t.height).toBe(0.012);
  });

  it('匿名父控件上的子 SetPoint：relativeTo 回落 parent.id', () => {
    const file = parseFdf(
      ['Frame "FRAME" "Root" {', '  Frame "FRAME" { Frame "FRAME" "Leaf" { SetPoint CENTER, } }', '}'].join('\n')
    );
    const frames = fileToFrameData(file);
    const leaf = frames.find((f) => f.name === 'Leaf')!;
    const anonParent = frames.find((f) => f.id === leaf.parentId)!;
    expect(anonParent.name).toBe('');
    expect(leaf.anchors[0].relativeTo).toBe(anonParent.id);
  });

  it('顶层非 0/8/4 点锚点：绝对化 on 0/8/4 全不命中仍保持 __PARENT__ 删除语义', () => {
    const file = parseFdf(['Frame "FRAME" "T" { SetPoint TOP, "__PARENT__", TOP, 0.1, 0.2, }'].join('\n'));
    const frames = fileToFrameData(file);
    const t = frames.find((f) => f.name === 'T')!.anchors[0];
    expect(t.point).toBe(1); // TOP
    expect(t.relativeTo).toBeUndefined(); // __PARENT__ 已删（画布绝对化路径）
    expect(t.x).toBe(0.1);
    expect(t.y).toBe(0.2);
  });

  it('容错：字符串数值宽度/高度走 parseFloat 数值化', () => {
    const file = parseFdf(['Frame "FRAME" "R" { Width "0.5", Height "0.25", }'].join('\n'));
    const frames = fileToFrameData(file);
    const r = frames.find((f) => f.name === 'R')!;
    expect(r.width).toBe(0.5);
    expect(r.height).toBe(0.25);
  });

  it('容错：空串宽度/高度回落默认值', () => {
    const file = parseFdf(['Frame "FRAME" "R" { Width "", Height "", }'].join('\n'));
    const frames = fileToFrameData(file);
    const r = frames.find((f) => f.name === 'R')!;
    // 无锚点 → 默认 TOPLEFT + 0.4 尺寸覆盖（方案 2：与内核"钉父 top-left"统一）
    expect(r.width).toBe(0.4);
    expect(r.height).toBe(0.4);
  });

  it('无锚点帧 → 默认 TOPLEFT@父（与内核 layout 的钉父 top-left 一致）', () => {
    const file = parseFdf(['Frame "FRAME" "Root" {', '  Frame "FRAME" "NoAnchor" { }', '}'].join('\n'));
    const frames = fileToFrameData(file);
    const na = frames.find((f) => f.name === 'NoAnchor')!;
    expect(na.anchors.length).toBe(1);
    expect(na.anchors[0].point).toBe(0); // TOPLEFT
    expect(na.anchors[0].relativePoint).toBe(0); // TOPLEFT
    expect(na.anchors[0].x).toBe(0);
    expect(na.anchors[0].y).toBe(0);
  });

  it('容错：缺失/非法点名的 SetPoint 回落 TOPLEFT 原点', () => {
    const file = parseFdf(['Frame "FRAME" "R" { SetPoint , }'].join('\n'));
    const frames = fileToFrameData(file);
    const r = frames.find((f) => f.name === 'R')!;
    expect(r.anchors[0].point).toBe(0); // mapFramePoint('') → 0
  });

  it('容错：模板晚于继承者定义 → 继承子名回落原名（nameToId 尚未登记）', () => {
    const file = parseFdf(
      ['Frame "FRAME" "Inheritor" INHERITS WITHCHILDREN "Tpl" { }', 'Frame "FRAME" "Tpl" { Frame "FRAME" "Leaf" {} }'].join('\n')
    );
    const frames = fileToFrameData(file);
    const inh = frames.find((f) => f.name === 'Inheritor')!;
    // 模板在其后定义：转换 Inheritor 时 Leaf 尚未写入 nameToId → 回落原始名字
    expect(inh.fdfMetadata?.inheritedChildrenIds).toEqual(['Leaf']);
  });
});

describe('fdfKernelTransformer: 84 官方语料结构扫描（不抛错 + 顶层非空）', () => {
  const root = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.fdf')) files.push(p);
    }
  };
  walk(root);

  it(`全语料可经内核 parser → transformer，顶层帧数与直接 parser 一致`, () => {
    let checked = 0;
    for (const f of files) {
      const src = fs.readFileSync(f, 'latin1');
      const file = parseFdf(src);
      if (file.frames.length === 0) continue;
      const frames = fileToFrameData(file);
      const topLevel = frames.filter((fd) => fd.parentId === null).length;
      expect(topLevel).toBe(file.frames.length);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('每个顶层 Frame 都有稳定投影（id 归一化后可 round-trip 名称集一致）', () => {
    let checked = 0;
    for (const f of files) {
      const file = parseFdf(fs.readFileSync(f, 'latin1'));
      if (file.frames.length === 0) continue;
      const frames = transformKernelFrames(file.frames);
      const names = frames.filter((fd) => fd.parentId === null).map((fd) => fd.name).sort();
      const kernelNames = file.frames.map((kf) => kf.name).sort();
      // 顶层 name 集合一致（大小写严格）
      expect(names).toEqual(kernelNames);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });
});