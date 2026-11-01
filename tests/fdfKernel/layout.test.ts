/**
 * FDF 声明式核心 —— 布局求解器单测（阶段 A）。
 * 覆盖不动点、双锚点钉住、TEXT 自动尺寸、SetAllPoints、无锚点、toPixels。
 */
import { describe, it, expect } from 'vitest';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import {
  layout,
  toPixels,
  fitBox,
  stretchBox,
  UI_WIDTH,
  UI_HEIGHT,
  fontSizeOf,
  textBoxHeight,
} from '../../src/utils/fdfKernelLayout';
import type { FdfFrame } from '../../src/utils/fdfKernelTypes';

const frame = (src: string): FdfFrame => parseFdf(src).frames[0];

describe('布局不动点 — 锚点链', () => {
  it('兄弟链按 TOPright-of-Top 依次摆放', () => {
    // 两条按钮链：top 按钮顶部居中，下一按钮锚到上一的 BOTTOM。
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "GLUETEXTBUTTON" "BtnA" { Width 0.2, Height 0.05, SetPoint TOP, "Screen", TOP, 0, 0, }' +
        'Frame "GLUETEXTBUTTON" "BtnB" { Width 0.2, Height 0.05, SetPoint BOTTOM, "BtnA", BOTTOM, 0, -0.01, }' +
        '}',
    );
    const { tree, byName } = layout(root);
    const a = byName.get('BtnA')!;
    const b = byName.get('BtnB')!;
    expect(a.placed).toBe(true);
    expect(b.placed).toBe(true);
    // A 顶部居中 → 其上边界 y 应 = 0.6（Screen 顶）。
    expect(a.y + a.h).toBeCloseTo(0.6);
    // B 的 BOTTOM 锚到 A 的 BOTTOM 下方 0.01 → B 紧邻 A 下方。
    expect(b.y).toBeCloseTo(a.y - 0.01);
  });

  it('SetPoint 引用未放置 sibling 时不动点多轮收敛', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "B" { Width 0.3, Height 0.05, SetPoint TOP, "A", TOPLEFT, 0, 0, }' +
        'Frame "FRAME" "A" { Width 0.3, Height 0.05, SetPoint TOP, "Screen", TOP, 0, 0, }' +
        '}',
    );
    const { byName } = layout(root);
    // B 引用 A，A 又引用 Screen；都应在少数几轮内放置。
    expect(byName.get('A')!.placed).toBe(true);
    expect(byName.get('B')!.placed).toBe(true);
  });

  it('未解析名字回退到父控件（不悬空消失）', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "Orphan" { Width 0.1, Height 0.1, SetPoint TOP, "Ghost", TOPLEFT, 0, 0, }' +
        '}',
    );
    const { byName } = layout(root);
    const o = byName.get('Orphan')!;
    expect(o.placed).toBe(true);
    // "Ghost" 查不到 → relOf 回退父控件；myPoint TOP ↔ relPoint TOPLEFT（fx=0）
    // → x = 0 − 0.5·w = −0.05，y = 0.6 − h = 0.5。仍未悬空。
    expect(o.x).toBeCloseTo(-0.05);
    expect(o.y).toBeCloseTo(0.5);
  });
});

describe('双锚点钉住 vs 声明尺寸', () => {
  it('两个对立 SetPoint 逆时针钉住，胜过声明 Width/Height', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "Pin" {' +
        ' SetPoint TOPLEFT, "Screen", TOPLEFT, 0.1, -0.1,' +
        ' SetPoint BOTTOMRIGHT, "Screen", BOTTOMRIGHT, -0.1, 0.1,' +
        ' Width 0.5, Height 0.3, }' + // 被点的约束压过
        '}',
    );
    const { byName } = layout(root);
    const p = byName.get('Pin')!;
    // x ∈ [0.1, 0.7], y ∈ [0.1, 0.5] → 尺寸 0.6×0.4，而非 0.5×0.3。
    expect(p.w).toBeCloseTo(0.6);
    expect(p.h).toBeCloseTo(0.4);
    expect(p.x).toBeCloseTo(0.1);
    expect(p.y).toBeCloseTo(0.1);
  });
});

