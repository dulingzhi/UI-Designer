import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BlpImageData } from './rustBridge';

const coreMocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: coreMocks.invoke }));

// 路径 A 双通道：显式控制「是否浏览器」与「WASM 是否可用」。
const wasmMocks = vi.hoisted(() => ({
  isBrowserRuntime: vi.fn(() => false),
  loadWasmModule: vi.fn(async () => null as unknown),
}));
vi.mock('./platformBridge', () => ({ isBrowserRuntime: wasmMocks.isBrowserRuntime }));
vi.mock('./wasmBridge', () => ({ loadWasmModule: wasmMocks.loadWasmModule }));

// Browser-ish mocks for the DOM-based conversion helpers.
function makeContext() {
  return {
    putImageData: vi.fn(),
  };
}
function makeCanvas(ctx: any) {
  return {
    width: 0,
    height: 0,
    toDataURL: vi.fn(() => 'data:image/png;base64,AAAA'),
    getContext: vi.fn(() => ctx),
  };
}

class FakeImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data;
    this.width = width;
    this.height = height;
  }
}

let currentCtx: any;
let canvas: any;

beforeEach(() => {
  currentCtx = makeContext();
  canvas = makeCanvas(currentCtx);
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) });
  vi.stubGlobal('ImageData', FakeImageData);
  coreMocks.invoke.mockReset();
  wasmMocks.isBrowserRuntime.mockReset();
  wasmMocks.isBrowserRuntime.mockReturnValue(false);
  wasmMocks.loadWasmModule.mockReset();
  wasmMocks.loadWasmModule.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// Import after mocks are installed.
const rustBridge = await import('./rustBridge');
const {
  decodeBLPToPNG,
  decodeBLPToRGBA,
  decodeBLPMipmap,
  parseMDX,
  parseMDXFromMPQ,
  parseMDXFromFile,
  blpImageDataToImageData,
  blpImageDataToDataURL,
} = rustBridge;

const sampleBlp = new Uint8Array([0x42, 0x4c, 0x50, 0x31]);

