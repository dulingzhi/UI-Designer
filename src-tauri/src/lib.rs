use std::sync::Mutex;
use std::collections::HashMap;

mod mdx_parser;
mod blp_handler;
pub mod tcp_server;

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
fn launch_kkwe(launcher_path: String, map_path: String) -> Result<u32, String> {
    use std::process::Command;
    
    let mut child = Command::new(&launcher_path)
        .args(&["-launchwar3", "-loadfile", &map_path])
        .spawn()
        .map_err(|e| format!("启动 KKWE 失败: {}", e))?;
    
    // 等待启动器退出，其退出码就是War3.exe的PID
    match child.wait() {
        Ok(status) => {
            if let Some(exit_code) = status.code() {
                Ok(exit_code as u32)
            } else {
                Err("启动器进程被信号终止".to_string())
            }
        }
        Err(e) => Err(format!("等待启动器退出失败: {}", e))
    }
}

/// 检查进程是否存在
#[tauri::command]
fn is_process_running(pid: u32) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // 使用 tasklist 查询特定PID
        let output = Command::new("tasklist")
            .args(&["/FI", &format!("PID eq {}", pid), "/NH", "/FO", "CSV"])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // 检查输出中是否包含PID (CSV格式会包含 "进程名","PID","...")
            return stdout.contains(&format!("\"{}", pid));
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // 非Windows平台暂不支持
    }
    
    false
}

/// 结束指定进程
#[tauri::command]
fn kill_process(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("taskkill")
            .args(&["/F", "/PID", &pid.to_string()])
            .output()
            .map_err(|e| format!("结束进程失败: {}", e))?;
        
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(format!("taskkill执行失败: {}", stderr))
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("仅支持 Windows 平台".to_string())
}

/// 使用管理员权限结束指定进程（通过PowerShell提升权限）
#[tauri::command]
fn kill_process_elevated(pid: u32) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        // 构建PowerShell命令：Start-Process -Verb RunAs -Wait -FilePath taskkill -ArgumentList "/F /PID 12345"
        let ps_command = format!(
            "Start-Process -Verb RunAs -Wait -WindowStyle Hidden -FilePath taskkill -ArgumentList '/F','/PID','{}'",
            pid
        );
        
        let output = Command::new("powershell")
            .args(&["-NoProfile", "-Command", &ps_command])
            .output()
            .map_err(|e| format!("PowerShell执行失败: {}", e))?;
        
        // PowerShell的Start-Process -Verb RunAs会弹出UAC提示
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            
            // 检查是否是用户取消了UAC
            if stderr.contains("canceled") || stderr.contains("取消") {
                Err("用户取消了权限提升".to_string())
            } else {
                Err(format!("管理员权限结束进程失败: {}", stderr))
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("仅支持 Windows 平台".to_string())
}

/// 检查War3.exe进程是否正在运行
#[tauri::command]
fn is_war3_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("tasklist")
            .args(&["/NH", "/FO", "CSV"])
            .output();
        
        if let Ok(output) = output {
            let stdout = String::from_utf8_lossy(&output.stdout);
            // 检查可能的War3进程名
            return stdout.to_lowercase().contains("war3.exe") || 
                   stdout.to_lowercase().contains("warcraft iii.exe") ||
                   stdout.to_lowercase().contains("w3l.exe");
        }
    }
    
    false
}

/// 结束所有War3.exe进程
#[tauri::command]
fn kill_war3_processes() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        
        let output = Command::new("taskkill")
            .args(&["/F", "/IM", "war3.exe"])
            .output()
            .map_err(|e| format!("结束War3进程失败: {}", e))?;
        
        if output.status.success() {
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // 如果没有找到进程，也算成功
            if stderr.contains("找不到") || stderr.contains("not found") {
                Ok(())
            } else {
                Err(format!("taskkill执行失败: {}", stderr))
            }
        }
    }
    
    #[cfg(not(target_os = "windows"))]
    Err("仅支持 Windows 平台".to_string())
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
    
    // 返回目标文件路径
    Ok(target_file.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(tcp_server::TcpServerState::new())
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
            is_process_running,
            kill_process,
            kill_process_elevated,
            is_war3_running,
            kill_war3_processes,
            extract_template_map,
            tcp_server::start_hot_reload_server,
            tcp_server::send_hot_reload_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
