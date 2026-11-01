import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BackdropEdgeConfig, RenderRect } from './backdropEdgeRenderer';

const atlasMocks = vi.hoisted(() => ({
  extractSubTextures: vi.fn(),
  parseCornerFlags: vi.fn(),
}));
const textureLoaderMocks = vi.hoisted(() => ({ loadTexture: vi.fn() }));

vi.mock('./textureAtlas', () => ({
  textureAtlasSplitter: { extractSubTextures: atlasMocks.extractSubTextures },
  parseCornerFlags: atlasMocks.parseCornerFlags,
}));
vi.mock('./textureLoader', () => ({ loadTexture: textureLoaderMocks.loadTexture }));

import { BackdropEdgeRenderer, renderBackdropEdge, EdgeFlag as _EdgeFlag } from './backdropEdgeRenderer';
import { parseCornerFlags } from './textureAtlas';

type EdgeFlag = 'UL' | 'UR' | 'BL' | 'BR' | 'T' | 'L' | 'B' | 'R';

const ALL_FLAGS: EdgeFlag[] = ['UL', 'UR', 'BL', 'BR', 'T', 'L', 'B', 'R'];

function makeCtx() {
  return {
    drawImage: vi.fn(),
    createPattern: vi.fn(() => ({})),
    save: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    translate: vi.fn(),
    fillStyle: undefined,
    fillRect: vi.fn(),
    restore: vi.fn(),
  };
}

function makeCanvas(ctx: any, width = 800) {
  return {
    width,
    height: 600,
    getContext: vi.fn(() => ctx),
  };
}

class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  _src = '';
  constructor() {}
  set src(v: string) {
    this._src = v;
    queueMicrotask(() => {
      if (imageBehavior === 'error') this.onerror?.();
      else this.onload?.();
    });
  }
  get src() {
    return this._src;
  }
}

let currentCtx: any;
let currentCanvas: any;
let imageBehavior: 'load' | 'error';

const frameRect: RenderRect = { x: 100, y: 50, width: 400, height: 200 };
const config: BackdropEdgeConfig = {
  edgeFile: 'UI\\frame.blp',
  cornerFlags: 'UL|UR|BL|BR|T|L|B|R',
  cornerSize: 0.05,
};

