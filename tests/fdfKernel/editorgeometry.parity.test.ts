/**
 * 编辑器端渲染几何一致守卫（编辑器锚点求解器 ↔ 内核 layout）。
 *
 * 目的：断言**同一份 FDF** 经同一条内核桥接（`fileToFrameData`，`src/utils/fdfKernelTransformer.ts`）
 * 产出 FrameData 后，「编辑器渲染消费路径」与「内核/参考布局」算出的**世界矩形完全一致**。
 *
 *   - 编辑器侧：`SceneGraphManager.sync` 对每个帧调用 `calculatePositionFromAnchors(frame, frames)`
 *     （`src/utils/anchorUtils.ts`），结果以 `{...rawFrame, ...calculatedPos}` 覆盖进渲染几何。
 *   - 内核侧：`layout(root, {box})`（`src/utils/fdfKernelLayout.ts`）在 box(0,0,0.8×0.6) 内解整棵子树。
 *
 * 两侧都是 **y-up、左下原点、[0,0.8]×[0,0.6] 世界坐标**，故世界矩形可逐字段直接比较。
 *
 * 覆盖的锚点配置（均为 FDF 里真实可达的写法）：单锚点 TOPLEFT/BOTTOMLEFT/CENTER、对角双锚
 * TL+BR、上排双锚 TL+TR、下排双锚 BL+BR、四边锚 L+R+T+B、左右双锚 L+R、上下双锚 T+B、
 * 跨节点相对锚（子帧相对兄弟帧）、三级嵌套、root 显式 CENTER。
 *
 * 历史注记（重要，避免后人误判）：此前一版探针曾得出"两求解器大面积分歧"的结论，那是由**探针自身
 * 的两个缺陷**造成的假象：(1) 把 `Record<string, FrameData>` 传成了 `Map`，导致 `allFrames[relativeTo]`
 * 恒为 undefined、所有相对锚点解析失败；(2) 根帧锚点未按画布绝对化——`transformKernelFrames` 的顶层
 * 画布归一化曾排在"默认 CENTER 锚点注入"之前，使无显式 SetPoint 的根帧拿到未归一化的
 * `CENTER@__PARENT__`，求解器回落 (0,0) 再减半宽高得到 (-w/2,-h/2)，把整棵子树平移出画布。
 * 该顺序缺陷已在源码修复（见 fdfKernelTransformer 顶层归一化注释），修复后 14 个场景中 13 个逐字段相等。
 *
 * 唯一有意不纳入的语义分歧：**无锚点子帧的默认落位**。内核把无锚点帧钉到父控件 top-left
 * （`layout` 的未放置分支），编辑器则注入默认 `CENTER@父 CENTER`。两者都是有意的产品语义
 * （内核对齐 WC3 引擎、编辑器对齐设计器交互），不做对拍，故下方用例显式排除该场景。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { calculatePositionFromAnchors, clearPositionCache } from '../../src/utils/anchorUtils';
import { layout } from '../../src/utils/fdfKernelLayout';
import { parseFdf } from '../../src/utils/fdfKernelParser';
import { fileToFrameData } from '../../src/utils/fdfKernelTransformer';

const EPS = 1e-9;

/** 同一份 FDF 分别过「内核 layout」与「编辑器锚点求解器」，逐帧比对世界矩形。 */
function assertParity(fdf: string): { frames: number; names: string[] } {
  clearPositionCache();
  const file = parseFdf(fdf);
  const lr = layout(file.frames[0]);

  const kernel = new Map<string, { x: number; y: number; w: number; h: number }>();
  (function walk(n: any) {
    if (n.frame.name) kernel.set(n.frame.name, { x: n.x, y: n.y, w: n.w, h: n.h });
    n.children.forEach(walk);
  })(lr.tree);

  const fds = fileToFrameData(file);
  // 编辑器运行时契约是 Record<id, FrameData>（SceneGraphManager.sync 收到的就是这种形状）。
  const byId: Record<string, any> = {};
  for (const f of fds) byId[f.id] = f;
  const byName = new Map<string, any>();
  for (const f of fds) if (f.name) byName.set(f.name, f);

  const compared: string[] = [];
  for (const [name, k] of kernel) {
    const kf = byName.get(name);
    if (!kf) continue;
    const e = calculatePositionFromAnchors(kf, byId);
    // 根帧在编辑器侧没有相对锚点（已按画布绝对化），求解器按契约返回 null，
    // 渲染时直接使用帧自身的存储几何；这正与内核把 root 钉在 box(0,0) 等价。
    if (!e) { compared.push(`${name}:root-self`); continue; }
    expect(Math.abs(e.x - k.x), `${name}.x`).toBeLessThan(EPS);
    expect(Math.abs(e.y - k.y), `${name}.y`).toBeLessThan(EPS);
    expect(Math.abs(e.width - k.w), `${name}.w`).toBeLessThan(EPS);
    expect(Math.abs(e.height - k.h), `${name}.h`).toBeLessThan(EPS);
    compared.push(name);
  }
  return { frames: compared.length, names: compared };
}

