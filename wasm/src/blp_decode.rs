//! BLP 解码（浏览器 WASM 侧自实现）。
//!
//! 为何不直接用 `blp` crate：其 `image` 全格式依赖拉入 `turbojpeg-sys`（C 库），
//! `dunce`/`fluent-templates` 拉入 `path-dedot`——均无法编译到 `wasm32-unknown-unknown`。
//!
//! 本实现的格式语义**严格对齐**桌面端所用 `blp-0.1.37`：
//! - 头部：`version` 为 **BigEndian**（`BLP1`=0x424C5031），其余字段 LittleEndian；
//! - `HEADER_SIZE` = 156；
//! - JPEG 变体：156 处为 `u32 LE` 的共享头长度，头紧随其后（160 起）；
//!   每个 mip 解压时拼成 `[共享头][mip 尾]` 的完整 JPEG；
//! - DIRECT（调色板）变体：156 处为 256 色 BGRA 调色板（每色 u32 LE，
//!   R=bits16..23 / G=bits8..15 / B=bits0..7），mip 数据为 `w*h` 索引 + alpha 区。

use byteorder::{BigEndian, LittleEndian, ReadBytesExt};
use std::io::{Cursor, Read};
use wasm_bindgen::prelude::*;

/// BLP 头部字节数（与 `blp` crate 的 `HEADER_SIZE` 一致）。
const HEADER_SIZE: usize = 156;
/// mip 级数上限（与 `blp` crate 的 `MAX_MIPS` 一致）。
const MAX_MIPS: usize = 16;

/// BLP 解码结果（与桌面端 `BlpImageData` 同形：width/height/RGBA 字节）。
#[wasm_bindgen]
#[derive(Debug)]
pub struct BlpImage {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl BlpImage {
    /// 图像宽度（像素）。
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }

    /// 图像高度（像素）。
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }

    /// RGBA 字节（长度 = width * height * 4）。
    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }
}

/// 纹理类型：JPEG（0）或 DIRECT/调色板（1）。
#[derive(PartialEq, Eq, Clone, Copy)]
enum TextureType {
    Jpeg,
    Direct,
}

struct Header {
    texture_type: TextureType,
    alpha_bits: u32,
    width: u32,
    height: u32,
    mip_offsets: [usize; MAX_MIPS],
    mip_lengths: [usize; MAX_MIPS],
    /// JPEG 共享头 / DIRECT 调色板所在偏移与长度。
    header_offset: usize,
    header_length: usize,
}

