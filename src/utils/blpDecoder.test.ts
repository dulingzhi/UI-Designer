import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BLPDecoder, decodeBLP, decodeBLPToDataURL } from './blpDecoder';

// ---------------------------------------------------------------------------
// Mutable browser-global mocks (document / Image / URL / ImageData) so the
// pure decoding logic runs in Node. Behavior is toggled per-test.
// ---------------------------------------------------------------------------
let imgBehavior: 'load' | 'error' = 'load';
let getImageDataThrows = false;
let currentCtx: any;

class MockBrowserImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';
  get src() {
    return this._src;
  }
  set src(v: string) {
    this._src = v;
    if (imgBehavior === 'error') {
      queueMicrotask(() => this.onerror?.());
    } else {
      queueMicrotask(() => this.onload?.());
    }
  }
}

function makeCtx() {
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => {
      if (getImageDataThrows) throw new Error('getImageData boom');
      return { data: new Uint8ClampedArray([1, 2, 3, 4]) };
    }),
    putImageData: vi.fn(),
  };
}

function makeCanvas(ctx: any) {
  return {
    width: 0,
    height: 0,
    toDataURL: vi.fn(() => 'data:image/png;base64,XXXX'),
    getContext: vi.fn(() => ctx),
  };
}

/** Fake ImageData used only when we want the browser `new ImageData` branch. */
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

// Core mock for decodeBLPToDataURL's dynamic Rust-backend import.
const coreMocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ invoke: coreMocks.invoke }));

beforeEach(() => {
  imgBehavior = 'load';
  getImageDataThrows = false;
  currentCtx = makeCtx();
  vi.stubGlobal('Image', MockBrowserImage);
  vi.stubGlobal('document', {
    createElement: vi.fn(() => makeCanvas(currentCtx)),
  });
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  coreMocks.invoke.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * 构造一个最小 BLP1 (paletted, 未压缩) 文件：
 *   - 256 色调色板位于偏移 156，每项 BGRA。
 *   - alphaDepth(偏移 8) = 0：调色板第4字节(charIndex) 不是 alpha，图应视为不透明(255)。
 *   - mip0 索引区在调色板之后，每像素 1 字节。
 * 生成 1 行 x 1 列，调色板第 0 项 BGRA=(0,0,58,0)（闲置第4字节=0，历史上被误读成全透明）。
 */
function makePalettedBLP1(alphaDepth: number): ArrayBuffer {
  const W = 1, H = 1;
  const paletteOffset = 156;
  const indexOffset = paletteOffset + 256 * 4;      // 156 + 1024
  const total = indexOffset + W * H;
  const buf = new ArrayBuffer(total);
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);

  // 魔数 BLP1，按 mdx 的 Int32 方式读 header[0..39]，这里直接手工写 4 字节 'B','L','P','1'：
  u8[0] = 'B'.charCodeAt(0);
  u8[1] = 'L'.charCodeAt(0);
  u8[2] = 'P'.charCodeAt(0);
  u8[3] = '1'.charCodeAt(0);

  dv.setUint32(1 * 4, 1, true);        // content/type = 1 (paletted)
  dv.setUint32(2 * 4, alphaDepth, true); // alphaBits
  dv.setUint32(3 * 4, W, true);        // width
  dv.setUint32(4 * 4, H, true);        // height
  dv.setUint32(5 * 4, 0, true);        // type
  dv.setInt32(6 * 4, 0, true);         // hasMipmaps(mip0 一条): 用偏移0表示存在

  // mip0 条目的 offset + size (mdx 用 header[7+mip], header[23+mip])
  dv.setUint32((7 + 0) * 4, indexOffset, true);  // mipOffsets[0]
  dv.setUint32((23 + 0) * 4, W * H, true);       // mipSizes[0]

  // 调色板第0项 BGRA=(0,0,58,alpha)。字节序在文件里是 B,G,R,A。
  const palO = paletteOffset;
  u8[palO + 0] = 0;   // B
  u8[palO + 1] = 0;   // G
  u8[palO + 2] = 58;  // R
  u8[palO + 3] = 0;   // A (闲置 charIndex=0)

  // 索引
  u8[indexOffset] = 0; // 引用调色板第0项

  return buf;
}

/** 更通用的 paletted BLP1 构造器，支持任意 WxH、alphaDepth 与外部 alpha 数据。 */
function buildPalettedBLP1(opts: {
  width?: number;
  height?: number;
  alphaDepth?: number;
  keepEmptyMip?: boolean;
  extraAlpha?: Uint8Array;
  wantMaybeHasMip?: boolean;
}): ArrayBuffer {
  const W = opts.width ?? 1;
  const H = opts.height ?? 1;
  const alphaDepth = opts.alphaDepth ?? 0;
  const indexOffset = 156 + 256 * 4;
  const alphaLen =
    opts.extraAlpha?.length ??
    (alphaDepth <= 0 ? 0 : alphaDepth === 1 ? Math.ceil((W * H) / 8) : alphaDepth === 4 ? Math.ceil((W * H) / 2) : W * H);
  const total = indexOffset + W * H + alphaLen;
  const buf = new ArrayBuffer(total);
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);

  u8[0] = 'B'.charCodeAt(0);
  u8[1] = 'L'.charCodeAt(0);
  u8[2] = 'P'.charCodeAt(0);
  u8[3] = '1'.charCodeAt(0);
  dv.setUint32(4, 1, true); // paletted
  dv.setUint32(8, alphaDepth, true); // alphaDepth
  dv.setUint32(12, W, true);
  dv.setUint32(16, H, true);
  dv.setUint32(20, 0, true); // alphaEncoding
  dv.setUint32(24, 0, true); // hasMipmaps
  dv.setUint32(28, opts.keepEmptyMip ? 0 : indexOffset, true);
  dv.setUint32(92, opts.keepEmptyMip ? 0 : W * H, true);

  // 调色板全 0 => R=G=B=0
  if (opts.extraAlpha) {
    u8.set(opts.extraAlpha, indexOffset + W * H);
  }
  return buf;
}

