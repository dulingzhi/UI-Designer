//! MPQ 读取器（浏览器 WASM 侧自实现）。
//!
//! 为何不直接用 `wow_mpq::Archive`：其结构体字段全部私有，且 `reader: BufReader<File>`
//! 硬绑 `std::fs::File`——`wasm32-unknown-unknown` 下无法构造。
//!
//! 本实现只复用 wow-mpq 的**低层公开 API**，编排逻辑严格对照 `archive.rs` 的
//! `find_file_classic` / `read_file` / `read_sectored_file`，保证与桌面端读同一档案结果一致：
//! - 表项解密键：`hash_string("(hash table)"/"(block table)", TABLE_OFFSET=0x000)`（由
//!   `HashTable::from_bytes` / `BlockTable::from_bytes` 内部完成）；
//! - 文件解密键：`hash_string(name, FILE_KEY=0x300)`，带 `FIX_KEY` 时
//!   `(base_key + file_pos) ^ file_size`；
//! - 扇区偏移表解密键：`key - 1`；扇区数据解密键：`key + i`；
//! - `IMPLODE` 无压缩类型前缀字节，其余走首字节前缀。
//!
//! 覆盖范围（诚实声明）：经典 hash/block 表（V1/V2/V3）+ 单单元与多扇区文件 +
//! IMPLODE/ZLIB/PKWARE 等常见压缩；**不覆盖** V4 的 HET/BET 表、patch 文件
//! （`FLAG_PATCH_FILE` 显式报错）、以及 sig/strong-sig 校验。

use std::collections::HashMap;
use std::io::Cursor;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Mutex, OnceLock};

use byteorder::{LittleEndian, ReadBytesExt};
use wow_mpq::compression;
use wow_mpq::crypto::{decrypt_block, hash_string};
use wow_mpq::header::find_header;
use wow_mpq::tables::{BlockEntry, BlockTable, HashTable};

/// 文件解密键的哈希类型（`hash_type::FILE_KEY`）。
const HASH_FILE_KEY: u32 = 0x300;

/// 压缩方法掩码位（`flags & 0x0000FF00 >> 8`）。
const COMPRESS_MASK: u32 = 0x0000_FF00;

/// 已打开的归档句柄表（WASM 单线程模型下用 Mutex 保安全）。
struct Archive {
    data: Vec<u8>,
    archive_offset: u64,
    hash_table: HashTable,
    block_table: BlockTable,
    sector_size: usize,
}

static HANDLES: OnceLock<Mutex<HashMap<u32, Archive>>> = OnceLock::new();
static NEXT_ID: AtomicU32 = AtomicU32::new(1);

fn handles() -> &'static Mutex<HashMap<u32, Archive>> {
    HANDLES.get_or_init(|| Mutex::new(HashMap::new()))
}

/// 在锁内访问句柄对应的归档。
///
/// **不可移除**：句柄在 `close` 之前必须可被反复使用（`list` → `read_file` → …）。
/// 早期实现用 `HashMap::remove` 取所有权，导致第二次调用即报"无效句柄"。
fn with_handle<T>(
    handle: u32,
    f: impl FnOnce(&Archive) -> Result<T, String>,
) -> Result<T, String> {
    let map = handles()
        .lock()
        .map_err(|e| format!("句柄锁中毒: {}", e))?;
    let archive = map
        .get(&handle)
        .ok_or_else(|| format!("无效句柄: {}", handle))?;
    f(archive)
}

/// 释放句柄（浏览器端在卸载归档时调用，避免整份归档字节常驻内存）。
pub fn close(handle: u32) -> Result<(), String> {
    let mut map = handles()
        .lock()
        .map_err(|e| format!("句柄锁中毒: {}", e))?;
    map.remove(&handle)
        .map(|_| ())
        .ok_or_else(|| format!("无效句柄: {}", handle))
}

// ---------------------------------------------------------------------------
// 公开入口
// ---------------------------------------------------------------------------

