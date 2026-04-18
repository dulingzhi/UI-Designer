// ============================================================
// MDXSkeletonBuilder — MDX Nodes → THREE.Bone tree + THREE.Skeleton
// ============================================================
// Nodes 数组包含所有节点 (Bones / Helpers / Attachments / ...)；通过
// ObjectId 建立父子关系，PivotPoint 作为骨骼在模型空间中的初始位置。

import * as THREE from 'three';
// @ts-ignore war3-model 无类型声明
import type { Model, Node as MdxNode } from 'war3-model';

export interface SkeletonResult {
  /** 按 ObjectId 索引的 Three.js Bone（非骨骼节点也包含，用于动画） */
  bonesById: Map<number, THREE.Bone>;
  /** 有序骨骼列表（供 SkinnedMesh 使用） */
  boneList: THREE.Bone[];
  /** 根节点（不含父）的 Bones */
  roots: THREE.Bone[];
  /** THREE.Skeleton（bind matrices 从 PivotPoint 派生） */
  skeleton: THREE.Skeleton;
  /** Node 元数据（便于后续查询 Flags / 原始 PivotPoint） */
  nodeMetaById: Map<number, MdxNode>;
}

export function buildSkeleton(model: Model): SkeletonResult {
  const bonesById = new Map<number, THREE.Bone>();
  const nodeMetaById = new Map<number, MdxNode>();

  // MDX 的 Nodes 字段汇总了 Bones + Helpers + Attachments + Lights + Emitters 等全部节点
  const allNodes: MdxNode[] = model.Nodes ?? [];

  for (const node of allNodes) {
    const bone = new THREE.Bone();
    bone.name = node.Name || `node_${node.ObjectId}`;
    bone.userData.mdxObjectId = node.ObjectId;
    bone.userData.mdxFlags = node.Flags;
    bonesById.set(node.ObjectId, bone);
    nodeMetaById.set(node.ObjectId, node);
  }

  // 设置层级 + 绑定局部位置（PivotPoint 是世界坐标，需相对父亲转换为局部）
  const roots: THREE.Bone[] = [];
  const worldPivot = new Map<number, THREE.Vector3>();

  for (const node of allNodes) {
    const p = node.PivotPoint;
    worldPivot.set(node.ObjectId, new THREE.Vector3(p[0], p[1], p[2]));
  }

  for (const node of allNodes) {
    const bone = bonesById.get(node.ObjectId)!;
    const worldPos = worldPivot.get(node.ObjectId)!;

    if (node.Parent === undefined || node.Parent === null || !bonesById.has(node.Parent)) {
      bone.position.copy(worldPos);
      roots.push(bone);
    } else {
      const parentBone = bonesById.get(node.Parent)!;
      const parentWorld = worldPivot.get(node.Parent)!;
      bone.position.copy(worldPos).sub(parentWorld);
      parentBone.add(bone);
    }
  }

  // 骨骼顺序：按 ObjectId 升序，保证索引稳定
  const boneList: THREE.Bone[] = [];
  const ids = Array.from(bonesById.keys()).sort((a, b) => a - b);
  for (const id of ids) boneList.push(bonesById.get(id)!);

  // 更新世界矩阵后计算 inverse bind matrices
  for (const root of roots) root.updateMatrixWorld(true);

  const boneInverses = boneList.map((b) => {
    const m = new THREE.Matrix4();
    m.copy(b.matrixWorld).invert();
    return m;
  });

  const skeleton = new THREE.Skeleton(boneList, boneInverses);

  return { bonesById, boneList, roots, skeleton, nodeMetaById };
}
