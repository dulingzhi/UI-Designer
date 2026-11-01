//! MPQ 档案的 Rust 侧 IO 封装。
//!
//! 对标 openwar3 的 `vfs/mpq.ts`（`MpqDataSource`），但保留 Rust `wow_mpq`
//! 作为唯一解析后端，并在本模块做两件纯本地优化：
//!
//! 1. **开档句柄缓存**：`wow_mpq::Archive` 打开时需读取并解析 header/hash/block
//!    表，代价较高。旧实现每次 `read_mpq_file` 都重新 `Archive::open`。此处把
//!    打开的 `Archive` 放进 `HashMap<路径, Archive>`（`Archive: Send`，字段全为
//!    自有所有权类型），`read_file` / `has_file` 复用同一句柄，避免重复解析。
//! 2. **`has_file` 快速存在性查询**：用 `Archive::find_file`（`&self`，不加载整个
//!    listfile）判断文件是否存在，供前端 `DataSource::exists` 使用；比拉取全量
//!    listfile 再匹配便宜。
//!
//! 该模块**不依赖 Tauri**，因此可用 `#[cfg(test)]` 做自包含单元测试
//! （借助 `ArchiveBuilder` 在临时目录生成 MPQ 再读回）。

use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::OnceLock;

use serde::Serialize;

/// 单个 MPQ 档案信息的对外载体（与 listfile 一一对应）。
#[derive(Serialize, Clone, Debug)]
pub struct MpqFileInfo {
    pub name: String,
    pub size: u64,
}

/// 已打开的 `wow_mpq::Archive` 句柄缓存。
///
/// `wow_mpq::Archive` 的所有字段都是 `PathBuf`/`BufReader<File>`/自有表类型，
/// 因此自动实现 `Send`，可安全放入 `Mutex` 供命令共享。
pub struct ArchivePool {
    handles: HashMap<String, wow_mpq::Archive>,
}

impl ArchivePool {
    pub fn new() -> Self {
        ArchivePool {
            handles: HashMap::new(),
        }
    }

    /// 获取（或打开并缓存）指定路径的 Archive 可变引用。
    fn with_archive_mut<T>(
        &mut self,
        path: &str,
        f: impl FnOnce(&mut wow_mpq::Archive) -> Result<T, String>,
    ) -> Result<T, String> {
        if !self.handles.contains_key(path) {
            let archive = wow_mpq::Archive::open(path)
                .map_err(|e| format!("无法打开 MPQ 档案 {}: {:?}", path, e))?;
            self.handles.insert(path.to_string(), archive);
        }
        let archive = self
            .handles
            .get_mut(path)
            .expect("just inserted/open archive must be present");
        f(archive)
    }

    /// 读取 (listfile) 并缓存文件列表。保留旧命令 `load_mpq_archive` 的契约。
    pub fn list_files(&mut self, path: &str) -> Result<Vec<MpqFileInfo>, String> {
        let mut files = Vec::new();
        self.with_archive_mut(path, |archive| {
            match archive.read_file("(listfile)") {
                Ok(data) => {
                    let text = String::from_utf8_lossy(&data);
                    for line in text.lines() {
                        let filename = line.trim();
                        if !filename.is_empty() {
                            files.push(MpqFileInfo {
                                name: filename.to_string(),
                                size: 0,
                            });
                        }
                    }
                }
                Err(_) => {
                    // listfile 缺失：返回空列表而不是失败（前端可降级）。
                }
            }
            Ok(())
        })?;
        Ok(files)
    }

    /// 读取指定文件的内容。
    pub fn read_file(&mut self, path: &str, file_name: &str) -> Result<Vec<u8>, String> {
        self.with_archive_mut(path, |archive| {
            archive
                .read_file(file_name)
                .map_err(|e| format!("无法读取文件 {}: {:?}", file_name, e))
        })
    }

    /// 判断文件是否存在（快速路径，不加载全量 listfile）。
    pub fn has_file(&mut self, path: &str, file_name: &str) -> Result<bool, String> {
        self.with_archive_mut(path, |archive| {
            match archive.find_file(file_name) {
                Ok(Some(_)) => Ok(true),
                Ok(None) => Ok(false),
                Err(e) => Err(format!("查询文件 {} 失败: {:?}", file_name, e)),
            }
        })
    }

