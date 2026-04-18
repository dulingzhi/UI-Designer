// ============================================================
// MDXModel — 顶层聚合器：parse → 骨架 → 几何 → 材质 → 动画
// ============================================================
// 输入：MDX 二进制 ArrayBuffer
// 输出：THREE.Group（包含若干 SkinnedMesh）+ AnimationClip[] + AnimationMixer
//
// 使用方式（见 MDXModelViewer.tsx）：
//   const model = await MDXModel.load(arrayBuffer, textureResolver);
//   scene.add(model.root);
//   const action = model.mixer.clipAction(model.clips[0]);
//   action.play();

import * as THREE from 'three';
// @ts-ignore war3-model 无类型声明
import { parseMDX } from 'war3-model';
// @ts-ignore
import type { Model as MdxModelData } from 'war3-model';

import { buildSkeleton, type SkeletonResult } from './MDXSkeletonBuilder';
import { buildGeosetGeometry } from './MDXGeometryBuilder';
import { buildLayerMaterials } from './MDXLayerMaterial';
import { buildClips } from './MDXAnimationBuilder';
import { MDXParticleSystem } from './MDXParticleEmitter';

export type MdxTextureResolver = (path: string, replaceableId?: number) => Promise<THREE.Texture | null>;

/** 从 GeosetAnim 取首帧 Alpha / Color 应用到各层材质的 rest 状态 */
function applyGeosetAnimStatic(materials: THREE.Material[], ga: any): void {
  // Alpha: AnimVector | number
  let alpha: number | null = null;
  if (typeof ga.Alpha === 'number') {
    alpha = ga.Alpha;
  } else if (ga.Alpha && Array.isArray(ga.Alpha.Keys) && ga.Alpha.Keys.length > 0) {
    const v = ga.Alpha.Keys[0]?.Vector?.[0];
    if (typeof v === 'number') alpha = v;
  }
  // Color: AnimVector | Float32Array (BGR 顺序，MDX 约定)
  let color: [number, number, number] | null = null;
  if (ga.Color instanceof Float32Array && ga.Color.length >= 3) {
    color = [ga.Color[2], ga.Color[1], ga.Color[0]];
  } else if (ga.Color && Array.isArray(ga.Color.Keys) && ga.Color.Keys.length > 0) {
    const v = ga.Color.Keys[0]?.Vector;
    if (v && v.length >= 3) color = [v[2], v[1], v[0]];
  }

  for (const mat of materials) {
    const m = mat as any;
    if (alpha !== null) {
      m.opacity = Math.max(0, Math.min(1, alpha));
      m.transparent = true;
    }
    if (color && m.color && typeof m.color.setRGB === 'function') {
      m.color.setRGB(color[0], color[1], color[2]);
    }
    m.needsUpdate = true;
  }
}

export class MDXModel {
  /** 放入场景的根节点（包含模型朝向修正 Group） */
  readonly root: THREE.Group;
  /** 原始 war3-model 解析结果 */
  readonly data: MdxModelData;
  /** 骨架信息 */
  readonly skeletonInfo: SkeletonResult;
  /** 模型内所有 SkinnedMesh */
  readonly meshes: THREE.SkinnedMesh[];
  /** 动画剪辑（按 Sequences 顺序） */
  readonly clips: THREE.AnimationClip[];
  /** 驱动动画的 Mixer（作用于 root） */
  readonly mixer: THREE.AnimationMixer;
  /** 粒子系统（ParticleEmitter2 + RibbonEmitter），可选 */
  readonly particles: MDXParticleSystem | null;
  /** 当前播放的 AnimationAction，用于求 emitter 帧 */
  private currentAction: THREE.AnimationAction | null = null;
  /** 当前播放序列的 Interval[start] (ms) */
  private currentSeqStart = 0;
  /** Billboard 骨骼列表（需 onBeforeRender 对齐相机） */
  private readonly billboardBones: Array<{ bone: THREE.Bone; mode: 'full' | 'lockX' | 'lockY' | 'lockZ' }> = [];
  // 临时变量（避免 GC）
  private static readonly _camQuat = new THREE.Quaternion();
  private static readonly _parentQuat = new THREE.Quaternion();
  private static readonly _euler = new THREE.Euler();