/** JPEG 压缩 BLP1 构造器。 */
function buildJpegBLP1(opts: {
  width?: number;
  height?: number;
  headerSize?: number;
  dataLen?: number;
  emptyMip?: boolean;
  compression?: number;
}): ArrayBuffer {
  const W = opts.width ?? 2;
  const H = opts.height ?? 2;
  const headerSize = opts.headerSize ?? 8;
  const dataLen = opts.dataLen ?? 4;
  const jpegOffset = 160 + headerSize;
  const total = jpegOffset + dataLen;
  const buf = new ArrayBuffer(total);
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);

  u8[0] = 'B'.charCodeAt(0);
  u8[1] = 'L'.charCodeAt(0);
  u8[2] = 'P'.charCodeAt(0);
  u8[3] = '1'.charCodeAt(0);
  dv.setUint32(4, opts.compression ?? 0, true); // JPEG
  dv.setUint32(8, 0, true);
  dv.setUint32(12, W, true);
  dv.setUint32(16, H, true);
  dv.setUint32(20, 0, true);
  dv.setUint32(24, 0, true);
  dv.setUint32(28, opts.emptyMip ? 0 : jpegOffset, true);
  dv.setUint32(92, opts.emptyMip ? 0 : dataLen, true);
  dv.setUint32(156, headerSize, true); // jpegHeaderSize
  dv.setUint32(160, 0x11111111, true); // jpeg header bytes
  dv.setUint32(jpegOffset, 0x22222222, true); // jpeg data
  return buf;
}

/** BLP2 DXT 构造器：把 dataBytes 放到正文偏移 144，mip0 指向那里。 */
function buildBLP2DXT(opts: {
  compression: number;
  width?: number;
  height?: number;
  alphaDepth?: number;
  data: Uint8Array;
}): ArrayBuffer {
  const W = opts.width ?? 4;
  const H = opts.height ?? 4;
  const dataStart = 144;
  const total = dataStart + opts.data.length;
  const buf = new ArrayBuffer(total);
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);

  u8[0] = 'B'.charCodeAt(0);
  u8[1] = 'L'.charCodeAt(0);
  u8[2] = 'P'.charCodeAt(0);
  u8[3] = '2'.charCodeAt(0);
  dv.setUint8(4, opts.compression);
  dv.setUint8(5, opts.alphaDepth ?? 0);
  dv.setUint8(6, 0); // alphaEncoding
  dv.setUint8(7, 0); // hasMipmaps
  dv.setUint32(8, W, true);
  dv.setUint32(12, H, true);
  dv.setUint32(16, dataStart, true); // mipOffsets[0]
  dv.setUint32(80, opts.data.length, true); // mipSizes[0]
  u8.set(opts.data, dataStart);
  return buf;
}

