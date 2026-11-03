/**
 * luaGenerator 的产物正确性与功能完整性守卫。
 *
 * 审计发现（luaGenerator 是**独立于 codeExport 的另一条导出链路**）：
 * 1. **texCoord 参数错序**：`frame.texCoord` 定义为 `[left, right, top, bottom]`，
 * 但产物写成 `API.SetTexCoord(frame, left, top, right, bottom)` —— `right`/`top` 互换，
 * 纹理区域裁错。引擎 `DzFrameSetTexCoord(f, l, r, t, b)`（openwar3 dzapi 确认）按 r 在前。
 * 2. **Reforged 分支的 SetTexCoord 是空壳**：只 `print` 警告、**不设置任何值**。
 * 3. **6 个隐藏开关全未接入** → 勾选后导出即静默丢失。
 * 4. **文本对齐 horAlign/verAlign 未接入**。
 * 5. **alphaMode 无法运行时设置**（`DzFrameSetTexture` 只有 frame/path/texCoord/fixedScale），
 * 属 FDF 模板属性；本条只断言"不伪装成已支持"。
 *
 * 说明：API 包装在 `generateLoaderScript()` 里，Frame 创建代码在 `generate()` 里——两者分开断言。
 */
import { describe, it, expect } from 'vitest';
import { FrameType, type ProjectData, type FrameData } from '../types';
import { LuaUIGenerator, generateLoaderScript } from './luaGenerator';

function mkFrame(o: Partial<FrameData> & { id: string; name: string }): FrameData {
  return {
    type: FrameType.FRAME, x: 0, y: 0, width: 0.1, height: 0.1,
    anchors: [], children: [], ...o,
  } as FrameData;
}
function mkProject(frames: FrameData[], o: Partial<ProjectData> = {}): ProjectData {
  const rec: Record<string, FrameData> = {};
  for (const f of frames) rec[f.id] = f;
  return {
    version: 2, libraryName: 'TestLib', originMode: 'gameui', exportVersion: 'reforged',
    hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
    hideButtonBar: false, hidePortrait: false, hideChat: false,
 frames: rec,
    rootFrameIds: frames.filter((f) => !f.parentId).map((f) => f.id),
    ...o,
  } as unknown as ProjectData;
}
function gen(frames: FrameData[], o: Partial<ProjectData> = {}): string {
  return new LuaUIGenerator(mkProject(frames, o)).generate();
}
function loader(frames: FrameData[]): string {
  return generateLoaderScript(mkProject(frames));
}

describe('texCoord 参数顺序必须是 (left, right, top, bottom)', () => {
  it('产物按 right 在前的顺序传参', () => {
    const bd = mkFrame({ id: 'b1', name: 'Bd', type: FrameType.BACKDROP,
      texCoord: [0.25, 0.5, 0.1, 0.9] });
    const code = gen([bd]);
    expect(code).toMatch(/SetTexCoord\(frame, 0\.25, 0\.5, 0\.1, 0\.9\)/);
  });
});

describe('loader 脚本：API 包装必须与引擎签名一致', () => {
  it('SetTexCoord 形参为 (frame, left, right, top, bottom)', () => {
    const code = loader([mkFrame({ id: 'f1', name: 'F1' })]);
    expect(code).not.toMatch(/function\(frame, left, top, right, bottom\)/);
    expect(code).toMatch(/function\(frame, left, right, top, bottom\)/);
  });

  it('Reforged 分支的 SetTexCoord 不再是空壳，必须真正调用 BlzFrameSetTexCoord', () => {
    const code = loader([mkFrame({ id: 'f1', name: 'F1' })]);
    expect(code).toContain('BlzFrameSetTexCoord');
    expect(code).not.toMatch(/SetTexCoord 在 Reforged 中可能不支持/);
  });

  it('loader 提供 GetOriginFrame / GetFrameByName / HideOriginFrames / SetTextAlignment 包装', () => {
    const code = loader([mkFrame({ id: 'f1', name: 'F1' })]);
    expect(code).toMatch(/API\.GetOriginFrame/);
    expect(code).toMatch(/API\.GetFrameByName/);
    expect(code).toMatch(/API\.HideOriginFrames/);
    expect(code).toMatch(/API\.SetTextAlignment/);
  });
});

describe('6 个隐藏开关必须接入', () => {
  const cases: Array<[string, string]> = [
    ['hideMiniMap', 'ORIGIN_FRAME_MINIMAP'],
    ['hideHeroBar', 'ORIGIN_FRAME_HERO_BUTTON'],
    ['hidePortrait', 'ORIGIN_FRAME_PORTRAIT'],
    ['hideChat', 'ORIGIN_FRAME_CHAT_MSG'],
    ['hideButtonBar', 'ORIGIN_FRAME_SIMPLE_BUTTON'],
  ];
  for (const [flag, origin] of cases) {
    it(`${flag} → 隐藏 ${origin}`, () => {
      const code = gen([mkFrame({ id: 'f1', name: 'F1' })], { [flag]: true } as Partial<ProjectData>);
      expect(code).toContain(origin);
    });
  }

  it('hideResources → 按名字隐藏 ResourceBar', () => {
    const code = gen([mkFrame({ id: 'f1', name: 'F1' })], { hideResources: true } as Partial<ProjectData>);
    expect(code).toMatch(/ResourceBar/);
  });

  it('未勾选时不含多余的隐藏调用', () => {
    const code = gen([mkFrame({ id: 'f1', name: 'F1' })]);
    expect(code).not.toContain('ORIGIN_FRAME_MINIMAP');
  });

  it('hideGameUI → 调用 HideOriginFrames(true)', () => {
    const code = gen([mkFrame({ id: 'f1', name: 'F1' })], { hideGameUI: true } as Partial<ProjectData>);
    expect(code).toContain('HideOriginFrames(true)');
  });
});

describe('文本对齐必须接入', () => {
  it('horAlign/verAlign 产生 SetTextAlignment 调用', () => {
    const t = mkFrame({ id: 't1', name: 'T1', type: FrameType.TEXT_FRAME,
      text: 'hi', horAlign: 'center', verAlign: 'center' });
    const code = gen([t]);
    expect(code).toMatch(/SetTextAlignment\(frame, TEXTALIGN_CENTER, TEXTALIGN_MIDDLE\)/);
  });

  it('left/start → LEFT/TOP', () => {
    const t = mkFrame({ id: 't2', name: 'T2', type: FrameType.TEXT_FRAME,
      text: 'x', horAlign: 'left', verAlign: 'start' });
    expect(gen([t])).toMatch(/TEXTALIGN_LEFT, TEXTALIGN_TOP/);
  });

  it('未设对齐时不产生该调用', () => {
    const t = mkFrame({ id: 't3', name: 'T3', type: FrameType.TEXT_FRAME, text: 'x' });
    expect(gen([t])).not.toContain('SetTextAlignment(frame,');
  });
});

describe('alphaMode：引擎无运行时 API，如实记录（不臆造）', () => {
  it('产物不得凭空生成 SetAlphaMode 之类不存在的调用', () => {
    const bd = mkFrame({ id: 'b2', name: 'Bd2', type: FrameType.BACKDROP,
      backdropBackground: 'x.blp', alphaMode: 'ALPHAKEY' });
    const code = gen([bd]);
 // 依据 openwar3 dzapi：DzFrameSetTexture 只有 (frame,path,texCoord,fixedScale)，
 // 无 alphaMode 运行时接口；alphaMode 属 FDF 模板属性（由 FDF 导出承担）。
    expect(code).not.toMatch(/SetAlphaMode/);
  });
});
