/**
 * fdfKernelScene 桥的验证 —— root 锚点定位 + 内核 layout 解子树 → FrameData 几何。
 *
 * 验证点：
 *  a) 坐标约定：WC3_MAX_X/WC3_MAX_Y == 内核 UI_WIDTH/UI_HEIGHT == 0.8/0.6。
 *  b) root box 解析：无锚点 root 居中画布；CENTER 锚点 root 的 box 由中心反推左下角。
 *  c) 冒烟（UpperButtonBar.fdf）：顶层 root 居中、子按钮继承 Width/Height 且沿 SetPoint
 *     链左排、坐标非编辑器默认。
 *  d) 最小 FDF → 居中 root。
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { WC3_MAX_X, WC3_MAX_Y } from '../../src/constants';
import { UI_WIDTH, UI_HEIGHT } from '../../src/utils/fdfKernelLayout';
import {
  buildKernelLayoutFrameData,
  fileToFrameData,
  resolveRootBox,
} from '../../src/utils/fdfKernelScene';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { parseFDF } from '../../src/utils/fdf';

const VENDOR = path.join(process.cwd(), 'vendor', 'UI', 'FrameDef');

describe('fdfKernelScene root 锚点定位 + 内核 layout 解子树', () => {
  it('a) 坐标约定：WC3_MAX_X/Y == 内核 UI_WIDTH/HEIGHT == 0.8/0.6', () => {
    expect([WC3_MAX_X, WC3_MAX_Y]).toEqual([0.8, 0.6]);
    expect([UI_WIDTH, UI_HEIGHT]).toEqual([0.8, 0.6]);
    expect(WC3_MAX_X).toBe(UI_WIDTH);
    expect(WC3_MAX_Y).toBe(UI_HEIGHT);
  });

  it('b) resolveRootBox：无锚点 root 居中画布', () => {
    const src = fs.readFileSync(path.join(VENDOR, 'UI', 'UpperButtonBar.fdf'), 'latin1');
    const file = parseFdf(src);
    const root = file.frames.find((f) => f.name === 'UpperButtonBarFrame')!;
    expect(root).toBeTruthy();
    const box = resolveRootBox(root);
    // W 0.34,H 0.022 → 居中
    expect(box.w).toBeCloseTo(0.34, 6);
    expect(box.h).toBeCloseTo(0.022, 6);
    expect(box.x).toBeCloseTo((0.8 - 0.34) / 2, 6);
    expect(box.y).toBeCloseTo((0.6 - 0.022) / 2, 6);
  });

  it('b2) resolveRootBox：无偏移 root → 左下角由中心反推', () => {
    const src = 'Frame "FRAME" "MainPanel" {\n' +
      '  Width 0.2,\n  Height 0.1,\n' +
      '}\n';
    const file = parseFdf(src);
    const root = file.frames[0];
    // 无锚点 → 居中：left=(0.8-0.2)/2=0.3, bottom=(0.6-0.1)/2=0.25
    const box = resolveRootBox(root);
    expect(box.x).toBeCloseTo(0.3, 6);
    expect(box.y).toBeCloseTo(0.25, 6);
    expect(box.w).toBeCloseTo(0.2, 6);
    expect(box.h).toBeCloseTo(0.1, 6);
  });

  it('c) 冒烟（UpperButtonBar.fdf）：root 居中、子按钮继承尺寸且左排', () => {
    const frames = buildKernelLayoutFrameData(
      fs.readFileSync(path.join(VENDOR, 'UI', 'UpperButtonBar.fdf'), 'latin1'),
    );
    const roots = frames.filter((f) => f.parentId === null);
    expect(roots.some((r) => r.name === 'UpperButtonBarFrame')).toBe(true);
    const root = roots.find((r) => r.name === 'UpperButtonBarFrame')!;
    // root 居中（非编辑器默认 0/0）
    expect(root.x).toBeCloseTo(0.23, 6);
    expect(root.y).toBeCloseTo(0.289, 6);
    expect(root.width).toBeCloseTo(0.34, 6);
    expect(root.height).toBeCloseTo(0.022, 6);

    // 结构：按钮子帧继承 0.085/0.022，且已几何求值
    const quest = frames.find((f) => f.name === 'UpperButtonBarQuestsButton')!;
    expect(quest.parentId).toBe(root.id);
    expect(quest.width).toBeCloseTo(0.085, 6);
    expect(quest.height).toBeCloseTo(0.022, 6);
    // TOPLEFT+0.002 贴 root 左上内部 → 按钮在 root 内、x>=root.x
    expect(quest.x).toBeGreaterThanOrEqual(root.x - 1e-9);
    expect(quest.y).toBeGreaterThan(0);
  });

  it('d) fileToFrameData：O型最小 FDF 产出 1 个居中 root', () => {
    const frames = fileToFrameData(parseFdf('Frame "FRAME" "A" { }'));
    // 无锚点 → 默认尺寸 0.4/0.4 居中
    expect(frames.length).toBeGreaterThan(0);
    const a = frames.find((f) => f.name === 'A')!;
    expect(a.x).toBeCloseTo((0.8 - 0.4) / 2, 6);
    expect(a.y).toBeCloseTo((0.6 - 0.4) / 2, 6);
  });

  it('d2) Anchor 属性 root：锚点绝对点回推 box（回归 guard）', () => {
    // root 用 Anchor 语法把 CENTER 钉到画布中心(0.4,0.3)
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, Anchor CENTER 0 0 }';
    const file = parseFdf(src);
    const root = file.frames[0];
    const box = resolveRootBox(root);
    // CENTER 点 box 中心 = (0.4,0.3) → 左下角 x=0.4-0.1=0.3, y=0.3-0.05=0.25
    expect(box.x).toBeCloseTo(0.3, 6);
    expect(box.y).toBeCloseTo(0.25, 6);
    expect(box.w).toBeCloseTo(0.2, 6);
    expect(box.h).toBeCloseTo(0.1, 6);
  });

  it('e) parseFDF opt-in：useKernelLayout 切到内核几何', () => {
    const src = fs.readFileSync(
      path.join(VENDOR, 'UI', 'UpperButtonBar.fdf'),
      'latin1',
    );
    // 开启内核 layout
    const kernel = parseFDF(src, { useKernelLayout: true });
    const kernelRoot = kernel.find((f) => f.name === 'UpperButtonBarFrame')!;
    expect(kernelRoot).toBeTruthy();
    expect(kernelRoot.x).toBeCloseTo(0.23, 6);          // 居中（内核）
    expect(kernelRoot.width).toBeCloseTo(0.34, 6);

    // 默认走旧 transformer solver（不抛、有结构）
    const legacy = parseFDF(src);
    const legacyRoot = legacy.find((f) => f.name === 'UpperButtonBarFrame')!;
    expect(legacyRoot).toBeTruthy();
  });

  it('f) resolveRootBox：SetAllPoints root（anchor 0/8）', () => {
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetAllPoints }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    // 首个锚点 TOPLEFT(0)→画布(0,0.6)：boxX=0-0*0.2=0, boxY=0.6-1*0.1=0.5
    expect(box.x).toBeCloseTo(0, 6);
    expect(box.y).toBeCloseTo(0.5, 6);
    expect(box.w).toBeCloseTo(0.2, 6);
    expect(box.h).toBeCloseTo(0.1, 6);
  });

  it('g) resolveRootBox：SetPoint 裸相对点', () => {
    // SetPoint CENTER BOTTOM 0 0 → myPoint=4, relPoint=7(CENTER盒相对画布BOTTOM)
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetPoint CENTER BOTTOM 0 0 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    // box 中心 = canvasPoint(7)=BOTTOM(0.4,0)；fx(CENTER)=0.5, fy(CENTER)=0.5
    expect(box.x).toBeCloseTo(0.4 - 0.5 * 0.2, 6);
    expect(box.y).toBeCloseTo(0 - 0.5 * 0.1, 6);
  });

  it('h) resolveRootBox：SetPoint 带字符串相对名（跳过 name arg）', () => {
    // SetPoint CENTER "RelName" BOTTOM 0 0 → idx 跳过字符串，relPoint=BOTTOM
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetPoint CENTER "RelName" BOTTOM 0 0 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    expect(box.w).toBeCloseTo(0.2, 6);
    expect(box.x).toBeCloseTo(0.4 - 0.5 * 0.2, 6);
    expect(box.y).toBeCloseTo(0 - 0.5 * 0.1, 6);
  });

  it('i) resolveRootBox：未知 myPoint 回落 0、非帧点 relPoint 回落 myPoint', () => {
    // myPoint=NOPE→0(TOPLEFT)；字符串 BOTTOM 被当作 name 跳过；a[2] 为数字非帧点→relPoint=myPoint=0。
    // primary=TOPLEFT(0) 相对画布 TOPLEFT(0)：boxX=0+0, boxY=0.6-1*0.1=0.5
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetPoint NOPE BOTTOM 0 0 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    expect(box.x).toBeCloseTo(0, 6);
    expect(box.y).toBeCloseTo(0.5, 6);
  });

  it('j) fileToFrameData：匿名顶层 root 跳过几何叠加', () => {
    const frames = fileToFrameData(parseFdf('Frame "FRAME" { Width 0.1, Height 0.1 }'));
    // 匿名 root（name 空）被 geometry 循环跳过；结构层仍产出 frame。
    expect(frames.length).toBe(1);
  });

  it('k) resolveRootBox：Anchor 字符串数值参数走 parseFloat 路径', () => {
    // Anchor LEFT "1.5" "0.25" → aNum 对字符串 '1.5'/'0.25' 走 parseFloat
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, Anchor LEFT "1.5" "0.25" }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    // primary relPoint=3(LEFT) → canvas(0,0.3)；x=0+1.5, y=0.3+0.25
    expect(box.x).toBeCloseTo(0 + 1.5 - 0 * 0.2, 6);
    expect(box.y).toBeCloseTo(0.3 + 0.25 - 0.5 * 0.1, 6);
  });

  it('l) resolveRootBox：Anchor 数值首参 + 相对偏移', () => {
    // Anchor CENTER 0.1 0.05 → aNum 直接数字
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, Anchor CENTER 0.1 0.05 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    expect(box.x).toBeCloseTo(0.4 + 0.1 - 0.5 * 0.2, 6);
    expect(box.y).toBeCloseTo(0.3 + 0.05 - 0.5 * 0.1, 6);
  });

  it('m) resolveRootBox：Anchor 空字符串参数（aNum 缺省 ??0）', () => {
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, Anchor CENTER "" "" }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    // aa[1]={s:''} → aNum undefined → x=0；aa[2] 同 → y=0
    expect(box.x).toBeCloseTo(0.4 - 0.5 * 0.2, 6);
    expect(box.y).toBeCloseTo(0.3 - 0.5 * 0.1, 6);
  });

  it('n) resolveRootBox：RIGHT myPoint 覆盖 fx RIGHT 分支', () => {
    // myPoint=RIGHT(5)：fx(5)=1 → boxX=0.4-1*w；fy(5)=0.5；relPoint=BOTTOM(7)→canvas(0.4,0)
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetPoint RIGHT BOTTOM 0 0 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    expect(box.x).toBeCloseTo(0.4 - 0.2, 6);
    expect(box.y).toBeCloseTo(0 - 0.5 * 0.1, 6);
  });

  it('n2) resolveRootBox：BOTTOM myPoint 覆盖 fy BOTTOM 分支', () => {
    // myPoint=BOTTOM(7)：fy(7)=0 → boxY=canvasY；fx(7)=0.5；relPoint=CENTER(4)→canvas(0.4,0.3)
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetPoint BOTTOM CENTER 0 0 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    expect(box.x).toBeCloseTo(0.4 - 0.5 * 0.2, 6);
    expect(box.y).toBeCloseTo(0.3 - 0 * 0.1, 6);
  });

  it('o) resolveRootBox：TOPRIGHT 锚点覆盖 fy TOP/ fx RIGHT', () => {
    const src = 'Frame "FRAME" "A" { Width 0.2, Height 0.1, SetPoint TOPRIGHT BOTTOMLEFT 0 0 }';
    const box = resolveRootBox(parseFdf(src).frames[0]);
    // fx(TOPRIGHT=2)=1, fy(2)=1；canvas(BOTTOMLEFT)= (0,0)
    expect(box.x).toBeCloseTo(0 - 0.2, 6);
    expect(box.y).toBeCloseTo(0 - 0.1, 6);
  });

  it('p) fileToFrameData：匿名子帧 → overlay matchChildByName 空名回落', () => {
    // 具名 root + 一个匿名子帧：结构层仍产出匿名 fd（children 含 id），
    // 但 layout 侧同名查找 name='' → matchChildByName 走 `if(!name) return null`。
    const src = 'Frame "FRAME" "Root" { Width 0.3, Height 0.2, ' +
      'Frame "FRAME" { Width 0.1, Height 0.1 } }';
    const frames = fileToFrameData(parseFdf(src));
    const root = frames.find((f) => f.parentId === null)!;
    expect(root).toBeTruthy();
    // root 的近端点[T]已叠加几何（root 自身尺寸来自声明）
    expect(root.width).toBeCloseTo(0.3, 6);
    expect(root.height).toBeCloseTo(0.2, 6);
    // 匿名子帧仍在输出（结构层,culled 前的 Frame 块）
    const anon = root.children.map((id) => frames.find((f) => f.id === id));
    expect(anon.some((c) => c && c.name === '')).toBe(true);
  });

  it('q) fileToFrameData：顶层 root INHERITS 模板 → laidRoot 走 resolved 分支', () => {
    const src =
      'Frame "FRAME" "Tpl" { Width 0.3, Height 0.2 } ' +
      'Frame "FRAME" "Root" { INHERITS "Tpl", SetAllPoints }';
    const frames = fileToFrameData(parseFdf(src));
    const root = frames.find((f) => f.parentId === null && f.name === 'Root')!;
    expect(root).toBeTruthy();
    // resolved 分支被执行（lib.resolve(root) 命中模板）——几何叠加不抛、root 有结构。
    expect(root.width).toBeGreaterThan(0);
    expect(root.height).toBeGreaterThan(0);
  });
});