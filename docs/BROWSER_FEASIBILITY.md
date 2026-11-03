# 浏览器环境运行可行性评估

> 评估日期：2026-11（会话内侦察数据，非推测）
>
> 结论摘要：**纯编辑器功能可跑，War3 资源/热重载/进程管理三类功能不可用**。
> 可行性取决于"浏览器版要做什么"——若目标是「FDF 设计器（可导入导出 FDF、可视化编辑）」，
> 技术上可行且工作量中等；若目标是「完整还原桌面版」，**不可行**（平台能力缺口非工程量问题）。

---

## 1. 现状实证：Tauri 依赖面

22 个生产文件 import `@tauri-apps/*`（44 个含测试）。按模块：

| 模块 | 文件数 | 典型 API | 浏览器替代 |
|---|---|---|---|
| `plugin-fs` | 12 | readFile/writeTextFile/readTextFile/readDir/exists/mkdir | **File System Access API**（部分） |
| `plugin-dialog` | 5 | open/save | `<input type="file">` + 下载（可替代） |
| `api/core` (invoke) | 9 | 14 个命令 | **无替代**（需 WASM 或重写） |
| `api/path` | 4 | join/dirname | 纯字符串运算（易替代） |
| `api/core` (convertFileSrc) | 1 | 资源 URL 转换 | blob URL（可替代） |

## 2. invoke 命令清单与浏览器可行性

| 命令 | 用途 | 浏览器可行性 |
|---|---|---|
| `decode_blp_to_png` / `decode_blp_to_rgba` / `decode_blp_mipmap_level` | BLP 纹理解码 | ✅ **可 WASM 化**（blp crate 成熟，`wasm-bindgen` 直出） |
| `read_mpq_file` / `load_mpq_archive` / `has_mpq_file` | MPQ 档案读取 | ✅ **可 WASM 化**（wow-mpq 是纯 Rust 解析，无 OS 依赖）；但需用户用 File API 选 .mpq 文件 |
| `parse_mdx_file` / `parse_mdx_from_mpq` / `parse_mdx_from_file` | MDX 模型解析 | ✅ **可 WASM 化**（纯字节解析） |
| `extract_template_map` | 内嵌模板提取 | ✅ 可 WASM 化 |
| `get_username` | 系统用户名 | ❌ **不可用**（隐私限制）；需改为"用户手填路径"或放弃该默认值 |
| `start_hot_reload_server` | TCP 服务器 | ❌ **不可用**（浏览器无监听 socket；WebSocket 只能连不能听） |
| `is_process_running` / `launch_kkwe` | 进程管理 | ❌ **不可用**（无进程 API） |

**关键结论**：14 个命令中 **9 个可 WASM 化**（纯字节/文件解析），**3 个平台能力缺失**（进程/监听端口/用户名），2 个是路径工具。

## 3. 三条可行路径

### 路径 A：WASM 化只读功能（推荐，工作量中等）
- 用 `wasm-pack` 把 `blp_handler.rs` / `mpq_io.rs` / `mdx_parser.rs` 编为 WASM
- MPQ 文件通过 `<input type="file">` 读入 ArrayBuffer（已改 raw body，接口已就绪）
- 保留 Tauri 探测（`window.__TAURI_INTERNALS__`），双后端切换
- 工作量估计：WASM 打包 1-2 天 + 适配层 2-3 天 + 测试 1-2 天
- **产出**：浏览器版可加载 MPQ、浏览纹理、预览 MDX 模型、编辑并导出 FDF

### 路径 B：纯编辑器模式（最省，工作量小）
- 不接 MPQ，仅支持 FDF 导入导出 + 可视化编辑
- 跳过所有 invoke（用特性开关禁用相关 UI）
- 工作量估计：探测层 + 条件渲染 1-2 天
- **产出**：在线 FDF 设计器（可分享链接、无需安装）

### 路径 C：完整功能（不可行）
- 需浏览器提供 TCP 监听（热重载）、进程控制（启动 War3）、系统用户名
- **这不是工程量问题，是平台能力边界**——如实记录，不做硬凑

## 4. 已具备的有利条件（实证）

1. **C1 改造已完成**：`blpData` 已从 JSON 数组改为 raw binary，WASM 边界同样是 ArrayBuffer，接口天然兼容
2. **核心算法在 TS 侧**：FDF 解析/变换/布局/渲染全在 `src/utils` + `src/renderer`，不依赖 Rust
3. **Rust 侧仅 933 行**（lib 394 + mpq 230 + blp 106 + mdx 437，含 tcp_server 166 平台相关）——WASM 化面很小
4. **Vite 已就绪**：`vite.config.ts` 已有代码分割，加 WASM 产物只需 `assetsInclude`

## 5. 具体阻塞点（需产品决策）

1. **`get_username` 缺失** → 热重载默认路径无法生成；浏览器版需改为"用户手选输出目录"（File System Access API）或直接禁用热重载
2. **热重载不可用** → 浏览器版无法"保存即游戏内生效"；替代方案：导出 .lua 文件由用户手动放入（体验降级）
3. **MPQ 需用户选文件** → 无法自动扫描 War3 安装目录（浏览器无目录遍历权限，除非用 `showDirectoryPicker`）
4. **CSP/沙箱** → WASM 需 `wasm-unsafe-eval`（若加 CSP）

## 6. 建议

**若目标是"让更多人能在浏览器里设计 WC3 UI"** → 走**路径 A**（WASM 化资源解析），这是差异化价值所在。
**若目标是"提供轻量在线试用"** → 走**路径 B**（纯 FDF 编辑器），1-2 天可出可用版本。
**完整还原桌面版不可行**，且不建议为不可行目标投入。

下一步若批准，建议先做**路径 B**（快速验证浏览器版产品形态），再迭代 WASM 化（路径 A）。
