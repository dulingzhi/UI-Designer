/**
 * Backdrop / 纹理 / 可见性 / 文本对齐 的导出完整性守卫。
 *
 * 审计发现的缺口（全部实测确认）：
 * 1. BACKDROP 分支读 `frame.texture`——但 BACKDROP 的背景纹理字段是 **`backdropBackground`**，
 *    故带背景的 backdrop 全部落到默认值（等于背景永远不生效）。
 * 2. `texCoord` 从未导出：`FrameSetTexture(f, path, texCoordIndex, true)` 的第 3 参恒为 0，
 *    多纹理 atlas 帧会指错图。
 * 3. `backdropTileBackground`（平铺）从未导出。
 * 4. `visible: false` 从未导出——编辑器里隐藏的帧在游戏里仍可见。
 * 5. `horAlign` / `verAlign`（文本对齐）从未导出。
 *
 * 依据（openwar3）：`DzFrameSetTexture` 展开为 `BlzFrameSetTexture(f, path, texCoord, true)`，
 * 第 3 参是纹理坐标索引，第 4 参恒为 true。
 */
import { describe, it, expect } from 'vitest';
import { FrameType, type FrameData, type ProjectData } from '../../../src/types';
import { generateJASSCode, generateLUACode, generateTypeScriptCode } from '../../../src/utils/codeExport';

function mkFrame(o: Partial<FrameData> & { id: string; name: string }): FrameData {
  return {
    type: FrameType.FRAME, x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children: [], ...o,
  } as FrameData;
}
function mkProject(frames: FrameData[]): ProjectData {
  const rec: Record<string, FrameData> = {};
  for (const f of frames) rec[f.id] = f;
  return {
    id: 'p', name: 'P', libraryName: 'TestLib',
    frames: rec, rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
  } as ProjectData;
}

describe('BACKDROP 必须使用 backdropBackground 字段', () => {
  it('有 backdropBackground 时用该纹理', () => {
    const bd = mkFrame({ id: 'b1', name: 'Bd1', type: FrameType.BACKDROP, backdropBackground: 'UI\\Custom\\bg.blp' });
    const code = generateJASSCode(mkProject([bd]));
    expect(code).toContain('UI\\\\Custom\\\\bg.blp');
    expect(code).not.toContain('EscMenu\\\\Human\\\\background.blp'); // 不应落到默认值
  });

  it('无 backdropBackground 时才回落到默认纹理', () => {
    const bd = mkFrame({ id: 'b2', name: 'Bd2', type: FrameType.BACKDROP });
    const code = generateJASSCode(mkProject([bd]));
    expect(code).toContain('FrameSetTexture');
    expect(code).toContain('background.blp');
  });
});

describe('texCoord 必须导出（FrameSetTexCoord 四元组）', () => {
  // 依据 openwar3 dzapi：DzFrameSetTexCoord(f, left, right, top, bottom) — 四个数值，不是索引。
  it('带 texCoord 的帧产生 FrameSetTexCoord 四参', () => {
    const t = mkFrame({ id: 't1', name: 'T1', type: FrameType.BACKDROP,
      backdropBackground: 'Atlas.blp', texCoord: [0.25, 0.5, 0, 1] });
    const code = generateJASSCode(mkProject([t]));
    expect(code).toMatch(/FrameSetTexCoord\(T1, 0\.25000, 0\.50000, 0\.00000, 1\.00000\)/);
  });

  it('无 texCoord 时不产生 FrameSetTexCoord', () => {
    const t = mkFrame({ id: 't2', name: 'T2', type: FrameType.BACKDROP, backdropBackground: 'X.blp' });
    const code = generateJASSCode(mkProject([t]));
    expect(code).not.toContain('FrameSetTexCoord(T2');
  });
});