  private constructor(
    root: THREE.Group,
    data: MdxModelData,
    skeletonInfo: SkeletonResult,
    meshes: THREE.SkinnedMesh[],
    clips: THREE.AnimationClip[],
    particles: MDXParticleSystem | null,
  ) {
    this.root = root;
    this.data = data;
    this.skeletonInfo = skeletonInfo;
    this.meshes = meshes;
    this.clips = clips;
    this.mixer = new THREE.AnimationMixer(root);
    this.particles = particles;
    if (particles) root.add(particles.root);

    // 收集所有 billboard 骨骼（Node.Flags bit：0x8 Billboarded, 0x10/20/40 LockX/Y/Z）
    for (const bone of skeletonInfo.boneList) {
      const flags = (bone.userData.mdxFlags as number | undefined) ?? 0;
      if ((flags & 0x8) === 0 && (flags & 0x70) === 0) continue;
      let mode: 'full' | 'lockX' | 'lockY' | 'lockZ' = 'full';
      if (flags & 0x10) mode = 'lockX';
      else if (flags & 0x20) mode = 'lockY';
      else if (flags & 0x40) mode = 'lockZ';
      this.billboardBones.push({ bone, mode });
    }
  }

  /** 每帧推进动画 + 粒子 + Billboard。camera 可选：不传则跳过 billboard。 */
  update(dt: number, camera?: THREE.Camera): void {
    this.mixer.update(dt);
    if (camera && this.billboardBones.length > 0) {
      this.applyBillboards(camera);
    }
    if (this.particles) {
      // MDX 帧 (ms) = 序列起点 + action 时间(s)*1000
      const actTime = this.currentAction?.time ?? 0;
      this.particles.currentFrame = this.currentSeqStart + actTime * 1000;
      this.particles.update(dt);
    }
  }

  /**
   * 异步加载 MDX 模型。
   * @param arrayBuffer MDX 二进制数据
   * @param textureResolver 根据 Texture.Image 路径 / ReplaceableId 加载贴图
   */
  static async load(
    arrayBuffer: ArrayBuffer,
    textureResolver: MdxTextureResolver,
  ): Promise<MDXModel> {
    const data: MdxModelData = parseMDX(arrayBuffer);

    // 1. 骨架
    const skeletonInfo = buildSkeleton(data);
    const boneIdToIndex = new Map<number, number>();
    skeletonInfo.boneList.forEach((b, i) => {
      boneIdToIndex.set(b.userData.mdxObjectId as number, i);
    });

    // 2. 纹理（按索引并行加载）
    const textures = data.Textures ?? [];
    const loadedTextures: (THREE.Texture | null)[] = await Promise.all(
      textures.map((t: any) => textureResolver(t.Image, t.ReplaceableId).catch(() => null)),
    );

    const resolveTextureByIndex = (idx: number): THREE.Texture | null =>
      loadedTextures[idx] ?? null;

    // 3. 材质/几何按 Geoset 独立构建 —— 便于 GeosetAnim 动画互不干扰
    const materials = data.Materials ?? [];
    const textureAnims = (data as any).TextureAnims ?? [];

    // 4. 几何 + SkinnedMesh —— 每个 Layer 一个 mesh，共享 geometry
    const meshes: THREE.SkinnedMesh[] = [];
    const geosets = data.Geosets ?? [];
    /** geosetIdx → 各 Layer mesh 名称（供 GeosetAnim 动画轨道绑定） */
    const geosetMeshNames = new Map<number, string[]>();

    // Root 做 Z-up → Y-up 旋转修正
    const root = new THREE.Group();
    root.name = data.Info?.Name || 'MDXModel';
    root.rotation.x = -Math.PI / 2;

    // 骨架根节点附加到 root
    for (const r of skeletonInfo.roots) root.add(r);

    // GeosetAnim 按 GeosetId 索引
    const geosetAnims: any[] = (data as any).GeosetAnims ?? [];
    const geosetAnimByGeosetId = new Map<number, any>();
    for (const ga of geosetAnims) {
      if (typeof ga.GeosetId === 'number' && ga.GeosetId >= 0) {
        geosetAnimByGeosetId.set(ga.GeosetId, ga);
      }
    }

    geosets.forEach((geoset: any, geosetIdx: number) => {
      const { geometry, materialId, hasSkin } = buildGeosetGeometry(geoset, boneIdToIndex);
      const srcMaterial = materials[materialId] ?? materials[0];
      if (!srcMaterial) return;

      // 每个 Geoset 独立构建材质实例（避免 GeosetAnim 跨 geoset 污染）
      const layerMaterials = buildLayerMaterials(srcMaterial, textures, resolveTextureByIndex, textureAnims);
      if (layerMaterials.length === 0) return;

      // 应用 GeosetAnim 的静态 Alpha / Color（AnimVector 取首帧作为 rest 值）
      const ga = geosetAnimByGeosetId.get(geosetIdx);
      if (ga) applyGeosetAnimStatic(layerMaterials, ga);

      // DropShadow (Flags & 1)：该 Geoset 是地面投影贴花，UI 预览中隐藏
      const isDropShadow = ga && ((ga.Flags ?? 0) & 1) !== 0;

      const meshNames: string[] = [];
      layerMaterials.forEach((material, layerIdx) => {
        const meshName = `g${geosetIdx}_l${layerIdx}`;
        meshNames.push(meshName);

        let mesh: THREE.SkinnedMesh | THREE.Mesh;
        if (hasSkin) {
          const sm = new THREE.SkinnedMesh(geometry, material);
          sm.bind(skeletonInfo.skeleton, new THREE.Matrix4());
          mesh = sm;
        } else {
          mesh = new THREE.Mesh(geometry, material);
        }
        mesh.name = meshName;
        mesh.renderOrder = layerIdx;
        if (isDropShadow) mesh.visible = false;
        root.add(mesh);
        meshes.push(mesh as THREE.SkinnedMesh);
      });

      geosetMeshNames.set(geosetIdx, meshNames);
    });

    // 5. 动画（骨骼 + GeosetAnim）
    const clips = buildClips(data, skeletonInfo.bonesById, geosetAnimByGeosetId, geosetMeshNames);

    // 6. 粒子系统（ParticleEmitter2）—— 失败不阻塞主模型
    let particles: MDXParticleSystem | null = null;
    try {
      const resolveParticleTex = async (texIdx: number): Promise<THREE.Texture | null> => {
        const t = textures[texIdx];
        if (!t) return null;
        // 复用已加载纹理若在 loadedTextures 中，否则重新 resolve
        if (loadedTextures[texIdx]) return loadedTextures[texIdx];
        return textureResolver(t.Image, t.ReplaceableId).catch(() => null);
      };
      particles = await MDXParticleSystem.build(data, resolveParticleTex);
    } catch (err) {
      console.warn('[MDXModel] 粒子系统构建失败', err);
    }

    return new MDXModel(root, data, skeletonInfo, meshes, clips, particles);
  }