describe('rustBridge', () => {
  describe('decodeBLPToPNG', () => {
    it('invokes decode_blp_to_png with raw bytes and returns string', async () => {
      coreMocks.invoke.mockResolvedValue('data:image/png;base64,DEAD');
      const result = await decodeBLPToPNG(sampleBlp);
      expect(result).toBe('data:image/png;base64,DEAD');
      expect(coreMocks.invoke).toHaveBeenCalledWith('decode_blp_to_png', sampleBlp);
    });
  });

  describe('decodeBLPToRGBA', () => {
    it('invokes decode_blp_to_rgba with raw bytes and returns BlpImageData', async () => {
      coreMocks.invoke.mockResolvedValue({ width: 2, height: 2, data: [1, 2, 3, 4] });
      const result = await decodeBLPToRGBA(sampleBlp);
      expect(result).toEqual({ width: 2, height: 2, data: [1, 2, 3, 4] });
      expect(coreMocks.invoke).toHaveBeenCalledWith('decode_blp_to_rgba', sampleBlp);
    });

    it('浏览器 + WASM 可用 → 走 WASM 解码并 free()，不调 invoke', async () => {
      const free = vi.fn();
      wasmMocks.isBrowserRuntime.mockReturnValue(true);
      wasmMocks.loadWasmModule.mockResolvedValue({
        decode_blp_to_rgba: vi.fn(() => ({
          width: 3,
          height: 1,
          data: () => new Uint8Array([9, 8, 7, 6]),
          free,
        })),
      });
      const result = await decodeBLPToRGBA(sampleBlp);
      expect(result).toEqual({ width: 3, height: 1, data: [9, 8, 7, 6] });
      expect(free).toHaveBeenCalledTimes(1);
      expect(coreMocks.invoke).not.toHaveBeenCalled();
    });

    it('浏览器但 WASM 不可用（loadWasmModule=null）→ 回落 Tauri', async () => {
      wasmMocks.isBrowserRuntime.mockReturnValue(true);
      wasmMocks.loadWasmModule.mockResolvedValue(null);
      coreMocks.invoke.mockResolvedValue({ width: 1, height: 1, data: [0, 0, 0, 255] });
      const result = await decodeBLPToRGBA(sampleBlp);
      expect(result).toEqual({ width: 1, height: 1, data: [0, 0, 0, 255] });
      expect(coreMocks.invoke).toHaveBeenCalledWith('decode_blp_to_rgba', sampleBlp);
    });
  });


  describe('decodeBLPMipmap', () => {
    it('passes level through to invoke', async () => {
      coreMocks.invoke.mockResolvedValue({ width: 8, height: 8, data: [] });
      await decodeBLPMipmap(sampleBlp, 3);
      expect(coreMocks.invoke).toHaveBeenCalledWith('decode_blp_mipmap_level', {
        blpData: [0x42, 0x4c, 0x50, 0x31],
        level: 3,
      });
    });
  });

  describe('parseMDX', () => {
    it('parses the JSON string returned by invoke', async () => {
      const model = { version: 800, name: 'x', vertices: [], normals: [], uvs: [], faces: [], bounds: {} };
      coreMocks.invoke.mockResolvedValue(JSON.stringify(model));
      const result = await parseMDX(sampleBlp);
      expect(result).toEqual(model);
      expect(coreMocks.invoke).toHaveBeenCalledWith('parse_mdx_file', sampleBlp);
    });

    it('浏览器 + WASM 可用 → 走 WASM 解析，不调 invoke', async () => {
      wasmMocks.isBrowserRuntime.mockReturnValue(true);
      wasmMocks.loadWasmModule.mockResolvedValue({
        parse_mdx_file: vi.fn(() => '{"version":900,"name":"wasm"}'),
      });
      const result = await parseMDX(sampleBlp);
      expect(result).toEqual({ version: 900, name: 'wasm' });
      expect(coreMocks.invoke).not.toHaveBeenCalled();
    });

    it('浏览器但 WASM 不可用 → 回落 Tauri', async () => {
      wasmMocks.isBrowserRuntime.mockReturnValue(true);
      wasmMocks.loadWasmModule.mockResolvedValue(null);
      coreMocks.invoke.mockResolvedValue('{"name":"tauri"}');
      const result = await parseMDX(sampleBlp);
      expect(result).toEqual({ name: 'tauri' });
      expect(coreMocks.invoke).toHaveBeenCalledWith('parse_mdx_file', sampleBlp);
    });
  });

  describe('parseMDXFromMPQ', () => {
    it('passes archive path and filename, returns parsed model', async () => {
      coreMocks.invoke.mockResolvedValue('{"name":"m"}');
      const result = await parseMDXFromMPQ('war3.mpq', 'Units/a.mdx');
      expect(result).toEqual({ name: 'm' });
      expect(coreMocks.invoke).toHaveBeenCalledWith('parse_mdx_from_mpq', {
        archivePath: 'war3.mpq',
        fileName: 'Units/a.mdx',
      });
    });
  });

  describe('parseMDXFromFile', () => {
    it('passes file path and returns parsed model', async () => {
      coreMocks.invoke.mockResolvedValue('{}');
      await parseMDXFromFile('C:\\x\\a.mdx');
      expect(coreMocks.invoke).toHaveBeenCalledWith('parse_mdx_from_file', {
        filePath: 'C:\\x\\a.mdx',
      });
    });
  });

  describe('blpImageDataToImageData', () => {
    it('wraps data into a Uint8ClampedArray and builds ImageData', () => {
      const blp: BlpImageData = { width: 3, height: 2, data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24] };
      const im = blpImageDataToImageData(blp);
      expect(im).toBeInstanceOf(FakeImageData);
      expect(im.width).toBe(3);
      expect(im.height).toBe(2);
      expect(im.data).toBeInstanceOf(Uint8ClampedArray);
      expect(im.data.length).toBe(24);
    });
  });

  describe('blpImageDataToDataURL', () => {
    it('draws image data to a 2d context and returns data URL', () => {
      const blp: BlpImageData = { width: 1, height: 1, data: [255, 0, 0, 255] };
      const url = blpImageDataToDataURL(blp);
      expect(url).toBe('data:image/png;base64,AAAA');
      expect(canvas.width).toBe(1);
      expect(canvas.height).toBe(1);
      expect(canvas.getContext).toHaveBeenCalledWith('2d');
      expect(currentCtx.putImageData).toHaveBeenCalledTimes(1);
      expect(canvas.toDataURL).toHaveBeenCalled();
    });

    it('throws when the 2d context cannot be created', () => {
      vi.stubGlobal('document', {
        createElement: vi.fn(() => ({ ...canvas, getContext: vi.fn(() => null) })),
      });
      expect(() => blpImageDataToDataURL({ width: 1, height: 1, data: [1, 2, 3, 4] })).toThrow('无法创建 Canvas 上下文');
    });
  });
});