describe('BLPDecoder decodePaletted / alpha 语义', () => {
  it('alphaDepth=0 (BLP1 paletted 无额外 alpha) 时输出不透明 (alpha=255)', async () => {
    // 回归：调色板第4字节(charIndex=0) 曾被误读为 alpha，导致整图全透明。
    // 与 openwar3(mdx-m3-viewer) 一致：alphaDepth=0 → 不透明。
    const dec = new BLPDecoder(makePalettedBLP1(0));
    const im = await dec.decode(0);
    expect(im.width).toBe(1);
    expect(im.height).toBe(1);
    const d = im.data;
    expect([d[0], d[1], d[2], d[3]]).toEqual([58, 0, 0, 255]); // R,G,B,A
  });

  it('alphaDepth=8 时由额外 alpha 通道覆盖调色板默认 alpha', async () => {
    // 构造一个带额外 alpha 通道的变体：mip0 索引之后 1 像素 alpha=128。
    const base = makePalettedBLP1(0);
    const W = 1, H = 1;
    const paletteOffset = 156;
    const indexOffset = paletteOffset + 256 * 4;
    const alphaOffset = indexOffset + W * H;
    const buf = new ArrayBuffer(alphaOffset + W * H);
    const dst = new Uint8Array(buf);
    dst.set(new Uint8Array(base).subarray(0, indexOffset + W * H), 0);
    // 改 alphaDepth=8
    const dv = new DataView(buf);
    dv.setUint32(2 * 4, 8, true);
    // 写额外 alpha 通道
    dst[alphaOffset] = 128;
    const dec = new BLPDecoder(buf);
    const im = await dec.decode(0);
    const d = im.data;
    expect([d[0], d[1], d[2], d[3]]).toEqual([58, 0, 0, 128]);
  });
});

describe('BLPDecoder decodePaletted: alphaDepth 1 / 4, 错误路径, header errors', () => {
  it('alphaDepth=1 逐位 alpha', async () => {
    // 8 像素、1 位/像素。字节 0x80 => 第一个像素 alpha=1(bit7) 其他为 0。
    const buf = buildPalettedBLP1({ width: 8, height: 1, alphaDepth: 1, extraAlpha: new Uint8Array([0x80]) });
    const dec = new BLPDecoder(buf);
    const im = await dec.decode(0);
    expect(im.width).toBe(8);
    // 调色板 R=G=B=0，第0像素 alpha=255，其余 0
    expect(im.data[3]).toBe(255);
    expect(im.data[7]).toBe(0);
  });

  it('alphaDepth=4 半字节 alpha', async () => {
    // 2 像素，4 位/像素。字节 0xF0 => 第0像素 alpha=15(高位)，第1像素 alpha=0。
    const buf = buildPalettedBLP1({ width: 2, height: 1, alphaDepth: 4, extraAlpha: new Uint8Array([0xF0]) });
    const dec = new BLPDecoder(buf);
    const im = await dec.decode(0);
    expect(im.data[3]).toBe(255); // (15/15)*255
    expect(im.data[7]).toBe(0);
  });

  it('alphaDepth 非常规值(如 2)不触发任何 applyAlphaChannel 分支', async () => {
    const buf = buildPalettedBLP1({ width: 1, height: 1, alphaDepth: 2, extraAlpha: new Uint8Array([0x80]) });
    const dec = new BLPDecoder(buf);
    const im = await dec.decode(0);
    // alpha 保持调色板默认 255
    expect(im.data[3]).toBe(255);
  });

  it('decodePaletted 在 mip offset/size 为 0 时抛错', async () => {
    const dec = new BLPDecoder(buildPalettedBLP1({ keepEmptyMip: true }));
    await expect(dec.decode(0)).rejects.toThrow('无效的Mipmap级别: 0');
  });

  it('BLP0 magic 的版本 0 不兼容', () => {
    const buf = new ArrayBuffer(160);
    const u8 = new Uint8Array(buf);
    u8[0] = 'B'.charCodeAt(0);
    u8[1] = 'L'.charCodeAt(0);
    u8[2] = 'P'.charCodeAt(0);
    u8[3] = '0'.charCodeAt(0);
    expect(() => new BLPDecoder(buf)).toThrow('不支持的BLP版本: 0');
  });

  it('decodePaletted 对 BLP2 使用调色板偏移 148', async () => {
    // BLP2 paletted(compression=1) 调色板在 148。构造 1x1：
    const indexOffset = 148 + 256 * 4;
    const buf = new ArrayBuffer(indexOffset + 1);
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    u8[0] = 'B'.charCodeAt(0);
    u8[1] = 'L'.charCodeAt(0);
    u8[2] = 'P'.charCodeAt(0);
    u8[3] = '2'.charCodeAt(0);
    dv.setUint8(4, 1); // compression = 1 (paletted)
    dv.setUint8(5, 0); // alphaDepth
    dv.setUint8(6, 0);
    dv.setUint8(7, 0);
    dv.setUint32(8, 1, true); // width
    dv.setUint32(12, 1, true); // height
    dv.setUint32(16, indexOffset, true); // mipOffsets[0]
    dv.setUint32(80, 1, true); // mipSizes[0]
    // 调色板第0项 BGRA -> R=58 (BLP2 paletted 共用 decodePaletted)
    u8[148 + 2] = 58; // R
    u8[148 + 3] = 0;
    u8[indexOffset] = 0; // index 0
    const dec = new BLPDecoder(buf);
    const im = await dec.decode(0);
    expect(im.width).toBe(1);
    expect(im.data[0]).toBe(58);
    expect(im.data[3]).toBe(255);
  });

  it('非法 magic 抛错', () => {
    const buf = new ArrayBuffer(160);
    const u8 = new Uint8Array(buf);
    u8[0] = 'X'.charCodeAt(0);
    u8[1] = 'X'.charCodeAt(0);
    u8[2] = 'X'.charCodeAt(0);
    u8[3] = 'X'.charCodeAt(0);
    expect(() => new BLPDecoder(buf)).toThrow('不支持的BLP格式: XXXX');
  });

  it('不支持的压缩类型抛错', async () => {
    const dec = new BLPDecoder(buildJpegBLP1({ compression: 6 }));
    await expect(dec.decode(0)).rejects.toThrow('不支持的压缩类型: 6');
  });
});

