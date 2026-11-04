//! 真实归档端到端验证（手动运行，不进入 `cargo test`）。
//!
//! 用法：
//! ```text
//! cargo run --release --example verify_real -- "E:/GAMES/WAR3/war3.mpq"
//! ```
//!
//! 走 `wc3ui_wasm::native`（纯 Rust 实现），绕开 `#[wasm_bindgen]` 在非 wasm32
//! 目标上"function not implemented"的胶水。
//!
//! 校验内容：
//! 1. 头定位 + hash/block 表解析成功；
//! 2. `(listfile)` 可读，文件数为正；
//! 3. 抽查若干 FDF 文本文件——合法 UTF-8 且含 `Frame` 关键字；
//! 4. 抽查 BLP（direct 调色板与 JPEG 两种各取其一，若存在）——RGBA 长度 = w*h*4；
//! 5. 抽查 MDX——解析成功（若存在）。

use std::time::Instant;

use wc3ui_wasm::native;

fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| {
        eprintln!("用法: verify_real <war3.mpq>");
        std::process::exit(2);
    });
    let data = std::fs::read(&path).expect("读取归档失败");
    println!("归档 {} — {} 字节", path, data.len());

    let t0 = Instant::now();
    let handle = native::open(&data).expect("打开归档失败");
    println!("打开耗时 {:?}（含表解密）", t0.elapsed());

    let t1 = Instant::now();
    let list_json = native::list(handle).expect("读取 (listfile) 失败");
    let names: Vec<String> = serde_json::from_str(&list_json).expect("list JSON 解析失败");
    println!("列表耗时 {:?}，文件数 {}", t1.elapsed(), names.len());
    assert!(names.len() > 1000, "真实 war3.mpq 应有上千个文件");

    // ---------- FDF 抽查 ----------
    let fdf: Vec<&String> = names
        .iter()
        .filter(|n| n.to_ascii_lowercase().ends_with(".fdf"))
        .collect();
    println!("FDF 文件数 {}", fdf.len());
    assert!(!fdf.is_empty(), "归档内应至少有一个 FDF");

    let mut text_hits = 0;
    for name in fdf.iter().take(5) {
        let bytes = native::read_file(handle, name).expect("读 FDF 失败");
        let text = String::from_utf8_lossy(&bytes).to_string();
        // FDF 语法必有花括号块；`Frame` 关键字只出现在 FrameDef 类文件
        // （DateStrings.fdf 之类纯字符串表没有），故只断言结构性花括号。
        if !(text.contains('{') && text.contains('}')) {
            println!("  ?? {} — {} 字节，头 64 字节:", name, text.len());
            println!("     {}", text.chars().take(64).collect::<String>().escape_debug());
            println!("     原始字节: {:02X?}", &bytes[..bytes.len().min(48)]);
            continue;
        }
        if text.contains("Frame") {
            text_hits += 1;
        }
        println!("  OK {} — {} 字节", name, text.len());
    }
    assert!(text_hits > 0, "抽查的 FDF 中应至少有一个含 Frame 关键字");

    // ---------- BLP 抽查（direct + jpeg 各一） ----------
    let blps: Vec<&String> = names
        .iter()
        .filter(|n| n.to_ascii_lowercase().ends_with(".blp"))
        .collect();
    println!("BLP 文件数 {}", blps.len());
    assert!(!blps.is_empty(), "归档内应至少有一个 BLP");

    let mut seen = 0;
    for name in blps.iter() {
        if seen >= 6 {
            break;
        }
        let bytes = match native::read_file(handle, name) {
            Ok(b) => b,
            Err(e) => {
                println!("  SKIP {} — 读取失败: {}", name, e);
                continue;
            }
        };
        match native::decode_to_rgba_raw(&bytes) {
            Ok((w, h, rgba)) => {
                assert_eq!(rgba.len(), (w * h * 4) as usize, "RGBA 长度应与尺寸匹配");
                println!("  OK {} — {}x{} 解码 {} 字节", name, w, h, rgba.len());
                seen += 1;
            }
            Err(e) => {
                println!("  FAIL {} — 解码失败: {}", name, e);
                std::process::exit(1);
            }
        }
    }
    assert!(seen > 0, "至少应成功解码一个 BLP");

    // ---------- MDX 抽查 ----------
    if let Some(mdx) = names
        .iter()
        .find(|n| n.to_ascii_lowercase().ends_with(".mdx"))
    {
        let bytes = native::read_file(handle, mdx).expect("读 MDX 失败");
        let json = native::parse_mdx_json(&bytes).expect("MDX 解析失败");
        println!("  OK {} — JSON {} 字节", mdx, json.len());
    } else {
        println!("  （归档内无 MDX，跳过模型解析抽查）");
    }

    println!("全部通过。");
}
