use std::sync::Mutex;
use std::collections::HashMap;

mod mdx_parser;
mod blp_handler;

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

/// 获取当前用户名 (用于 KKWE 路径检测)
#[tauri::command]
fn get_username() -> Result<String, String> {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .map_err(|e| format!("无法获取用户名: {}", e))
}

/// 使用 KKWE 启动器启动 War3 地图
#[tauri::command]
fn launch_kkwe(launcher_path: String, map_path: String) -> Result<(), String> {
    use std::process::Command;
    
    let output = Command::new(&launcher_path)
        .args(&["-launchwar3", "-loadfile", &map_path])
        .spawn()
        .map_err(|e| format!("启动 KKWE 失败: {}", e))?;
    
    println!("[KKWE] 进程已启动: PID={}", output.id());
    Ok(())
}

/// 复制内置模板地图到War3目录
#[tauri::command]
fn extract_template_map(_app_handle: tauri::AppHandle, war3_path: String, map_name: String) -> Result<String, String> {
    use std::fs;
    use std::path::Path;
    
    // 检查是否是支持的模板地图
    if map_name != "test.1.27.w3x" {
        return Err(format!("不支持的模板地图: {}", map_name));
    }
    
    // 嵌入的模板地图数据 (编译时包含)
    const TEMPLATE_MAP_DATA: &[u8] = include_bytes!("../../public/maps/test.1.27.w3x");
    
    println!("[模板地图] 使用嵌入的地图数据，大小: {} 字节", TEMPLATE_MAP_DATA.len());
    
    // 目标路径: War3目录/Maps/Test/
    let target_dir = Path::new(&war3_path).join("Maps").join("Test");
    
    // 创建目标目录
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("创建目标目录失败: {}", e))?;
    
    // 目标文件路径
    let target_file = target_dir.join("test.w3x");
    
    // 写入文件
    fs::write(&target_file, TEMPLATE_MAP_DATA)
        .map_err(|e| format!("写入地图文件失败: {}", e))?;
    
    println!("[模板地图] 已释放到: {:?}", target_file);
    
    // 返回目标文件路径
    Ok(target_file.to_string_lossy().to_string())
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
            parse_mdx_from_file,
            get_username,
            launch_kkwe,
            extract_template_map
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
