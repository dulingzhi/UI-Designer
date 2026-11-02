/**
 * FDFExporterEnhanced 端到端往返守卫
 *
 * 背景：roundtrip.real 守卫覆盖的是 exportUtils.generateFrameFDF 路径；
 * 本文件补齐 FDFExporterEnhanced（MenuBar "导入增强 FDF" 用的独立导出实现）的
 * 端到端往返——Enhanced 导出 → 内核 parseFdf 导入 → 字段比对。
 * 教训（fullRoundtrip 同款）：mock AST 测试抓不到"属性名对不上/布局漂移"类断裂，
 * 只有真实产物 → 真 parser 的穿透才能验证。
 */
import { describe, it, expect } from 'vitest';
import { FDFExporterEnhanced } from './fdfExporter';
import { importFromFDFText } from './fdfImport';
import type { FrameData } from '../types';

function makeFrame(over: Partial<FrameData>): FrameData {
  return {
    id: 'f1',
    name: 'TestFrame',
    type: 'FRAME',
    x: 0.1,
    y: 0.2,
    width: 0.3,
    height: 0.15,
    children: [],
    anchors: [{ point: 0, x: 0.1, y: 0.2 }],
    ...over,
  } as FrameData;
}

describe('FDFExporterEnhanced → 内核 parseFdf 往返', () => {
  it('单帧基础几何经 exportEnhanced 标准分支（无 rawProperties）往返', async () => {
    const exporter = new FDFExporterEnhanced({ baseWidth: 0.8, baseHeight: 0.6 });
    const frames = [makeFrame({})];
    const fdfText = exporter.exportEnhanced(frames);
    expect(fdfText).toContain('Frame "FRAME" "TestFrame"');

    const parsed = await importFromFDFText(fdfText);
    expect(parsed.length).toBe(1);
    const back = parsed[0];
    // 几何：Anchor TOPLEFT 相对父（归一化 offset 0.125/0.333）经导入写回
    expect(back.anchors?.length).toBeGreaterThanOrEqual(1);
    // Width/Height 语义：导出除以 base（0.3/0.8=0.375）归一化为父宽比，
    // 渲染时 × 父宽还原——往返断言语义链而非原始值
    expect(back.width * 0.8).toBeCloseTo(0.3, 4);
    expect(back.height * 0.6).toBeCloseTo(0.15, 4);
  });

  it('带文本/纹理的帧走标准分支往返后字段保留', async () => {
    const exporter = new FDFExporterEnhanced({ baseWidth: 0.8, baseHeight: 0.6 });
    const frames = [
      makeFrame({
        name: 'TextFrame',
        text: 'He said "hi"',
        texture: 'UI\\Widgets\\X.blp',
      }),
    ];
    const fdfText = exporter.exportEnhanced(frames);

    const parsed = await importFromFDFText(fdfText);
    expect(parsed.length).toBe(1);
    const back = parsed[0];
    // 双写引号转义与反斜杠转义经导入 enhance 写回可编辑字段
    expect(back.text).toBe('He said "hi"');
    expect(back.texture).toBe('UI\\Widgets\\X.blp');
  });

  it('嵌套父子帧走标准分支往返保持层级', async () => {
    const exporter = new FDFExporterEnhanced({ baseWidth: 0.8, baseHeight: 0.6 });
    // 生产契约（fileOperations 迁移 + store 双侧同步）：parentId 与 children 互为镜像
    const child = makeFrame({ id: 'c1', name: 'ChildFrame', x: 0.05, y: 0.05, width: 0.1, height: 0.1, parentId: 'p1' });
    const parent = makeFrame({ id: 'p1', name: 'ParentFrame', children: ['c1'] });
    const fdfText = exporter.exportEnhanced([parent, child]);

    // 防双导出：child 有 parentId，不得再出现在顶层（topLevel 判定 `!f.parentId`
    // 与 children 递归导出依赖该契约；child 缺 parentId 会被导出两次）
    expect(fdfText.match(/"ChildFrame"/g)?.length).toBe(1);

    const parsed = await importFromFDFText(fdfText);
    // 层级保持：child 名在导入结果中出现恰一次（防双导出在导入侧的镜像断言）；
    // 结构由 children/parentId 链承载（旧 transformer 层级语义）
    const allNames = parsed.map((f) => f.name);
    expect(allNames.filter((n) => n === 'ChildFrame').length).toBe(1);
    expect(allNames).toContain('ParentFrame');
  });
});