  /**
   * 让 billboard 骨骼的世界朝向与相机对齐。
   * - full: 完全面向相机
   * - lockY: 只绕世界 Y 轴朝向相机（常用于人物头顶快拍）
   * - lockX/lockZ: 同理锁轴
   * 调用顺序必须在 mixer.update 之后、render 之前。
   */
  private applyBillboards(camera: THREE.Camera): void {
    camera.updateMatrixWorld();
    camera.getWorldQuaternion(MDXModel._camQuat);
    for (const { bone, mode } of this.billboardBones) {
      if (!bone.parent) continue;
      bone.parent.updateWorldMatrix(true, false);
      bone.parent.getWorldQuaternion(MDXModel._parentQuat);
      // target world quat
      const target = MDXModel._camQuat.clone();
      if (mode !== 'full') {
        // 将相机朝向转换为 euler，只保留锁轴分量
        MDXModel._euler.setFromQuaternion(target, 'YXZ');
        if (mode === 'lockY') { MDXModel._euler.x = 0; MDXModel._euler.z = 0; }
        else if (mode === 'lockX') { MDXModel._euler.y = 0; MDXModel._euler.z = 0; }
        else if (mode === 'lockZ') { MDXModel._euler.x = 0; MDXModel._euler.y = 0; }
        target.setFromEuler(MDXModel._euler);
      }
      // bone.quat = parent^-1 * target
      MDXModel._parentQuat.invert();
      bone.quaternion.multiplyQuaternions(MDXModel._parentQuat, target);
      bone.matrixWorldNeedsUpdate = true;
    }
  }

  /** 获取序列名列表 */
  getSequenceNames(): string[] {
    return (this.data.Sequences ?? []).map((s: any, i: number) => s.Name || `Sequence_${i}`);
  }

  /** 播放指定名称的序列（第一个匹配） */
  playSequence(name: string, loop = true): THREE.AnimationAction | null {
    const clipIdx = this.clips.findIndex((c) => c.name === name);
    if (clipIdx < 0) return null;
    const clip = this.clips[clipIdx];
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip);
    action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
    action.reset().play();
    this.currentAction = action;
    const seq: any = (this.data.Sequences ?? [])[clipIdx];
    this.currentSeqStart = seq?.Interval?.[0] ?? 0;
    return action;
  }

  /** 释放几何/材质/纹理 */
  dispose(): void {
    this.mixer.stopAllAction();
    this.particles?.dispose();
    const disposedGeoms = new Set<THREE.BufferGeometry>();
    const disposedTextures = new Set<THREE.Texture>();
    for (const mesh of this.meshes) {
      if (mesh.geometry && !disposedGeoms.has(mesh.geometry)) {
        disposedGeoms.add(mesh.geometry);
        mesh.geometry.dispose();
      }
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (!mat) continue;
        // @ts-ignore MeshBasicNodeMaterial.map
        const map: THREE.Texture | undefined = mat.map;
        if (map && !disposedTextures.has(map)) {
          disposedTextures.add(map);
          map.dispose();
        }
        mat.dispose();
      }
    }
  }
}
