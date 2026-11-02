import { describe, it, expect, vi } from 'vitest';
import { FrameType, type ProjectData, type FrameData } from '../types';
import { parseFdf } from './fdfKernelParser';

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
    appInterface: '', frames: rec,
    rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
  } as unknown as ProjectData;
}

describe('FDF 导出 round-trip：产物必须能被内核 parser 重新解析', () => {
  it('带完整九宫格边框的 backdrop 导出后可回读，且字段值一致', async () => {
    const bd = mkFrame({
      id: 'b1', name: 'FullBackdrop', type: FrameType.BACKDROP,
      backdropBackground: 'UI\\Bg.blp',
      backdropEdgeFile: 'UI\\Edge.blp',
      backdropCornerSize: 0.015,
      backdropCornerFlags: 'UL|BR',
      backdropBackgroundInsets: [0.01, 0.02, 0.03, 0.04],
      backdropTileBackground: true,
    });
    dialogMocks.save.mockResolvedValue('/out/rt.fdf');
    fsMocks.writeTextFile.mockResolvedValue(undefined as never);
    await exportToFDF(proj([bd]), false, () => {});
    const content = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;

    // 内核 parser 必须能吃下这份产物（不抛错、能拿到帧）
    const file = parseFdf(content);
    expect(file.frames.length).toBeGreaterThan(0);
    const frame = file.frames.find((f) => f.name === 'FullBackdrop');
    expect(frame).toBeDefined();

    // 回读后的属性值应与写入值一致
    const propMap = new Map<string, string | undefined>();
    for (const p of frame!.props) propMap.set(p.key, p.args.map((a) => a.s ?? '').join(' '));

    expect(propMap.get('BackdropBackground')).toContain('UI\\Bg.blp');
    expect(propMap.get('BackdropEdgeFile')).toContain('UI\\Edge.blp');
    expect(propMap.get('BackdropCornerSize')).toMatch(/0\.015/);
    expect(propMap.get('BackdropCornerFlags')).toContain('UL|BR');
    expect(propMap.get('BackdropBackgroundInsets')).toBeTruthy();
    expect(propMap.has('BackdropTileBackground')).toBe(true);
  });
});