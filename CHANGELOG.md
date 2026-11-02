# 更新日志

## [Unreleased]

> 2025-11 后系统性审计轮次（约 200 轮自主迭代）摘要，逐轮细节见 git log 与 AGENTS.md。全历史 513 提交（fix 88 / feat 26 / cleanup 9 / test 48 / docs 103）。

### 修复（选列，共 88 项 fix）
- 进程/竞态族：mpqManager 并发代际守卫、hotReloadExporter 防抖丢失、ProjectContext dirname 竞态、tcp_server bind 失败卡死
- 数据完整性族：悬空 parentId 归一化（8 处幽灵帧链）、BatchRemove undo 拓扑序、存档环打破（migrate 重建）
- 导出链族：JASS/LUA/TS 三语言 API 错名（FrameSetStepValue）、texCoord 参数顺序、文本引号转义（导出/导入双端）、BACKDROP 九宫格字段如实导出
- 交互族：hitTest 排序键改世界 z（重叠帧选错）、缩放三入口锚定统一、Shift+方向键微调、Ctrl+F/Ctrl+X 宣称补齐
- Rust 族：mdx DoS（截断文件内存爆炸）、BLP 下溢 panic、tcp_server is_running 假成功

### 功能（选列，26 项 feat）
- 代码导出：6 隐藏开关 + originMode 接入、三语言产物合法性守卫、拓扑排序（父先子后）
- FDF 往返：backdrop 13 字段导出+导入真写回、Control/Highlight/Font 系 13 字段闭环、fullRoundtrip 守卫
- 编辑器：多选组合命令、锚定缩放体系（3 入口）、Ctrl+F 聚焦搜索、数组编辑器
- 测试体系：2126 单测 + coverage 100×4 + 42 屏真实数据往返 + 5760 组像素守卫

### 清理（9 项，约 2700 行）
- snapUtils / fdfParser.old / fdfIncludeResolver / backdropEdgeRenderer / BackdropEdge+useTextureLoader 链 / LazyImage / HistoryPanel / TemplatePanel

### 已知诚实边界（不进入验收门）
- t3 高频 checker PSNR≈27dB（canvas2D vs WebGL 内核差异，实证排除补救假设）
- 顶层帧 box 语义 3 帧差异（编辑器设计器行为，快照锁定）——详见 AGENTS.md


## [0.1.2] - 2025-01-10

### 修复
- 修复 GitHub Actions 构建配置，确保正确生成 latest.json 更新文件
- 修复 Tauri 签名环境变量名称（Tauri v2 使用新的变量名）

### 改进
- 使用 Git Tag 作为版本号的唯一来源
- GitHub Actions 自动从 tag 提取版本号并更新所有配置文件
- AboutDialog 在生产环境使用 Tauri API 动态获取版本号

### 文档
- 添加详细的版本管理指南（docs/VERSION_MANAGEMENT.md）

## [0.1.1] - 2025-01-10

### 修复
- 修复拖拽过程中周期性卡顿的问题，优化为 60fps 流畅拖拽
- 修复 Model/Sprite 控件大小变化后 WebGL 显示区域未同步更新的问题
- 修复启动时 MPQ 档案重复加载的问题
- 修复版本号显示不一致的问题
- 修复自动更新器无法获取 latest.json 的问题

### 优化
- 移除 requestAnimationFrame 带来的额外开销
- 优化拖拽节流时间为 16ms（60fps）
- 优化 Model 控件投影矩阵更新逻辑
- 添加 isLoading 标志防止 MPQ 异步加载竞态条件

### 变更
- 统一所有配置文件版本号为 0.1.1
- AboutDialog 现在从 package.json 动态读取版本号
- GitHub Actions 工作流添加 includeUpdaterJson 选项

## [0.1.0] - 2025-01-09

### 新增
- 初始版本发布
- 可视化拖拽编辑功能
- 实时预览效果
- 丰富的 UI 模板
- 锚点系统支持
- 多层级组件管理
- FDF 格式导入导出
- MPQ 档案加载支持
- BLP 纹理加载
- MDX 模型渲染
- 自动更新检查（开发环境下跳过）
