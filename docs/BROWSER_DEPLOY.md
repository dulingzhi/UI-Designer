# 浏览器版部署与能力说明（路径 B）

> 本文档对应 `docs/BROWSER_FEASIBILITY.md` 中**路径 B**（纯 FDF 编辑器）的实施结果。
> 实施提交：`a93814f`。

---

## 1. 能做什么

纯浏览器（无 Tauri）下，以下功能**完整可用**：

| 功能 | 说明 |
|---|---|
| FDF 导入 | `<input type=file>` 选 `.fdf` / `.toc`，走内核 layout（`useKernelLayout: true`） |
| FDF 导出 | `prompt` 确认文件名 → Blob 下载；含九宫格边框、文本对齐、纹理等全部已对账字段 |
| JSON 项目导出 | 同上，`application/json` |
| PNG 导出 | `canvas.toBlob` → Blob 下载 |
| 项目保存 / 加载 | `.w3ui` 保存为下载、加载走文件选择 |
| 代码导出（JASS/Lua/TS） | 按扩展名下载 |
| 全部可视化编辑 | 画布拖拽 / 缩放 / 锚点 / 对齐 / z 序 / 撤销重做 / 批量编辑 / 样式预设 / 组合 |
| **MPQ 纹理库**（r255 起） | **选择 War3 安装目录** → 自动挑出 4 个标准 MPQ → 读入内存 → **WASM 内核解析**；纹理/FDF/模型全部可用 |

## 2. 不能做什么（如实声明，非"待实现"）

浏览器平台能力缺失，**不是工程量问题**：

| 功能 | 原因 |
|---|---|
| 热重载（保存即游戏内生效） | 需监听 TCP 端口 + 写入 War3 安装目录，浏览器两者皆不可用 |
| 启动 War3 / 进程管理 | 浏览器无进程 API |
| 更新检查 | 需 native updater + 进程重启 |
| 系统用户名（热重载默认路径） | 隐私限制，浏览器不暴露系统用户名 |

> **MPQ 已不在此列**（r255）：浏览器不允许**自动遍历**任意路径，但**允许用户主动选择一个目录**
> 并把其中文件交给页面——这是标准能力，不需要特殊权限。
>
> 实现走两条路径：
> 1. 首选 File System Access API 的 `showDirectoryPicker()`（Chrome/Edge，原生目录对话框）；
> 2. 不可用时回落到 `<input webkitdirectory>`（Chrome/Edge/Firefox/Safari 均支持）。
>
> 选中目录后自动挑出 `War3.mpq` / `War3x.mpq` / `War3xLocal.mpq` / `War3Patch.mpq`
> （大小写不敏感）；若目录里没有标准名则回落载入全部 `.mpq`，避免"选了没反应"。
> 实测真实安装目录（126 项）：精确挑出 4 个，忽略 `patch.mpq` / `zhCN.mpq` 等非标准档案。
>
> 解析由 WASM 内核完成，与桌面 `wow_mpq` 逐字节等价（war3.mpq 全量 10609 文件 0 不一致）。
> 操作方式与桌面一致：**选一次目录即可**。

UI 顶部会显示**浏览器模式提示条**（`.browser-mode-banner`）明确声明上述限制，避免用户"点了没反应"的困惑。

## 3. 双通道判定逻辑

`src/utils/platformBridge.ts`：

```
isTauri()          = window.__TAURI_INTERNALS__ 存在
isBrowserRuntime() = 有 document && 无 Tauri 注入 && UA 不含 "jsdom"
```

**为何排除 jsdom**：单元测试 mock 的是 Tauri API（`plugin-fs` / `plugin-dialog`），
若测试环境被判定为"浏览器"，所有既有 Tauri mock 测试都会失效
（实施过程中曾因此一次性失败 21 个测试）。这是刻意设计，并已用测试锁定。

调用分派：`isBrowserRuntime()` 为真 → 浏览器分支；否则 → 原 Tauri 分支（**逐字节等价**，桌面行为零变化）。

## 4. 部署

```bash
npm run build          # 产物在 dist/
npx vite preview       # 本地预览（注意：可能只绑定 IPv6，用 http://localhost:4173）
```

静态托管 `dist/` 到任意静态服务器即可（无需 Node 运行时、无需后端）。

**已验证**（本轮实测）：`vite preview` 下 `index.html` 200 / 主 chunk 1.3MB 200 /
three 566KB 200 / CSS 74KB 200，全部正常服务。

## 5. 已知取舍

- **浏览器分支的文件"路径"语义降级为文件名**：File 对象无真实路径，
  `saveProject` 等返回的是用户确认的文件名而非绝对路径。再次保存不会原地覆盖，
  而是重新下载（浏览器安全模型限制，无法绕过）。
- **需要 `npm.prompt`**：用 `window.prompt` 让用户确认文件名（无 `<dialog>` 自定义 UI）。
  `prompt` 不存在时回落默认文件名，不阻塞流程。
- **Chrome/Edge 专属能力未启用**：`hasFileSystemAccess()` 已探测 File System Access API，
  但当前分支统一走 Blob 下载，保证 Firefox/Safari 同样可用（未做浏览器差异化分支）。

## 6. 测试覆盖

| 文件 | 测数 | 覆盖点 |
|---|---|---|
| `platformBridge.test.ts` | 9 | Tauri/jsdom/真实浏览器三分支判定 |
| `platformBridge.edge.test.ts` | 9 | 边界：单 picker、fetch 失败、无 document |
| `platformBridge.node.test.ts` | 10 | node 语义（无 window/document） |
| `platformBridge.tauri.test.ts` | 4 | Tauri 分支走 plugin-fs |
| `fileOperations.browser.test.ts` | 12 | 5 个操作的浏览器分支 |
| `exportUtils.browser.test.ts` | 13 | FDF/JSON/PNG 浏览器下载分支 |
| `browserPath.parity.test.ts` | 3 | **端到端：导出产物 → 再解析，往返闭合** |

`src/utils` 覆盖率维持 **100 / 100 / 100 / 100**。
