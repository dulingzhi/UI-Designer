/**
 * 端到端往返守卫：exportToFDF 真实产物 → importFromFDFText（真 parser，不 mock）→ 字段原样回来。
 *
 * 单独建文件因为它需要**真实** fdfKernelParser；fdfImport.test.ts / fdfImportRoundtrip.test.ts
 * 都 mock 了 parser，无法证明真实往返。此前各环独立测试都绿，但链路从未整体穿过——
 * 本文件就是那根"穿针"。
 */
import { describe, it, expect, vi } from 'vitest';
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
import { importFromFDFText } from './fdfImport';

function mkFrame(o: Partial<FrameData> & { id: string; name: string }): FrameData {
  return {
    type: FrameType.BACKDROP, x: 0, y: 0, width: 0.1, height: 0.1,
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
    appInterface: '', frames: rec,
    rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
  } as unknown as ProjectData;
}

describe('端到端往返：导出 → 导入，九宫格与文本字段不丢失', () => {
  it('full backdrop 原样往返', async () => {
    const src = mkFrame({
      id: 'b1', name: 'FullBd', type: FrameType.BACKDROP,
      backdropBackground: 'UI\\Bg.blp',
      backdropEdgeFile: 'UI\\Edge.blp',
      backdropCornerFile: 'UI\\Corner.blp',
      backdropTopFile: 'UI\\T.blp',
      backdropBottomFile: 'UI\\B.blp',
      backdropLeftFile: 'UI\\L.blp',
      backdropRightFile: 'UI\\R.blp',
      backdropCornerFlags: 'UL|BR',
      backdropCornerSize: 0.015,
      backdropBackgroundSize: 0.05,
      backdropBackgroundInsets: [0.01, 0.02, 0.03, 0.04],
      backdropTileBackground: true,
    });

    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([src]), false, () => {});
    const fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    const [back] = importFromFDFText(fdf);
    expect(back.backdropBackground).toBe('UI\\Bg.blp');
    expect(back.backdropEdgeFile).toBe('UI\\Edge.blp');
    expect(back.backdropCornerFile).toBe('UI\\Corner.blp');
    expect(back.backdropTopFile).toBe('UI\\T.blp');
    expect(back.backdropBottomFile).toBe('UI\\B.blp');
    expect(back.backdropLeftFile).toBe('UI\\L.blp');
    expect(back.backdropRightFile).toBe('UI\\R.blp');
    expect(back.backdropCornerFlags).toBe('UL|BR');
    expect(back.backdropCornerSize).toBeCloseTo(0.015, 9);
    expect(back.backdropBackgroundSize).toBeCloseTo(0.05, 9);
    expect(back.backdropBackgroundInsets).toEqual([0.01, 0.02, 0.03, 0.04]);
    expect(back.backdropTileBackground).toBe(true);
  });

  it('文本与对齐原样往返（含引号转义）', async () => {
    const src = mkFrame({
      id: 't1', name: 'Txt', type: FrameType.TEXT_FRAME,
      text: 'He said "hi"', horAlign: 'right', verAlign: 'center',
    });

    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([src]), false, () => {});
    const fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    const [back] = importFromFDFText(fdf);
    // 对齐必须回可编辑字段
    expect(back.horAlign).toBe('right');
    expect(back.verAlign).toBe('center');
    // 文本写回可编辑字段且不被截断（引号转义在真实 lexer 往返下还原完整内容）
    expect(back.text).toBe('He said "hi"');
  });

  it('文本颜色经 |cff 内嵌编码往返', async () => {
    const src = mkFrame({
      id: 'c1', name: 'Clr', type: FrameType.TEXT_FRAME,
      text: 'colored', textColor: '#FF8800',
    });

    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([src]), false, () => {});
    const fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    const [back] = importFromFDFText(fdf);
    expect(back.text).toBe('colored');
    expect(back.textColor).toBe('#FF8800');
  });

  it('按钮文本经 ButtonText 往返', async () => {
    const src = mkFrame({
      id: 'btn1', name: 'Btn', type: FrameType.BUTTON,
      text: 'Click me',
    });

    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([src]), false, () => {});
    const fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    const [back] = importFromFDFText(fdf);
    expect(back.text).toBe('Click me');
  });

  it('textScale 经 FrameFont 往返', async () => {
    const src = mkFrame({
      id: 's1', name: 'Scaled', type: FrameType.TEXT_FRAME,
      text: 'big', textScale: 0.02,
    });

    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([src]), false, () => {});
    const fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    const [back] = importFromFDFText(fdf);
    expect(back.textScale).toBeCloseTo(0.02, 9);
  });

  it('纹理属性原样往返', async () => {
    const src = mkFrame({
      id: 'tx1', name: 'Tx', type: FrameType.BACKDROP,
      backdropBackground: 'UI\\Bg.blp',
      texture: 'UI\\Atlas.blp',
      texCoord: [0.25, 0.5, 0.1, 0.9],
      alphaMode: 'ALPHAKEY',
    });

    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([src]), false, () => {});
    const fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    const [back] = importFromFDFText(fdf);
    expect(back.backdropBackground).toBe('UI\\Bg.blp');
    // SetTexture 导出的是"有效背景"（backdropBackground 优先于 texture，与导出语义一致），
    // 故往返后 texture 应等于有效背景值而非原 texture 字段值。
    expect(back.texture).toBe('UI\\Bg.blp');
    expect(back.texCoord).toEqual([0.25, 0.5, 0.1, 0.9]);
    expect(back.alphaMode).toBe('ALPHAKEY');
  });
});