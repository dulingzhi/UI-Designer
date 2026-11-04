//! # wow_mpq（浏览器 / WASM 子集）
//!
//! 本 crate 是 crates.io `wow-mpq 0.3.2` 的裁剪副本，**只保留读取 MPQ 归档所需的低层模块**：
//!
//! - [`header`]：归档头解析（`find_header` / `MpqHeader`）
//! - [`tables`]：经典 hash / block 表（含表项解密）
//! - [`crypto`]：Storm 加密表、hash 与块解密
//! - [`compression`]：zlib / PKWARE-implode / sparse / huffman / adpcm / lzma 解压
//! - [`error`] / [`debug`]：错误类型与格式化辅助
//!
//! 被删除的部分（见 `Cargo.toml` 顶部注释）：`archive`（硬绑 `std::fs::File`）、
//! `builder` / `modification` / `rebuild`（写归档）、`database`（rusqlite）、
//! `parallel` / `single_archive_parallel`（rayon）、`patch_chain`、`signature`（rsa）、
//! `compare` / `path` / `io` / `special_files`，以及 `compression::algorithms::bzip2`
//! （C 依赖 `bzip2-sys` 无法编译到 wasm）。
//!
//! 调用方（`wasm/src/mpq_read.rs`）用这些低层 API 自行编排"字节流只读归档"。

#![warn(rust_2018_idioms)]

pub mod compression;
pub mod crypto;
pub mod debug;
pub mod error;
pub mod header;
pub mod tables;

// 常用类型再导出（与上游保持同名，便于调用方少写路径）
pub use error::{Error, Result};
pub use header::{FormatVersion, MpqHeader};
pub use tables::{BlockEntry, BlockTable, HashEntry, HashTable};

pub use compression::{compress, decompress};
pub use crypto::{
    decrypt_block, decrypt_dword, encrypt_block, hash_string, hash_type, jenkins_hash,
};

/// MPQ signature constants
pub mod signatures {
    /// Standard MPQ archive signature ('MPQ\x1A')
    pub const MPQ_ARCHIVE: u32 = 0x1A51504D;

    /// MPQ user data signature ('MPQ\x1B')
    pub const MPQ_USERDATA: u32 = 0x1B51504D;

    /// HET table signature ('HET\x1A')
    pub const HET_TABLE: u32 = 0x1A544548;

    /// BET table signature ('BET\x1A')
    pub const BET_TABLE: u32 = 0x1A544542;

    /// Strong signature magic ('NGIS')
    pub const STRONG_SIGNATURE: [u8; 4] = *b"NGIS";
}

/// Block size calculation
#[inline]
pub fn calculate_sector_size(block_size_shift: u16) -> usize {
    512 << block_size_shift
}

/// Check if a value is a power of two
#[inline]
pub fn is_power_of_two(value: u32) -> bool {
    value != 0 && (value & (value - 1)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_sector_size() {
        assert_eq!(calculate_sector_size(0), 512);
        assert_eq!(calculate_sector_size(3), 4096);
        assert_eq!(calculate_sector_size(9), 262144);
    }

    #[test]
    fn test_is_power_of_two() {
        assert!(is_power_of_two(1));
        assert!(is_power_of_two(0x80000000));
        assert!(!is_power_of_two(0));
        assert!(!is_power_of_two(0xFFFFFFFF));
    }
}