/// 打开归档，返回句柄 ID。
pub fn open(data: &[u8]) -> Result<u32, String> {
    let mut cursor = Cursor::new(data.to_vec());
    let (archive_offset, _user_data, header) =
        find_header(&mut cursor).map_err(|e| format!("MPQ 头定位失败: {:?}", e))?;

    let ht_pos = archive_offset + header.hash_table_pos as u64;
    let bt_pos = archive_offset + header.block_table_pos as u64;
    let ht_entries = header.hash_table_size as usize;
    let bt_entries = header.block_table_size as usize;
    let ht_len = ht_entries
        .checked_mul(16)
        .ok_or_else(|| "hash 表长度溢出".to_string())?;
    let bt_len = bt_entries
        .checked_mul(16)
        .ok_or_else(|| "block 表长度溢出".to_string())?;

    let ht_start = ht_pos as usize;
    let ht_end = ht_start
        .checked_add(ht_len)
        .ok_or_else(|| "hash 表越界".to_string())?;
    let bt_start = bt_pos as usize;
    let bt_end = bt_start
        .checked_add(bt_len)
        .ok_or_else(|| "block 表越界".to_string())?;

    let ht_bytes = data
        .get(ht_start..ht_end)
        .ok_or_else(|| format!("hash 表越界（{}..{} > {}）", ht_start, ht_end, data.len()))?;
    let bt_bytes = data
        .get(bt_start..bt_end)
        .ok_or_else(|| format!("block 表越界（{}..{} > {}）", bt_start, bt_end, data.len()))?;

    let hash_table = HashTable::from_bytes(ht_bytes, header.hash_table_size)
        .map_err(|e| format!("hash 表解析失败: {:?}", e))?;
    let block_table = BlockTable::from_bytes(bt_bytes, header.block_table_size)
        .map_err(|e| format!("block 表解析失败: {:?}", e))?;

    let sector_size = header.sector_size();
    if sector_size == 0 {
        return Err("sector_size 为 0，非法归档".to_string());
    }

    let id = NEXT_ID.fetch_add(1, Ordering::SeqCst);
    handles()
        .lock()
        .map_err(|e| format!("句柄锁中毒: {}", e))?
        .insert(
            id,
            Archive {
                data: data.to_vec(),
                archive_offset,
                hash_table,
                block_table,
                sector_size,
            },
        );
    Ok(id)
}

/// 列出归档内文件名（读 `(listfile)`），返回 JSON 数组字符串。
pub fn list(handle: u32) -> Result<String, String> {
    let data = read_file(handle, "(listfile)")?;
    let names: Vec<String> = String::from_utf8_lossy(&data)
        .lines()
        .map(|l| l.trim_end_matches('\r').to_string())
        .filter(|l| !l.is_empty())
        .collect();
    serde_json::to_string(&names)
        .map_err(|e| format!("列表序列化失败: {}", e))
}

/// 判断文件是否存在。
pub fn has_file(handle: u32, name: &str) -> Result<bool, String> {
    with_handle(handle, |arc| Ok(arc.find_file(name).is_some()))
}

/// 读取文件内容。
pub fn read_file(handle: u32, name: &str) -> Result<Vec<u8>, String> {
    with_handle(handle, |arc| arc.read_file_inner(name))
}

// ---------------------------------------------------------------------------
// 内部实现
// ---------------------------------------------------------------------------

impl Archive {
    /// 经典的 hash/block 表查找（对应 `find_file_classic`）。
    fn find_file(&self, name: &str) -> Option<(usize, &wow_mpq::tables::HashEntry)> {
        self.hash_table.find_file(name, 0)
    }

    fn read_slice(&self, pos: u64, len: usize) -> Result<Vec<u8>, String> {
        let start = pos as usize;
        let end = start
            .checked_add(len)
            .ok_or_else(|| format!("读取越界（{}+{}）", start, len))?;
        if end > self.data.len() {
            return Err(format!(
                "读取越界（{}..{} > {}）",
                start,
                end,
                self.data.len()
            ));
        }
        Ok(self.data[start..end].to_vec())
    }

