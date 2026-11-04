//! MPQ 表结构（hash / block）。
//!
//! 浏览器子集不含 HET/BET（WoW 4.x 专用扩展表）；WC3 的 war3.mpq 使用经典 V1 表。

mod block;
mod hash;

// Re-export public types
pub use block::{BlockEntry, BlockTable, HiBlockTable};
pub use hash::{HashEntry, HashTable};