describe('BLPDecoder getInfo', () => {
  it('报告宽高/版本/压缩名/mipmap 数量', () => {
    // BLP1 paletted（额外占满整幅）构造多个有效 mip 条目
    const W = 4, H = 4;
    const indexOffset = 156 + 256 * 4;
    const buf = new ArrayBuffer(indexOffset + W * H);
    const u8 = new Uint8Array(buf);
    const dv = new DataView(buf);
    u8[0] = 'B'.charCodeAt(0);
    u8[1] = 'L'.charCodeAt(0);
    u8[2] = 'P'.charCodeAt(0);
    u8[3] = '1'.charCodeAt(0);
    dv.setUint32(4, 1, true); // paletted
    dv.setUint32(12, W, true);
    dv.setUint32(16, H, true);
    // mip0 offset>0 size>0 (count), mip1 offset>0 size=0 (not count), mip2 offset=0 (not count)
    dv.setUint32(28, indexOffset, true);
    dv.setUint32(92, W * H, true);
    dv.setUint32(32, 50, true);
    dv.setUint32(96, 0, true);
    dv.setUint32(36, 0, true);
    dv.setUint32(100, 10, true);

    const dec = new BLPDecoder(buf);
    const info = dec.getInfo();
    expect(info.width).toBe(4);
    expect(info.height).toBe(4);
    expect(info.version).toBe(1);
    expect(info.compression).toBe('Paletted');
    expect(info.mipmapCount).toBe(1);
  });

  it('未知压缩类型回退为 Unknown(N)', () => {
    const dec = new BLPDecoder(buildJpegBLP1({ compression: 6 }));
    expect(dec.getInfo().compression).toBe('Unknown(6)');
  });
});

