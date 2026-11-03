import { invoke } from '@tauri-apps/api/core';

/**
 * BLP 图像数据（RGBA 格式）
 */
export interface BlpImageData {
  width: number;
  height: number;
  data: number[]; // RGBA 数据，每像素 4 字节
}

/**
 * MDX 顶点
 */
export interface MdxVertex {
  x: number;
  y: number;
  z: number;
}

/**
 * MDX 法线
 */
export interface MdxNormal {
  x: number;
  y: number;
  z: number;
}

/**
 * MDX UV 坐标
 */
export interface MdxUV {
  u: number;
  v: number;
}

/**
 * MDX 三角面
 */
export interface MdxFace {
  indices: [number, number, number];
}

/**
 * MDX 包围盒
 */
export interface MdxBoundingBox {
  min: MdxVertex;
  max: MdxVertex;
}

/**
 * MDX 模型数据
 */
export interface MdxModel {
  version: number;
  name: string;
  vertices: MdxVertex[];
  normals: MdxNormal[];
  uvs: MdxUV[];
  faces: MdxFace[];
  bounds: MdxBoundingBox;
}

/**
 * 解码 BLP 文件为 PNG base64（直接用于 <img> 标签）
 */
export async function decodeBLPToPNG(blpData: Uint8Array): Promise<string> {
  return invoke<string>('decode_blp_to_png', blpData);
}

/**
 * 解码 BLP 文件为 RGBA 数据
 */
export async function decodeBLPToRGBA(blpData: Uint8Array): Promise<BlpImageData> {
  return invoke<BlpImageData>('decode_blp_to_rgba', blpData);
}


/**
 * 解码 BLP 指定 mipmap 层级
 */
export async function decodeBLPMipmap(blpData: Uint8Array, level: number): Promise<BlpImageData> {
  // 权衡：本命令需 level+bytes 混合参数，Tauri 2 raw body 不支持混合——
  // 保持 JSON 数组（低频调用，膨胀可接受）；高频三命令已改 raw binary
  return invoke<BlpImageData>('decode_blp_mipmap_level', {
    blpData: Array.from(blpData),
    level,
  });
}

/**
 * 解析 MDX 文件
 */
export async function parseMDX(mdxData: Uint8Array): Promise<MdxModel> {
  const jsonStr = await invoke<string>('parse_mdx_file', mdxData);
  return JSON.parse(jsonStr);
}

/**
 * 从 MPQ 档案中解析 MDX 文件
 */
export async function parseMDXFromMPQ(archivePath: string, fileName: string): Promise<MdxModel> {
  const jsonStr = await invoke<string>('parse_mdx_from_mpq', {
    archivePath,
    fileName,
  });
  return JSON.parse(jsonStr);
}

/**
 * 从本地文件系统解析 MDX 文件
 */
export async function parseMDXFromFile(filePath: string): Promise<MdxModel> {
  const jsonStr = await invoke<string>('parse_mdx_from_file', {
    filePath,
  });
  return JSON.parse(jsonStr);
}

/**
 * 将 BlpImageData 转换为 ImageData（用于 Canvas）
 */
export function blpImageDataToImageData(blpData: BlpImageData): ImageData {
  const uint8Array = new Uint8ClampedArray(blpData.data);
  return new ImageData(uint8Array, blpData.width, blpData.height);
}

/**
 * 将 BlpImageData 转换为 Data URL（用于 <img> 标签）
 */
export function blpImageDataToDataURL(blpData: BlpImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = blpData.width;
  canvas.height = blpData.height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('无法创建 Canvas 上下文');
  }
  
  const imageData = blpImageDataToImageData(blpData);
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.toDataURL();
}
