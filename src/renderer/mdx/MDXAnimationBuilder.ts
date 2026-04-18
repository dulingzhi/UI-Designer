// ============================================================
// MDXAnimationBuilder — Sequences + Node AnimVectors → THREE.AnimationClip[]
// ============================================================
// 每个 Sequence 生成一个 AnimationClip；Clip 内包含所有骨骼在该时间段内的
// position / quaternion / scale tracks，以及 GeosetAnim 的 opacity / color tracks。

import * as THREE from 'three';
// @ts-ignore war3-model 无类型声明
import type { Model, Sequence, Node as MdxNode } from 'war3-model';
import { buildVectorTrack, buildQuaternionTrack, buildScalarTrack } from './interpolation';

export function buildClips(
  model: Model,
  bonesById: Map<number, THREE.Bone>,
  geosetAnimByGeosetId?: Map<number, any>,
  geosetMeshNames?: Map<number, string[]>,
): THREE.AnimationClip[] {
  const clips: THREE.AnimationClip[] = [];
  const sequences: Sequence[] = model.Sequences ?? [];
  const nodes: MdxNode[] = model.Nodes ?? [];

  for (const seq of sequences) {
    const duration = Math.max(0.001, (seq.Interval[1] - seq.Interval[0]) / 1000);
    const tracks: THREE.KeyframeTrack[] = [];

    for (const node of nodes) {
      const bone = bonesById.get(node.ObjectId);
      if (!bone) continue;
      const name = bone.name;

      if (node.Translation) {
        const t = buildVectorTrack(
          `${name}.position`,
          node.Translation,
          seq,
          3,
          [bone.position.x, bone.position.y, bone.position.z],
        );
        if (t) {
          // MDX translation 是相对 pivot 的偏移，需要加上骨骼 rest 位置
          const baseX = bone.position.x;
          const baseY = bone.position.y;
          const baseZ = bone.position.z;
          const values = t.values as Float32Array;
          for (let i = 0; i < values.length; i += 3) {
            values[i] += baseX;
            values[i + 1] += baseY;
            values[i + 2] += baseZ;
          }
          tracks.push(t);
        }
      }

      if (node.Rotation) {
        const t = buildQuaternionTrack(`${name}.quaternion`, node.Rotation, seq);
        if (t) tracks.push(t);
      }

      if (node.Scaling) {
        const t = buildVectorTrack(`${name}.scale`, node.Scaling, seq, 3, [1, 1, 1]);
        if (t) tracks.push(t);
      }
    }

    // GeosetAnim：Alpha / Color 动画 → material.opacity / material.color
    if (geosetAnimByGeosetId && geosetMeshNames) {
      for (const [geosetIdx, ga] of geosetAnimByGeosetId) {
        const meshNames = geosetMeshNames.get(geosetIdx);
        if (!meshNames || meshNames.length === 0) continue;

        // Alpha (AnimVector 才生成 track；静态数值已在 applyGeosetAnimStatic 处理)
        if (ga.Alpha && typeof ga.Alpha === 'object' && Array.isArray(ga.Alpha.Keys)) {
          for (const meshName of meshNames) {
            const t = buildScalarTrack(`${meshName}.material.opacity`, ga.Alpha, seq, 1);
            if (t) tracks.push(t);
          }
        }

        // Color (AnimVector) —— MDX 内部为 BGR，需要转回 RGB
        if (ga.Color && typeof ga.Color === 'object' && Array.isArray((ga.Color as any).Keys)) {
          const t0 = buildVectorTrack(
            `${meshNames[0]}.material.color`,
            ga.Color as any,
            seq,
            3,
            [1, 1, 1],
          );
          if (t0) {
            const vs = t0.values as Float32Array;
            for (let i = 0; i < vs.length; i += 3) {
              const b = vs[i];
              vs[i] = vs[i + 2];
              vs[i + 2] = b;
            }
            tracks.push(t0);
            // 其它 layer mesh 共享同一轨道（克隆轨道、改名）
            for (let k = 1; k < meshNames.length; k++) {
              const clone = t0.clone();
              clone.name = `${meshNames[k]}.material.color`;
              tracks.push(clone);
            }
          }
        }
      }
    }

    const clipName = seq.Name || `Sequence_${clips.length}`;
    const clip = new THREE.AnimationClip(clipName, duration, tracks);
    clips.push(clip);
  }

  return clips;
}
