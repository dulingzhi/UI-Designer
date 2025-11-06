use std::fs::File;
use std::sync::Mutex;
use std::collections::HashMap;
use std::panic;

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
    
    // 使用 catch_unwind 捕获 panic
    let result = panic::catch_unwind(|| -> Result<Vec<MpqFileInfo>, String> {
        // 打开 MPQ 文件
        let file = File::open(&path)
            .map_err(|e| format!("无法打开文件: {:?}", e))?;
        
        // 打开 MPQ 档案
        let mut archive = ceres_mpq::Archive::open(file)
            .map_err(|e| format!("无法打开 MPQ 档案: {:?}", e))?;
        
        // 获取文件列表
        let mut files = Vec::new();
        
        // 尝试读取 listfile
        if let Ok(listfile_data) = archive.read_file("(listfile)") {
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
        
        Ok(files)
    });
    
    match result {
        Ok(Ok(files)) => {
            // 缓存结果
            let mut cache = MPQ_CACHE.lock().unwrap();
            if let Some(ref mut cache) = *cache {
                cache.archives.insert(path, files.clone());
            }
            Ok(files)
        }
        Ok(Err(e)) => Err(e),
        Err(_) => Err("MPQ 档案解析失败（内部错误）".to_string()),
    }
}

#[tauri::command]
fn read_mpq_file(archive_path: String, file_name: String) -> Result<Vec<u8>, String> {
    // 使用 catch_unwind 捕获 panic
    let result = panic::catch_unwind(|| -> Result<Vec<u8>, String> {
        // 打开 MPQ 文件
        let file = File::open(&archive_path)
            .map_err(|e| format!("无法打开文件: {:?}", e))?;
        
        // 打开 MPQ 档案
        let mut archive = ceres_mpq::Archive::open(file)
            .map_err(|e| format!("无法打开 MPQ 档案: {:?}", e))?;
        
        // 读取指定文件
        let file_data = archive
            .read_file(&file_name)
            .map_err(|e| format!("无法读取文件 {}: {:?}", file_name, e))?;
        
        Ok(file_data)
    });
    
    match result {
        Ok(Ok(data)) => Ok(data),
        Ok(Err(e)) => Err(e),
        Err(_) => Err(format!("读取文件 {} 失败（内部错误）", file_name)),
    }
}

#[tauri::command]
fn clear_mpq_cache() -> Result<(), String> {
    let mut cache = MPQ_CACHE.lock().unwrap();
    if let Some(ref mut cache) = *cache {
        cache.archives.clear();
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![greet, load_mpq_archive, read_mpq_file, clear_mpq_cache])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
