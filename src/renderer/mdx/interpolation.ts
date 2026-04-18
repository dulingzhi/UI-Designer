// ============================================================
// MDX Interpolation — AnimVector 采样 → THREE keyframe tracks
// ============================================================
// MDX 动画向量支持 DontInterp / Linear / Hermite / Bezier 四种插值：
//   - DontInterp / Linear：直接作为 Three 线性 track 使用
//   - Hermite / Bezier：使用 InTan/OutTan 切线在每对关键帧之间**烘焙
//     密集线性采样点**，误差足够小即可被 Three 线性插值近似原曲线。

import * as THREE from 'three';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore war3-model 无类型声明
import type { AnimVector, AnimKeyframe, Sequence } from 'war3-model';

/** 每对 Hermite/Bezier 关键帧之间烘焙的子采样数（含首尾）。
 *  8 段 ≈ mdx-m3-viewer 常用粒度，视觉上足以消除曲线阶梯感。 */
const BAKE_SEGMENTS = 8;

/** MDX 帧 (ms) → 相对序列起点的秒 */
function frameToRelSec(frameMs: number, seq: Sequence): number {
  const [start] = seq.Interval;
  return Math.max(0, (frameMs - start) / 1000);
}

/** Hermite 插值: s ∈ [0,1]，返回 h00*P0 + h10*m0 + h01*P1 + h11*m1 的系数
 *  MDX Bezier 使用与 Hermite 相同的切线表达（社区惯例），此处复用。 */
function hermiteCoeffs(s: number): [number, number, number, number] {
  const s2 = s * s;
  const s3 = s2 * s;
  return [
    2 * s3 - 3 * s2 + 1, // h00 (P0)
    s3 - 2 * s2 + s,     // h10 (m0 = OutTan of P0)
    -2 * s3 + 3 * s2,    // h01 (P1)
    s3 - s2,             // h11 (m1 = InTan of P1)
  ];
}

/** 在两个 Hermite/Bezier 关键帧之间烘焙 (BAKE_SEGMENTS - 1) 个中间点。
 *  输出不含 a，含 b。调用方串联起始点后依次 push。*/
function bakeHermiteSegment(
  a: AnimKeyframe,
  b: AnimKeyframe,
  comp: number,
): Array<{ frame: number; vector: number[] }> {
  const p0 = a.Vector as ArrayLike<number>;
  const p1 = b.Vector as ArrayLike<number>;
  const m0 = (a.OutTan ?? a.Vector) as ArrayLike<number>;
  const m1 = (b.InTan ?? b.Vector) as ArrayLike<number>;
  const df = b.Frame - a.Frame;
  const out: Array<{ frame: number; vector: number[] }> = [];

  for (let step = 1; step <= BAKE_SEGMENTS; step++) {
    const s = step / BAKE_SEGMENTS;
    const [h00, h10, h01, h11] = hermiteCoeffs(s);
    const v: number[] = [];
    for (let c = 0; c < comp; c++) {
      v[c] = h00 * p0[c] + h10 * m0[c] + h01 * p1[c] + h11 * m1[c];
    }
    out.push({ frame: a.Frame + s * df, vector: v });
  }
  return out;
}

