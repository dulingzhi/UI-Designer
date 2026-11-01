import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { FrameType, type FrameData } from '../../src/types';
import { createMaterial, updateMaterial } from '../../src/renderer/ShaderLib';
import { TextureCache } from '../../src/renderer/TextureCache';
import type { DataSource } from '../../src/utils/dataSource';

function mkFrame(o: Partial<FrameData> = {}): FrameData {
  return { id: 'f', name: 'F', type: FrameType.FRAME, x: 0, y: 0, width: 0.1, height: 0.1, anchors: [], children: [], ...o } as FrameData;
}
function ds(): DataSource {
  return { label: 't', exists: async () => false, read: async () => null, list: () => [] };
}

describe('材质与 TextureCache 所有权集成（修复回归）', () => {
  it('材质换图不销毁 cache 拥有的纹理，缓存复用时拿到可用纹理', () => {
    const cache = new TextureCache(ds());
    const fallback = cache.getFallback();

    const disposed: string[] = [];
    fallback.addEventListener('dispose', () => disposed.push('fallback'));

    const m = createMaterial(mkFrame(), { texture: fallback });
    // 模拟换到另一张纹理，再换回 cache 的 fallback
    const other = new THREE.Texture();
    updateMaterial(m as any, mkFrame(), { texture: other });
    updateMaterial(m as any, mkFrame(), { texture: fallback });

    // fallback 在整个过程中不应被材质销毁
    expect(disposed).toEqual([]);
    expect(m.map).toBe(fallback);
  });

  it('fallback 是全局单例，不归 cache.ownedTextures 管理（故 dispose 不销毁它）', () => {
    const cache = new TextureCache(ds());
    const fallback = cache.getFallback();
    const m = createMaterial(mkFrame(), { texture: fallback });

    let disposed = false;
    fallback.addEventListener('dispose', () => { disposed = true; });
    cache.dispose();
    // getFallback 返回模块级单例（跨实例共享），不属于任何 cache 实例，
    // 故 cache.dispose 不会销毁它——这正是"所有纹理生命周期由 TextureCache 层统一管理"
    // 中 fallback 的特例，记录该事实。
    expect(disposed).toBe(false);
    expect(m.map).toBe(fallback);
  });
});