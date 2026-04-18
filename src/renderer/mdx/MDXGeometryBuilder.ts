// ============================================================
// MDXGeometryBuilder — Geoset → THREE.BufferGeometry (+ skin)
// ============================================================
// 每个 geoset 变成一个几何体；通过 VertexGroup + Groups 派生 skinIndex / skinWeight，
// MDX 不提供显式权重，同组的骨骼均分权重（最多 4 个，超出截断）。

import * as THREE from 'three';
// @ts-ignore war3-model 无类型声明
import type { Geoset } from 'war3-model';

export interface GeometryWithSkin {
  geometry: THREE.BufferGeometry;
  /** 每个几何体对应的 MaterialID */
  materialId: number;
  hasSkin: boolean;
}

/**
 * 构建带蒙皮信息的 BufferGeometry。
 * @param geoset MDX geoset
 * @param boneIdToIndex war3-model bone ObjectId → THREE.Skeleton.bones 索引
 */
export function buildGeosetGeometry(
  geoset: Geoset,
  boneIdToIndex: Map<number, number>,
): GeometryWithSkin {
  const geometry = new THREE.BufferGeometry();
  const vertexCount = geoset.Vertices.length / 3;

  geometry.setAttribute('position', new THREE.BufferAttribute(geoset.Vertices, 3));
  if (geoset.Normals && geoset.Normals.length === geoset.Vertices.length) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(geoset.Normals, 3));
  }

  // MDX: V 轴与 Three.js 相反，需 1-V 翻转
  const uvSrc = (geoset.TVertices && geoset.TVertices[0]) || null;
  if (uvSrc && uvSrc.length === vertexCount * 2) {
    const uv = new Float32Array(vertexCount * 2);
    for (let i = 0; i < vertexCount; i++) {
      uv[i * 2] = uvSrc[i * 2];
      uv[i * 2 + 1] = 1.0 - uvSrc[i * 2 + 1];
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  geometry.setIndex(new THREE.BufferAttribute(geoset.Faces, 1));

  // ---- 蒙皮 ----
  let hasSkin = false;
  if (geoset.VertexGroup && geoset.Groups && geoset.Groups.length > 0) {
    const skinIndex = new Float32Array(vertexCount * 4);
    const skinWeight = new Float32Array(vertexCount * 4);
    for (let i = 0; i < vertexCount; i++) {
      const groupId = geoset.VertexGroup[i];
      const group = geoset.Groups[groupId] || [];
      const count = Math.min(group.length, 4);
      const weight = count > 0 ? 1 / count : 0;
      for (let j = 0; j < count; j++) {
        const mdxBoneId = group[j];
        const boneIdx = boneIdToIndex.get(mdxBoneId) ?? 0;
        skinIndex[i * 4 + j] = boneIdx;
        skinWeight[i * 4 + j] = weight;
      }
    }
    geometry.setAttribute('skinIndex', new THREE.BufferAttribute(skinIndex, 4));
    geometry.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
    hasSkin = true;
  }

  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }

  return {
    geometry,
    materialId: geoset.MaterialID,
    hasSkin,
  };
}
