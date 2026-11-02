use tauri::{AppHandle, State, Manager, Emitter};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tokio::io::{AsyncWriteExt, BufWriter};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct HotReloadMessage {
    pub payload: String, // Expected to be base64 JSON
}

pub struct TcpServerState {
    pub tx: broadcast::Sender<String>,
    /// Arc 包装：bind 失败路径需在 spawn 的异步任务内复位，
    /// State<'_> 借用无法 move 进 'static 闭包，故用 Arc 共享所有权。
    pub is_running: Arc<Mutex<bool>>,
}

impl TcpServerState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        Self {
            tx,
            is_running: Arc::new(Mutex::new(false)),
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
    let running_flag = state.is_running.clone();

    tauri::async_runtime::spawn(async move {
        // TCP 绑定本地环回，防止公网访问，且端口定为 19999
        let listener = match TcpListener::bind("127.0.0.1:19999").await {
            Ok(l) => {
                println!("TCP server listening on 19999");
                l
            }
            Err(e) => {
                eprintln!("Failed to start TCP server: {}", e);
                // 复位运行标志：否则端口占用后 is_running 永久卡 true，
                // 后续 start 调用返回假成功 Ok(19999)，热重载静默失效。
                *running_flag.lock().unwrap() = false;
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
        // 无订阅者（客户端未连接）时返回 Err——前端 useHotReloadSync 对此静默 catch
        //（"可能断开了"），属预期路径而非异常。
        Err(_) => Err("没有活跃的客户端连接".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// TcpServerState::new 的初始契约：is_running=false（未启动）、
    /// broadcast 通道容量 100。
    #[test]
    fn new_state_starts_not_running() {
        let state = TcpServerState::new();
        assert!(!*state.is_running.lock().unwrap());
    }

    /// broadcast 语义锁定 send_hot_reload_update 的底层保证：
    /// 无订阅者时 send 返回 Err(0)，命令层据此返回 "没有活跃的客户端连接"。
    #[test]
    fn send_without_subscribers_is_expected_error_path() {
        let state = TcpServerState::new();
        let err = state.tx.send("payload".to_string());
        assert!(err.is_err(), "无订阅者时 send 必须失败（命令层映射为 Err）");
    }

    /// 有订阅者时消息可达（客户端已连接的正常路径）。
    #[tokio::test]
    async fn send_reaches_subscriber() {
        let state = TcpServerState::new();
        let mut rx = state.tx.subscribe();
        state.tx.send("hello".to_string()).expect("有订阅者应成功");
        assert_eq!(rx.recv().await.expect("通道开放"), "hello");
    }

    /// HotReloadMessage 序列化契约（TCP wire 格式依赖 Serialize）。
    #[test]
    fn hot_reload_message_serializes_with_payload_field() {
        let msg = HotReloadMessage { payload: "abc".into() };
        let json = serde_json::to_string(&msg).expect("序列化");
        assert!(json.contains("\"payload\":\"abc\""));
    }
}
