//! WC3 UI Designer 浏览器端解析内核（WASM）。
//!
//! 目标（浏览器路径 A）：把 Rust 侧的**纯字节解析**搬进浏览器，
//! 让浏览器版恢复纹理解码与模型预览能力。
//!
//! 设计原则：
//! 1. **源码共享而非复制**——MDX 解析器用 `#[path]` 直接引用
//!    `src-tauri/src/mdx_parser.rs`，两侧永不漂移。
//! 2. **只做纯解析**——不碰 `std::fs` / 进程 / socket。
//! 3. **输出结构与桌面端 API 对齐**——前端 `wasmBridge.ts` 可与 `rustBridge.ts` 同形消费。
//!
//! 已知边界（实证，非推测）：
//! - 不能复用 `blp` crate：其 `image` 全格式依赖拉入 `turbojpeg-sys`（C 库），
//!   `dunce`/`fluent-templates` 拉入 `path-dedot`，均无法编译到 wasm32-unknown-unknown。
//!   故 BLP 解码在本 crate 内按格式规范自实现（paletted + JPEG）。
//! - 不能复用 `wow_mpq::Archive`：其 `reader: BufReader<File>` 硬绑 std::fs。
//!   本 crate 仅复用其低层公开模块，自建字节流读取器。

use wasm_bindgen::prelude::*;

// 直接复用桌面端 MDX 解析器源码（零重复、零漂移）
#[path = "../../src-tauri/src/mdx_parser.rs"]
mod mdx_parser;

mod blp_decode;
mod mpq_read;

// 原生端（cargo test / examples）直接用纯 Rust 实现，绕开 wasm-bindgen 的
// "non-wasm32 未实现" 胶水（`#[wasm_bindgen]` 导出的函数在宿主机会 panic）。
// wasm 侧走上面的 `#[wasm_bindgen]` 包装，两侧共用同一实现。
#[doc(hidden)]
pub mod native {
    pub use crate::blp_decode::decode_to_rgba_raw;
    pub use crate::mpq_read::{close, has_file, list, open, read_file};
    pub use crate::parse_mdx_json;
}

pub use blp_decode::BlpImage;

/// 解码 BLP 为 RGBA（对应桌面端命令 `decode_blp_to_rgba`）。
#[wasm_bindgen]
pub fn decode_blp_to_rgba(blp_data: &[u8]) -> Result<BlpImage, JsValue> {
    blp_decode::decode_to_rgba(blp_data).map_err(|e| JsValue::from_str(&e))
}

/// 解析 MDX 模型为 JSON 字符串（对应桌面端命令 `parse_mdx_file` 的返回）。
#[wasm_bindgen]
pub fn parse_mdx_file(mdx_data: &[u8]) -> Result<String, JsValue> {
    parse_mdx_json(mdx_data).map_err(|e| JsValue::from_str(&e))
}

/// `parse_mdx_file` 的纯 Rust 实现（原生侧可直接调用）。
#[doc(hidden)]
pub fn parse_mdx_json(mdx_data: &[u8]) -> Result<String, String> {
    let mut parser = mdx_parser::MdxParser::new(mdx_data.to_vec())?;
    let model = parser.parse()?;
    serde_json::to_string(&model).map_err(|e| format!("JSON 序列化失败: {}", e))
}

/// 打开 MPQ 归档（字节流），返回句柄 ID。前端持有 ID 复用之。
///
/// 取 `Vec<u8>`（而非 `&[u8]`）：wasm-bindgen 会把 JS 的 `Uint8Array`
/// **搬进** wasm 线性内存并交出所有权，于是可以直接把它交给 `Archive`，
/// 不再额外复制一份。前端打开成功后应主动丢弃自己的 `bytes`，
/// 否则内存里会同时存在 JS 与 wasm 各一份。
#[wasm_bindgen]
pub fn mpq_open(archive: Vec<u8>) -> Result<u32, JsValue> {
    mpq_read::open_owned(archive).map_err(|e| JsValue::from_str(&e))
}

/// 列出归档内全部文件名（JSON 数组字符串）。
#[wasm_bindgen]
pub fn mpq_list(handle: u32) -> Result<String, JsValue> {
    mpq_read::list(handle).map_err(|e| JsValue::from_str(&e))
}

/// 判断文件是否存在。
#[wasm_bindgen]
pub fn mpq_has_file(handle: u32, name: &str) -> Result<bool, JsValue> {
    mpq_read::has_file(handle, name).map_err(|e| JsValue::from_str(&e))
}

/// 读取文件内容。
#[wasm_bindgen]
pub fn mpq_read_file(handle: u32, name: &str) -> Result<Vec<u8>, JsValue> {
    mpq_read::read_file(handle, name).map_err(|e| JsValue::from_str(&e))
}

/// 关闭归档、释放其占用的内存。
#[wasm_bindgen]
pub fn mpq_close(handle: u32) -> Result<(), JsValue> {
    mpq_read::close(handle).map_err(|e| JsValue::from_str(&e))
}

/// WASM 模块版本（供前端探测加载成功）。
#[wasm_bindgen]
pub fn wasm_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
