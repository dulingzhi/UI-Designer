/**
 * planSplitEdges — 拆分边缘 Backdrop 规划测试 (纯函数)
 */
import { describe, it, expect } from 'vitest';
import { FrameType, type FrameData } from '../../src/types';
import { planSplitEdges } from '../../src/renderer/backdropSplitEdges';

const passthru = (p: string | undefined) => p;

function mkFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'bk',
    name: 'HeavyBorder',
    type: FrameType.BACKDROP,
    x: 0, y: 0, width: 0.2, height: 0.1,
    backdropCornerFile: 'corner.blp',
    backdropTopFile: 'top.blp',
    backdropBottomFile: 'bottom.blp',
    backdropLeftFile: 'left.blp',
    backdropRightFile: 'right.blp',
    backdropCornerSize: 0.008,
    ...overrides,
  } as FrameData;
}

describe('planSplitEdges — 8 slice 组装', () => {
  it('全 5 文件 → 8 flags 齐备', () => {
    const plan = planSplitEdges(mkFrame(), passthru, 400, 200, 40);
    const flags = Array.from(plan.keys()).sort();
    expect(flags).toEqual(['B', 'BL', 'BR', 'L', 'R', 'T', 'UL', 'UR']);
  });

  it('缺 CornerFile 时仅边缘 4 flags', () => {
    const plan = planSplitEdges(
      mkFrame({ backdropCornerFile: undefined }),
      passthru, 400, 200, 40,
    );
    expect(Array.from(plan.keys()).sort()).toEqual(['B', 'L', 'R', 'T']);
  });

  it('仅 CornerFile → 4 角无边', () => {
    const plan = planSplitEdges(
      {
        backdropCornerFile: 'c.blp',
        backdropTopFile: undefined,
        backdropBottomFile: undefined,
        backdropLeftFile: undefined,
        backdropRightFile: undefined,
      },
      passthru, 400, 200, 40,
    );
    expect(Array.from(plan.keys()).sort()).toEqual(['BL', 'BR', 'UL', 'UR']);
  });

  it('cornerSizePx = 0 → 空 plan', () => {
    const plan = planSplitEdges(mkFrame(), passthru, 400, 200, 0);
    expect(plan.size).toBe(0);
  });

  it('全空 → 空 plan', () => {
    const plan = planSplitEdges(
      { backdropCornerFile: undefined, backdropTopFile: undefined,
        backdropBottomFile: undefined, backdropLeftFile: undefined, backdropRightFile: undefined },
      passthru, 400, 200, 40,
    );
    expect(plan.size).toBe(0);
  });
});

describe('planSplitEdges — 角 UV 镜像', () => {
  const plan = planSplitEdges(mkFrame(), passthru, 400, 200, 40);

  it('UL: 原图 (repeat 1,1 offset 0,0)', () => {
    const uv = plan.get('UL')!;
    expect(uv.path).toBe('corner.blp');
    expect(uv.repeatX).toBe(1);
    expect(uv.repeatY).toBe(1);
    expect(uv.offsetX).toBe(0);
    expect(uv.offsetY).toBe(0);
  });

  it('UR: X 翻转 (repeat -1,1 offset 1,0)', () => {
    const uv = plan.get('UR')!;
    expect(uv.repeatX).toBe(-1);
    expect(uv.offsetX).toBe(1);
    expect(uv.repeatY).toBe(1);
    expect(uv.offsetY).toBe(0);
  });

  it('BL: Y 翻转 (repeat 1,-1 offset 0,1)', () => {
    const uv = plan.get('BL')!;
    expect(uv.repeatX).toBe(1);
    expect(uv.repeatY).toBe(-1);
    expect(uv.offsetX).toBe(0);
    expect(uv.offsetY).toBe(1);
  });

  it('BR: XY 翻转 (repeat -1,-1 offset 1,1)', () => {
    const uv = plan.get('BR')!;
    expect(uv.repeatX).toBe(-1);
    expect(uv.repeatY).toBe(-1);
    expect(uv.offsetX).toBe(1);
    expect(uv.offsetY).toBe(1);
  });

  it('4 角共享同一 path', () => {
    expect(plan.get('UL')!.path).toBe('corner.blp');
    expect(plan.get('UR')!.path).toBe('corner.blp');
    expect(plan.get('BL')!.path).toBe('corner.blp');
    expect(plan.get('BR')!.path).toBe('corner.blp');
  });
});

describe('planSplitEdges — 边缘平铺', () => {
  it('T/B: 沿 X 重复, wrapRepeatX=true', () => {
    // width 400, cornerSize 40 → edgeRepeatX = (400-80)/40 = 8
    const plan = planSplitEdges(mkFrame(), passthru, 400, 200, 40);
    const t = plan.get('T')!;
    expect(t.path).toBe('top.blp');
    expect(t.repeatX).toBe(8);
    expect(t.repeatY).toBe(1);
    expect(t.wrapRepeatX).toBe(true);
    expect(t.wrapRepeatY).toBe(false);
  });

  it('L/R: 沿 Y 重复, wrapRepeatY=true', () => {
    // height 200, cornerSize 40 → edgeRepeatY = (200-80)/40 = 3
    const plan = planSplitEdges(mkFrame(), passthru, 400, 200, 40);
    const l = plan.get('L')!;
    expect(l.path).toBe('left.blp');
    expect(l.repeatX).toBe(1);
    expect(l.repeatY).toBe(3);
    expect(l.wrapRepeatX).toBe(false);
    expect(l.wrapRepeatY).toBe(true);
  });

  it('宽度 <= 2*cornerSize 时边缘 repeat 回退到 1', () => {
    const plan = planSplitEdges(mkFrame(), passthru, 80, 80, 40);
    expect(plan.get('T')!.repeatX).toBe(1);
    expect(plan.get('L')!.repeatY).toBe(1);
  });
});

describe('planSplitEdges — resolvePath 透传', () => {
  it('使用 resolvePath 修改每个 path', () => {
    const plan = planSplitEdges(
      mkFrame(),
      (p) => p ? `PREFIX/${p}` : undefined,
      400, 200, 40,
    );
    expect(plan.get('UL')!.path).toBe('PREFIX/corner.blp');
    expect(plan.get('T')!.path).toBe('PREFIX/top.blp');
  });

  it('resolvePath 返回 undefined → 跳过该 flag', () => {
    const plan = planSplitEdges(
      mkFrame({ backdropCornerFile: 'missing' }),
      (p) => (p === 'missing' ? undefined : p),
      400, 200, 40,
    );
    expect(plan.has('UL')).toBe(false);
    expect(plan.has('T')).toBe(true);
  });
});