describe('TEXT 自动尺寸', () => {
  const textFrame = frame(
    'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
      'Frame "TEXT" "Lbl" { FrameFont "Fonts\\FrizQuadrata.ttf", 0.02,' +
      ' SetPoint TOP, "Screen", TOP, 0, 0, }' +
      '}',
  );
  it('fontSizeOf 读 FrameFont 第二参', () => {
    expect(fontSizeOf(textFrame.children[0])).toBeCloseTo(0.02);
  });
  it('单行 TEXT 高 = 字号（shrink-wrap）', () => {
    const { byName } = layout(textFrame, { measure: () => 0.15 });
    const lbl = byName.get('Lbl')!;
    expect(lbl.h).toBeCloseTo(0.02);
    expect(lbl.shrinkWrapped).toBe(true);
    expect(lbl.fabricatedWidth).toBe(true);
  });
  it('multi-line TEXT 高 = 行数×字号×1.2', () => {
    const { byName } = layout(textFrame, { measure: () => 0.3, measureLines: () => 2 });
    const lbl = byName.get('Lbl')!;
    expect(lbl.h).toBeCloseTo(2 * 0.02 * 1.2);
    expect(lbl.shrinkWrapped).toBe(false);
  });
  it('textBoxHeight 多行用 1.2 行高', () => {
    const tf = textFrame.children[0];
    expect(textBoxHeight(tf, 1)).toBeCloseTo(0.02);
    expect(textBoxHeight(tf, 3)).toBeCloseTo(3 * 0.02 * 1.2);
  });
});

describe('SetAllPoints / 无锚点', () => {
  it('SetAllPoints 填满父控件', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "TEXTURE" "bg" { SetAllPoints, }' +
        '}',
    );
    const { byName } = layout(root);
    const bg = byName.get('bg')!;
    expect(bg.x).toBeCloseTo(0);
    expect(bg.y).toBeCloseTo(0);
    expect(bg.w).toBeCloseTo(0.8);
    expect(bg.h).toBeCloseTo(0.6);
  });
  it('无锚点节点落在父 top-left', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "Kid" { Width 0.2, Height 0.1, }' +
        '}',
    );
    const { byName } = layout(root);
    const kid = byName.get('Kid')!;
    expect(kid.x).toBeCloseTo(0);
    expect(kid.y).toBeCloseTo(0.6 - 0.1);
  });
});

describe('applyWidgetDefaults / scaleButtonWidths', () => {
  it('PopupArrowFrame 无锚点时被引擎贴到右缘并内缩', () => {
    const root = frame(
      'Frame "POPUPMENU" "Menu" { PopupArrowFrame "Arrow", PopupButtonInset 0.02,' +
        '  Frame "GLUETEXTBUTTON" "Arrow" { Width 0.05, Height 0.05, }' +
        '}',
    );
    const { byName } = layout(root);
    const arrow = byName.get('Arrow')!;
    expect(arrow.placed).toBe(true);
    // RIGHT ↔ 父（Menu）RIGHT，dx = -inset → 贴右缘。
    expect(arrow.x + arrow.w).toBeCloseTo(0.8 - 0.02);
  });
  it('buttonWidthScale 只拉宽按钮、不动文本；BACKDROP socket 连带拉宽', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        ' Frame "BACKDROP" "Sock" { Width 0.4, Height 0.1,' +
        '   Frame "GLUETEXTBUTTON" "Btn" { Width 0.3, Height 0.1, SetPoint TOPLEFT, "Sock", TOPLEFT, 0, 0, }' +
        ' }' +
        '}',
    );
    const { byName } = layout(root, { buttonWidthScale: 2 });
    // Btn 拉宽到 0.6，其 BACKDROP socket 也拉宽。
    expect(byName.get('Btn')!.w).toBeCloseTo(0.6);
    expect(byName.get('Sock')!.w).toBeCloseTo(0.8);
  });
});

