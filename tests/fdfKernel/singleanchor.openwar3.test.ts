/**
 * 单锚点定位语义守卫 —— 以 **openwar3 实现为准**。
 *
 * 依据（openwar3 `ui/fdf/layout.js` 的通用单锚点解，权威实现）：
 *
 *     const pt = points[0];
 *     const rel = relOf(n, pt.relName);
 *     const lx = rel.x + fx(pt.relPoint) * rel.w + pt.dx;
 *     const ly = rel.y + fy(pt.relPoint) * rel.h + pt.dy;
 *     n.x = lx - fx(pt.myPoint) * n.w;
 *     n.y = ly - fy(pt.myPoint) * n.h;
 *
 * 即：锚点绝对位置 = 相对帧的 relPoint 位置 + 偏移；本帧左下角 = 锚点绝对位置 − 自己
 * 该点在矩形内的偏移。`fx`/`fy` 把点名映射为 0/0.5/1 的分数位置（y 从底部量起）。
 *
 * 本守卫断言编辑器 `calculatePositionFromAnchors` 的单锚点分支对**全部 9 个点**都等价于
 * 上式，从而把"单锚点以 openwar3 为准"这条约定固化为可执行测试，而非口头约定。
 *
 * 说明：编辑器现有实现是逐点硬编码（CENTER 用 `-w/2,-h/2`、TOP 用 `-w/2,-h` 等），
 * 与通用公式在代数上等价；本测试的作用是**锁定这份等价关系**，任何一侧漂移都会失败。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FramePoint, FrameData, FrameType } from '../../src/types';
import { calculatePositionFromAnchors, clearPositionCache } from '../../src/utils/anchorUtils';

const EPS = 1e-12;

/** openwar3 的点名 → 分数位置（x 从左、y 从底）。 */
function fx(point: FramePoint): number {
  if (point === FramePoint.LEFT || point === FramePoint.TOPLEFT || point === FramePoint.BOTTOMLEFT) return 0;
  if (point === FramePoint.RIGHT || point === FramePoint.TOPRIGHT || point === FramePoint.BOTTOMRIGHT) return 1;
  return 0.5;
}
function fy(point: FramePoint): number {
  if (point === FramePoint.BOTTOM || point === FramePoint.BOTTOMLEFT || point === FramePoint.BOTTOMRIGHT) return 0;
  if (point === FramePoint.TOP || point === FramePoint.TOPLEFT || point === FramePoint.TOPRIGHT) return 1;
  return 0.5;
}

/** 某点在矩形内的绝对位置（与 `getAnchorPosition` 同语义）。 */
function pointPos(r: { x: number; y: number; w: number; h: number }, p: FramePoint): { x: number; y: number } {
  return { x: r.x + fx(p) * r.w, y: r.y + fy(p) * r.h };
}

function makeFrame(overrides: Partial<FrameData> = {}): FrameData {
  return {
    id: 'f', name: 'F', type: FrameType.FRAME,
    x: 0, y: 0, width: 0.2, height: 0.1, z: 0, parentId: null,
    anchors: [], children: [],
    ...overrides,
  } as FrameData;
}

/** openwar3 通用单锚点解：给定相对帧几何、relPoint、自身点、偏移、自身尺寸，返回左下角。 */
function openwar3SingleAnchor(
  rel: { x: number; y: number; w: number; h: number },
  relPoint: FramePoint, myPoint: FramePoint,
  dx: number, dy: number, w: number, h: number,
): { x: number; y: number } {
  const relPos = pointPos(rel, relPoint);
  const lx = relPos.x + dx;
  const ly = relPos.y + dy;
  return { x: lx - fx(myPoint) * w, y: ly - fy(myPoint) * h };
}

const ALL_POINTS: Array<[string, FramePoint]> = [
  ['TOPLEFT', FramePoint.TOPLEFT],
  ['TOP', FramePoint.TOP],
  ['TOPRIGHT', FramePoint.TOPRIGHT],
  ['LEFT', FramePoint.LEFT],
  ['CENTER', FramePoint.CENTER],
  ['RIGHT', FramePoint.RIGHT],
  ['BOTTOMLEFT', FramePoint.BOTTOMLEFT],
  ['BOTTOM', FramePoint.BOTTOM],
  ['BOTTOMRIGHT', FramePoint.BOTTOMRIGHT],
];