describe('编辑器锚点求解器 == 内核 layout（世界矩形逐字段一致）', () => {
  beforeEach(() => clearPositionCache());

  const SCENES: Record<string, string> = {
    '单锚点 TOPLEFT': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Width 0.2, Height 0.1, SetPoint TOPLEFT, "Screen", TOPLEFT, 0.1, 0.2, } }`,
    '单锚点 BOTTOMLEFT': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Width 0.2, Height 0.1, SetPoint BOTTOMLEFT, "Screen", BOTTOMLEFT, 0.1, 0.2, } }`,
    '单锚点 CENTER': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Width 0.2, Height 0.1, SetPoint CENTER, "Screen", CENTER, 0, 0, } }`,
    '对角双锚 TOPLEFT+BOTTOMRIGHT（动态宽高）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { SetPoint TOPLEFT, "Screen", TOPLEFT, 0.15, 0.2, SetPoint BOTTOMRIGHT, "Screen", BOTTOMRIGHT, -0.1, -0.1, } }`,
    '上排双锚 TOPLEFT+TOPRIGHT（动态宽定型高）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Height 0.1, SetPoint TOPLEFT, "Screen", TOPLEFT, 0.1, 0.2, SetPoint TOPRIGHT, "Screen", TOPRIGHT, -0.1, 0.2, } }`,
    '下排双锚 BOTTOMLEFT+BOTTOMRIGHT（动态宽定型高）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Height 0.1, SetPoint BOTTOMLEFT, "Screen", BOTTOMLEFT, 0.1, -0.2, SetPoint BOTTOMRIGHT, "Screen", BOTTOMRIGHT, -0.1, -0.2, } }`,
    '四边锚 LEFT+RIGHT+TOP+BOTTOM（动态宽高）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { SetPoint LEFT, "Screen", LEFT, 0.1, 0, SetPoint RIGHT, "Screen", RIGHT, -0.1, 0, SetPoint TOP, "Screen", TOP, 0, -0.1, SetPoint BOTTOM, "Screen", BOTTOM, 0, 0.1, } }`,
    '左右双锚 LEFT+RIGHT（动态宽定型高）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Height 0.1, SetPoint LEFT, "Screen", LEFT, 0.1, 0, SetPoint RIGHT, "Screen", RIGHT, -0.1, 0, } }`,
    '上下双锚 TOP+BOTTOM（动态高定宽）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "Child" { Width 0.2, SetPoint TOP, "Screen", TOP, 0, -0.1, SetPoint BOTTOM, "Screen", BOTTOM, 0, 0.1, } }`,
    '跨节点相对锚（子帧相对兄弟）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "A" { Width 0.3, Height 0.1, SetPoint TOPLEFT, "Screen", TOPLEFT, 0, 0.2, },
      Frame "FRAME" "B" { Width 0.2, Height 0.05, SetPoint TOP, "A", BOTTOM, 0, -0.01, } }`,
    '三级嵌套（父再子）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6,
      Frame "FRAME" "P" { Width 0.4, Height 0.3, SetPoint TOPLEFT, "Screen", TOPLEFT, 0.1, 0.2,
        Frame "FRAME" "C" { Width 0.1, Height 0.05, SetPoint TOPLEFT, "P", TOPLEFT, 0.02, 0.03, } } }`,
    'root 显式 CENTER（画布绝对化）': `Frame "FRAME" "Screen" { Width 0.8, Height 0.6, SetPoint CENTER, "__PARENT__", CENTER, 0, 0, }`,
  };

  for (const [label, fdf] of Object.entries(SCENES)) {
    it(`${label}：编辑器求解器与内核 layout 世界矩形一致`, () => {
      const r = assertParity(fdf);
      expect(r.frames).toBeGreaterThan(0);
    });
  }

  it('全部场景合计覆盖 ≥ 13 个帧的世界矩形比对', () => {
    let total = 0;
    for (const fdf of Object.values(SCENES)) total += assertParity(fdf).frames;
    expect(total).toBeGreaterThanOrEqual(13);
  });

  it('根帧在编辑器侧无相对锚点（求解器返回 null）→ 与内核 box(0,0) 等价', () => {
    const fdf = SCENES['单锚点 TOPLEFT'];
    const file = parseFdf(fdf);
    const fds = fileToFrameData(file);
    const byId: Record<string, any> = {};
    for (const f of fds) byId[f.id] = f;
    const rootFd = fds.find((f: any) => f.parentId === null)!;
    clearPositionCache();
    expect(calculatePositionFromAnchors(rootFd, byId)).toBeNull();
    // 内核侧 root 填满 box(0,0,0.8,0.6)
    const lr = layout(file.frames[0]);
    expect(lr.tree.x).toBe(0);
    expect(lr.tree.y).toBe(0);
    expect(lr.tree.w).toBeCloseTo(0.8, 9);
    expect(lr.tree.h).toBeCloseTo(0.6, 9);
  });
});
