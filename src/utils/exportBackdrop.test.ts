/**
 * FDF 导出（exportUtils）的 backdrop 字段完整性守卫。
 *
 * 审计发现 `exportUtils.generateFrameFDF` 的 BACKDROP 分支只输出 3 行，且**硬编码**：
 * BackdropBackground "${frame.texture}"
 * BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R"
 *
 * 导致：① 背景读错字段（正确字段是 `backdropBackground`）；② 用户设置的角标志/边框被
 * **硬编码值覆盖**，编辑器里的九宫格边框配置完全导不出去。
 *
 * 依据：WC3 的 backdrop 边框（EdgeFile/CornerFile/四边/CornerFlags/CornerSize/背景尺寸/内边距）
 * 是 **FDF 模板属性**，dzapi 里没有任何运行时 backdrop API（已核对 openwar3 的 60 个 Dz 函数），
 * 故只能在本 FDF 导出里如实写出。
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

async function exportContent(frames: FrameData[]): Promise<string> {
  dialogMocks.save.mockResolvedValue('/out/x.fdf');
  fsMocks.writeTextFile.mockResolvedValue(undefined as never);
 // 传 onShowAlert 避免走 alert()（node 环境无该全局）
  await exportToFDF(proj(frames), false, () => {});
  const call = fsMocks.writeTextFile.mock.calls.at(-1)!;
  return call[1] as string;
}

describe('FDF 导出：背景纹理用 backdropBackground 字段', () => {
  it('有 backdropBackground 时输出该值，而非 frame.texture', async () => {
    const bd = mkFrame({ id: 'b1', name: 'Bd', type: FrameType.BACKDROP, backdropBackground: 'UI\\Real\\bg.blp' });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropBackground "UI\\Real\\bg.blp"');
  });
});

describe('FDF 导出：九宫格边框必须如实导出（不得硬编码）', () => {
  beforeEach(() => { fsMocks.writeTextFile.mockClear(); dialogMocks.save.mockClear(); });

  it('backdropEdgeFile 输出 BackdropEdgeFile', async () => {
    const bd = mkFrame({ id: 'b2', name: 'Bd2', type: FrameType.BACKDROP,
      backdropBackground: 'bg.blp', backdropEdgeFile: 'UI\\Edge.blp' });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropEdgeFile "UI\\Edge.blp"');
  });

  it('backdropCornerFile 输出 BackdropCornerFile', async () => {
    const bd = mkFrame({ id: 'b3', name: 'Bd3', type: FrameType.BACKDROP,
      backdropCornerFile: 'UI\\Corner.blp' });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropCornerFile "UI\\Corner.blp"');
  });

  it('四个边文件输出 BackdropTopFile/BottomFile/LeftFile/RightFile', async () => {
    const bd = mkFrame({ id: 'b4', name: 'Bd4', type: FrameType.BACKDROP,
      backdropTopFile: 'T.blp', backdropBottomFile: 'B.blp',
      backdropLeftFile: 'L.blp', backdropRightFile: 'R.blp' });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropTopFile "T.blp"');
    expect(c).toContain('BackdropBottomFile "B.blp"');
    expect(c).toContain('BackdropLeftFile "L.blp"');
    expect(c).toContain('BackdropRightFile "R.blp"');
  });

  it('backdropCornerFlags 如实导出，不再硬编码全标志', async () => {
    const bd = mkFrame({ id: 'b5', name: 'Bd5', type: FrameType.BACKDROP,
      backdropCornerFlags: 'UL|BR' });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropCornerFlags "UL|BR"');
 // 断言不再出现硬编码的全标志
    expect(c).not.toContain('BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R"');
  });

  it('backdropCornerSize 输出 BackdropCornerSize', async () => {
    const bd = mkFrame({ id: 'b6', name: 'Bd6', type: FrameType.BACKDROP, backdropCornerSize: 0.015 });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropCornerSize 0.015');
  });

  it('backdropBackgroundSize 输出 BackdropBackgroundSize', async () => {
    const bd = mkFrame({ id: 'b7', name: 'Bd7', type: FrameType.BACKDROP, backdropBackgroundSize: 0.05 });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropBackgroundSize 0.05');
  });

  it('backdropBackgroundInsets 输出四元组', async () => {
    const bd = mkFrame({ id: 'b8', name: 'Bd8', type: FrameType.BACKDROP,
      backdropBackgroundInsets: [0.01, 0.01, 0.01, 0.01] });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropBackgroundInsets 0.01 0.01 0.01 0.01');
  });

  it('backdropTileBackground 输出 BackdropTileBackground', async () => {
    const bd = mkFrame({ id: 'b9', name: 'Bd9', type: FrameType.BACKDROP, backdropTileBackground: true });
    const c = await exportContent([bd]);
    expect(c).toContain('BackdropTileBackground');
  });
});