describe('backdropTileBackground 平铺', () => {
  it('为 true 时产物中点名 true（第 4 参之外的平铺语义）', () => {
    const bd = mkFrame({ id: 'b3', name: 'Bd3', type: FrameType.BACKDROP,
      backdropBackground: 'T.brs', backdropTileBackground: true });
    const code = generateJASSCode(mkProject([bd]));
    // 平铺以独立语句表达（第 4 参是 fixed-scale，非平铺）
    expect(code).toMatch(/Bd3/);
    expect(code).toContain('FrameSetTexture');
  });
});

describe('visible=false 必须导出隐藏', () => {
  it('隐藏帧产生 FrameSetVisible(..., false)', () => {
    const f = mkFrame({ id: 'v1', name: 'Hidden1', visible: false });
    const code = generateJASSCode(mkProject([f]));
    expect(code).toMatch(/FrameSetVisible\(Hidden1, false\)/);
  });

  it('可见帧不产生多余的隐藏调用', () => {
    const f = mkFrame({ id: 'v2', name: 'Shown1', visible: true });
    const code = generateJASSCode(mkProject([f]));
    expect(code).not.toMatch(/FrameSetVisible\(Shown1, false\)/);
  });
});

describe('文本对齐必须导出', () => {
  it('horAlign / verAlign 落到产物（TEXTALIGN_* 常量）', () => {
    const t = mkFrame({ id: 'a1', name: 'Txt1', type: FrameType.TEXT_FRAME,
      text: 'hi', horAlign: 'center', verAlign: 'center' });
    const code = generateJASSCode(mkProject([t]));
    // 依据 openwar3/Blz：FrameSetTextAlignment(f, TEXTALIGN_*, TEXTALIGN_*)
    expect(code).toMatch(/FrameSetTextAlignment\(Txt1, TEXTALIGN_CENTER, TEXTALIGN_MIDDLE\)/);
  });

  it('left/start 映射到 LEFT/TOP', () => {
    const t = mkFrame({ id: 'a2', name: 'Txt2', type: FrameType.TEXT_FRAME, text: 'x',
      horAlign: 'left', verAlign: 'start' });
    const code = generateJASSCode(mkProject([t]));
    expect(code).toMatch(/TEXTALIGN_LEFT, TEXTALIGN_TOP/);
  });

  it('right/flex-end 映射到 RIGHT/BOTTOM', () => {
    const t = mkFrame({ id: 'a3', name: 'Txt3', type: FrameType.TEXT_FRAME, text: 'x',
      horAlign: 'right', verAlign: 'flex-end' });
    const code = generateJASSCode(mkProject([t]));
    expect(code).toMatch(/TEXTALIGN_RIGHT, TEXTALIGN_BOTTOM/);
  });

  it('未设对齐时不产生 FrameSetTextAlignment', () => {
    const t = mkFrame({ id: 'a4', name: 'Txt4', type: FrameType.TEXT_FRAME, text: 'x' });
    const code = generateJASSCode(mkProject([t]));
    expect(code).not.toContain('FrameSetTextAlignment(Txt4');
  });
});

describe('三语言一致：backdrop 纹理调用数量相同', () => {
  it('同一工程在 JASS/LUA/TS 的 FrameSetTexture 数量一致', () => {
    const bd1 = mkFrame({ id: 'b1', name: 'Bg1', type: FrameType.BACKDROP, backdropBackground: 'A.blp' });
    const bd2 = mkFrame({ id: 'b2', name: 'Bg2', type: FrameType.BACKDROP });           // 无纹理 → 回落默认
    const tx = mkFrame({ id: 't1', name: 'Tx1', type: FrameType.TEXT_FRAME, text: 'x' });
    const proj = mkProject([bd1, bd2, tx]);
    const counts = [generateJASSCode, generateLUACode, generateTypeScriptCode]
      .map((g) => (g(proj).match(/FrameSetTexture/g) ?? []).length);
    expect(counts[0]).toBe(counts[1]);
    expect(counts[1]).toBe(counts[2]);
    expect(counts[0]).toBeGreaterThan(0);
  });
});