//! Compression and decompression algorithms for MPQ files

mod algorithms;
mod compress;
mod decompress;
mod methods;

// Re-export the main public API
pub use compress::compress;
pub use decompress::decompress;
pub use methods::{CompressionMethod, flags};

/// 浏览器（WASM）子集删除了 bzip2 实现（C 依赖 `bzip2-sys` 无法交叉编译），
/// 对该方法统一返回此错误。WC3 的 war3.mpq 扇区不使用 bzip2。
pub(crate) const BZIP2_UNSUPPORTED: &str =
    "BZip2 is not supported in the browser (WASM) build of wow-mpq";

/// Error conversion helpers for compression algorithms
pub(crate) mod error_helpers {
    use crate::Error;

    /// Convert a compression-related error to an MPQ Error with algorithm context
    pub(crate) fn compression_error(algorithm: &str, err: impl std::fmt::Display) -> Error {
        Error::compression(format!("{algorithm} compression failed: {err}"))
    }

    /// Convert a decompression-related error to an MPQ Error with algorithm context  
    pub(crate) fn decompression_error(algorithm: &str, err: impl std::fmt::Display) -> Error {
        Error::compression(format!("{algorithm} decompression failed: {err}"))
    }
}
