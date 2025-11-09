use std::sync::Mutex;
use std::collections::HashMap;

mod mdx_parser;
mod blp_handler;

use mdx_parser::MdxParser;
use blp_handler::{decode_blp, decode_blp_to_png_base64, decode_blp_mipmap, get_blp_info, BlpImageData};

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
    blp_handler::decode_blp_to_png_base64(&blp_data)
}

/// 解码 BLP 图像为 RGBA 数据（用于前端）
#[tauri::command]
fn decode_blp_to_rgba(blp_data: Vec<u8>) -> Result<blp_handler::BlpImageData, String> {
    blp_handler::decode_blp(&blp_data)
}

/// 获取 BLP 文件信息
#[tauri::command]
fn get_blp_file_info(blp_data: Vec<u8>) -> Result<blp_handler::BlpInfo, String> {
    blp_handler::get_blp_info(&blp_data)
}

/// 解码 BLP 指定 mipmap 层级
#[tauri::command]
fn decode_blp_mipmap_level(blp_data: Vec<u8>, level: usize) -> Result<blp_handler::BlpImageData, String> {
    blp_handler::decode_blp_mipmap(&blp_data, level)
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

/// 从本地文件系统读取并解析 MDX 文件
#[tauri::command]
fn parse_mdx_from_file(file_path: String) -> Result<String, String> {
    use std::fs;
    
    // 读取本地文件
    let mdx_data = fs::read(&file_path)
        .map_err(|e| format!("无法读取文件 {}: {}", file_path, e))?;
    
    // 解析 MDX
    parse_mdx_file(mdx_data)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            load_mpq_archive,
            read_mpq_file,
            clear_mpq_cache,
            decode_blp_to_png,
            decode_blp_to_rgba,
            get_blp_file_info,
            decode_blp_mipmap_level,
            parse_mdx_file,
            parse_mdx_from_mpq,
            parse_mdx_from_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