describe('BLPDecoder DXT1 (BLP2)', () => {
  it('color0 > color1 时 4 色插值模式', async () => {
    // 4x4 单块：color0=0xFFFF(白) > color1=0x0000(黑) => 4色模式
    const data = new Uint8Array(8);
    const dv = new DataView(data.buffer);
    dv.setUint16(0, 0xFFFF, true);
    dv.setUint16(2, 0x0000, true);
    dv.setUint32(4, 0, true); // 全 color0
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 2, width: 4, height: 4, data }));
    const im = await dec.decode(0);
    expect(im.data.length).toBe(4 * 4 * 4);
    // 白色(RGB565 0xFFFF) -> R=G=B≈248
    expect(im.data[0]).toBe(248);
    expect(im.data[3]).toBe(255);
  });

  it('color0 <= color1 时 3 色 + 透明模式', async () => {
    const data = new Uint8Array(8);
    const dv = new DataView(data.buffer);
    dv.setUint16(0, 0x0000, true); // color0 = black
    dv.setUint16(2, 0xFFFF, true); // color1 = white (color1 > color0 => 3色+透明)
    dv.setUint32(4, 0xFFFFFFFF, true); // 全 color3 => 透明
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 2, width: 4, height: 4, data }));
    const im = await dec.decode(0);
    expect(im.data[3]).toBe(0); // A=0
  });

  it('跳过超出图像边界的像素(非4倍数尺寸)', async () => {
    // 2x2 图像，单块：仅 (0,0)(1,0)(0,1)(1,1) 落在界内
    const data = new Uint8Array(8);
    const dv = new DataView(data.buffer);
    dv.setUint16(0, 0xF800, true);
    dv.setUint16(2, 0x07FF, true);
    dv.setUint32(4, 0, true);
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 2, width: 2, height: 2, data }));
    const im = await dec.decode(0);
    expect(im.data.length).toBe(2 * 2 * 4);
  });
});

describe('BLPDecoder DXT3 (BLP2)', () => {
  it('解码 4 位 alpha 块', async () => {
    // 16 字节块：前8字节为 alpha(每字节2像素)，后8字节为 RGB (复用 DXT1)
    const data = new Uint8Array(16);
    const dv = new DataView(data.buffer);
    // alpha bytes: 0xAB,0xCD,0xEF,0x12,0x34,0x56,0x78,0x9A (覆盖高/低 nibble 两分支)
    const alphaBytes = [0xAB, 0xCD, 0xEF, 0x12, 0x34, 0x56, 0x78, 0x9A];
    for (let i = 0; i < 8; i++) data[i] = alphaBytes[i];
    dv.setUint16(8, 0xFFFF, true);
    dv.setUint16(10, 0x0000, true);
    dv.setUint32(12, 0, true);
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 3, width: 4, height: 4, data }));
    const im = await dec.decode(0);
    expect(im.data.length).toBe(4 * 4 * 4);
    // pixel0 high nibble of 0xAB = A -> (10*16+10)=170
    expect(im.data[3]).toBe((0x0A << 4) | 0x0A);
    // pixel1 low nibble of 0xAB = B -> 187
    expect(im.data[7]).toBe((0x0B << 4) | 0x0B);
  });

  it('非倍数尺寸跳过越界像素(窄边缘块)', async () => {
    // 2x2 图像 -> blockCountX/Y=1，许多像素越界被跳过
    const data = new Uint8Array(16);
    for (let i = 0; i < 8; i++) data[i] = 0xFF; // 全部 alpha
    const dv = new DataView(data.buffer);
    dv.setUint16(8, 0xF800, true);
    dv.setUint16(10, 0x07FF, true);
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 3, width: 2, height: 2, data }));
    const im = await dec.decode(0);
    expect(im.data.length).toBe(2 * 2 * 4);
  });
});

describe('BLPDecoder DXT5 (BLP2)', () => {
  it('alpha0 > alpha1 时 6 段插值', async () => {
    const data = new Uint8Array(16);
    const dv = new DataView(data.buffer);
    data[0] = 0xFF; // alpha0
    data[1] = 0x00; // alpha1  (alpha0 > alpha1 => 6 段插值)
    // 6 字节索引 => 16 像素。填充为 0 覆盖 单字节/跨字节索引分支。
    dv.setUint16(8, 0xFFFF, true);
    dv.setUint16(10, 0x0000, true);
    dv.setUint32(12, 0, true);
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 4, width: 4, height: 4, data }));
    const im = await dec.decode(0);
    expect(im.data.length).toBe(4 * 4 * 4);
    // 索引 0 => alpha0=255
    expect(im.data[3]).toBe(255);
  });

  it('alpha0 <= alpha1 时 4 段插值 + 0 + 255', async () => {
    const data = new Uint8Array(16);
    const dv = new DataView(data.buffer);
    data[0] = 0x00; // alpha0
    data[1] = 0xFF; // alpha1 (alpha0 <= alpha1 => 4 段插值 + 0 + 255)
    // 索引全 7 => alphas[7] = 255
    data[2] = 0xFF;
    data[3] = 0xFF;
    data[4] = 0xFF;
    data[5] = 0xFF;
    data[6] = 0xFF;
    data[7] = 0xFF;
    dv.setUint16(8, 0xF800, true);
    dv.setUint16(10, 0x07FF, true);
    dv.setUint32(12, 0, true);
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 4, width: 4, height: 4, data }));
    const im = await dec.decode(0);
    expect(im.data[3]).toBe(255);
  });

  it('alpha0 <= alpha1 时 4 段插值 + 0 + 255 (颜色相同分支)', async () => {
    const data = new Uint8Array(16);
    const dv = new DataView(data.buffer);
    data[0] = 0x10;
    data[1] = 0x20; // alpha0(0x10) <= alpha1(0x20) => 4 段插值分支
    const dec = new BLPDecoder(buildBLP2DXT({ compression: 4, width: 2, height: 2, data }));
    const im = await dec.decode(0);
    expect(im.data.length).toBe(2 * 2 * 4);
  });
});

