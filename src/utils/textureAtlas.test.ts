import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  TextureAtlasSplitter,
  parseCornerFlags,
  hasAllBorderParts,
  hasOnlyCorners,
  hasOnlyEdges,
  DEFAULT_BORDER_LAYOUT,
  HORIZONTAL_BORDER_LAYOUT,
  COMPACT_BORDER_LAYOUT,
} from './textureAtlas';

// ---- global stubs for browser APIs used by the pure logic ----
const imgSizes = new Map<string, [number, number]>();
const imgErrors = new Set<string>();
const cssCalls: string[] = [];

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  width = 0;
  height = 0;
  set src(v: string) {
    this._src = v;
    if (imgErrors.has(v)) {
      queueMicrotask(() => this.onerror?.());
    } else {
      const s = imgSizes.get(v);
      if (s) {
        this.width = s[0];
        this.height = s[1];
      }
      queueMicrotask(() => this.onload?.());
    }
  }
  get src() {
    return this._src;
  }
}

let preventContext = false;
let throwOnDraw = false;

function makeCtx() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(() => {
      if (throwOnDraw) throw new Error('draw boom');
    }),
  };
}

function makeCanvas() {
  const ctx = makeCtx();
  const canvas = {
    width: 0,
    height: 0,
    toDataURL: vi.fn(() => 'data:image/png;base64,AAA'),
    getContext: vi.fn(() => (preventContext ? null : ctx)),
  };
  return { canvas, ctx };
}

