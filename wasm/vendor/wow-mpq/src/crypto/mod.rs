//! MPQ 加解密与哈希（浏览器子集）。
//!
//! 保留的模块：
//! - `decryption` / `encryption`：Storm 块加解密（`ENCRYPTION_TABLE` 查表）
//! - `hash`：经典 MPQ 哈希（表项定位 + 文件解密键派生）
//! - `jenkins`：Jenkins one-at-a-time / hashlittle2
//! - `keys`：加密表常量
//! - `types`：`hash_type` 常量
//!
//! 已删除：`signature`（弱/强 RSA 签名，依赖 `rsa`/`sha1`/`md-5`，无法编译到 wasm；
//! 浏览器端只读归档，不做签名校验）。

mod decryption;
mod encryption;
mod hash;
mod jenkins;
mod keys;
mod types;

// Re-export public API
pub use decryption::{decrypt_block, decrypt_dword};
pub use encryption::encrypt_block;
pub use hash::hash_string;
pub use jenkins::{jenkins_hashlittle2 as het_hash, jenkins_one_at_a_time as jenkins_hash};
pub use types::hash_type;

// Re-export constants that might be needed elsewhere
pub use keys::ENCRYPTION_TABLE;