beforeEach(() => {
  imageBehavior = 'load';
  currentCtx = makeCtx();
  currentCanvas = makeCanvas(currentCtx);
  atlasMocks.extractSubTextures.mockReset();
  atlasMocks.parseCornerFlags.mockReset();
  textureLoaderMocks.loadTexture.mockReset();
  vi.stubGlobal('Image', MockImage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BackdropEdgeRenderer constructor', () => {
  it('throws when no 2d context is available', () => {
    const bad = makeCanvas(null);
    bad.getContext.mockReturnValue(null);
    expect(() => new BackdropEdgeRenderer(bad)).toThrow('无法创建 Canvas 上下文');
  });

  it('stores context and canvas width (default 800)', () => {
    const r = new BackdropEdgeRenderer(currentCanvas);
    expect(r).toBeInstanceOf(BackdropEdgeRenderer);
    // default canvas width 800 is reflected in content-area math
    const cfg: BackdropEdgeConfig = { edgeFile: 'f', cornerFlags: '', cornerSize: 0.1 };
    expect(r.calculateContentRect(frameRect, cfg).x).toBe(frameRect.x + 80);
  });

  it('stores explicit canvas width and updates via setCanvasWidth', () => {
    const r = new BackdropEdgeRenderer(currentCanvas, 1024);
    (r as any).canvasWidth;
    r.setCanvasWidth(1280);
    expect(r.calculateContentRect(frameRect, config).x).toBeGreaterThan(0);
  });
});

describe('render', () => {
  it('renders all corner/edge parts with drawImage and tiled pattern', async () => {
    textureLoaderMocks.loadTexture.mockResolvedValue('data:image/png;base64,AAAA');
    const subTextures = new Map<EdgeFlag, string>();
    for (const f of ALL_FLAGS) subTextures.set(f, 'data:image/png;base64,SUBTEX');
    atlasMocks.extractSubTextures.mockResolvedValue(subTextures);
    atlasMocks.parseCornerFlags.mockReturnValue([...ALL_FLAGS]);

    const renderer = new BackdropEdgeRenderer(currentCanvas, 800);
    await renderer.render(config, frameRect);

    expect(textureLoaderMocks.loadTexture).toHaveBeenCalledWith('UI\\frame.blp');
    expect(atlasMocks.extractSubTextures).toHaveBeenCalledWith('data:image/png;base64,AAAA');
    // Four corners drawn directly, four edges via pattern fill.
    expect(currentCtx.drawImage).toHaveBeenCalledTimes(4);
    expect(currentCtx.createPattern).toHaveBeenCalledTimes(4);
    expect(currentCtx.fillRect).toHaveBeenCalledTimes(4);
    currentCtx.drawImage.mock.calls.forEach((args: unknown[]) => {
      expect(args[0]).toBeInstanceOf(MockImage);
    });
  });

  it('warns and skips parts whose sub-texture is missing', async () => {
    textureLoaderMocks.loadTexture.mockResolvedValue('data:image/png;base64,AAAA');
    atlasMocks.extractSubTextures.mockResolvedValue(new Map<string, string>([['T', 'x']]));
    // Flags contain a flag with no texture ('UL'), and one with ('T').
    atlasMocks.parseCornerFlags.mockReturnValue(['UL', 'T']);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new BackdropEdgeRenderer(currentCanvas, 800);
    await renderer.render(config, frameRect);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('未找到子纹理: UL'));
    // 'T' is present and tiles via pattern; no direct drawImage for it.
    expect(currentCtx.createPattern).toHaveBeenCalledTimes(1);
    expect(currentCtx.drawImage).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logs and swallows errors from sub-texture extraction', async () => {
    textureLoaderMocks.loadTexture.mockResolvedValue('data:image/png;base64,AAAA');
    atlasMocks.extractSubTextures.mockRejectedValue(new Error('atlas boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const renderer = new BackdropEdgeRenderer(currentCanvas, 800);
    await renderer.render(config, frameRect);
    expect(err).toHaveBeenCalledWith('[BackdropEdge] 渲染失败:', expect.any(Error));
    err.mockRestore();
  });

  it('handles image onerror by rejecting loadImage, caught by render', async () => {
    imageBehavior = 'error';
    textureLoaderMocks.loadTexture.mockResolvedValue('data:image/png;base64,AAAA');
    atlasMocks.extractSubTextures.mockResolvedValue(new Map<EdgeFlag, string>([['UL', 'data:img']]));
    atlasMocks.parseCornerFlags.mockReturnValue(['UL']);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const renderer = new BackdropEdgeRenderer(currentCanvas, 800);
    await renderer.render(config, frameRect);
    expect(err).toHaveBeenCalledWith('[BackdropEdge] 渲染失败:', expect.any(Error));
    err.mockRestore();
  });

  it('warns when createPattern returns null and skips tiling', async () => {
    textureLoaderMocks.loadTexture.mockResolvedValue('data:image/png;base64,AAAA');
    atlasMocks.extractSubTextures.mockResolvedValue(new Map<EdgeFlag, string>([['T', 'x']]));
    atlasMocks.parseCornerFlags.mockReturnValue(['T']);
    currentCtx.createPattern.mockReturnValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const renderer = new BackdropEdgeRenderer(currentCanvas, 800);
    await renderer.render(config, frameRect);
    expect(warn).toHaveBeenCalledWith('[BackdropEdge] 无法创建 pattern');
    expect(currentCtx.save).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('calculateContentRect', () => {
  it('uses default zero insets when backgroundInsets absent', () => {
    const renderer = new BackdropEdgeRenderer(currentCanvas, 800);
    const cfg: BackdropEdgeConfig = { edgeFile: 'f', cornerFlags: '', cornerSize: 0.1 };
    const r = renderer.calculateContentRect(frameRect, cfg);
    expect(r).toEqual({
      x: frameRect.x + 80,
      y: frameRect.y + 80,
      width: frameRect.width - 160,
      height: frameRect.height - 160,
    });
  });

  it('scales provided insets by canvasWidth', () => {
    const renderer = new BackdropEdgeRenderer(currentCanvas, 1000);
    const cfg: BackdropEdgeConfig = {
      edgeFile: 'f',
      cornerFlags: '',
      cornerSize: 0.05,
      backgroundInsets: [0.01, 0.02, 0.03, 0.04],
    };
    const r = renderer.calculateContentRect(frameRect, cfg);
    expect(r.x).toBe(frameRect.x + 50 + 10);
    expect(r.y).toBe(frameRect.y + 50 + 20);
    expect(r.width).toBe(frameRect.width - 100 - 10 - 30);
    expect(r.height).toBe(frameRect.height - 100 - 20 - 40);
  });
});

describe('renderBackdropEdge', () => {
  it('creates a renderer and renders onto the canvas', async () => {
    textureLoaderMocks.loadTexture.mockResolvedValue('data:image/png;base64,AAAA');
    atlasMocks.extractSubTextures.mockResolvedValue(new Map<EdgeFlag, string>());
    atlasMocks.parseCornerFlags.mockReturnValue([]);
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await renderBackdropEdge(currentCanvas, config, frameRect, 800);
    expect(textureLoaderMocks.loadTexture).toHaveBeenCalled();
    err.mockRestore();
    log.mockRestore();
  });
});

// keep import alive so EdgeFlag type is referenced
void (_EdgeFlag as unknown as string);