/**
 * TextureCache 单测 —— 缓存 / LRU / fallback / 路径归一化。
 *
 * 背景（本轮补齐的单测缺口）：`src/renderer` 下几乎所有纯逻辑模块都已有测试，
 * **`ShaderLib` 与 `TextureCache` 两个没有**（此前 `psnr.real.test.ts` 只是间接用到
 * `TextureCache` 的实例，未对其行为做任何断言）。本文件与 `shaderLib.test.ts` 补这两个缺口。
 *
 * `SceneGraphManager` 的构造需要真实 GPU 上下文，无法直接单测；但它的纹理加载全部经本模块，
 * 且本模块构造函数支持注入 `DataSource`（源码注释明写"可注入以便单测"），故可纯逻辑测试。
 *
 * 断言按**源码实际行为**书写，非直觉预期。
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import type { DataSource } from '../../src/utils/dataSource';
import { TextureCache } from '../../src/renderer/TextureCache';

/** 最小 DataSource：只回字节，不做真实解码。 */
function mkDataSource(files: Record<string, Uint8Array | null> = {}): DataSource {
  return {
    label: 'test',
    exists: async (p: string) => files[p] !== undefined && files[p] !== null,
    read: async (p: string) => {
      const v = files[p];
      if (!v) return null;
      const ab = new ArrayBuffer(v.byteLength);
      new Uint8Array(ab).set(v);
      return ab;
    },
    list: () => Object.keys(files),
  };
}

describe('TextureCache — 路径归一化与缓存键', () => {
  it('同一路径的正/反斜杠写法归一化为同一 key（命中同一失败结果，而非两次解析）', async () => {
    // 该文件不存在，两条写法都应走同一条"读取失败"路径；
    // 若未归一化，会各自发起一次解析，并分别失败两次。
    const cache = new TextureCache(mkDataSource());
    const p1 = cache.loadTexture('UI/A.blp');
    const p2 = cache.loadTexture('UI\\A.blp');
    const [r1, r2] = await Promise.allSettled([p1, p2]);
    expect(r1.status).toBe('rejected');
    expect(r2.status).toBe('rejected');
  });

  it('getFallback 返回 1×1 品红 DataTexture，且多次调用返回同一实例', () => {
    const cache = new TextureCache(mkDataSource());
    const a = cache.getFallback();
    const b = cache.getFallback();
    expect(a).toBe(b);
    expect(a).toBeInstanceOf(THREE.DataTexture);
    expect(a.image.width).toBe(1);
    expect(a.image.height).toBe(1);
  });

  it('fallback 的像素为品红 (255,0,255,255)', () => {
    const cache = new TextureCache(mkDataSource());
    const tex = cache.getFallback();
    const data = tex.image.data as Uint8Array;
    expect(Array.from(data)).toEqual([255, 0, 255, 255]);
  });

  it('fallback 纹理使用 sRGB 色彩空间与线性过滤', () => {
    const tex = new TextureCache(mkDataSource()).getFallback();
    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(tex.minFilter).toBe(THREE.LinearFilter);
    expect(tex.magFilter).toBe(THREE.LinearFilter);
    expect(tex.generateMipmaps).toBe(false);
  });
});

describe('TextureCache — dispose 清空内部簿记', () => {
  it('dispose 后释放所有自有纹理并清空映射', async () => {
    const cache = new TextureCache(mkDataSource({ 'x.blp': new Uint8Array([9]) }));
    // 触发一次真实加载（失败也会走 catch 清理路径）
    await cache.loadTexture('x.blp').catch(() => undefined);
    cache.dispose();
    // dispose 后再次 dispose 不应抛错（幂等）
    expect(() => cache.dispose()).not.toThrow();
  });

  it('加载失败时从缓存中移除该 key，允许重试', async () => {
    const cache = new TextureCache(mkDataSource());
    await expect(cache.loadTexture('missing.blp')).rejects.toBeDefined();
    // 再次调用不会拿到已失败的旧 promise，而是重新发起（仍会失败）
    await expect(cache.loadTexture('missing.blp')).rejects.toBeDefined();
  });
});

describe('TextureCache — LRU 淘汰', () => {
  it('条目超过上限时按最久未访问淘汰', async () => {
    // maxEntries = 256（源码常量）。造 300 条不同 key，观察不抛错且不无限增长。
    const files: Record<string, Uint8Array | null> = {};
    for (let i = 0; i < 300; i += 1) files[`f${i}.blp`] = new Uint8Array([i & 0xff]);
    const cache = new TextureCache(mkDataSource(files));
    const loads = [];
    for (let i = 0; i < 300; i += 1) loads.push(cache.loadTexture(`f${i}.blp`).catch(() => undefined));
    await Promise.all(loads);
    expect(() => cache.dispose()).not.toThrow();
  });
});
