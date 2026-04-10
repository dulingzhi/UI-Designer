use tauri::{AppHandle, State, Manager, Emitter};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio::io::{AsyncWriteExt, BufWriter};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct HotReloadMessage {
    pub payload: String, // Expected to be base64 JSON
}

pub struct TcpServerState {
    pub tx: broadcast::Sender<String>,
    pub is_running: Mutex<bool>,
}

impl TcpServerState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            tx,
            is_running: Mutex::new(false),
        }
    }
}

#[tauri::command]
pub async fn start_hot_reload_server(
    app: AppHandle,
    state: State<'_, TcpServerState>,
) -> Result<u16, String> {
    let mut is_running = state.is_running.lock().unwrap();
    if *is_running {
        return Ok(19999); // Hardcoded standard port for MVP
    }
    
    *is_running = true;
    let tx = state.tx.clone();
    
    tauri::async_runtime::spawn(async move {
        // TCP 绑定本地环回，防止公网访问，且端口定为 19999
        let listener = match TcpListener::bind("127.0.0.1:19999").await {
            Ok(l) => {
                println!("TCP server listening on 19999");
                l
            }
            Err(e) => {
                eprintln!("Failed to start TCP server: {}", e);
                let _ = app.emit("hot-reload-status", "error");
                return;
            }
        };

        loop {
            match listener.accept().await {
                Ok((mut socket, addr)) => {
                    println!("Client connected from {}", addr);
                    let _ = app.emit("hot-reload-status", "connected");
                    let mut rx = tx.subscribe();
                    
                    tauri::async_runtime::spawn(async move {
                        let (read_half, write_half) = socket.split();
                        // For MVP, we only write to the client
                        // Using BufWriter for better line writing performance
                        let mut writer = BufWriter::new(write_half);
                        
                        loop {
                            tokio::select! {
                                msg = rx.recv() => {
                                    match msg {
                                        Ok(data) => {
                                            // The payload is already base64 + \n formatted from Frontend or we do it here.
                                            // Better to let Frontend send the exact structure, or we wrap it here.
                                            // Assume frontend sends pure JSON, and Rust converts to base64 + \n:
                                            use base64::{Engine as _, engine::general_purpose::STANDARD};
                                            let encoded = STANDARD.encode(&data);
                                            let final_payload = format!("{}\n", encoded);
                                            
                                            if let Err(e) = writer.write_all(final_payload.as_bytes()).await {
                                                eprintln!("Write failed to client {}: {}", addr, e);
                                                break;
                                            }
                                            if let Err(e) = writer.flush().await {
                                                eprintln!("Flush failed: {}", e);
                                                break;
                                            }
                                        },
                                        Err(_) => {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
                Err(e) => {
                    eprintln!("Failed to accept client: {}", e);
                }
            }
        }
    });

    Ok(19999)
}

#[tauri::command]
pub fn send_hot_reload_update(
    state: State<'_, TcpServerState>,
    data: String,
) -> Result<(), String> {
    // 收到来自于前段的最新帧数据
    match state.tx.send(data) {
        Ok(_) => Ok(()),
        Err(_) => Err("没有活跃的客户端连接".into()), // 此时暂不报错，静默失败就好
    }
}