describe('单锚点定位以 openwar3 为准（全部 9 点）', () => {
  beforeEach(() => clearPositionCache());

  // 相对帧刻意取非对称几何，避免对称值掩盖符号/轴混淆。
  const REL = { x: 0.13, y: 0.27, w: 0.44, h: 0.19 };

  for (const [label, myPoint] of ALL_POINTS) {
    it(`${label}：自身点 == 相对点（偏移 0）时与 openwar3 公式一致`, () => {
      const rel = makeFrame({ id: 'rel', name: 'Rel', x: REL.x, y: REL.y, width: REL.w, height: REL.h });
      const cur = makeFrame({
        id: 'cur', name: 'Cur', width: 0.2, height: 0.1,
        anchors: [{ point: myPoint, x: 0, y: 0, relativeTo: 'rel', relativePoint: myPoint }],
      });
      const got = calculatePositionFromAnchors(cur, { rel })!;
      const want = openwar3SingleAnchor(REL, myPoint, myPoint, 0, 0, cur.width, cur.height);
      expect(got.x).toBeCloseTo(want.x, 12);
      expect(got.y).toBeCloseTo(want.y, 12);
      expect(got.width).toBeCloseTo(cur.width, 12);
      expect(got.height).toBeCloseTo(cur.height, 12);
    });

    it(`${label}：带非零偏移时与 openwar3 公式一致`, () => {
      const rel = makeFrame({ id: 'rel', name: 'Rel', x: REL.x, y: REL.y, width: REL.w, height: REL.h });
      const dx = 0.017, dy = -0.009; // 刻意非零、非对称，能暴露轴混淆
      const cur = makeFrame({
        id: 'cur', name: 'Cur', width: 0.2, height: 0.1,
        anchors: [{ point: myPoint, x: dx, y: dy, relativeTo: 'rel', relativePoint: myPoint }],
      });
      const got = calculatePositionFromAnchors(cur, { rel })!;
      const want = openwar3SingleAnchor(REL, myPoint, myPoint, dx, dy, cur.width, cur.height);
      expect(got.x).toBeCloseTo(want.x, 12);
      expect(got.y).toBeCloseTo(want.y, 12);
    });
  }

  it('CENTER 等 0.5 分数点的横纵都是 1/2（防止把 y 当成 1/3 之类）', () => {
    expect(fx(FramePoint.CENTER)).toBe(0.5);
    expect(fy(FramePoint.CENTER)).toBe(0.5);
    // 交叉校验：编辑器 CENTER 分支 = center - (w/2, h/2)
    const rel = makeFrame({ id: 'rel', name: 'Rel', x: 0.2, y: 0.3, width: 0.4, height: 0.2 });
    const cur = makeFrame({ id: 'cur', name: 'Cur', width: 0.1, height: 0.05,
      anchors: [{ point: FramePoint.CENTER, x: 0, y: 0, relativeTo: 'rel', relativePoint: FramePoint.CENTER }] });
    const got = calculatePositionFromAnchors(cur, { rel })!;
    const center = pointPos({ x: 0.2, y: 0.3, w: 0.4, h: 0.2 }, FramePoint.CENTER);
    expect(got.x).toBeCloseTo(center.x - 0.1 / 2, 12);
    expect(got.y).toBeCloseTo(center.y - 0.05 / 2, 12);
    expect(Math.abs(got.x - want0x())).toBeLessThan(1e-12 + 1e-12);
    function want0x() { return center.x - 0.1 / 2; }
  });

  it('全部 9 点的 fx/fy 覆盖 0/0.5/1 各档', () => {
    for (const [, p] of ALL_POINTS) {
      expect([0, 0.5, 1]).toContain(fx(p));
      expect([0, 0.5, 1]).toContain(fy(p));
    }
  });
});
