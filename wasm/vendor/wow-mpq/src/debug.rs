//! 最小调试/格式化辅助。
//!
//! 上游 `debug.rs`（1040 行）还包含归档结构可视化、HET/BET 表格式化、
//! 进度/表格渲染等依赖完整 `archive` 模块的辅助函数。浏览器子集只保留
//! `header.rs` 实际使用的两个纯函数，其余删除（无调用方）。

/// 人类可读的文件大小（如 `1.50 KB`）。
pub fn format_size(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.2} {}", size, UNITS[unit_index])
    }
}

/// 单行十六进制串；超过 `max_len` 字节时追加总长提示。
pub fn hex_string(data: &[u8], max_len: usize) -> String {
    let len = data.len().min(max_len);
    let hex: Vec<String> = data[..len].iter().map(|b| format!("{b:02X}")).collect();
    if data.len() > max_len {
        format!("{} ... ({} bytes total)", hex.join(" "), data.len())
    } else {
        hex.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn format_size_units() {
        assert_eq!(format_size(512), "512 B");
        assert_eq!(format_size(2048), "2.00 KB");
        assert_eq!(format_size(1024 * 1024 * 3), "3.00 MB");
    }

    #[test]
    fn hex_string_truncates() {
        assert_eq!(hex_string(&[0x0A, 0xFF], 4), "0A FF");
        assert_eq!(hex_string(&[0x0A, 0xFF, 0x01], 2), "0A FF ... (3 bytes total)");
    }
}