describe('toPixels / 视口适配', () => {
  function oneRect(frame: FdfFrame) {
    const { byName } = layout(frame);
    return byName.get('R')!;
  }
  it('世界 y-up 左下 → CSS y-down 左上', () => {
    const r = oneRect(
      frame('Frame "FRAME" "Screen" { Width 0.8, Height 0.6, Frame "FRAME" "R" { Width 0.2, Height 0.1, SetPoint BOTTOMLEFT, "Screen", BOTTOMLEFT, 0.1, 0.2, } }'),
    );
    const px = toPixels(r, { scale: 100, xScale: 1 });
    expect(px.left).toBeCloseTo(10);
    expect(px.width).toBeCloseTo(20);
    expect(px.height).toBeCloseTo(10);
    // y 翻转：top = 0.6 - (y+h) = 0.6 - 0.3 = 0.3 → 30px。
    expect(px.top).toBeCloseTo(30);
  });
  it('fitBox：按高度缩放、铺满全宽（worldW > 0.8 于宽屏）', () => {
    const fit = fitBox(1600, 900);
    expect(fit.scale).toBeCloseTo(900 / 0.6);
    expect(fit.worldW).toBeCloseTo(1600 / fit.scale);
    expect(fit.xScale).toBe(1);
    expect(fit.worldW).toBeGreaterThan(UI_WIDTH); // 16:9 → 1.066…
  });
  it('stretchBox：保持 0.8 宽的 4:3 box，xScale > 1', () => {
    const fit = stretchBox(1600, 900);
    expect(fit.scale).toBeCloseTo(900 / UI_HEIGHT);
    expect(fit.worldW).toBe(UI_WIDTH);
    expect(fit.xScale).toBeCloseTo(1600 / (UI_WIDTH * fit.scale));
    expect(fit.xScale).toBeGreaterThan(1);
  });
  it('xScale 拉伸 x 但不拉伸 y', () => {
    const r = oneRect(
      frame('Frame "FRAME" "Screen" { Width 0.8, Height 0.6, Frame "FRAME" "R" { Width 0.1, Height 0.1, SetPoint BOTTOMLEFT, "Screen", BOTTOMLEFT, 0, 0, } }'),
    );
    const px = toPixels(r, { scale: 100, xScale: 2 });
    expect(px.width).toBeCloseTo(20); // 0.1*100*2
    expect(px.height).toBeCloseTo(10); // 0.1*100
  });
  it('toPixels：xScale 缺省 ??1（png 到像素）', () => {
    const r = oneRect(
      frame('Frame "FRAME" "Screen" { Width 0.8, Height 0.6, Frame "FRAME" "R" { Width 0.1, Height 0.1, SetPoint BOTTOMLEFT, "Screen", BOTTOMLEFT, 0, 0, } }'),
    );
    const px = toPixels(r, { scale: 100 });
    expect(px.left).toBeCloseTo(0);
    expect(px.width).toBeCloseTo(10);
  });
});

describe('readPoints 边界与 Anchor / Font', () => {
  it('裸 SetPoint（无参数）→ 跳过，不产生锚点', () => {
    // 子帧落在父 top-left（无锚点路径）；SetPoint GHOST 同理被 readPoints 跳过。
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, SetPoint }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    expect(k.placed).toBe(true);
    expect(k.x).toBeCloseTo(0);
    expect(k.y).toBeCloseTo(0.6 - 0.1);
  });
  it('SetPoint 首参数非帧点 → 跳过', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, SetPoint GHOST Screen TOP 0 0 }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    expect(k.placed).toBe(true);
    expect(k.x).toBeCloseTo(0);
  });
  it('SetPoint 相对名后接非帧点 → relPoint 回落 myPoint', () => {
    // myPoint=TOP, relName=Screen, a[2]=GHOST 非帧点 → relPoint=TOP。
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, SetPoint TOP "Screen" GHOST 0 0 }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    // rel=Screen TOP：lx=0.4, ly=0.6；K TOP↔TOP → x=0.4-0.5*0.2=0.3, y=0.6-0.1=0.5。
    expect(k.x).toBeCloseTo(0.3);
    expect(k.y).toBeCloseTo(0.5);
  });
  it('Anchor 中央（无偏移）', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, Anchor CENTER }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    expect(k.x).toBeCloseTo(0.4 - 0.1);
    expect(k.y).toBeCloseTo(0.3 - 0.05);
  });
  it('Anchor BOTTOMLEFT 带 dx/dy 偏移', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, Anchor BOTTOMLEFT 0.1 0.2 }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    expect(k.x).toBeCloseTo(0.1);
    expect(k.y).toBeCloseTo(0.2);
  });
  it('fontSizeOf 读 Font（非 FrameFont）第二参', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "STRING" "Lbl" { Font "F", 0.03, SetPoint TOP "Screen" TOP 0 0 }' +
        '}',
    );
    const lbl = layout(root).byName.get('Lbl')!;
    expect(fontSizeOf(lbl.frame)).toBeCloseTo(0.03);
  });
});

