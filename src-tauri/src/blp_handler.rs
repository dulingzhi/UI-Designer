use blp::core::image::ImageBlp;
use image::{ImageFormat, RgbaImage};
use std::io::Cursor;

#[derive(serde::Serialize, Debug, Clone)]
pub struct BlpImageData {
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>, // RGBA 格式，每像素 4 字节
}

#[derive(serde::Serialize, Debug)]
pub struct BlpInfo {
    pub width: u32,
    pub height: u32,
    pub mipmap_count: usize,
    pub format: String,
}

/// 解码 BLP 文件为 ImageData（RGBA 格式）
pub fn decode_blp(blp_data: &[u8]) -> Result<BlpImageData, String> {
    // 解析 BLP 结构
    let mut blp = ImageBlp::from_buf(blp_data)
        .map_err(|e| format!("BLP 解析失败: {:?}", e))?;
    
    // 解码第一层 mipmap（最高分辨率）
    blp.decode(blp_data, &[true])
        .map_err(|e| format!("BLP 解码失败: {:?}", e))?;
    
    // 获取 RGBA 图像
    let img = blp.mipmaps[0].image
        .take()
        .ok_or_else(|| "没有可用的图像数据".to_string())?;
    
    let (width, height) = img.dimensions();
    let raw_data = img.into_raw();
    
    Ok(BlpImageData {
        width,
        height,
        data: raw_data,
    })
}

/// 获取 BLP 文件的 mipmap 信息
pub fn get_blp_info(blp_data: &[u8]) -> Result<BlpInfo, String> {
    let blp = ImageBlp::from_buf(blp_data)
        .map_err(|e| format!("BLP 解析失败: {:?}", e))?;
    
    let format = match blp.encoding {
        1 => "JPEG",
        2 => "Paletted",
        3 => "DXT1/DXT3/DXT5",
        _ => "Unknown",
    };
    
    Ok(BlpInfo {
        width: blp.width,
        height: blp.height,
        mipmap_count: blp.mipmap_count as usize,
        format: format.to_string(),
    })
}

/// 解码 BLP 为 PNG base64（用于直接显示）
pub fn decode_blp_to_png_base64(blp_data: &[u8]) -> Result<String, String> {
    let image_data = decode_blp(blp_data)?;
    
    // 创建 RGBA 图像
    let img = RgbaImage::from_raw(image_data.width, image_data.height, image_data.data)
        .ok_or_else(|| "无法创建图像".to_string())?;
    
    // 转换为 PNG
    let mut png_buffer = Vec::new();
    let mut cursor = Cursor::new(&mut png_buffer);
    
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("PNG 编码失败: {}", e))?;
    
    // 编码为 base64
    let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_buffer);
    Ok(format!("data:image/png;base64,{}", base64_str))
}

/// 解码 BLP 指定 mipmap 层级
pub fn decode_blp_mipmap(blp_data: &[u8], mipmap_level: usize) -> Result<BlpImageData, String> {
    let mut blp = ImageBlp::from_buf(blp_data)
        .map_err(|e| format!("BLP 解析失败: {:?}", e))?;
    
    if mipmap_level >= blp.mipmap_count as usize {
        return Err(format!("Mipmap 层级 {} 超出范围 (最大: {})", mipmap_level, blp.mipmap_count - 1));
    }
    
    // 解码指定的 mipmap
    let mut decode_flags = vec![false; blp.mipmap_count as usize];
    decode_flags[mipmap_level] = true;
    
    blp.decode(blp_data, &decode_flags)
        .map_err(|e| format!("BLP 解码失败: {:?}", e))?;
    
    let img = blp.mipmaps[mipmap_level].image
        .take()
        .ok_or_else(|| format!("Mipmap {} 没有图像数据", mipmap_level))?;
    
    let (width, height) = img.dimensions();
    let raw_data = img.into_raw();
    
    Ok(BlpImageData {
        width,
        height,
        data: raw_data,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_decode_blp() {
        // 这里可以添加测试代码
        // 需要一个有效的 BLP 文件数据
    }
}