/** 过滤出属于指定序列区间的关键帧；若 LineType 是 Hermite/Bezier 则烘焙成密集线性点。*/
function keyframesInSequence(vec: AnimVector, seq: Sequence): Array<{ time: number; values: number[] }> {
  const [start, end] = seq.Interval;
  const isCurve = vec.LineType === 2 /* Hermite */ || vec.LineType === 3 /* Bezier */;

  // 先收集落在区间内 + 边界前后各一帧的原始关键帧
  const raw: AnimKeyframe[] = [];
  let preBoundary: AnimKeyframe | null = null;
  let postBoundary: AnimKeyframe | null = null;
  for (const kf of vec.Keys) {
    if (kf.Frame < start) {
      preBoundary = kf;
      continue;
    }
    if (kf.Frame > end) {
      if (!postBoundary) postBoundary = kf;
      break;
    }
    raw.push(kf);
  }

  if (raw.length === 0) {
    const fallback: Array<{ time: number; values: number[] }> = [];
    if (preBoundary) fallback.push({ time: 0, values: Array.from(preBoundary.Vector as ArrayLike<number>) });
    if (postBoundary) fallback.push({ time: frameToRelSec(end, seq), values: Array.from(postBoundary.Vector as ArrayLike<number>) });
    return fallback;
  }

  // 若曲线插值，烘焙 preBoundary→raw[0]→raw[1]...→postBoundary 的相邻段
  if (isCurve) {
    const comp = raw[0].Vector.length;
    const chain: AnimKeyframe[] = [];
    if (preBoundary) chain.push(preBoundary);
    chain.push(...raw);
    if (postBoundary) chain.push(postBoundary);

    const out: Array<{ time: number; values: number[] }> = [];
    // 起点
    const head = chain[0];
    out.push({
      time: frameToRelSec(Math.max(head.Frame, start), seq),
      values: Array.from(head.Vector as ArrayLike<number>),
    });
    for (let i = 0; i < chain.length - 1; i++) {
      const segs = bakeHermiteSegment(chain[i], chain[i + 1], comp);
      for (const s of segs) {
        if (s.frame < start) continue;
        if (s.frame > end) break;
        out.push({ time: frameToRelSec(s.frame, seq), values: s.vector });
      }
    }
    // 保证 t=0 存在
    if (out.length > 0 && out[0].time > 0) {
      out.unshift({ time: 0, values: out[0].values.slice() });
    }
    return out;
  }

  // Linear / DontInterp
  const out: Array<{ time: number; values: number[] }> = [];
  if (preBoundary && raw[0].Frame > start) {
    out.push({ time: 0, values: Array.from(preBoundary.Vector as ArrayLike<number>) });
  }
  for (const kf of raw) {
    out.push({ time: frameToRelSec(kf.Frame, seq), values: Array.from(kf.Vector as ArrayLike<number>) });
  }
  if (out.length > 0 && out[0].time > 0) {
    out.unshift({ time: 0, values: out[0].values.slice() });
  }
  return out;
}

/** 生成 VectorKeyframeTrack (position / scale) */
export function buildVectorTrack(
  name: string,
  vec: AnimVector,
  seq: Sequence,
  componentCount: 3,
  defaultValue: [number, number, number],
): THREE.VectorKeyframeTrack | null {
  const kfs = keyframesInSequence(vec, seq);
  if (kfs.length === 0) return null;
  if (kfs.length === 1) {
    // 单帧：需要至少 2 帧才能构成有效 track；复制为起止两帧
    kfs.push({ time: frameToRelSec(seq.Interval[1], seq), values: kfs[0].values.slice() });
  }

  const times = new Float32Array(kfs.length);
  const values = new Float32Array(kfs.length * componentCount);
  for (let i = 0; i < kfs.length; i++) {
    times[i] = kfs[i].time;
    const v = kfs[i].values;
    values[i * 3 + 0] = v[0] ?? defaultValue[0];
    values[i * 3 + 1] = v[1] ?? defaultValue[1];
    values[i * 3 + 2] = v[2] ?? defaultValue[2];
  }
  return new THREE.VectorKeyframeTrack(name, times as any, values as any);
}

/** 生成 QuaternionKeyframeTrack (rotation) — MDX 四元数为 xyzw，与 Three.js 一致 */
export function buildQuaternionTrack(
  name: string,
  vec: AnimVector,
  seq: Sequence,
): THREE.QuaternionKeyframeTrack | null {
  const kfs = keyframesInSequence(vec, seq);
  if (kfs.length === 0) return null;
  if (kfs.length === 1) {
    kfs.push({ time: frameToRelSec(seq.Interval[1], seq), values: kfs[0].values.slice() });
  }

  const times = new Float32Array(kfs.length);
  const values = new Float32Array(kfs.length * 4);
  for (let i = 0; i < kfs.length; i++) {
    times[i] = kfs[i].time;
    const v = kfs[i].values;
    values[i * 4 + 0] = v[0] ?? 0;
    values[i * 4 + 1] = v[1] ?? 0;
    values[i * 4 + 2] = v[2] ?? 0;
    values[i * 4 + 3] = v[3] ?? 1;
  }
  return new THREE.QuaternionKeyframeTrack(name, times as any, values as any);
}

/** 生成 NumberKeyframeTrack (Alpha 等标量动画) */
export function buildScalarTrack(
  name: string,
  vec: AnimVector,
  seq: Sequence,
  defaultValue: number,
): THREE.NumberKeyframeTrack | null {
  const kfs = keyframesInSequence(vec, seq);
  if (kfs.length === 0) return null;
  if (kfs.length === 1) {
    kfs.push({ time: frameToRelSec(seq.Interval[1], seq), values: kfs[0].values.slice() });
  }

  const times = new Float32Array(kfs.length);
  const values = new Float32Array(kfs.length);
  for (let i = 0; i < kfs.length; i++) {
    times[i] = kfs[i].time;
    values[i] = kfs[i].values[0] ?? defaultValue;
  }
  return new THREE.NumberKeyframeTrack(name, times as any, values as any);
}