fn read_header(buf: &[u8]) -> Result<Header, String> {
    if buf.len() < HEADER_SIZE {
        return Err(format!("BLP 过短：{} < {}", buf.len(), HEADER_SIZE));
    }
    let mut c = Cursor::new(buf);

    // version 为 BigEndian（'BLP1' / 'BLP0' / 'BLP2'）
    let version_raw = c
        .read_u32::<BigEndian>()
        .map_err(|e| format!("读取 version 失败: {}", e))?;
    let magic = match version_raw {
        0x424C5030 => "BLP0",
        0x424C5031 => "BLP1",
        0x424C5032 => "BLP2",
        _ => return Err(format!("未知 BLP 版本魔数: 0x{:08X}", version_raw)),
    };
    let is_blp2 = magic == "BLP2";

    let texture_type_raw = c
        .read_u32::<LittleEndian>()
        .map_err(|e| format!("读取 texture_type 失败: {}", e))?;
    let texture_type = match texture_type_raw {
        0 => TextureType::Jpeg,
        1 => TextureType::Direct,
        other => return Err(format!("未知 BLP texture_type: {}", other)),
    };

    // BLP2 多出 compression/alpha_bits/alpha_type/has_mips 四个 u8；
    // BLP0/BLP1 为 alpha_bits(u32) 单字段。
    let alpha_bits = if is_blp2 {
        let _compression = c.read_u8().map_err(|e| e.to_string())?;
        let ab = c.read_u8().map_err(|e| e.to_string())? as u32;
        let _alpha_type = c.read_u8().map_err(|e| e.to_string())?;
        let _has_mips = c.read_u8().map_err(|e| e.to_string())?;
        ab
    } else {
        c.read_u32::<LittleEndian>()
            .map_err(|e| format!("读取 alpha_bits 失败: {}", e))?
    };

    let width = c
        .read_u32::<LittleEndian>()
        .map_err(|e| format!("读取 width 失败: {}", e))?;
    let height = c
        .read_u32::<LittleEndian>()
        .map_err(|e| format!("读取 height 失败: {}", e))?;

    if width == 0 || height == 0 {
        return Err(format!("非法尺寸: {}x{}", width, height));
    }

    if !is_blp2 {
        let _extra = c.read_u32::<LittleEndian>().map_err(|e| e.to_string())?;
        let _has_mipmaps = c.read_u32::<LittleEndian>().map_err(|e| e.to_string())?;
    }

    let mut mip_offsets = [0usize; MAX_MIPS];
    let mut mip_lengths = [0usize; MAX_MIPS];
    for i in 0..MAX_MIPS {
        mip_offsets[i] = c
            .read_u32::<LittleEndian>()
            .map_err(|e| format!("读取 mip 偏移[{}] 失败: {}", i, e))? as usize;
    }
    for i in 0..MAX_MIPS {
        mip_lengths[i] = c
            .read_u32::<LittleEndian>()
            .map_err(|e| format!("读取 mip 长度[{}] 失败: {}", i, e))? as usize;
    }

    let (header_offset, header_length) = match texture_type {
        TextureType::Jpeg => {
            let base = HEADER_SIZE;
            if buf.len() < base + 4 {
                return Err("截断：读不到 JPEG 共享头长度".to_string());
            }
            let mut cc = Cursor::new(&buf[base..]);
            let hdr_len = cc
                .read_u32::<LittleEndian>()
                .map_err(|e| format!("读取 JPEG 头长度失败: {}", e))? as usize;
            let hdr_off = base + 4;
            if buf.len() < hdr_off + hdr_len {
                return Err(format!(
                    "截断：JPEG 头越界（{}+{} > {}）",
                    hdr_off,
                    hdr_len,
                    buf.len()
                ));
            }
            (hdr_off, hdr_len)
        }
        TextureType::Direct => (HEADER_SIZE, 256 * 4),
    };

    Ok(Header {
        texture_type,
        alpha_bits,
        width,
        height,
        mip_offsets,
        mip_lengths,
        header_offset,
        header_length,
    })
}

/// 解码 BLP 为 RGBA（只解最高分辨率 mip，与桌面端 `decode_blp_to_rgba` 行为一致）。
pub fn decode_to_rgba(buf: &[u8]) -> Result<BlpImage, String> {
    let h = read_header(buf)?;

    match h.texture_type {
        TextureType::Direct => decode_direct(buf, &h),
        TextureType::Jpeg => decode_jpeg(buf, &h),
    }
}

/// 纯 Rust 形态的解码结果 `(width, height, rgba)`。
///
/// 供原生侧（`cargo test` / `examples`）使用：`BlpImage` 的 getter 由
/// `#[wasm_bindgen]` 生成，在非 wasm32 目标上调用会 panic，故原生侧走本函数。
#[doc(hidden)]
pub fn decode_to_rgba_raw(buf: &[u8]) -> Result<(u32, u32, Vec<u8>), String> {
    let img = decode_to_rgba(buf)?;
    Ok((img.width, img.height, img.data))
}

