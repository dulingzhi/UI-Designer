// ============================================================
// MDXParticleEmitter — ParticleEmitter2 + RibbonEmitter CPU 模拟
// ============================================================
// ParticleEmitter2: InstancedBufferGeometry(PlaneGeometry) + SpriteNodeMaterial
//   - 每帧 CPU 写入 InstancedBufferAttribute（pos/color/size/uvOffset）
//   - 由 SpriteNodeMaterial 自动做 view-space billboard
//   - 支持 atlas 帧动画（Rows × Columns + LifeSpanUVAnim）
//   - 在 WebGPU & WebGL2 后端均可正确显示纹理（不依赖 gl_PointCoord）
//
// RibbonEmitter: dynamic indexed Mesh
//   - 段点按 LifeSpan 老化、按 emit 顺序排列
//
// 不支持：
//   - Head/Tail 双面片区分（统一按 Head）
//   - DecayUVAnim（粒子后半生使用 LifeSpanUVAnim 同表）
//   - ModelSpace 标志、Tail 扯尾长度
//   - 旧版 ParticleEmitter / Popcorn

import * as THREE from 'three';
import { SpriteNodeMaterial, MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedDynamicBufferAttribute, texture as tslTexture, uv as tslUv, Fn, vec2 } from 'three/tsl';
// @ts-ignore war3-model 无类型声明
import type { Model, ParticleEmitter2, AnimVector } from 'war3-model';

function firstScalar(v: any, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (v && Array.isArray(v.Keys) && v.Keys.length > 0) {
    const x = v.Keys[0]?.Vector?.[0];
    if (typeof x === 'number') return x;
  }
  return fallback;
}

/** 在 frame(ms) 处对 AnimVector 做标量采样；支持 Linear / Hermite / Bezier */
function sampleScalar(v: any, frame: number, fallback = 0): number {
  if (typeof v === 'number') return v;
  if (!v || !Array.isArray(v.Keys) || v.Keys.length === 0) return fallback;
  const keys = v.Keys;
  if (frame <= keys[0].Frame) return keys[0].Vector[0] ?? fallback;
  if (frame >= keys[keys.length - 1].Frame) return keys[keys.length - 1].Vector[0] ?? fallback;
  let lo = 0, hi = keys.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid].Frame <= frame) lo = mid; else hi = mid;
  }
  const a = keys[lo], b = keys[hi];
  const df = b.Frame - a.Frame;
  if (df <= 0) return a.Vector[0] ?? fallback;
  const t = (frame - a.Frame) / df;
  const va = a.Vector[0] ?? fallback;
  const vb = b.Vector[0] ?? fallback;
  if (v.LineType === 2 || v.LineType === 3) {
    const ma = (a.OutTan?.[0] ?? va);
    const mb = (b.InTan?.[0] ?? vb);
    const s = t, s2 = s * s, s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * va
      + (s3 - 2 * s2 + s) * ma
      + (-2 * s3 + 3 * s2) * vb
      + (s3 - s2) * mb;
  }
  return va + (vb - va) * t;
}

function applyEmitter2FilterMode(mat: SpriteNodeMaterial, mode: number | undefined): void {
  const m = mode ?? 0;
  mat.transparent = true;
  mat.depthWrite = false;
  mat.depthTest = true;
  switch (m) {
    case 0: // Blend
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.SrcAlphaFactor;
      mat.blendDst = THREE.OneMinusSrcAlphaFactor;
      break;
    case 1: // Additive
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.SrcAlphaFactor;
      mat.blendDst = THREE.OneFactor;
      break;
    case 2: // Modulate
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.ZeroFactor;
      mat.blendDst = THREE.SrcColorFactor;
      break;
    case 3: // Modulate2x
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.DstColorFactor;
      mat.blendDst = THREE.SrcColorFactor;
      break;
    case 4: // AlphaKey
      mat.blending = THREE.CustomBlending;
      mat.blendSrc = THREE.SrcAlphaFactor;
      mat.blendDst = THREE.OneMinusSrcAlphaFactor;
      mat.alphaTest = 0.1;
      break;
  }
}

interface Particle {
  age: number;
  lifeSpan: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
}

class Emitter2Instance {
  readonly mesh: THREE.Mesh;
  private readonly emitter: ParticleEmitter2;
  private readonly pivot: THREE.Vector3;
  private readonly maxParticles: number;
  private readonly particles: Particle[];
  private readonly posAttr: THREE.InstancedBufferAttribute;
  private readonly colorAttr: THREE.InstancedBufferAttribute;
  private readonly sizeAttr: THREE.InstancedBufferAttribute;
  private readonly uvOffsetAttr: THREE.InstancedBufferAttribute;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: SpriteNodeMaterial;
  private readonly lifeSpan: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cellW: number;
  private readonly cellH: number;
  private readonly uvAnimStart: number;
  private readonly uvAnimEnd: number;
  private spawnAcc = 0;

