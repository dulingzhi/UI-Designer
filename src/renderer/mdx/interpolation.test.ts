/**
 * 决策项：mdx 渲染器补审——interpolation.ts（208L 纯数学）行为测试。
 * 全文审定性通过（Hermite 基函数标准、边界完备）；本文件锁定核心行为防回归。
 *其余 6 个 mdx 文件（MDXModel/Builders/Material/Emitter）为 three.js 场景构件，
 * 与 SceneGraphManager 同档需 GPU 环境，由 MDXModelViewer 集成路径覆盖。
 */
import { describe, it, expect } from 'vitest';
import {
  buildVectorTrack,
  buildScalarTrack,
  buildQuaternionTrack,
} from './interpolation';
import type { AnimVector, Sequence } from 'war3-model';

function seq(start: number, end: number): Sequence {
  return { Interval: [start, end] } as unknown as Sequence;
}

function vec(lineType: number, keys: Array<{ frame: number; v: number[]; inTan?: number[]; outTan?: number[] }>): AnimVector {
  return {
    LineType: lineType,
    Keys: keys.map(k => ({
      Frame: k.frame,
      Vector: k.v,
      ...(k.inTan && { InTan: k.inTan }),
      ...(k.outTan && { OutTan: k.outTan }),
    })),
  } as unknown as AnimVector;
}

describe('mdx/interpolation（决策项：渲染器补审）', () => {
  describe('buildVectorTrack', () => {
    it('Linear：帧时间转换为相对序列起点的秒', () => {
      const track = buildVectorTrack(
        'pos', vec(1, [{ frame: 0, v: [1, 2, 3] }, { frame: 500, v: [4, 5, 6] }]),
        seq(0, 1000), 3, [0, 0, 0],
      );
      expect(track).not.toBeNull();
      expect(track!.times[0]).toBe(0);
      expect(track!.times[1]).toBeCloseTo(0.5);
      expect(Array.from(track!.values)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('Hermite：端点值精确（烘焙曲线经过关键帧）', () => {
      const track = buildVectorTrack(
        'pos', vec(2, [
          { frame: 0, v: [0, 0, 0], outTan: [10, 0, 0] },
          { frame: 1000, v: [100, 0, 0], inTan: [10, 0, 0] },
        ]),
        seq(0, 1000), 3, [0, 0, 0],
      );
      expect(track).not.toBeNull();
      // 首值 = P0，末值 = P1（曲线必过端点）
      expect(track!.values[0]).toBe(0);
      expect(track!.values[(track!.times.length - 1) * 3]).toBe(100);
      // 烘焙点数 = 1 + 8（BAKE_SEGMENTS）
      expect(track!.times.length).toBe(9);
    });

    it('帧区间过滤：区间内帧+preBoundary t=0 兜底；区间后帧不进入', () => {
      // 探针实证：preBoundary 值在 t=0 兜底（区间开始保持 pre 姿态=源码语义，探针 _p417）
      const track = buildVectorTrack(
        'pos', vec(1, [
          { frame: -500, v: [9, 9, 9] },
          { frame: 100, v: [1, 1, 1] },
          { frame: 900, v: [2, 2, 2] },
          { frame: 5000, v: [8, 8, 8] },
        ]),
        seq(0, 1000), 3, [0, 0, 0],
      );
      expect(track).not.toBeNull();
      // t=0(preBoundary 9) + 区间内 2 帧 = 3 帧
      expect(track!.times.length).toBe(3);
      expect(Array.from(track!.times).map(x => Number(x.toFixed(3)))).toEqual([0, 0.1, 0.9]);
      expect(track!.values).not.toContain(8); // 区间后帧（5000ms）不进入
    });

    it('空 Keys 返回 null', () => {
      expect(buildVectorTrack('pos', vec(1, []), seq(0, 1000), 3, [0, 0, 0])).toBeNull();
    });

    it('区间中部单帧：t=0 兜底展开为两帧（值保持，探针实证）', () => {
      // 探针实证：unshift 兜底先于单帧分支生效 → kfs=[0, 0.1]，两帧同值（静态保持语义正确）
      const track = buildVectorTrack('pos', vec(1, [{ frame: 100, v: [5, 5, 5] }]), seq(0, 1000), 3, [0, 0, 0]);
      expect(track).not.toBeNull();
      expect(track!.times.length).toBe(2);
      expect(Array.from(track!.times).map(x => Number(x.toFixed(3)))).toEqual([0, 0.1]);
      expect(Array.from(track!.values)).toEqual([5, 5, 5, 5, 5, 5]);
    });
  });

  describe('buildScalarTrack', () => {
    it('标量动画+默认值兜底', () => {
      const track = buildScalarTrack('alpha', vec(1, [{ frame: 0, v: [1] }, { frame: 1000, v: [] as unknown as number[] }]), seq(0, 1000), 0.5);
      expect(track).not.toBeNull();
      expect(track!.values[0]).toBe(1);
      // 第二帧缺组件 → defaultValue
      expect(track!.values[1]).toBe(0.5);
    });
  });

  describe('buildQuaternionTrack', () => {
    it('缺组件时 w 兜底为 1（单位四元数）', () => {
      const track = buildQuaternionTrack('rot', vec(1, [{ frame: 0, v: [0, 0, 0] }]), seq(0, 1000));
      expect(track).not.toBeNull();
      expect(track!.values[3]).toBe(1);
    });
  });
});