describe('BLPDecoder JPEG (BLP1)', () => {
  it('offset/size 为 0 时返回占位图 (无需浏览器)', async () => {
    const dec = new BLPDecoder(buildJpegBLP1({ emptyMip: true }));
    const im = await dec.decode(0);
    expect(im.data[0]).toBe(128); // 半透明灰
    expect(im.data[3]).toBe(128);
  });

  it('有效 JPEG: canvas drawImage + getImageData 解码成功', async () => {
    const dec = new BLPDecoder(buildJpegBLP1({ width: 2, height: 2, headerSize: 8, dataLen: 4 }));
    const im = await dec.decode(0);
    expect(im.data[0]).toBe(1);
    expect(im.width).toBe(2);
  });

  it('JPEG Image onerror 时回退到占位图', async () => {
    imgBehavior = 'error';
    const dec = new BLPDecoder(buildJpegBLP1({ width: 2, height: 2 }));
    const im = await dec.decode(0);
    expect(im.data[0]).toBe(128);
  });

  it('getImageData 抛错时 onload catch 并回退到占位图', async () => {
    getImageDataThrows = true;
    const dec = new BLPDecoder(buildJpegBLP1({ width: 2, height: 2 }));
    const im = await dec.decode(0);
    expect(im.data[0]).toBe(128);
  });
});

describe('BLPDecoder.decode 在浏览器 ImageData 存在时走 new ImageData 分支', () => {
  beforeEach(() => {
    vi.stubGlobal('ImageData', FakeImageData);
  });

  it('构造 ImageData 实例', async () => {
    const dec = new BLPDecoder(makePalettedBLP1(0));
    const im = await dec.decode(0);
    expect(im).toBeInstanceOf(FakeImageData);
    expect(im.width).toBe(1);
    expect((im as FakeImageData).data.length).toBe(4);
  });
});

describe('decodeBLP / decodeBLPToDataURL 辅助函数', () => {
  it('decodeBLP 委托给 BLPDecoder', async () => {
    const im = await decodeBLP(makePalettedBLP1(0));
    expect(im.width).toBe(1);
  });

  it('decodeBLPToDataURL 使用 Rust 后端成功时直接返回 dataURL', async () => {
    coreMocks.invoke.mockResolvedValue('data:image/png;base64,RUST');
    const url = await decodeBLPToDataURL(makePalettedBLP1(0));
    expect(url).toBe('data:image/png;base64,RUST');
    expect(coreMocks.invoke).toHaveBeenCalledWith('decode_blp_to_png', {
      blpData: Array.from(new Uint8Array(makePalettedBLP1(0))),
    });
  });

  it('decodeBLPToDataURL 后端失败时回退 JS 解码并输出 dataURL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    coreMocks.invoke.mockRejectedValue(new Error('rust down'));
    const url = await decodeBLPToDataURL(makePalettedBLP1(0));
    expect(url).toBe('data:image/png;base64,XXXX');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('decodeBLPToDataURL useRustBackend=false 直接 JS 解码', async () => {
    const url = await decodeBLPToDataURL(makePalettedBLP1(0), 0, false);
    expect(url).toBe('data:image/png;base64,XXXX');
    expect(coreMocks.invoke).not.toHaveBeenCalled();
  });
});