  constructor(emitter: ParticleEmitter2, pivot: Float32Array | undefined, texture: THREE.Texture | null) {
    this.emitter = emitter;
    this.pivot = new THREE.Vector3(pivot?.[0] ?? 0, pivot?.[1] ?? 0, pivot?.[2] ?? 0);
    this.lifeSpan = emitter.LifeSpan ?? 1;

    // Atlas 配置
    this.cols = Math.max(1, (emitter as any).Columns ?? 1);
    this.rows = Math.max(1, (emitter as any).Rows ?? 1);
    this.cellW = 1 / this.cols;
    this.cellH = 1 / this.rows;
    const uvAnim = (emitter as any).LifeSpanUVAnim as Uint32Array | number[] | undefined;
    this.uvAnimStart = uvAnim?.[0] ?? 0;
    this.uvAnimEnd = uvAnim?.[1] ?? 0;

    const rate0 = firstScalar(emitter.EmissionRate, 0);
    const needed = Math.ceil(Math.max(1, rate0) * Math.max(0.1, this.lifeSpan));
    this.maxParticles = Math.max(32, Math.min(needed * 2 + 16, 4096));

    this.particles = new Array(this.maxParticles);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles[i] = {
        age: 0, lifeSpan: 0,
        pos: new THREE.Vector3(), vel: new THREE.Vector3(),
        active: false,
      };
    }

    // 1×1 单位四边形 → InstancedBufferGeometry
    const planeGeom = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = planeGeom.index;
    this.geometry.attributes = planeGeom.attributes;
    this.geometry.instanceCount = 0;

    const positions = new Float32Array(this.maxParticles * 3);
    const colors = new Float32Array(this.maxParticles * 4);
    const sizes = new Float32Array(this.maxParticles * 2);
    const uvOffs = new Float32Array(this.maxParticles * 2);
    this.posAttr = new THREE.InstancedBufferAttribute(positions, 3);
    this.colorAttr = new THREE.InstancedBufferAttribute(colors, 4);
    this.sizeAttr = new THREE.InstancedBufferAttribute(sizes, 2);
    this.uvOffsetAttr = new THREE.InstancedBufferAttribute(uvOffs, 2);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colorAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    this.uvOffsetAttr.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('iPos', this.posAttr);
    this.geometry.setAttribute('iColor', this.colorAttr);
    this.geometry.setAttribute('iSize', this.sizeAttr);
    this.geometry.setAttribute('iUvOffset', this.uvOffsetAttr);

    this.material = new SpriteNodeMaterial({
      map: texture ?? undefined,
      transparent: true,
    });

    // TSL: positionNode = per-instance position
    this.material.positionNode = instancedDynamicBufferAttribute(this.posAttr) as any;
    // scaleNode = per-instance vec2 size
    this.material.scaleNode = instancedDynamicBufferAttribute(this.sizeAttr) as any;
    // colorNode = sample(map, uv*cellSize + uvOffset) * iColor
    const cellSize = vec2(this.cellW, this.cellH);
    const iUvOffset = instancedDynamicBufferAttribute(this.uvOffsetAttr);
    const iColor = instancedDynamicBufferAttribute(this.colorAttr);
    if (texture) {
      this.material.colorNode = Fn(() => {
        const sampledUv = tslUv().mul(cellSize).add(iUvOffset);
        const sampled = tslTexture(texture, sampledUv);
        return sampled.mul(iColor);
      })();
    } else {
      this.material.colorNode = iColor as any;
    }
    // 同时把 alpha 接到 opacityNode，确保 vertex color alpha 不被吞
    this.material.opacityNode = (iColor as any).w;