/// DIRECT（调色板）解码。
fn decode_direct(buf: &[u8], h: &Header) -> Result<BlpImage, String> {
    let h_off = h.header_offset;
    let h_len = h.header_length;
    if h_off + h_len > buf.len() {
        return Err("调色板越界".to_string());
    }

    // 读 256 色调色板：每色 u32 LE，R=bits16..23 / G=bits8..15 / B=bits0..7
    let mut palette = [[0u8; 3]; 256];
    let mut c = Cursor::new(&buf[h_off..h_off + h_len]);
    for slot in palette.iter_mut() {
        let color = c
            .read_u32::<LittleEndian>()
            .map_err(|e| format!("读取调色板失败: {}", e))?;
        let r = ((color >> 16) & 0xFF) as u8;
        let g = ((color >> 8) & 0xFF) as u8;
        let b = (color & 0xFF) as u8;
        *slot = [r, g, b];
    }

    // mip 0：最高分辨率
    let off = h.mip_offsets[0];
    let len = h.mip_lengths[0];
    if len == 0 {
        return Err("mip 0 数据为空".to_string());
    }
    if off.checked_add(len).map_or(true, |end| end > buf.len()) {
        return Err(format!(
            "mip 0 越界（off={} len={} buf={}）",
            off,
            len,
            buf.len()
        ));
    }

    let w = h.width as usize;
    let hgt = h.height as usize;
    let pixel_count = w
        .checked_mul(hgt)
        .ok_or_else(|| "尺寸溢出".to_string())?;

    let mut c = Cursor::new(&buf[off..off + len]);

    // 索引：每像素 1 字节
    let mut indices = vec![0u8; pixel_count];
    c.read_exact(&mut indices)
        .map_err(|_| "mip 0 索引区截断".to_string())?;

    // alpha 区：位深 0/1/4/8
    let alpha_bytes = match h.alpha_bits {
        0 => 0,
        1 => (pixel_count + 7) / 8,
        4 => (pixel_count + 1) / 2,
        8 => pixel_count,
        other => return Err(format!("不支持的 alpha 位深: {}", other)),
    };
    let mut alpha_raw = vec![0u8; alpha_bytes];
    if alpha_bytes > 0 {
        c.read_exact(&mut alpha_raw)
            .map_err(|_| "mip 0 alpha 区截断".to_string())?;
    }

    let mut out = vec![0u8; pixel_count * 4];
    for p in 0..pixel_count {
        let idx = indices[p] as usize;
        let [r, g, b] = palette[idx];
        let a = match h.alpha_bits {
            0 => 255,
            1 => {
                let byte = alpha_raw[p / 8];
                if (byte >> (p % 8)) & 1 == 1 { 255 } else { 0 }
            }
            4 => {
                let byte = alpha_raw[p / 2];
                let nibble = if (p & 1) == 0 { byte & 0x0F } else { byte >> 4 };
                (nibble << 4) | nibble
            }
            _ => alpha_raw[p],
        };
        let o = p * 4;
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = a;
    }

    Ok(BlpImage {
        width: h.width,
        height: h.height,
        data: out,
    })
}

/// JPEG 变体解码：`[共享头][mip 尾]` 拼成完整 JPEG 后解码。
fn decode_jpeg(buf: &[u8], h: &Header) -> Result<BlpImage, String> {
    use jpeg_decoder::{Decoder, PixelFormat};

    let h_off = h.header_offset;
    let h_len = h.header_length;
    if h_off + h_len > buf.len() {
        return Err("JPEG 共享头越界".to_string());
    }
    let header_bytes = &buf[h_off..h_off + h_len];

    let off = h.mip_offsets[0];
    let len = h.mip_lengths[0];
    if len == 0 {
        return Err("mip 0 数据为空".to_string());
    }
    if off.checked_add(len).map_or(true, |end| end > buf.len()) {
        return Err(format!(
            "mip 0 越界（off={} len={} buf={}）",
            off,
            len,
            buf.len()
        ));
    }

    let mut full = Vec::with_capacity(header_bytes.len() + len);
    full.extend_from_slice(header_bytes);
    full.extend_from_slice(&buf[off..off + len]);

    let mut dec = Decoder::new(Cursor::new(&full));
    dec.read_info()
        .map_err(|e| format!("JPEG 读头失败: {:?}", e))?;
    let info = dec.info().ok_or_else(|| "JPEG 元信息缺失".to_string())?;
    let (w, hh) = (info.width as u32, info.height as u32);
    let pixels = dec.decode().map_err(|e| format!("JPEG 解码失败: {:?}", e))?;

    // alpha_bits == 0 时强制不透明（与桌面端语义一致）
    let force_opaque = h.alpha_bits == 0;
    let mut out = vec![0u8; (w as usize) * (hh as usize) * 4];

    match info.pixel_format {
        PixelFormat::CMYK32 => {
            let need = (w as usize) * (hh as usize) * 4;
            if pixels.len() != need {
                return Err(format!("JPEG CMYK 尺寸不符: {} != {}", pixels.len(), need));
            }
            for p in 0..(w as usize) * (hh as usize) {
                let i = p * 4;
                let c = pixels[i];
                let m = pixels[i + 1];
                let y = pixels[i + 2];
                let k = pixels[i + 3];
                let a = if force_opaque { 255 } else { 255u8.saturating_sub(k) };
                out[i] = 255u8.saturating_sub(y);
                out[i + 1] = 255u8.saturating_sub(m);
                out[i + 2] = 255u8.saturating_sub(c);
                out[i + 3] = a;
            }
        }
        PixelFormat::RGB24 => {
            let need = (w as usize) * (hh as usize) * 3;
            if pixels.len() != need {
                return Err(format!("JPEG RGB 尺寸不符: {} != {}", pixels.len(), need));
            }
            for p in 0..(w as usize) * (hh as usize) {
                let s = p * 3;
                let d = p * 4;
                out[d] = pixels[s];
                out[d + 1] = pixels[s + 1];
                out[d + 2] = pixels[s + 2];
                out[d + 3] = 255;
            }
        }
        other => {
            return Err(format!("不支持的 JPEG 像素格式: {:?}", other));
        }
    }

    Ok(BlpImage {
        width: w,
        height: hh,
        data: out,
    })
}