describe('applyWidgetDefaults / scaleButtonWidths / dxScale', () => {
  it('PopupArrowFrame 无 PopupButtonInset → 用默认 0.01', () => {
    const root = frame(
      'Frame "POPUPMENU" "Menu" { PopupArrowFrame "Arrow",' +
        '  Frame "GLUETEXTBUTTON" "Arrow" { Width 0.05, Height 0.05, }' +
        '}',
    );
    const arrow = layout(root).byName.get('Arrow')!;
    expect(arrow.x + arrow.w).toBeCloseTo(0.8 - 0.01);
  });
  it('buttonWidthScale：BACKDROP 内的 GLUEBUTTON icon 连带拉宽 socket', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        ' Frame "BACKDROP" "Sock" { Width 0.4, Height 0.1,' +
        '   Frame "GLUETEXTBUTTON" "Btn" { Width 0.3, Height 0.1, SetPoint TOPLEFT, "Sock", TOPLEFT, 0, 0, }' +
        '   Frame "GLUEBUTTON" "Icon" { Width 0.1, Height 0.1, }' +
        ' }' +
        '}',
    );
    const { byName } = layout(root, { buttonWidthScale: 2 });
    // Btn 拉宽到 0.6，再加 icon.w*(scale-1)=0.1 → 0.7；其 BACKDROP socket 拉宽到 0.8。
    expect(byName.get('Btn')!.w).toBeCloseTo(0.7);
    expect(byName.get('Sock')!.w).toBeCloseTo(0.8);
  });
  it('dxScale：SetPoint X 偏移乘 dxScale', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, SetPoint BOTTOMLEFT "Screen" BOTTOMLEFT 0.1 0.2 }' +
        '}',
    );
    const k = layout(root, { dxScale: 2 }).byName.get('K')!;
    // dx=0.1*2=0.2 → x=0.2；dy 不缩放 → y=0.2。
    expect(k.x).toBeCloseTo(0.2);
    expect(k.y).toBeCloseTo(0.2);
  });
  it('TEXT 自动尺寸后按锚点分值为 autoJustifyH', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "TEXT" "Lbl" { FrameFont "F", 0.02, SetPoint LEFT "Screen" LEFT 0 0 }' +
        '}',
    );
    const lbl = layout(root, { measure: () => 0.15 }).byName.get('Lbl')!;
    expect(lbl.autoJustifyH).toBe('JUSTIFYLEFT');
    expect(lbl.fabricatedWidth).toBe(true);
  });
});

describe('两对立锚点 TEXT wrap-height 与互锁循环兜底', () => {
  it('TEXT 跨宽锚定、无 Height → wrapHeight 多行 shrink-wrap', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "TEXT" "Lbl" { FrameFont "F", 0.02,' +
        '  SetPoint TOPLEFT "Screen" TOPLEFT 0 0, SetPoint TOPRIGHT "Screen" TOPRIGHT 0 0 }' +
        '}',
    );
    const lbl = layout(root, { measureLines: () => 3 }).byName.get('Lbl')!;
    // 跨宽 x 锚定 + 无 Height → 三行 shrink-wrap 高 3*0.02*1.2。
    expect(lbl.w).toBeCloseTo(0.8);
    expect(lbl.h).toBeCloseTo(3 * 0.02 * 1.2);
    expect(lbl.shrinkWrapped).toBe(false);
  });
  it('互锁 SetPoint 循环 + 无锚点子帧 → 最终兜底钉父 top-left', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        ' Frame "FRAME" "P" { Width 0.2, Height 0.1, SetPoint TOP "Q" TOP 0 0,' +
        '   Frame "FRAME" "C" { Width 0.2, Height 0.1 }' +
        '   Frame "FRAME" "D" { }' + // 无尺寸：父 P 未放置 → NaN 兜底填充
        ' }' +
        ' Frame "FRAME" "Q" { Width 0.2, Height 0.1, SetPoint TOP "P" TOP 0 0 }' +
        '}',
    );
    const { byName } = layout(root);
    // P/Q 互相悬空 → 最终兜底钉到父（Screen）top-left。
    const p = byName.get('P')!;
    const q = byName.get('Q')!;
    const c = byName.get('C')!;
    const d = byName.get('D')!;
    expect(p.placed).toBe(true);
    expect(q.placed).toBe(true);
    expect(p.x).toBeCloseTo(0);
    expect(p.y + p.h).toBeCloseTo(0.6);
    // C（无锚点、父 P 未放置）在兜底时以 P 的尺寸钉入，而非 NaN。
    expect(c.placed).toBe(true);
    expect(c.w).toBeCloseTo(0.2);
    expect(c.h).toBeCloseTo(0.1);
    // D 无尺寸 → 兜底填充为父 P 的宽高。
    expect(d.placed).toBe(true);
    expect(d.w).toBeCloseTo(0.2);
    expect(d.h).toBeCloseTo(0.1);
  });
});