    fn read_file_inner(&self, name: &str) -> Result<Vec<u8>, String> {
        let (_hash_index, hash_entry) = self
            .find_file(name)
            .ok_or_else(|| format!("文件不存在: {}", name))?;

        let block_entry = self
            .block_table
            .get(hash_entry.block_index as usize)
            .ok_or_else(|| format!("块索引越界: {}", hash_entry.block_index))?;

        if (block_entry.flags & BlockEntry::FLAG_DELETE_MARKER) != 0 {
            return Err(format!("文件已删除: {}", name));
        }
        if (block_entry.flags & BlockEntry::FLAG_EXISTS) == 0 {
            return Err(format!("文件不存在标记: {}", name));
        }
        if (block_entry.flags & BlockEntry::FLAG_PATCH_FILE) != 0 {
            return Err(format!("patch 文件不支持直接读取: {}", name));
        }

        let file_pos_rel = block_entry.file_pos as u64;
        let abs_pos = self.archive_offset + file_pos_rel;
        let compressed_size = block_entry.compressed_size as usize;
        let file_size = block_entry.file_size as usize;

        let encrypted = (block_entry.flags & BlockEntry::FLAG_ENCRYPTED) != 0;
        let compressed = (block_entry.flags & (BlockEntry::FLAG_IMPLODE | BlockEntry::FLAG_COMPRESS)) != 0;
        let single_unit = (block_entry.flags & BlockEntry::FLAG_SINGLE_UNIT) != 0;

        let key = if encrypted {
            // 文件解密键用**文件名（不含路径）**派生，不是完整路径。
            // 实证：war3.mpq 的 UI\FrameDef\Glue\MainMenu.fdf（5 扇区）用完整路径推出
            // 的扇区偏移表是乱码，用 basename 推出的表 [24,1064,1793,2727,3538,4335]
            // 严格单调且末项 == compressed_size。
            // 与参考实现 openwar3 一致：mdx-m3-viewer `MpqCrypto.computeFileKey` 取
            // `name.substring(name.lastIndexOf('\\') + 1)` 后再哈希。
            let base_key = hash_string(basename_of(name), HASH_FILE_KEY);
            if (block_entry.flags & BlockEntry::FLAG_FIX_KEY) != 0 {
                (base_key.wrapping_add(file_pos_rel as u32)) ^ file_size as u32
            } else {
                base_key
            }
        } else {
            0
        };

        if single_unit || !compressed {
            // 对应 archive.rs read_file 的单单元分支
            let mut data = self.read_slice(abs_pos, compressed_size)?;

            if encrypted {
                decrypt_bytes(&mut data, key);
            }

            if compressed {
                if single_unit {
                    if data.len() == file_size {
                        // COMPRESS 置位但压缩后与原大小相同 → 实为未压缩
                        Ok(data)
                    } else if method_known(block_entry.flags) {
                        if data.is_empty() {
                            return Err(format!("压缩数据为空: {}", name));
                        }
                        let actual = data[0];
                        let body = data[1..].to_vec();
                        compression::decompress(&body, actual, file_size)
                            .map_err(|e| format!("解压失败 {}: {:?}", name, e))
                    } else {
                        Err(format!("无法确定压缩方法: {}", name))
                    }
                } else {
                    Ok(data)
                }
            } else {
                if encrypted && data.len() > file_size {
                    data.truncate(file_size);
                }
                Ok(data)
            }
        } else {
            self.read_sectored(block_entry, abs_pos, file_size, compressed, key, name)
        }
    }

    /// 对应 `archive.rs read_sectored_file`（不含 CRC 校验，仅跳过）。
    fn read_sectored(
        &self,
        block_entry: &BlockEntry,
        abs_pos: u64,
        file_size: usize,
        compressed: bool,
        key: u32,
        name: &str,
    ) -> Result<Vec<u8>, String> {
        let encrypted = (block_entry.flags & BlockEntry::FLAG_ENCRYPTED) != 0;
        let implode = (block_entry.flags & BlockEntry::FLAG_IMPLODE) != 0;

        let sector_size = self.sector_size;
        let sector_count = file_size.div_ceil(sector_size);
        if sector_count == 0 {
            return Ok(Vec::new());
        }

        // 扇区偏移表：(sector_count+1) 个 u32 LE，解密键为 key - 1
        let off_len = (sector_count + 1) * 4;
        let mut offset_data = self.read_slice(abs_pos, off_len)?;
        if encrypted {
            decrypt_bytes(&mut offset_data, key.wrapping_sub(1));
        }
        let mut offsets = Vec::with_capacity(sector_count + 1);
        let mut cursor = Cursor::new(&offset_data);
        for _ in 0..=sector_count {
            offsets.push(
                cursor
                    .read_u32::<LittleEndian>()
                    .map_err(|e| format!("偏移表解析失败: {}", e))?,
            );
        }

        let mut out = Vec::with_capacity(file_size);
        for i in 0..sector_count {
            let start = offsets[i] as u64;
            let end = offsets[i + 1] as u64;

            if end < start {
                // 与上游一致的恢复策略：该扇区补零
                let remaining = file_size - out.len();
                out.extend(vec![0u8; remaining.min(sector_size)]);
                continue;
            }

            let sz = (end - start) as usize;
            let mut sector = self.read_slice(abs_pos + start, sz)?;

            if encrypted {
                decrypt_bytes(&mut sector, key.wrapping_add(i as u32));
            }

            let expected = (file_size - out.len()).min(sector_size);

            let decompressed = if compressed && sz < expected {
                if sector.is_empty() {
                    vec![0u8; expected]
                } else if implode {
                    // IMPLODE 无类型前缀字节
                    compression::decompress(&sector, 0x08, expected)
                        .unwrap_or_else(|_| vec![0u8; expected])
                } else {
                    let method = sector[0];
                    let body = sector[1..].to_vec();
                    compression::decompress(&body, method, expected)
                        .unwrap_or_else(|_| vec![0u8; expected])
                }
            } else {
                sector[..expected.min(sector.len())].to_vec()
            };

            out.extend_from_slice(&decompressed);
        }

        let _ = name;
        Ok(out)
    }
}