// ---------------------------------------------------------------------------
// 测试（原生 cargo test，非 wasm 运行）
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    /// 构造一个最小 DIRECT/调色板 BLP1（2x2，alpha_bits=8）。
    fn make_paletted_blp() -> Vec<u8> {
        let mut b = Vec::new();
        b.extend_from_slice(b"BLP1"); // version (BE)
        b.extend_from_slice(&1u32.to_le_bytes()); // texture_type = DIRECT
        b.extend_from_slice(&8u32.to_le_bytes()); // alpha_bits
        b.extend_from_slice(&2u32.to_le_bytes()); // width
        b.extend_from_slice(&2u32.to_le_bytes()); // height
        b.extend_from_slice(&0u32.to_le_bytes()); // extra
        b.extend_from_slice(&0u32.to_le_bytes()); // has_mipmaps
        assert_eq!(b.len(), 28);

        // 调色板 256*4
        let palette_start = b.len();
        let mut palette = vec![0u8; 256 * 4];
        // 索引 0 → 纯红 (R=255,G=0,B=0) 存为 LE u32 = 0x0000FF00? 见下
        // R=bits16..23, G=bits8..15, B=bits0..7 → 红 = 0x00FF0000
        palette[0..4].copy_from_slice(&0x00FF_0000u32.to_le_bytes());
        // 索引 1 → 纯绿 0x0000FF00
        palette[4..8].copy_from_slice(&0x0000_FF00u32.to_le_bytes());
        b.extend_from_slice(&palette);
        assert_eq!(b.len() - palette_start, 256 * 4);

        // mip 数据起点
        let mip_off = b.len();
        // 4 个索引：0,1,0,1
        b.extend_from_slice(&[0u8, 1, 0, 1]);
        // alpha：4 字节
        b.extend_from_slice(&[255u8, 128, 255, 0]);
        let mip_len = b.len() - mip_off;

        // 回填 mip 偏移/长度表（此时 b 长度 = 28 + 1024 + 8）
        // 头部结构：28 + 64(offsets) + 64(lengths) + 1024(palette) + mip
        // 但上面我们是顺序写的，需要把表插在 28 之后 → 重建
        let mut out = Vec::new();
        out.extend_from_slice(&b[0..28]);
        let new_mip_off = 28 + 64 + 64 + 1024;
        for i in 0..16 {
            let v = if i == 0 { new_mip_off as u32 } else { 0 };
            out.extend_from_slice(&v.to_le_bytes());
        }
        for i in 0..16 {
            let v = if i == 0 { mip_len as u32 } else { 0 };
            out.extend_from_slice(&v.to_le_bytes());
        }
        out.extend_from_slice(&b[28..]);
        let _ = mip_off;
        out
    }

    #[test]
    fn decodes_paletted_basic() {
        let blp = make_paletted_blp();
        let img = decode_to_rgba(&blp).expect("应能解码");
        assert_eq!(img.width, 2);
        assert_eq!(img.height, 2);
        assert_eq!(img.data.len(), 2 * 2 * 4);
        // 像素 0：索引 0 → 红，alpha 255
        assert_eq!(&img.data[0..4], &[255, 0, 0, 255]);
        // 像素 1：索引 1 → 绿，alpha 128
        assert_eq!(&img.data[4..8], &[0, 255, 0, 128]);
        // 像素 3：索引 1 → 绿，alpha 0
        assert_eq!(&img.data[12..16], &[0, 255, 0, 0]);
    }

    #[test]
    fn rejects_short_buffer() {
        let err = decode_to_rgba(&[0u8; 10]).unwrap_err();
        assert!(err.contains("过短"), "实际: {}", err);
    }

    #[test]
    fn rejects_bad_magic() {
        let mut b = vec![0u8; HEADER_SIZE];
        b[0..4].copy_from_slice(&0xDEADBEEFu32.to_be_bytes());
        let err = decode_to_rgba(&b).unwrap_err();
        assert!(err.contains("未知 BLP 版本魔数"), "实际: {}", err);
    }
}
