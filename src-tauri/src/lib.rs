use std::sync::Mutex;
use std::collections::HashMap;

mod mdx_parser;
use mdx_parser::MdxParser;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Serialize, Clone)]
struct MpqFileInfo {
    name: String,
    size: u64,
}

// MPQ 档案缓存
struct MpqCache {
    archives: HashMap<String, Vec<MpqFileInfo>>,
}

impl MpqCache {
    fn new() -> Self {
        MpqCache {
            archives: HashMap::new(),
        }
    }
}

static MPQ_CACHE: Mutex<Option<MpqCache>> = Mutex::new(None);

fn init_cache() {
    let mut cache = MPQ_CACHE.lock().unwrap();
    if cache.is_none() {
        *cache = Some(MpqCache::new());
    }
}

#[tauri::command]
fn load_mpq_archive(path: String) -> Result<Vec<MpqFileInfo>, String> {
    init_cache();
    
    // 检查缓存
    {
        let cache = MPQ_CACHE.lock().unwrap();
        if let Some(ref cache) = *cache {
            if let Some(files) = cache.archives.get(&path) {
                return Ok(files.clone());
            }
        }
    }
    
    // 打开 MPQ 档案（wow-mpq 使用路径而不是 File）
    let mut archive = wow_mpq::Archive::open(&path)
        .map_err(|e| format!("无法打开 MPQ 档案: {:?}", e))?;
    
    // 获取文件列表
    let mut files = Vec::new();
    
    // 尝试读取 listfile
    match archive.read_file("(listfile)") {
        Ok(listfile_data) => {
            let listfile_str = String::from_utf8_lossy(&listfile_data);
            for line in listfile_str.lines() {
                let filename = line.trim();
                if !filename.is_empty() {
                    files.push(MpqFileInfo {
                        name: filename.to_string(),
                        size: 0,
                    });
                }
            }
        }
        Err(_) => {
            // listfile 不存在，忽略
        }
    }
    
    // 缓存结果
    let mut cache = MPQ_CACHE.lock().unwrap();
    if let Some(ref mut cache) = *cache {
        cache.archives.insert(path, files.clone());
    }
    
    Ok(files)
}

#[tauri::command]
fn read_mpq_file(archive_path: String, file_name: String) -> Result<Vec<u8>, String> {
    // 打开 MPQ 档案
    let mut archive = wow_mpq::Archive::open(&archive_path)
        .map_err(|e| format!("无法打开 MPQ 档案: {:?}", e))?;
    
    // 读取指定文件
    let file_data = archive
        .read_file(&file_name)
        .map_err(|e| format!("无法读取文件 {}: {:?}", file_name, e))?;
    
    Ok(file_data)
}

#[tauri::command]
fn clear_mpq_cache() -> Result<(), String> {
    let mut cache = MPQ_CACHE.lock().unwrap();
    if let Some(ref mut cache) = *cache {
        cache.archives.clear();
    }
    Ok(())
}

/// 解码 BLP 图像为 PNG base64
#[tauri::command]
fn decode_blp_to_png(blp_data: Vec<u8>) -> Result<String, String> {
    use image::ImageFormat;
    use std::io::Cursor;
    use blp::core::image::ImageBlp;
    
    // 解析 BLP 结构
    let mut blp = ImageBlp::from_buf(&blp_data)
        .map_err(|e| format!("BLP 解析失败: {:?}", e))?;
    
    // 解码第一层 mipmap（最高分辨率）
    blp.decode(&blp_data, &[true])
        .map_err(|e| format!("BLP 解码失败: {:?}", e))?;
    
    // 获取 RGBA 图像
    let img = blp.mipmaps[0].image
        .take()
        .ok_or_else(|| "没有可用的图像数据".to_string())?;
    
    // 转换为 PNG
    let mut png_buffer = Vec::new();
    let mut cursor = Cursor::new(&mut png_buffer);
    
    img.write_to(&mut cursor, ImageFormat::Png)
        .map_err(|e| format!("PNG 编码失败: {}", e))?;
    
    // 编码为 base64
    let base64_str = base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &png_buffer);
    Ok(format!("data:image/png;base64,{}", base64_str))
}

/// 解析 MDX/MDL 模型文件，返回几何数据的 JSON
#[tauri::command]
fn parse_mdx_file(mdx_data: Vec<u8>) -> Result<String, String> {
    let mut parser = MdxParser::new(mdx_data)?;
    let model = parser.parse()?;
    
    // 转换为 JSON
    serde_json::to_string(&model)
        .map_err(|e| format!("JSON 序列化失败: {}", e))
}

/// 从 MPQ 中读取并解析 MDX 文件
#[tauri::command]
fn parse_mdx_from_mpq(archive_path: String, file_name: String) -> Result<String, String> {
    // 从 MPQ 读取文件
    let mdx_data = read_mpq_file(archive_path, file_name)?;
    
    // 解析 MDX
    parse_mdx_file(mdx_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_mpq_archive,
            read_mpq_file,
            clear_mpq_cache,
            decode_blp_to_png,
            parse_mdx_file,
            parse_mdx_from_mpq
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