describe('readPoints 边界（数值相对名 / 裸 Anchor）', () => {
  it('SetPoint 次参为数值（非常量相对名）→ relName 保持 null、relPoint 回落 myPoint', () => {
    // a[1]=CENTER（点）, a[2]=0（数值, str=false）→ 不解析相对名，relPoint=CENTER。
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, SetPoint CENTER 0 0 0 }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    // rel=Screen CENTER：lx=0.4, ly=0.3；K CENTER↔CENTER → x=0.4-0.5*0.2=0.3, y=0.3-0.5*0.1=0.25。
    expect(k.x).toBeCloseTo(0.3);
    expect(k.y).toBeCloseTo(0.25);
  });
  it('裸 Anchor（无参数）→ readPoints 跳过、不崩溃，回落父 top-left', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1, Anchor }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    expect(k.placed).toBe(true);
    expect(k.x).toBeCloseTo(0);
    expect(k.y).toBeCloseTo(0.6 - 0.1);
  });
});

describe('无字体帧：fontSizeOf / textBoxHeight 回落默认字号', () => {
  it('无 FrameFont/Font → fontSizeOf 返回 undefined、textBoxHeight 用 0.013 默认', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "FRAME" "K" { Width 0.2, Height 0.1 }' +
        '}',
    );
    const k = layout(root).byName.get('K')!;
    expect(fontSizeOf(k.frame)).toBeUndefined();
    expect(textBoxHeight(k.frame, 1)).toBeCloseTo(0.013);
    expect(textBoxHeight(k.frame, 2)).toBeCloseTo(2 * 0.013 * 1.2);
  });
});

describe('scaleButtonWidths 边界', () => {
  it('无宽度按钮 NaN 早退：BACKDROP socket 仍连带拉宽（done 不含该按钮）', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        ' Frame "BACKDROP" "Sock" { Width 0.4, Height 0.1,' +
        '   Frame "GLUETEXTBUTTON" "Btn" { },' + // 无 Width → NaN
        '   Frame "GLUEBUTTON" "Icon" { Width 0.1, Height 0.1, }' +
        ' }' +
        '}',
    );
    const { byName } = layout(root, { buttonWidthScale: 2 });
    // Btn 宽度 NaN → widen 早退不入 done；BACKDROP 仍被拉宽到 0.8。
    expect(byName.get('Sock')!.w).toBeCloseTo(0.8);
  });
  it('SliderThumbButtonFrame 具名按钮豁免拉宽', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        ' Frame "BACKDROP" "Sock" { Width 0.4, Height 0.1, SliderThumbButtonFrame "Knob",' +
        '   Frame "GLUETEXTBUTTON" "Knob" { Width 0.2, Height 0.1, }' +
        ' }' +
        '}',
    );
    const { byName } = layout(root, { buttonWidthScale: 2 });
    // 名字命中 knobs 集合 → 豁免，宽度保持 0.2 不变。
    expect(byName.get('Knob')!.w).toBeCloseTo(0.2);
  });
  it('父非 BACKDROP 时按钮只拉宽自身', () => {
    const root = frame(
      'Frame "FRAME" "Screen" { Width 0.8, Height 0.6,' +
        'Frame "TEXTBUTTON" "Btn" { Width 0.3, Height 0.1 }' +
        '}',
    );
    const { byName } = layout(root, { buttonWidthScale: 2 });
    expect(byName.get('Btn')!.w).toBeCloseTo(0.6);
  });
});