    applyEmitter2FilterMode(this.material, emitter.FilterMode as number | undefined);

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
  }

  update(dt: number, frame: number): void {
    const visibility = sampleScalar(this.emitter.Visibility as AnimVector, frame, 1);
    this.mesh.visible = visibility > 0.001;
    if (!this.mesh.visible) {
      this.geometry.instanceCount = 0;
      return;
    }

    const emissionRate = Math.max(0, sampleScalar(this.emitter.EmissionRate, frame, 0));
    const speedBase = sampleScalar(this.emitter.Speed, frame, 0);
    const variation = sampleScalar(this.emitter.Variation, frame, 0);
    const latitude = sampleScalar(this.emitter.Latitude, frame, 0);
    const gravity = sampleScalar(this.emitter.Gravity, frame, 0);
    const width = sampleScalar(this.emitter.Width, frame, 0);
    const length = sampleScalar(this.emitter.Length, frame, 0);

    this.spawnAcc += emissionRate * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const p = this.findFreeParticle();
      if (!p) break;
      this.emitOne(p, speedBase, variation, latitude);
    }

    let maxAlive = 0;
    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.lifeSpan) { p.active = false; continue; }
      p.vel.y -= gravity * dt;
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
      p.pos.z += p.vel.z * dt;
      maxAlive = i + 1;
    }

    const baseSize = Math.max(0.01, (width + length) * 0.5);
    this.flushAttributes(baseSize, visibility);
    this.geometry.instanceCount = maxAlive;
  }

  private findFreeParticle(): Particle | null {
    for (const p of this.particles) if (!p.active) return p;
    return null;
  }

  private emitOne(p: Particle, speedBase: number, variation: number, latitude: number): void {
    p.active = true;
    p.age = 0;
    p.lifeSpan = this.lifeSpan;
    p.pos.copy(this.pivot);
    const lat = latitude * (Math.random() * 2 - 1);
    const azi = Math.random() * Math.PI * 2;
    const dirX = Math.sin(lat) * Math.cos(azi);
    const dirY = Math.cos(lat);
    const dirZ = Math.sin(lat) * Math.sin(azi);
    const speed = speedBase + (Math.random() * 2 - 1) * variation;
    p.vel.set(dirX * speed, dirY * speed, dirZ * speed);
  }

  private flushAttributes(baseSize: number, emitterAlpha: number): void {
    const posArr = this.posAttr.array as Float32Array;
    const colArr = this.colorAttr.array as Float32Array;
    const sizeArr = this.sizeAttr.array as Float32Array;
    const uvArr = this.uvOffsetAttr.array as Float32Array;
    const segs = this.emitter.SegmentColor ?? [];
    const alphas = this.emitter.Alpha ?? new Uint8Array([255, 255, 255]);
    const scaling = this.emitter.ParticleScaling ?? new Float32Array([1, 1, 1]);

    for (let i = 0; i < this.maxParticles; i++) {
      const p = this.particles[i];
      if (!p.active) {
        colArr[i * 4 + 3] = 0;
        continue;
      }
      const t = p.age / p.lifeSpan;
      const segIdx = t < 0.5 ? 0 : 1;
      const segT = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const c0 = segs[segIdx] ?? new Float32Array([1, 1, 1]);
      const c1 = segs[segIdx + 1] ?? c0;
      const a0 = (alphas[segIdx] ?? 255) / 255;
      const a1 = (alphas[segIdx + 1] ?? a0 * 255) / 255;
      const s0 = scaling[segIdx] ?? 1;
      const s1 = scaling[segIdx + 1] ?? s0;

      posArr[i * 3]     = p.pos.x;
      posArr[i * 3 + 1] = p.pos.y;
      posArr[i * 3 + 2] = p.pos.z;

      // SegmentColor 在 MDX 中为 BGR
      colArr[i * 4]     = c0[2] * (1 - segT) + c1[2] * segT;
      colArr[i * 4 + 1] = c0[1] * (1 - segT) + c1[1] * segT;
      colArr[i * 4 + 2] = c0[0] * (1 - segT) + c1[0] * segT;
      colArr[i * 4 + 3] = (a0 * (1 - segT) + a1 * segT) * emitterAlpha;

      const sz = baseSize * (s0 * (1 - segT) + s1 * segT);
      sizeArr[i * 2]     = sz;
      sizeArr[i * 2 + 1] = sz;

      // UV 帧动画：frame = lerp(uvAnimStart, uvAnimEnd, t)
      const uvFrame = Math.round(this.uvAnimStart + (this.uvAnimEnd - this.uvAnimStart) * t);
      const col = uvFrame % this.cols;
      const row = Math.floor(uvFrame / this.cols) % this.rows;
      uvArr[i * 2]     = col * this.cellW;
      // PlaneGeometry.uv 默认 V 朝上(左下=0,左上=1)，MDX atlas row=0 在顶部
      // → V 偏移 = 1 - (row+1)*cellH
      uvArr[i * 2 + 1] = 1 - (row + 1) * this.cellH;
    }

    this.posAttr.needsUpdate = true;
    this.colorAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.uvOffsetAttr.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ============================================================
// RibbonEmitter — 条带
// ============================================================

interface RibbonSeg {
  age: number;
  lifeSpan: number;
  top: THREE.Vector3;
  bot: THREE.Vector3;
  active: boolean;
}

class RibbonInstance {
  readonly mesh: THREE.Mesh;
  private readonly emitter: any;
  private readonly pivot: THREE.Vector3;
  private readonly maxSegs: number;
  private readonly segs: RibbonSeg[];
  private readonly posAttr: THREE.BufferAttribute;
  private readonly colAttr: THREE.BufferAttribute;
  private readonly indexAttr: THREE.BufferAttribute;
  private readonly material: MeshBasicNodeMaterial;
  private spawnAcc = 0;

  constructor(emitter: any, pivot: Float32Array | undefined, texture: THREE.Texture | null) {
    this.emitter = emitter;
    this.pivot = new THREE.Vector3(pivot?.[0] ?? 0, pivot?.[1] ?? 0, pivot?.[2] ?? 0);

    const lifeSpan = emitter.LifeSpan ?? 1;
    const rate = emitter.EmissionRate ?? 30;
    this.maxSegs = Math.max(16, Math.min(Math.ceil(rate * lifeSpan) + 4, 256));

    this.segs = new Array(this.maxSegs);
    for (let i = 0; i < this.maxSegs; i++) {
      this.segs[i] = { age: 0, lifeSpan: 0, top: new THREE.Vector3(), bot: new THREE.Vector3(), active: false };
    }

    const vertCount = this.maxSegs * 2;
    const pos = new Float32Array(vertCount * 3);
    const col = new Float32Array(vertCount * 4);
    const uv = new Float32Array(vertCount * 2);
    for (let i = 0; i < this.maxSegs; i++) {
      const u = i / Math.max(1, this.maxSegs - 1);
      uv[(i * 2) * 2]     = u;
      uv[(i * 2) * 2 + 1] = 0;
      uv[(i * 2 + 1) * 2] = u;
      uv[(i * 2 + 1) * 2 + 1] = 1;
    }
    const idx = new Uint16Array((this.maxSegs - 1) * 6);

    this.posAttr = new THREE.BufferAttribute(pos, 3);
    this.colAttr = new THREE.BufferAttribute(col, 4);
    this.indexAttr = new THREE.BufferAttribute(idx, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.indexAttr.setUsage(THREE.DynamicDrawUsage);

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', this.posAttr);
    geom.setAttribute('color', this.colAttr);
    geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geom.setIndex(this.indexAttr);
    geom.setDrawRange(0, 0);

    this.material = new MeshBasicNodeMaterial({
      map: texture ?? undefined,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.material.blending = THREE.CustomBlending;
    this.material.blendSrc = THREE.SrcAlphaFactor;
    this.material.blendDst = THREE.OneMinusSrcAlphaFactor;

    this.mesh = new THREE.Mesh(geom, this.material);
    this.mesh.frustumCulled = false;
  }

  update(dt: number, frame: number): void {
    const heightAbove = sampleScalar(this.emitter.HeightAbove, frame, 0);
    const heightBelow = sampleScalar(this.emitter.HeightBelow, frame, 0);
    const alpha = sampleScalar(this.emitter.Alpha, frame, 1);
    const visibility = sampleScalar(this.emitter.Visibility, frame, 1);

    this.mesh.visible = visibility > 0.001 && (heightAbove + heightBelow) > 0.001;
    if (!this.mesh.visible) {
      this.mesh.geometry.setDrawRange(0, 0);
      return;
    }

    this.spawnAcc += (this.emitter.EmissionRate ?? 30) * dt;
    while (this.spawnAcc >= 1) {
      this.spawnAcc -= 1;
      const s = this.findFreeSeg();
      if (!s) break;
      s.active = true;
      s.age = 0;
      s.lifeSpan = this.emitter.LifeSpan ?? 1;
      s.top.set(this.pivot.x, this.pivot.y + heightAbove, this.pivot.z);
      s.bot.set(this.pivot.x, this.pivot.y - heightBelow, this.pivot.z);
    }

    const gravity = this.emitter.Gravity ?? 0;
    for (const s of this.segs) {
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.lifeSpan) { s.active = false; continue; }
      s.top.y -= gravity * dt;
      s.bot.y -= gravity * dt;
    }

    const live: RibbonSeg[] = [];
    for (const s of this.segs) if (s.active) live.push(s);
    live.sort((a, b) => a.age - b.age);

    const posArr = this.posAttr.array as Float32Array;
    const colArr = this.colAttr.array as Float32Array;
    const idxArr = this.indexAttr.array as Uint16Array;
    const color = this.emitter.Color ?? new Float32Array([1, 1, 1]);
    const cr = color[2] ?? 1, cg = color[1] ?? 1, cb = color[0] ?? 1;

    for (let i = 0; i < live.length; i++) {
      const s = live[i];
      const a = (1 - s.age / s.lifeSpan) * alpha * visibility;
      const base = i * 2;
      posArr[base * 3]     = s.top.x;
      posArr[base * 3 + 1] = s.top.y;
      posArr[base * 3 + 2] = s.top.z;
      posArr[(base + 1) * 3]     = s.bot.x;
      posArr[(base + 1) * 3 + 1] = s.bot.y;
      posArr[(base + 1) * 3 + 2] = s.bot.z;
      colArr[base * 4] = cr; colArr[base * 4 + 1] = cg; colArr[base * 4 + 2] = cb; colArr[base * 4 + 3] = a;
      colArr[(base + 1) * 4] = cr; colArr[(base + 1) * 4 + 1] = cg; colArr[(base + 1) * 4 + 2] = cb; colArr[(base + 1) * 4 + 3] = a;
    }

    let indexCount = 0;
    for (let i = 0; i < live.length - 1; i++) {
      const v0 = i * 2, v1 = v0 + 1, v2 = v0 + 2, v3 = v0 + 3;
      idxArr[indexCount++] = v0;
      idxArr[indexCount++] = v1;
      idxArr[indexCount++] = v2;
      idxArr[indexCount++] = v2;
      idxArr[indexCount++] = v1;
      idxArr[indexCount++] = v3;
    }

    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.indexAttr.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, indexCount);
  }

  private findFreeSeg(): RibbonSeg | null {
    for (const s of this.segs) if (!s.active) return s;
    return null;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

export class MDXParticleSystem {
  readonly root: THREE.Group;
  private readonly emitters: Emitter2Instance[] = [];
  private readonly ribbons: RibbonInstance[] = [];
  /** 外部（MDXModel）注入的当前 MDX 帧（ms） */
  currentFrame = 0;

  constructor() {
    this.root = new THREE.Group();
    this.root.name = 'MDXParticles';
  }

  static async build(
    model: Model,
    resolveTexture: (texIndex: number) => Promise<THREE.Texture | null>,
  ): Promise<MDXParticleSystem> {
    const sys = new MDXParticleSystem();
    const pivots: Float32Array[] = model.PivotPoints ?? [];

    // ParticleEmitter2
    const emitters: ParticleEmitter2[] = (model as any).ParticleEmitters2 ?? [];
    for (const emitter of emitters) {
      if (typeof emitter.TextureID !== 'number') continue;
      const tex = await resolveTexture(emitter.TextureID).catch(() => null);
      const pivotIdx = (emitter as any).PivotPoint as number | undefined;
      const pivot = pivotIdx !== undefined ? pivots[pivotIdx] : undefined;
      const inst = new Emitter2Instance(emitter, pivot, tex);
      sys.emitters.push(inst);
      sys.root.add(inst.mesh);
    }

    // RibbonEmitter
    const ribbons: any[] = (model as any).RibbonEmitters ?? [];
    const materials = model.Materials ?? [];
    for (const emitter of ribbons) {
      const mat = materials[emitter.MaterialID ?? 0];
      const layer = mat?.Layers?.[0];
      let texId: number | undefined;
      if (layer) {
        texId = typeof layer.TextureID === 'number'
          ? layer.TextureID
          : (layer.TextureID as any)?.Keys?.[0]?.Vector?.[0];
      }
      const tex = typeof texId === 'number' ? await resolveTexture(texId).catch(() => null) : null;
      const pivotIdx = (emitter as any).PivotPoint as number | undefined;
      const pivot = pivotIdx !== undefined ? pivots[pivotIdx] : undefined;
      const inst = new RibbonInstance(emitter, pivot, tex);
      sys.ribbons.push(inst);
      sys.root.add(inst.mesh);
    }

    return sys;
  }

  update(dt: number): void {
    for (const e of this.emitters) e.update(dt, this.currentFrame);
    for (const r of this.ribbons) r.update(dt, this.currentFrame);
  }

  dispose(): void {
    for (const e of this.emitters) e.dispose();
    for (const r of this.ribbons) r.dispose();
    this.emitters.length = 0;
    this.ribbons.length = 0;
  }
}