    /// 清空句柄缓存（释放文件句柄）。
    pub fn clear(&mut self) {
        self.handles.clear();
    }
}

/// 全局句柄池（惰性）。
static POOL: OnceLock<Mutex<ArchivePool>> = OnceLock::new();

pub fn pool() -> &'static Mutex<ArchivePool> {
    POOL.get_or_init(|| Mutex::new(ArchivePool::new()))
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------
#[cfg(test)]
mod tests {
    use super::*;

    /// 用 `ArchiveBuilder` 在临时目录生成一个含自定义文件的 MPQ，返回其路径。
    /// `tag` 用于让每个测试/每次调用都使用**互不冲突**的文件名（并行测试下若共用
    /// 同一路径会因竞争写同一个文件而报 PermissionDenied）。
    fn make_test_archive(tag: &str) -> std::path::PathBuf {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let dir = std::env::temp_dir();
        let path = dir.join(format!(
            "wc3_designer_mpq_io_{tag}_{}_{n}.mpq",
            std::process::id()
        ));
        let _ = std::fs::remove_file(&path);

        let builder = wow_mpq::ArchiveBuilder::new();
        let tmp_file = dir.join(format!(
            "wc3_builder_src_{tag}_{}_{n}.bin",
            std::process::id()
        ));
        std::fs::write(&tmp_file, b"hello mpq").expect("write temp src");
        builder
            .add_file(&tmp_file, "ui\\hello.txt")
            .build(&path)
            .expect("build archive");
        let _ = std::fs::remove_file(&tmp_file);
        path
    }

    #[test]
    fn list_files_reads_listfile() {
        let path = make_test_archive("list");
        let mut pool = ArchivePool::new();
        let files = pool.list_files(&path.to_string_lossy()).expect("list");
        // 至少包含 (listfile) 与 ui\hello.txt 之一。
        let names: Vec<&str> = files.iter().map(|f| f.name.as_str()).collect();
        assert!(
            names.contains(&"ui\\hello.txt") || names.contains(&"(listfile)"),
            "listfile should list ui\\\\hello.txt, got {names:?}"
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn read_file_returns_content() {
        let path = make_test_archive("read");
        let mut pool = ArchivePool::new();
        let data = pool
            .read_file(&path.to_string_lossy(), "ui\\hello.txt")
            .expect("read");
        assert_eq!(&data, b"hello mpq");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn has_file_fast_path() {
        let path = make_test_archive("has");
        let mut pool = ArchivePool::new();
        assert_eq!(
            pool.has_file(&path.to_string_lossy(), "ui\\hello.txt")
                .expect("has"),
            true
        );
        assert_eq!(
            pool.has_file(&path.to_string_lossy(), "does_not_exist.txt")
                .expect("has"),
            false
        );
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn archive_handle_reused_across_calls() {
        let path = make_test_archive("reuse");
        let p = path.to_string_lossy().to_string();
        let mut pool = ArchivePool::new();
        // 连续调用应复用同一句柄（第二次命中缓存），内容仍可正确读取。
        let a = pool.read_file(&p, "ui\\hello.txt").expect("first read");
        let b = pool.read_file(&p, "ui\\hello.txt").expect("second read");
        assert_eq!(a, b);
        assert_eq!(&a, b"hello mpq");
        assert_eq!(pool.handles.len(), 1, "one archive cached");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn clear_releases_handles() {
        let path = make_test_archive("clear");
        let p = path.to_string_lossy().to_string();
        let mut pool = ArchivePool::new();
        let _ = pool.read_file(&p, "ui\\hello.txt").expect("read");
        assert!(!pool.handles.is_empty());
        pool.clear();
        assert!(pool.handles.is_empty());
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn error_on_missing_archive() {
        let mut pool = ArchivePool::new();
        let r = pool.read_file("Z:\\definitely\\missing.mpq", "ui\\x.txt");
        assert!(r.is_err(), "missing archive must error");
    }
}