beforeEach(() => {
  imgSizes.clear();
  imgErrors.clear();
  cssCalls.length = 0;
  preventContext = false;
  throwOnDraw = false;
  const doc = {
    createElement: vi.fn(() => {
      const { canvas } = makeCanvas();
      return canvas;
    }),
  };
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Image', MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TextureAtlasSplitter.extractSubTextures', () => {
  it('extracts all parts, rotating T/B, and caches by url+subSize', async () => {
    imgSizes.set('data:u', [192, 192]);
    const splitter = new TextureAtlasSplitter();
    const result = await splitter.extractSubTextures('data:u', {
      UL: [0, 0],
      T: [1, 0],
      B: [1, 1],
      R: [2, 0],
    });

    expect(Array.from(result.keys()).sort()).toEqual(['B', 'R', 'T', 'UL']);
    expect(result.get('UL')).toBe('data:image/png;base64,AAA');
    expect(result.get('T')).toBeDefined();
    expect(splitter.getCacheSize()).toBe(1);

    // second call hits cache (same cache entry, no re-extraction)
    const cached = await splitter.extractSubTextures('data:u', {
      B: [0, 0], // different layout, but cache key ignores layout
    }, 64);
    expect(Array.from(cached.keys()).sort()).toEqual(['B', 'R', 'T', 'UL']);

    // different subSize => different cache key
    await splitter.extractSubTextures('data:u', DEFAULT_BORDER_LAYOUT, 128);
    expect(splitter.getCacheSize()).toBe(2);
  });

  it('uses default layout and size, and reuses cache cacheKey layout-independent', async () => {
    imgSizes.set('data:d', [192, 192]);
    const splitter = new TextureAtlasSplitter();
    const r1 = await splitter.extractSubTextures('data:d');
    expect(Array.from(r1.keys()).length).toBe(8);
    expect(splitter.getCacheSize()).toBe(1);
  });

  it('rejects when source image fails to load', async () => {
    imgErrors.add('data:err');
    const splitter = new TextureAtlasSplitter();
    await expect(splitter.extractSubTextures('data:err')).rejects.toThrow('图像加载失败');
    await expect(splitter.detectLayout('data:err')).rejects.toThrow('图像加载失败');
  });

  it('throws when Canvas 2D context is unavailable', async () => {
    imgSizes.set('data:noctx', [64, 64]);
    preventContext = true;
    const splitter = new TextureAtlasSplitter();
    await expect(splitter.extractSubTextures('data:noctx')).rejects.toThrow(
      '无法创建 Canvas 上下文',
    );
  });

  it('catches per-flag draw errors and warns, still returning partial map', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    imgSizes.set('data:warn', [64, 64]);
    throwOnDraw = true;
    const splitter = new TextureAtlasSplitter();
    const result = await splitter.extractSubTextures('data:warn');
    expect(result.size).toBe(0);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('TextureAtlasSplitter.detectLayout', () => {
  it('detects 8x1 horizontal layout (aspect 8)', async () => {
    imgSizes.set('data:h', [512, 64]);
    const splitter = new TextureAtlasSplitter();
    const res = await splitter.detectLayout('data:h');
    expect(res.layout).toBe(HORIZONTAL_BORDER_LAYOUT);
    expect(res.subSize).toBe(64);
  });

  it('detects 2x4 compact layout (aspect 0.5)', async () => {
    imgSizes.set('data:c', [128, 256]);
    const splitter = new TextureAtlasSplitter();
    const res = await splitter.detectLayout('data:c');
    expect(res.layout).toBe(COMPACT_BORDER_LAYOUT);
    expect(res.subSize).toBe(64);
  });

  it('detects 3x3 default layout (aspect 1)', async () => {
    imgSizes.set('data:s', [192, 192]);
    const splitter = new TextureAtlasSplitter();
    const res = await splitter.detectLayout('data:s');
    expect(res.layout).toBe(DEFAULT_BORDER_LAYOUT);
    expect(res.subSize).toBe(64);
  });

  it('falls back to default 3x3 for unknown aspect ratios', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // ratios: very wide (>=7 true, <=9 false) and very tall (>=7 false)
    const splitter = new TextureAtlasSplitter();
    imgSizes.set('data:wide', [200, 10]);
    const rw = await splitter.detectLayout('data:wide');
    expect(rw.layout).toBe(DEFAULT_BORDER_LAYOUT);
    expect(rw.subSize).toBe(Math.floor(200 / 3));

    imgSizes.set('data:tall', [10, 200]);
    const rt = await splitter.detectLayout('data:tall');
    expect(rt.layout).toBe(DEFAULT_BORDER_LAYOUT);

    // ratio 0.8 (between compact and square bands) triggers the default fallback
    imgSizes.set('data:m', [80, 100]);
    const rm = await splitter.detectLayout('data:m');
    expect(rm.layout).toBe(DEFAULT_BORDER_LAYOUT);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('TextureAtlasSplitter cache management', () => {
  it('clearCache, removeCacheEntry, getCacheSize', async () => {
    imgSizes.set('data:x', [64, 64]);
    const splitter = new TextureAtlasSplitter();
    expect(splitter.getCacheSize()).toBe(0);
    await splitter.extractSubTextures('data:x');
    expect(splitter.getCacheSize()).toBe(1);
    expect(splitter.removeCacheEntry('data:x', 64)).toBeUndefined();
    expect(splitter.getCacheSize()).toBe(0);
    // removal of a non-existent key is a no-op
    expect(splitter.removeCacheEntry('data:nope')).toBeUndefined();
    await splitter.extractSubTextures('data:x');
    splitter.clearCache();
    expect(splitter.getCacheSize()).toBe(0);
  });
});

describe('parseCornerFlags', () => {
  it('parses valid flags and trims', () => {
    expect(parseCornerFlags('UL|UR|BL|BR|T|L|B|R')).toEqual([
      'UL', 'UR', 'BL', 'BR', 'T', 'L', 'B', 'R',
    ]);
    expect(parseCornerFlags('  UL |  UR ')).toEqual(['UL', 'UR']);
  });

  it('filters invalid / unknown flags', () => {
    expect(parseCornerFlags('UL|XX|BL')).toEqual(['UL', 'BL']);
  });

  it('returns [] for empty string', () => {
    expect(parseCornerFlags('')).toEqual([]);
  });
});

describe('hasAllBorderParts / hasOnlyCorners / hasOnlyEdges', () => {
  it('hasAllBorderParts true when all present; false otherwise', () => {
    const all = parseCornerFlags('UL|UR|BL|BR|T|L|B|R');
    expect(hasAllBorderParts(all)).toBe(true);
    expect(hasAllBorderParts(['UL', 'UR', 'BL', 'BR', 'T', 'L', 'B'])).toBe(false);
    expect(hasAllBorderParts(['UL', 'UR', 'BL', 'BR', 'T', 'L', 'B', 'R', 'UL'])).toBe(true);
  });

  it('hasOnlyCorners', () => {
    expect(hasOnlyCorners(['UL', 'UR', 'BL', 'BR'])).toBe(true);
    expect(hasOnlyCorners([])).toBe(true);
    expect(hasOnlyCorners(['UL', 'T'])).toBe(false);
  });

  it('hasOnlyEdges', () => {
    expect(hasOnlyEdges(['T', 'L', 'B', 'R'])).toBe(true);
    expect(hasOnlyEdges([])).toBe(true);
    expect(hasOnlyEdges(['T', 'UL'])).toBe(false);
  });
});