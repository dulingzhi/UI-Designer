# 版本管理指南

## 版本号系统

本项目使用 **Git Tag** 作为版本号的唯一来源（Single Source of Truth）。

### 版本号格式

使用语义化版本号（Semantic Versioning）：`v<major>.<minor>.<patch>`

- **major**: 重大更新，不向后兼容
- **minor**: 新功能，向后兼容
- **patch**: Bug 修复，向后兼容

示例：`v0.1.1`, `v1.0.0`, `v2.3.5`

## 发布新版本流程

### 1. 准备工作

更新 `CHANGELOG.md`，记录本次版本的更新内容：

```markdown
## [0.1.2] - 2025-01-10

### 新增
- 添加了某某功能

### 修复
- 修复了某某问题

### 优化
- 优化了某某性能
```

### 2. 提交代码

```bash
git add .
git commit -m "准备发布 v0.1.2"
git push
```

### 3. 创建并推送 Tag

```bash
# 创建带注释的 tag（推荐）
git tag -a v0.1.2 -m "Release v0.1.2"

# 或创建轻量级 tag
git tag v0.1.2

# 推送 tag 到远程
git push origin v0.1.2
```

### 4. 自动构建

推送 tag 后，GitHub Actions 会自动：

1. **提取版本号**：从 tag `v0.1.2` 提取 `0.1.2`
2. **更新配置文件**：
   - `package.json` → `"version": "0.1.2"`
   - `src-tauri/tauri.conf.json` → `"version": "0.1.2"`
   - `src-tauri/Cargo.toml` → `version = "0.1.2"`
3. **构建应用**：生成对应版本的安装包
4. **创建 Release**：
   - Release 名称：`WC3 UI Designer v0.1.2`
   - 文件名：`wc3-ui-designer_0.1.2_x64-setup.exe`
5. **生成更新文件**：`latest.json` 供自动更新器使用

### 5. 验证发布

检查以下内容：

- [ ] GitHub Release 页面版本号正确
- [ ] 下载的安装包文件名版本号正确
- [ ] 安装后关于面板显示的版本号正确
- [ ] `latest.json` 文件存在且版本号正确
- [ ] 自动更新功能能够检测到新版本

## 版本号在项目中的使用

### 配置文件（自动更新）

GitHub Actions 会在构建时自动更新以下文件：

- `package.json` - 前端版本号
- `src-tauri/tauri.conf.json` - Tauri 应用版本号
- `src-tauri/Cargo.toml` - Rust 包版本号

**注意**：本地开发时这些文件可能不是最新版本号，这是正常的。

### 应用中显示版本号

`AboutDialog.tsx` 会自动获取正确的版本号：

- **生产环境**：通过 `@tauri-apps/api/app` 的 `getVersion()` API 获取实际版本
- **开发环境**：使用 `package.json` 的版本号作为后备

```typescript
import { getVersion } from '@tauri-apps/api/app';

useEffect(() => {
  getVersion().then(setVersion).catch(() => {
    // 开发环境使用 package.json 版本
  });
}, []);
```

## 删除/更新已发布的版本

### 删除本地 tag

```bash
git tag -d v0.1.2
```

### 删除远程 tag

```bash
git push origin :refs/tags/v0.1.2
```

### 重新发布相同版本

```bash
# 1. 删除旧 tag
git tag -d v0.1.2
git push origin :refs/tags/v0.1.2

# 2. 删除 GitHub Release（在网页上手动删除）

# 3. 创建新 tag
git tag v0.1.2
git push origin v0.1.2
```

## 常见问题

### Q: 为什么本地的 package.json 版本号和 Release 不一致？

A: 这是正常的。版本号由 Git tag 控制，GitHub Actions 会在构建时自动更新配置文件。本地文件的版本号不重要。

### Q: 如何查看当前发布的版本？

```bash
# 查看所有 tag
git tag

# 查看最新 tag
git describe --tags --abbrev=0

# 查看最新 tag 的详细信息
git show $(git describe --tags --abbrev=0)
```

### Q: 开发时如何测试新版本号？

开发环境下，AboutDialog 显示的是 `package.json` 的版本号。如果需要测试新版本号：

1. 临时修改 `package.json` 的 version 字段
2. 重启应用
3. 查看关于面板

### Q: 自动更新器如何知道最新版本？

GitHub Actions 构建时会生成 `latest.json` 文件，包含：

```json
{
  "version": "0.1.2",
  "notes": "更新说明",
  "pub_date": "2025-01-10T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "...",
      "url": "https://github.com/.../wc3-ui-designer_0.1.2_x64-setup.nsis.zip"
    }
  }
}
```

应用启动时会请求这个文件来检查更新。

## 最佳实践

1. **遵循语义化版本号**：根据更改类型正确增加版本号
2. **先更新 CHANGELOG**：每次发布前更新更新日志
3. **使用带注释的 tag**：`git tag -a v0.1.2 -m "Release v0.1.2"`
4. **不要手动修改配置文件版本号**：让 GitHub Actions 自动处理
5. **发布前测试**：确保代码在本地完全测试通过
6. **及时删除错误的 tag**：如果发现问题，立即删除并重新发布

## 参考资料

- [语义化版本号规范](https://semver.org/lang/zh-CN/)
- [Git Tag 文档](https://git-scm.com/book/zh/v2/Git-基础-打标签)
- [Tauri 更新器文档](https://tauri.app/v1/guides/distribution/updater/)