/// 取归档内路径的文件名部分（MPQ 解密键只用文件名）。
///
/// 同时兼容 `\` 与 `/`（listfile 里是 `\`，用户输入可能是 `/`）。
fn basename_of(name: &str) -> &str {
    match name.rfind(['\\', '/']) {
        Some(i) => &name[i + 1..],
        None => name,
    }
}

/// 按 MPQ 规则解密字节流（每 4 字节一组，键链推进），与表项解密同一算法。
fn decrypt_bytes(data: &mut [u8], key: u32) {
    let n = data.len() / 4;
    if n == 0 {
        return;
    }
    let mut words = Vec::with_capacity(n);
    for i in 0..n {
        let mut b = [0u8; 4];
        b.copy_from_slice(&data[i * 4..i * 4 + 4]);
        words.push(u32::from_le_bytes(b));
    }
    decrypt_block(&mut words, key);
    for i in 0..n {
        data[i * 4..i * 4 + 4].copy_from_slice(&words[i].to_le_bytes());
    }
}

/// 判断 block flags 中的压缩方法是否已知（对应 `get_compression_method`）。
fn method_known(flags: u32) -> bool {
    matches!(
        (flags & COMPRESS_MASK) >> 8,
        0x01 | 0x02 | 0x08 | 0x10 | 0x20 | 0x40 | 0x80
    )
}

// ---------------------------------------------------------------------------
// 测试（原生 cargo test）
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_input() {
        let err = open(&[]).unwrap_err();
        assert!(err.contains("MPQ 头定位失败"), "实际: {}", err);
    }

    #[test]
    fn rejects_garbage() {
        let err = open(&[0u8; 64]).unwrap_err();
        assert!(err.contains("MPQ 头定位失败"), "实际: {}", err);
    }

    #[test]
    fn rejects_unknown_handle() {
        let err = list(9999).unwrap_err();
        assert!(err.contains("无效句柄"), "实际: {}", err);
    }

    #[test]
    fn decrypt_then_encrypt_restores() {
        // 注意：MPQ 的 decrypt_block **不是**自逆运算——其密钥流的 seed 由明文推进，
        // 故 decrypt 两次得到的是"用密文推进 seed"的另一串结果。正确还原须 decrypt→encrypt。
        let mut data: Vec<u8> = (0..32u32).map(|i| (i * 7) as u8).collect();
        let orig = data.clone();
        decrypt_bytes(&mut data, 0x1234_5678);
        assert_ne!(data, orig, "密钥非零时数据应变化");

        let mut words: Vec<u32> = data
            .chunks_exact(4)
            .map(|c| u32::from_le_bytes([c[0], c[1], c[2], c[3]]))
            .collect();
        wow_mpq::crypto::encrypt_block(&mut words, 0x1234_5678);
        let restored: Vec<u8> = words.iter().flat_map(|w| w.to_le_bytes()).collect();
        assert_eq!(restored, orig, "decrypt→encrypt 应还原");
    }

    #[test]
    fn decrypt_bytes_handles_nonmultiple_of_four() {
        // 尾部不足 4 字节的余量应保持不变
        let mut data: Vec<u8> = vec![1, 2, 3, 4, 5, 6, 7];
        let tail = data[4..].to_vec();
        decrypt_bytes(&mut data, 0xDEAD_BEEF);
        assert_eq!(&data[4..], &tail);
    }

    #[test]
    fn basename_extracts_file_name() {
        assert_eq!(basename_of("UI\\FrameDef\\Glue\\MainMenu.fdf"), "MainMenu.fdf");
        assert_eq!(basename_of("UI/FrameDef/MainMenu.fdf"), "MainMenu.fdf");
        assert_eq!(basename_of("(listfile)"), "(listfile)");
        assert_eq!(basename_of("a\\b"), "b");
    }

    #[test]
    fn method_known_matches_mask() {
        assert!(method_known(0x0000_0200)); // ZLIB
        assert!(method_known(0x0000_0100)); // IMPLODE
        assert!(method_known(0x0000_0800)); // PKWARE
        assert!(!method_known(0x0000_0000));
        assert!(!method_known(0x0000_0400));
        assert!(!method_known(0x0000_0003));
    }
}
