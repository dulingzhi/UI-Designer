/**
 * FDF 导出 —— 文本/字体/对齐/纹理字段完整性守卫。
 *
 * 审计 `exportUtils.generateFrameFDF` 发现：
 * 1. **文本引号未转义**：`Text "${frame.text}"` 直接插入，文本含 `"` 时会截断字符串，
 * 产物变成非法 FDF（且不会报错，静默产出坏文件）。
 * 2. **`horAlign` 分支只输出 `FrameFont`**：既没有输出对齐属性，又把字体名硬编码成
 * `MasterFont`、字号取 `textScale`——用户设的对齐完全丢失。
 * 3. **`verAlign` 完全没有导出**。
 * 4. **纹理属性 `texCoord` / `alphaMode` / `decorateFileNames` 未导出**。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FrameType, type ProjectData, type FrameData } from '../types';

const dialogMocks = vi.hoisted(() => ({ save: vi.fn() }));
const fsMocks = vi.hoisted(() => ({ writeTextFile: vi.fn(), writeFile: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: dialogMocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: fsMocks.writeTextFile, writeFile: fsMocks.writeFile }));
vi.mock('./fdfExporter', () => ({
  FDFExporterEnhanced: function FDFExporterEnhanced() {
    this.exportEnhanced = () => '';
  },
}));

import { exportToFDF } from './exportUtils';
import { parseFdf } from './fdfKernelParser';

function mkFrame(o: Partial<FrameData> & { id: string; name: string }): FrameData {
  return {
    type: FrameType.FRAME, x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children: [], ...o,
  } as FrameData;
}
function proj(frames: FrameData[]): ProjectData {
  const rec: Record<string, FrameData> = {};
  for (const f of frames) rec[f.id] = f;
  return {
    version: 2, libraryName: 'Lib', originMode: 'gameui', exportVersion: 'reforged',
    hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
    hideButtonBar: false, hidePortrait: false, hideChat: false,
 frames: rec,
    rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
  } as unknown as ProjectData;
}
async function content(frames: FrameData[]): Promise<string> {
  dialogMocks.save.mockResolvedValue('/out/x.fdf');
  fsMocks.writeTextFile.mockResolvedValue(undefined as never);
  await exportToFDF(proj(frames), false, () => {});
  return fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;
}

describe('文本引号必须转义，产物才能被 parseFdf 回读', () => {
  beforeEach(() => { fsMocks.writeTextFile.mockClear(); dialogMocks.save.mockClear(); });

  it('TEXT_FRAME 的文本含双引号时，回读后文本**不被截断**', async () => {
    const t = mkFrame({ id: 't1', name: 'Txt', type: FrameType.TEXT_FRAME, text: 'He said "hi"' });
    const c = await content([t]);
 // 探针实测：未转义时 parser 不抛错，但把文本静默截断成 "He said "（"hi" 丢失）——
 // 这才是真正危险的地方：产物看起来"能解析"，内容却是错的。
    const file = parseFdf(c);
    const txt = file.frames[0]; // 顶层帧（exportUtils 以 rootFrameIds 为顶层）
    expect(txt).toBeDefined();
    const textProp = txt.props.find((p) => p.key.toLowerCase() === 'text');
    expect(textProp).toBeDefined();
    const joined = textProp!.args.map((a) => a.s).join('');
    expect(joined).toContain('hi');
  });

  it('BUTTON 的 ButtonText 同样不被截断', async () => {
    const b = mkFrame({ id: 'b1', name: 'Btn', type: FrameType.BUTTON, text: 'a"b' });
    const c = await content([b]);
    const frame = parseFdf(c).frames[0];
    const p = frame.props.find((x) => x.key.toLowerCase() === 'buttontext');
    expect(p).toBeDefined();
    expect(p!.args.map((a) => a.s).join('')).toContain('b');
  });

  it('EDITBOX 的 EditTextFrame 同样不被截断', async () => {
    const e = mkFrame({ id: 'e1', name: 'Ed', type: FrameType.EDITBOX, text: 'x"y' });
    const c = await content([e]);
    const frame = parseFdf(c).frames[0];
    const p = frame.props.find((x) => x.key.toLowerCase() === 'edittextframe');
    expect(p).toBeDefined();
    expect(p!.args.map((a) => a.s).join('')).toContain('y');
  });
});

describe('文本对齐必须导出（不得只输出 FrameFont）', () => {
  it('horAlign 输出 JustifyH 属性', async () => {
    const t = mkFrame({ id: 't2', name: 'AlignH', type: FrameType.TEXT_FRAME,
      text: 'x', horAlign: 'right' });
    const c = await content([t]);
    expect(c).toMatch(/FontJustificationH\s+JUSTIFYRIGHT/i);
  });

  it('verAlign 输出 JustifyV 属性', async () => {
    const t = mkFrame({ id: 't3', name: 'AlignV', type: FrameType.TEXT_FRAME,
      text: 'x', verAlign: 'center' });
    const c = await content([t]);
    expect(c).toMatch(/FontJustificationV\s+JUSTIFYMIDDLE/i);
  });

  it('center/start/flex-end 映射到 JUSTIFYCENTER / JUSTIFYTOP / JUSTIFYBOTTOM', async () => {
    const a = mkFrame({ id: 'a1', name: 'A1', type: FrameType.TEXT_FRAME, text: 'x', horAlign: 'center' });
    const b = mkFrame({ id: 'b2', name: 'B2', type: FrameType.TEXT_FRAME, text: 'x', verAlign: 'start' });
    const d = mkFrame({ id: 'd1', name: 'D1', type: FrameType.TEXT_FRAME, text: 'x', verAlign: 'flex-end' });
    const c = await content([a, b, d]);
    expect(c).toContain('JUSTIFYCENTER');
    expect(c).toContain('JUSTIFYTOP');
    expect(c).toContain('JUSTIFYBOTTOM');
  });

  it('未设对齐时不输出对齐属性', async () => {
    const t = mkFrame({ id: 't4', name: 'NoAlign', type: FrameType.TEXT_FRAME, text: 'x' });
    const c = await content([t]);
    expect(c).not.toContain('FontJustificationH');
  });
});

describe('纹理属性必须导出', () => {
  it('texCoord 输出 TexCoord 四元组', async () => {
    const b = mkFrame({ id: 'x1', name: 'Tx', type: FrameType.BACKDROP,
      backdropBackground: 'a.blp', texCoord: [0.25, 0.5, 0.1, 0.9] });
    const c = await content([b]);
    expect(c).toMatch(/TexCoord\s+0\.25\s*,\s*0\.5\s*,\s*0\.1\s*,\s*0\.9/i);
  });

  it('alphaMode 输出 AlphaMode', async () => {
    const b = mkFrame({ id: 'x2', name: 'Am', type: FrameType.BACKDROP,
      backdropBackground: 'a.blp', alphaMode: 'ALPHAKEY' });
    const c = await content([b]);
    expect(c).toMatch(/AlphaMode\s+"?ALPHAKEY"?/i);
  });

  it('decorateFileNames 输出 DecorateFileNames', async () => {
    const b = mkFrame({ id: 'x3', name: 'Dec', type: FrameType.BACKDROP,
      backdropBackground: 'a.blp', decorateFileNames: true });
    const c = await content([b]);
    expect(c).toContain('DecorateFileNames');
  });
});

describe('FrameFont 使用用户字体（不再硬编码 MasterFont）', () => {
  it('font 字段被采用', async () => {
    const t = mkFrame({ id: 'f1', name: 'Fnt', type: FrameType.TEXT_FRAME,
      text: 'x', font: 'MyFont', textScale: 0.02 });
    const c = await content([t]);
    expect(c).toContain('FrameFont "MyFont", 0.02,');
  });

  it('无 font 时回落 MasterFont', async () => {
    const t = mkFrame({ id: 'f2', name: 'Fnt2', type: FrameType.TEXT_FRAME, text: 'x' });
    const c = await content([t]);
    expect(c).toContain('FrameFont "MasterFont",');
  });
});

describe('horAlign=left 与 justifyV 的其它分支', () => {
  it('horAlign=left 输出 JUSTIFYLEFT', async () => {
    const t = mkFrame({ id: 'l1', name: 'Left1', type: FrameType.TEXT_FRAME, text: 'x', horAlign: 'left' });
    const c = await content([t]);
    expect(c).toContain('JUSTIFYLEFT');
  });

  it('horAlign 为未知值时不出对齐属性（防御分支）', async () => {
    const t = mkFrame({ id: 'l2', name: 'Unknown', type: FrameType.TEXT_FRAME,
      text: 'x', horAlign: 'bogus' as unknown as FrameData['horAlign'] });
    const c = await content([t]);
    expect(c).not.toContain('FontJustificationH');
  });
});