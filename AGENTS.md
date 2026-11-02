# agents.md

本文件是给代码代理（agent）的「操作规则 / 门禁 / 验收标准」备忘录。所有后续迭代**必须**在改动后同步更新本文件，并在提交前复查一遍是否与本仓库的实际规则一致。

---

## 1. 项目定位

在 `src/utils/` 内重建 Warcraft3 的 FDF UI（对齐参考实现 `d:/Projects/openwar3`），目标是把内核（kernel：parser/transformer/layout/library）、桥接与渲染器都对齐参考，最终达成**浏览器栅格 PSNR** 收敛。参考仓库是**只读**的，不得修改。

里程碑（matching, 档）：
- 档3a Solver 内核与参考求解器对拍 —— DONE
- 档3b 独立真实数据桥接（不再复用参考求解器）—— DONE
- 档2 渲染像素对拍 PSNR —— DONE（验收：t1 不透明 / t2 半透明 精确 0 diff，t4 平滑 ≥45dB 实测 71.6；t2 曾因 psnr.html 材质漏 `transparent:true` 实测 10.46dB，修复 harness 后 0 diff——真实产品路径 ShaderLib 本就 `transparent:true`）
- **双路径决策（实证审计，不切换默认）**：渲染消费路径 `fileOperations.ts:169` 已走内核 layout（`useKernelLayout:true`）；
  `parseFDF()` 默认分支 + `fdfImport.ts` 供编辑器直接 API / 模板继承 / 导出往返使用，刻意保留旧 transformer（"阶段 E 收尾"按现状记录），
  两者按调用方语义各得其位，不统一翻转为默认以避免破坏 30+ 编辑器视觉回归。`fdfTest.ts` 为 dev 示例，非渲染消费。
- 最终交付目标：**浏览器栅格 PSNR ≥ 45**（对复杂/全屏场景若无法达成，须如实上报，不得硬凑或掩盖）
  - **已知诚实上限（不进入验收门）**：t3 高频 checker 采样差异，实测 PSNR≈27dB，非布局缺陷，文档化保留。
    实证排除的两种补救假设：(a) `imageSmoothingQuality=low`(canvas 双线性) 对 mine 仍 ≈27dB → 非滤波器带宽差；
    (b) WebGL UV 亚纹素偏移扫描（0/±0.5/±1/±2/±4‰）在 offset=0 处最优（27.07，偏移增大降 22/18）→ 非采样相位/纹素中心差。
    27dB 源于 @×5.6 放大下 {canvas2D 颜色未托管 set + smoothing} vs {WebGL sRGB + LinearFilter} 的内核本质差异。
  - **"整屏复杂场景 PSNR"不可行（实证）**：openwar3 参考渲染是 **DOM 覆盖层**（absolutely-positioned DOM over 3D 背景），
    非 canvas/离屏栅格。产品是 WebGL framebuffer，两者输出表面异构，无可逐像素对齐的"整屏"参考面；
    可比的诚实像素面只有"公平基元"（单纹理双端拉伸），即 t1/t2/t4。故不建整屏 PSNR 守卫，避免空对空。

像素矩形对拍（`tests/ow3compare/pixelrect.real.test.ts`）是绿色守护线（guarded-green），不可破坏；`tests/ow3compare/psnr.real.test.ts` 现覆盖 t1/t2/t4。
- **编辑器渲染像素映射一致守卫（几何一致守卫，实证落点）**：`tests/ow3compare/editorrender.pixelrect.test.ts`。
  在 1920×1080、margin=240 下，对世界矩形网格**穷举**（10×9×8×8=5760 组）断言
  `SceneGraphManager.computePixelRect` 所用的 `coordinateService + snapRectToPixels`
  （编辑器渲染路径）与内核/参考 `fdfKernelLayout.toPixels`（openwar3 路径）落到**完全相同的整数像素矩形**。
  两者代数同构（uniform scale 1800=1080/0.6；编辑器加 240px X margin，内核无 margin，统一约定后抵消），
  故可全量成立、无 root/子帧特殊化。此守卫覆盖「编辑器渲染路径的世界→像素映射」与内核/参考一致的硬门槛。
  **实证边界（已修正，勿沿用旧结论）**：编辑器锚点求解器 `calculatePositionFromAnchors`（`anchorUtils.ts`）
  与内核 `fdfKernelLayout.layout` 经同一条 `fileToFrameData` 桥接后，**世界矩形逐字段等价**——
  见下方 `editorgeometry.parity.test.ts` 守卫（12 类锚点配置、14 用例全绿）。
  早期曾得出"两求解器大面积分歧"的结论，那是**探针自身缺陷**造成的假象：探针把
  `Record<string, FrameData>` 误传为 `Map`（`allFrames[relativeTo]` 恒 undefined），且根帧锚点未按
  画布绝对化。后者暴露了一个**真 bug**：`transformKernelFrames` 的顶层画布归一化曾排在"默认 CENTER
  锚点注入"之前，使无显式 SetPoint 的根帧拿到未归一化的 `CENTER@__PARENT__`，求解器回落 (0,0) 再减
  半宽高得 (-w/2,-h/2)，把整棵子树平移出画布。该顺序缺陷已修复（顶层归一化移到默认锚点注入之后）。
- **编辑器渲染几何一致守卫（求解器 ↔ 内核 layout）**：`tests/fdfKernel/editorgeometry.parity.test.ts`。
  走**产品真实路径**：`parseFDF(src,{useKernelLayout:true})` 让内核 layout 几何先 overlay 进 FrameData，
  再断言编辑器渲染消费路径的 `calculatePositionFromAnchors`（`SceneGraphManager.sync` 逐帧调用）
  覆盖后**不破坏**该内核几何（world rect x/y/w/h 逐字段一致，y-up 左下原点 [0,0.8]×[0,0.6]）。
  覆盖单锚点 TOPLEFT/BOTTOMLEFT/CENTER、对角 TL+BR、上排 TL+TR、下排 BL+BR、四边 L+R+T+B、
  左右 L+R、上下 T+B、跨节点相对锚、三级嵌套、root 显式 CENTER。
  根帧/无相对锚点帧求解器返回 null，渲染直接消费存储几何（= 内核 overlay 值）。
  **无锚点子帧兜底已统一**（见下方"无锚点帧兜底统一"）：两处都钉父 top-left，不再存在
  "内核钉 top-left vs 编辑器注入 CENTER"的分歧。
- **编辑器渲染一致 — 真实原版 UI 守卫**：`tests/ow3compare/editorrender.real.test.ts`（war3.mpq，41 屏）。
  走**产品真实路径** `parseFDF(src,{useKernelLayout:true})` → `SceneGraphManager.sync` 的
  `calculatePositionFromAnchors` 覆盖，量化"覆盖是否破坏内核 ground-truth 几何"。
  实测基线：`frames=1371  solver-null=202  overridden=1169  divergent=3`，一致率 **99.74%**（1166/1169）。
  演进：61（递归）→ 31（去递归）→ **3**（方案 2 统一无锚点兜底 + 提前注入引擎默认锚点）。
  剩余 3 帧**全部是顶层帧**（MainMenu:DebugButton/ReplayButton、ScoreScreen:SaveReplayPanel）：
  其 `relativeTo` 指向同文件根帧，而根帧 box 在两管线语义不同——内核 `resolveRootBox` 对无锚点 root
  做**居中** `((0.8-w)/2,(0.6-h)/2)`，solver 走 `transformKernelFrames` 注入的默认 TOPLEFT@画布
  （得 `(0, 0.6-h)`）。这属**顶层帧 box 语义**的历史差异（编辑器里 root 居中是有意的设计器行为，
  改动会破坏 5 条既有 scene 测试），如实保留、以快照锁定，不冒充已解决。
  注意：早期一版探针（把纯结构帧喂给求解器、未走产品路径）得出"1112/1191 分歧"，那是**探针路线错误**的假象。
- **无锚点帧兜底统一（方案 2 落地）**：两处兜底统一为"钉父 **top-left**"。
  - `transformKernelFrames`（`fdfKernelTransformer.ts`）的默认锚点由 `CENTER@父 CENTER` 改为
    `TOPLEFT@父 TOPLEFT`；`fdfKernelLayout.layout` 的未放置分支本就是钉父 top-left，二者从此一致。
  - **引擎默认锚点提前注入**：`applyWidgetDefaults`（`fdfKernelLayout.ts`，已 export）从"布局阶段"
    提前到 `fileToFrameData` 的**第一步**。它原地改写 `FdfFrame.props`（PopupArrowFrame → 贴右缘内缩
    `PopupButtonInset`）；若只在 layout 阶段注入，结构层 anchors 就拿不到这条锚点，编辑器求解器与
    内核 layout 会对同一帧给出不同位置（实测 10 帧 PopupMenuArrow 因此分歧，占 31→13 的绝大部分）。
  **注意这仍是偏离引擎的自造行为**：IDA 证实引擎对未锚定帧返回 `CFramePoint::UNDEFINED`
  （§4.1 已记录），本仓库必须给未锚定帧一个可见位置，故选"统一 top-left"而非"UNDEFINED"。
  该取舍是产品决策（用户选定方案 2），不是引擎原义。
- **去递归修正（方案 A 落地）**：`calculatePositionFromAnchors`（`anchorUtils.ts`）不再递归重解
  `relativeTo` 指向的帧，直接用其**已存 x/y/width/height** 作为锚点基准。
  理由：祖先几何已由上游（内核 layout overlay / 上一次同步）确定，递归重解等于**用求解器覆盖求解器**，
  误差沿祖先链累积。实测（war3.mpq 41 屏 1371 帧）分歧 61→31，且 `noRecBetter=32 / noRecWorse=0`（无一例变差）。
  **子帧跟随前提**：`SceneGraphManager.sync` 按父→子顺序收集（`collectIds`）并同步，祖先在本轮已先更新；
  该前提由 `anchorUtils.test.ts` 的「祖先先算」用例锁定（父帧存储几何更新后子帧跟随位移）。
  **取舍**：去掉递归后，若祖先锚点变化而祖先存储几何尚未更新，子帧会读到旧值一帧；因 sync 遍历顺序保证
  祖先先算，正常同步路径不触发。若未来引入异步/乱序同步，需重新评估。
- **单锚点定位以 WC3 引擎 + openwar3 为准（已固化）**：`tests/fdfKernel/singleanchor.openwar3.test.ts`。
  **IDA 取证（Game.dll，imagebase 0x6f000000，本轮已反编译确认）**：
  - `CFramePointRelative::X` @ `0x6f0e7d20`：按 `CRect` 三分支取值——
    LEFT 族 `m_offset.x*scale + rect.l`；CENTER 族 `(r+l)*0.5 + m_offset.x*scale`；
    RIGHT 族 `m_offset.x*scale + rect.r`。`::Y` @ `0x6f0e7e20` 结构对称
    （TOP 族用 `rect.b`、中部 `(b+t)*0.5`、BOTTOM 族 `rect.t`；WC3 rect 以底为基）。
  - `CFramePointRelative::New` @ `0x6f0e7cc0` 只存 `relative / framePoint / offsetX / offsetY`
    → 锚点恒为**相对**解算。
  - `CFramePointRelative::X/Y` 在 `m_relative->GetRect()` 失败时返回 `CFramePoint::UNDEFINED`
    （`0x6fd3d6a0`）→ **引擎没有"无锚点帧钉父 top-left"的兜底**，未锚定帧坐标是 UNDEFINED。
  - `CLayoutFrame::SetPoint`（相对重载 @ `0x6f0daf00`）构造的就是 `CFramePointRelative`。
  - 由上述可推出 `x = (rect.l + fx*p(rect.r-rect.l)) + offset.x`，与 openwar3
    `rel.x + fx(relPoint)*rel.w + dx` 代数等价。守卫对**全部 9 个点** × 带/不带非零偏移逐点断言，
    并额外用 **CRect 显式形式**（边/中点 + offset）交叉验算一遍。
  **后续进展**：曾经指认的"31 帧分歧"根因已按方案 2 修掉（无锚点兜底统一 + 引擎默认锚点提前注入），
  现降至 **3 帧**，且剩余 3 帧是**顶层帧 box 语义**（见上条"真实原版 UI 守卫"），与单锚点求值无关。
  单锚点求值本身与引擎/openwar3 一致，无遗留问题。

---

## 2. 硬性门禁（Commit Gate）——每次提交前必须全绿

以下任意一条不满足就**不允许提交**：

1. **单测全绿**：`npm run test`
2. **覆盖率达到 100%**：`npm run test:coverage`（等价 `vitest run --coverage`）
   - 目标范围：**整个 `src/utils`**
   - 验收指标**四项全 100**：`Lines` / `Statements` / `Functions` / `Branches`
3. **守护回归全绿**：内核 + 参考对拍套件
   `node node_modules/vitest/vitest.mjs run tests/fdfKernel tests/ow3compare`
4. **类型检查**：`npx tsc --noEmit`。**源码（src，非 `*.test.ts`）必须 0 报错**。测试文件的既有松散类型报错可暂缓，但新增代码不得引入新的错误。`npm run build`（= `tsc -p tsconfig.build.json && vite build`）用 build 专用配置排除测试文件——r120 修复生产构建被 95 个测试侧报错阻塞的问题（此前 build 从未绿过）；主 chunk 1.87MB 警告为代码分割优化项不阻塞。r122 已分割：three(566KB)/react(12KB) 独立 vendor 分包，主 chunk 降至 1.29MB（-31%，vendor 长缓存）；业务 chunk 强耦合不再细分。

最新全量基线：
- `139 passed | 2 skipped` 测试文件，`2116 passed | 5 skipped` 测试
- 内核/对拍：`18 passed | 2 skipped` 文件，`444 passed | 5 skipped` 测试（含真实数据往返守卫）
- `All files` 覆盖：`100 / 100 / 100 / 100`

### hotReloadExporter 热重载链路审计（本轮，抓到防抖竞态数据丢失）

热重载链路（200 行，既有 20 测）审计发现 **1 处真实竞态缺陷**：
导出进行中（`isExporting=true`）新触发的导出被跳过且**不重排**——
编辑 → 防抖导出开始 → 期间再编辑 → 防抖再次触发 → 被 `isExporting` 跳过 →
**最新版本静默丢失**，且后续无编辑则永远不落盘。
既有测试「second call while isExporting」把跳过行为锁为期望
（同款"测试认证 bug"模式：跳过本身合理，不重排导致丢失是缺陷）。

**修复**：跳过时记录 `pendingProject`，`finally` 中补充导出一次
（不递归暂存——补充导出期间的更新由下一次防抖承接；补充导出失败
捕获记日志不冒泡）。测试扩到 22 测（pending 补充导出 + 失败不冒泡）。

**如实记录（产品决策项）**：`getDefaultHotReloadConfig` 的 Reforged 回退路径
硬编码个人用户名 `'81468'`（`system_username` 缺失时）。修复需接 Tauri
`documentDir()` 异步 API 并调整模块级常量初始化时序，涉及启动时序重构，
本轮不动代码、如实记录。

### 审计轮次结论汇总（bridging/KKWE/fileOperations/snapUtils/textureLoader/process/mpqManager）

盲区审计（"覆盖率 100% 但无语义审计"路线）累计 8 个模块面，结论压缩如下（细节见 git 历史）：

| 模块 | 结果 | 核心结论 |
|---|---|---|
| dataSource.ts | 通过 | loadList 失败降级可重试；大小写分层正确（Rust has_mpq_file 走 MPQ hash 不敏感，快/降级两路一致） |
| rustBridge.ts | 通过+1 决策 | `Array.from(blpData)` 大纹理内存膨胀 8 倍——Tauri 2 二进制 payload 需 Rust 端配合，性能决策项 |
| kkweDetector+Rust | 通过+2 边界 | ①detectKKWE 失败与未安装不可区分（UX 决策）②launch_kkwe 以启动器退出码当 War3 PID（外部约定） |
| fileOperations.ts | **修 1 缺陷** | 迁移不清理悬空 parentId → 再次保存永久化；已修（清理为 `''`，2 测） |
| snapUtils.ts | **删除死代码** | 零生产引用（真实路径 frameTransforms.snapRect）；342 行+34 测清除。**教训：零引用检查是盲区审计第一步** |
| textureLoader.ts | **修 1 缺陷** | evictLRU 公式 `acc*1000+age` 淘汰 score 最小=刚加载项——**与 LRU 相反**；已改 `acc*maxCacheAge-age` + fake-timer 方向性 2 测。**测试认证 bug 第 4 例**（旧测试注释把 timestamp 当 age、不断言淘汰对象） |
| war3ProcessManager | **修 1 耦合** | isCurrentProcessRunning 只查内存，漏 localStorage 恢复——隐式依赖调用方先调 getCurrentPid；已统一 |
| mpqManager.ts | **修 1 竞态** | setWar3Path 无并发防护（WC3TextureBrowser:55 fire-and-forget + 用户改路径并发）→ **两路径档案混合加载**；已加代际守卫（loadGeneration 过期中止剩余档案），58 测 |
| blpDecoder.ts | 通过+1 改进项 | JPEG 静默占位是设计决策（Rust 后端优先、灰图不断链）；URL 三路 revoke 完整；mip 越界已有抛错守卫。低危项：空/短缓冲的 RangeError 信息不友好（Rust 前置遮蔽） |
| war3SkinsParser+textureLoader | **修 2 缺陷** | openwar3 仲裁：1.27 war3skins.txt 值大量带成对引号（`Key="UI\..."`），两 parser 均无 unquote → **路径含引号字符全部失效**。已加 unquote（两处）；textureLoader 扁平映射改段落感知（[Default] 全表优先，种族段 override 不冒充全局；且旧实现"后缀过滤在 unquote 前"会全部误过滤带引号值——测试红抓出）。textureLoader.parseWar3Skins 与 war3SkinsParser.parseWar3Skins 是双实现（扁平 vs 结构化，语义不同故并存） |
| Rust lib.rs（20 命令） | 通过 | extract_template_map 白名单+include_bytes!（无路径注入）；parse_mdx ? 错误链显式；BLP 三命令 map_err 完整；get_username USERNAME→USER 环境变量回退。与此前 kkwe/MPQ/BLP 分项审计合并后 Rust 侧全面收口 |
| codeExport 数值格式化 | 通过 | 全部数值插值有 toFixed(2/5) 保护（锚点/尺寸/MinMax/Step）——无 JASS/LUA 不支持的科学计数法（1e-7）风险；maxValue=0→100、stepSize=0→1 是无意义输入的防御兜底，与 SLIDER 导入侧 minValue=0 合法值不冲突（minValue||0 对 0 处理正确） |
| fdfParser.old.ts | **删除死代码** | `.old.` 命名旧解析器实现，零生产引用（真实路径 fdfParser.ts 内核）；8.4KB+18 测清除。testMdxParser/fdfTest 是有意的控制台调试工具（非死代码）保留 |
| backdropEdgeRenderer.ts | **删除死代码** | 全部导出（BackdropEdgeRenderer/renderBackdropEdge）生产零引用；BackdropEdge.tsx 组件实际用 textureAtlas（WebGL 路径），本文件是被取代的 canvas 2D 旧实现；6.6KB+11 测清除 |
| textureAtlas.ts | **修 1 缺陷** | extractSubTextures 缓存键 `${url}_${subSize}` 不含 layout——同纹理换布局命中错误缓存返回错误部件；已加 `JSON.stringify(layout)` 进键（removeCacheEntry 同步签名）。**测试认证 bug 第 5 例**：既有测试名直接写 "reuses cache cacheKey layout-independent"、注释明示 "cache key ignores layout"——缺陷被认证为期望。HORIZONTAL_BORDER_LAYOUT 的 TODO(P1) Hexrays 索引顺序差异已有诚实记录，不动 |
| coordinateService+fdfImportExport | 通过+删死函数 | 数学由 5760 组穷举守卫覆盖；clampWc3/clampWc3Size 生产零引用（真实钳制在 frameTransforms.clampRectToCanvas）删除；转换函数有生产引用保留。fdfImportExport 是 MenuBar 用的纯 re-export facade |
| anchorUtils.ts | **修 1 性能缺陷** | 求解主路径 21 条 console.log 在 SceneGraphManager.sync 热路径上（1371 帧真实数据每次同步数千条日志，性能+控制台淹没真实 warn）；已删热路径 log，保留 warn 与 updateAnchorsFromBounds 编辑路径 log。另：getFrameVersion 缓存键缺目标帧 width/height，属防御性缺失非当前缺陷（updateFrame 全量清缓存保证失效），未来做精细化失效必须补 |
| fdf.ts 统一入口 | 通过+2 边界 | 双路径分支与 AGENTS.md 决策一致；parseFDFToAST 被 fdfImport/fdfTemplates 生产消费。边界：①validateFDF 的 warnings 恒空（预留通道未实现，仅 dev 工具消费）②formatFDF 经旧 transformer 有损风险但生产零引用（仅 fdfTest） |
| fdfExporter.roundtrip（新守卫） | 通过+守卫补齐 | 真实守卫只覆盖 lossless 分支（真实数据全带 rawProperties）——新 3 测覆盖**标准分支**（无 metadata）：Enhanced 导出→importFromFDFText→字段/转义/层级往返成立。Width 归一化语义（0.3/0.8=0.375 父宽比，渲染 ×父宽还原）以语义链断言。两次探针自身错误（parseFdf 返回 FdfFile 误用、regex 数帧类型标签而非帧名）——探针教训第 N 次验证 |
| fdfIncludeResolver.ts | **删除死代码** | Node-only（fs/path import，浏览器/Tauri webview 不可用）+ 生产零引用；真实模板继承走 fdfTemplates.templateManager 路径。191 行+14 测清除 |
| fdfExporter 剩余面+fdfTemplates | 通过+1 边界 | mapFrameType FT 0-28 全覆盖（+100/101 别名）；exportTexture 的 TexCoord 顺序/AlphaMode/DecorateFileNames 与 exportUtils 一致；escapeString 数组多元素空格连接。fdfTemplates：循环继承 visited 防护、多级继承合并顺序正确（子覆盖父）。**边界**：applyTemplate 继承属性只进 fdfMetadata.rawProperties（不写可编辑字段）——导入带 INHERITS 的帧其继承 backdrop 在属性面板不可见，lossless 导出靠 rawProperties 保真，改动需产品决策 |
| fdfImport.test mock 补齐 | test 侧修复 | mock templateManager 缺 loadTemplatesFromFile 致 tsc 测试侧 2 报错（生产无碍）；补 mock 后清零 |
| 命令层 src/commands（9 文件全类） | 通过+1 边界 | 20 命令类全部有测试实例化（Frame 10/Align 3/AlignToCanvas/Size/ZIndex/Duplicate 2/Array 2）——无缺口。ZIndexCommand 语义：moveUp/Down 找相邻 z、边界 no-op 不写、bringToFront max+1/sendToBack min-1、undo/redo 存 old/new。**边界**：no-op 命令（已最高层再上移）仍入栈并清空 redo 栈——commandStore"新 execute 清 redo"设计语义的自然结果（类比 git empty commit），UX 细节记录不改。13 条 console.log 在用户操作路径非渲染热路径，保留 |
| BackdropEdge.tsx+useTextureLoader | **删除死代码链** | 组件无任何 JSX 渲染点（WebGL 路径 SceneGraphManager.syncBackdropEdges 用 textureAtlas 取代）；useTextureLoader 唯一消费者是该孤儿、useTextureLoaderBatch 零消费。canvasHelpersWiring 相应用例随删（守卫 6 测）；useCanvasPan/useHotReloadSync 有活消费方（Canvas/HotReloadPanel）确认非死代码 |
| constants.ts+App.tsx 接线 | 通过 | constants 6 值消费方 11 处；renderer/kernelScene 无硬编码绕过（kernel 用自身 UI_WIDTH/UI_HEIGHT，与编辑器 constants 的等价性由 5760 组穷举守卫锁定）；CANVAS_POINT 中心点 0.4/0.3 是 WC3 标准系自洽值非 magic number。App.tsx 快捷键/删除确认/面板切换接线已被 utilityPanelsWiring/canvasWiring/projectStore.test 覆盖 |
| mpq_io.rs+tcp_server.rs | **修 1 缺陷**+1 缺口 | mpq_io：句柄缓存+listfile 缺失降级+has_file 快速路径+测试自包含 ✓；换路径清池链完整（setWar3Path→unloadAll→clear_mpq_cache→pool.clear）无泄漏。tcp_server：**bind 失败 is_running 卡 true**（后续 start 返回假成功，热重载静默失效）——已修 Arc<Mutex> 供 spawn 内复位。**环境缺口已解除（round 81）**：根因是 cmake crate 0.1.54 不识别 VS 18（非缺库）——`cargo update -p cmake --precise 0.1.58` + vcvars64.bat 环境下构建即通（`cmd /c "...vcvars64.bat >nul 2>&1 && cargo check/test"`）；cargo test **19/19 全绿**，此前 3 个 Rust 修复（tcp_server/mdx/blp）全部编译+测试验证通过 |
| mdx_parser.rs 全文 | **修 1 DoS 缺陷** | VRTX/NRMS/UVBS/PVTX 数据循环用 read_f32().unwrap_or(0.0)——截断/损坏文件 count 巨大时 EOF 后静默产 0 循环数十亿次 push（内存爆炸/假死）；已改 ? 传播错误（12 处），损坏文件报错给前端而非假死。skip 类分支（GNDX/PTYP）保持 .ok()（seek 兜底无膨胀风险）。编译验证仍被 turbojpeg 环境阻塞（同上条缺口），花括号配对+残留扫描自检通过 |
| blp_handler.rs 全文 | **修 1 panic 缺陷**+实证修正 | decode_blp_mipmap 在 mipmaps 为空时 "count - 1" usize 下溢 panic（debug 构建）——已加 count==0 提前报错。**round 103 实证修正**：blp-0.1.37 from_buf 返回 [Mipmap; MAX_MIPS].into_iter().collect()——mipmaps.len() 恒为 MAX_MIPS，**count==0 分支实证不可达**（"损坏 BLP 可能 mipmaps 为空"假设被源码证伪；防御代码无害保留）。错误链/越界检查/多 mip 解码旗标语义正确；91/91 前端 BLP 守卫覆盖真实解码路径。**边界**：get_blp_info 命令前端零消费（未接线 API 面，format 字符串仅展示用），保留不删（cargo 验证阻塞下减少 Rust 动作）；test_decode_blp 空壳如实记录（真实路径由前端守卫覆盖） |
| fdfTransformer 旧路径抽查 | 通过+定性 | 70.7KB 双路径保留分支不做逐行全文审（30+ 视觉回归+roundtrip+importRoundtrip 43 测守卫其行为）；抽查几何核心：toPixels 恒等（编辑器世界坐标语义）与内核 toPixels（世界→像素）不同名不同义各得其所，世界矩形等价由 5760 守卫锁；Anchor 单点=绝对、SetPoint=相对 ✓；外部引用（UIParent/ConsoleUI/GameUI）删 relativeTo 画布绝对化与内核 __PARENT__ 顶层语义一致 ✓；同名多候选优先同父级（比内核精细）。3 条 console.log 在导入一次性路径非热路径，保留 |
| fdfLexer+fdfAst 抽查 | 通过 | readNumber 负号/小数/科学计数法/C 风格 f 后缀（官方 FDF ButtonPushedTextOffset 用 -0.0015f）全支持；readIdentifier 无连字符但真实 FDF 无此案例（42/42 往返守卫覆盖）；fdfAst 纯类型+常量白名单无运行时逻辑 |
| Rust 损坏输入测试（round 82） | test 补齐 | mdx 截断 VRTX（count=3 无数据字节）必须报错而非产零顶点 + 合法 3 顶点解析/bounds 计算——fixture 首版缺 geoset_size 字段探针自错（GEOS 内布局 size+sub-chunks）。cargo test 19/19 全绿；tcp_server/blp 的行为由类型/早退结构保证不额外建测 |
| useCanvasPan 纯逻辑抽取（round 83） | test 抽取 | computeWheelScale/startPanAnchor/computePanOffset 抽到 canvasViewTransforms.ts（与 frameTransforms 同模式）+7 测；hook 保留状态/事件接线。钳制测试断言首版自错（raw vs 钳制值矛盾+手算错）修正。2083 测全绿 |
| useHotReloadSync 纯逻辑抽取（round 84） | test 抽取+1 防御 | buildHotReloadLua 抽到 hotReloadLua.ts +5 测（空串/toFixed 6/多帧/id 双引号转义 escapeLuaString——原内联实现 id 直插无转义，抽取时加防御）；hook 保留 rAF 节流/状态机。2088 测全绿 |
| 热重载 Lua 补文本/纹理同步（round 85） | feat 补齐 | buildHotReloadLua 原只发位置/大小（原实现注释"可以按需追加"）——补 SetText（仅 text 帧）/SetTexture（仅 texture 帧，fixedScale 0 与 luaGenerator 同参），均 escapeLuaString。8 测全绿 |
| 交互面与数据链核查通过（rounds 88-106 归并） | 通过 | 十一次核查全通过：修饰键反模式横向排查（canvas 三 hook 正确）、CustomEvent 配对、画布交互 4 项、Toolbar 启动链（含 grep 假阴性教训）、localStorage 6 键配对、自动导出订阅、uiStore 5 开关消费、右键菜单 11 项、DebugPanel 接线、mpq 6 测+参考线闭环、commandStore 异常路径（+2 守卫测）。详见各轮 git 历史 |
| useKeyboardShortcuts 修复（round 87） | **修 1 死功能** | 方向键微调的 Shift 精细步长(0.001)判断放在 !e.shiftKey 分支内——恒 false，Shift+方向键落入 Ctrl+Shift 分支尾静默无操作（注释宣称的精调功能从未生效）；已加独立 Shift+方向键分支（0.001 步长）。2091 测全绿+src 0 报错 |
| 帮助面板虚标快捷键补齐（round 90） | **修 1 宣称≠实现** | ShortcutHelp 宣称的 Ctrl+X 剪切 / Ctrl+±/0 缩放 hook 无实现（按了没反应）——已补：Ctrl+X=复制+删除半步（过滤锁定帧走确认框）、Ctrl+=/- 缩放钳 0.1..5、Ctrl+0 重置 1。其余宣称项核实存在（Alt+滚轮/Ctrl+点击/Shift 框选）。2094 测全绿 |
| 帮助面板反向对账（round 91） | docs 补全 | 已实现但未列：Ctrl+A 全选/Ctrl+Shift+A 反选/Ctrl+; 清参考线/Ctrl+, 偏好设置——补入 ShortcutHelp 编辑操作类。双向对账完成（宣称≠实现 r90 + 实现≠宣称 r91），帮助面板与 hook 全量一致 |
| MenuBar 虚标收敛（round 92） | **修 1 误判+补 4 快捷键** | 初判 Ctrl+3/4/5/Shift+D 虚标——**误判**：App.tsx 有独立键盘监听器（不在 hook 内）已实现；真正虚标仅 Ctrl+1/2（面板）、Ctrl+9（适应窗口）、Ctrl+/（帮助）——App handleViewToggle 补 case 1/2/9//（canvasRef.centerCanvas 同 MenuBar 款）。教训：跨文件键盘监听器并存，虚标判定须扫全仓而非单 hook |
| 偏好设置死链修复（round 97） | **修 1 摆设面板** | PreferencesDialog 6 项中 5 项保存后零消费：showGrid/snapToGrid/gridSize 画布读 uiStore（偏好不生效）、preferences-updated 事件 0 监听、theme/language 仓库无主题/i18n 系统（纯摆设承诺）。修：①handleSave 实时同步 3 画布项到 uiStore ②App 启动恢复 preferences→uiStore ③删 theme/language 控件（不留无效承诺）。preferencesWiring 守卫同步（断言 ui 同步+无 theme/language） |
| uiStore 选择类 action 补测（round 105） | **修 1 不一致+1 防御** | 发现选择类 action（编辑器核心交互）零测试覆盖。selectGroup 两缺陷：①只设 selectedFrameIds 不同步 selectedFrameId——组选择后属性面板残留旧选中帧（与 selectMultipleFrames 语义不一致），已同步=最后成员 ②frameIds 无防御（手编辑存档缺字段 spread 抛错），已 ||[]。+6 测（单选/toggle 加移除/清空/组选同步/未知组 no-op/缺字段防御）。2100 测全绿 |
| addFrame 幽灵帧修复（round 108） | **修 1 P1 缺陷** | 粘贴审计发现：复制子帧→删原父→Ctrl+V，PasteFrameCommand 以原 parentId 粘贴副本，addFrame 对悬空 parentId 不挂父也不入 rootFrameIds——**副本成幽灵帧**（存在但不可见不可选）。修复：addFrame 悬空 parentId 归一化为根帧（与 fileOperations 迁移清理语义统一）。+2 测（归一化/有效父不回归）。2104 测全绿 |
| BatchRemove undo 恢复顺序修复（round 109） | **修 1 回归风险** | round 108 修复引入的回归面：undo 按用户选择序（Map 插入序）恢复，子先于父时子帧被归一化成根帧 → 与父 children 快照树断裂。修复：undo 按拓扑序（父先）恢复（迭代去依赖+环防御）。+2 测（跨层级删除树完整/兄弟多选不变）。2106 测全绿 |
| Rust 补测与命令族核查（rounds 102/103/110/111 归并） | 通过 | tcp_server 4 测（State 契约/broadcast Err 语义/wire 序列化）+ resolve_username 抽纯函数 4 测（**空 USERNAME 视同缺失**——原 Ok("") 拼坏路径，行为改进）→ Rust 19/19；DuplicateFrame（redo 稳定快照）与 UpdateFrame（undo 按键精确采样/已删帧安全）核查通过；PasteFrame redo 重新生成 id 定性低危边界不修 |
| updateFrame 悬空归一化修复（round 112） | **修 1 同族缺陷（第 8 处）** | parentId 变更路径无归一化：拖拽到已删父（悬空）不挂 children 又不入 rootFrameIds（仅对 null 判定）→ 幽灵帧在 updateFrame 路径复发。修复：悬空归一化根帧（与 addFrame r108 统一），rootFrameIds 判定改用归一化值。+3 测（悬空/正常父/拖回根）。2109 测全绿 |
| CreateFrame/重命名核查（round 114） | 通过 | CreateFrame 构造期快照（redo id 稳定）；MoveFrame redo 重新捕获经分析安全（undo 后新 execute 清空 redo 栈——重捕获值=正确旧值）；ProjectTree 重命名走 UpdateFrameCommand 可撤销。命令族 20 类全部核查完毕 |
| 生产构建修复（round 120） | **修 1 P1 交付缺陷** | npm run build（tsc && vite build）被 95 个测试文件 TS 报错阻塞——生产构建从未绿过（门禁"测试侧可暂缓"与 build 全量编译矛盾，无法发布）。修复：新增 tsconfig.build.json（exclude *.test.ts/__test_helpers__），build 脚本改用之。vite build 4.72s 绿；主 chunk 1.87MB 警告=分割优化项 |
| 数据完整性与持久化收口（rounds 115-119 归并） | 通过+修 5 | 存档序列化保真 2 测（全字段往返/JSON 转义）；损坏容错：存档 frames 缺失归一化空项目（+2 测）、recentFiles 非数组回落空列表、hotReloadConfig 自动导出订阅 try-catch（**损坏 JSON 异步未捕获 rejection 曾使自动导出静默死亡**）；undo 旁路：useCanvasDrag/Resize 手动入栈绕过 MAX_UNDO_HISTORY=100 裁剪（拖拽最频繁操作栈无限增长）——commandStore 加 pushCommand 统一 3 处旁路（+3 测） |
| Rust 发布构建验证（round 121） | 通过+清理 | cargo build --release 2m35s 绿（首次 release 验证）——3 warnings 中 2 个死代码已清（unused import Manager/read_half→_read_half），LNK4098 链接器提示与 num-bigint-dig future-incompat 为工具链/外部依赖如实记录。cargo test 19/19 复绿 |
| 主 chunk 代码分割（round 122） | perf 补齐 | vite manualChunks 分离 three/react vendor——主 chunk 1.87→1.29MB（-31%），vendor 内容稳定可长缓存；业务模块强耦合不细分（误拆有循环 chunk 风险）。build 3.2s 绿 |
| UpdateChecker 核查（round 124） | **修 1 stale closure** | 网络/下载容错全健康（check/downloadAndInstall 均 catch+对话框；dev 跳过；挂载 3s 静默检查）——唯 window.checkForUpdates 暴露用 [] 依赖数组，闭包捕获恒 false 的 checking/downloading，防重入失效可并发检查。改无依赖数组每渲染重暴露（setState 引用稳定无副作用） |

**盲区审计阶段收敛声明（rounds 48-80）**：src 全树（utils 33 文件/commands/store/components/hooks/renderer/constants/App）+ src-tauri 全树（6 Rust 文件）全部定性完毕——30 个模块面：12 缺陷修复 + 6 死代码清除（~2200 行）+ 12 通过/抽查 + 2 守卫补齐 + 2 测试侧修复 + 1 环境缺口（cargo check 被 libturbojpeg 阻塞）+ 4 产品决策项（appInterface/editBorderSize/applyTemplate 写回/用户名回退）。后续轮次转入新方向。

**共性教训**：①零引用扫描先行；②pwsh 批量文本替换跨 CRLF 会静默未命中——替换后必须 grep 验证（tsc "参数未使用"曾救场）；③测试认证 bug 反复出现，方向性/淘汰对象级断言不可省。
### 组件层接线守卫汇总（rounds 27-47，结论）

因未装 jsdom，21 个 *Wiring.test.ts 文件（123 测）用静态断言锁接线（诚实守卫；引入 jsdom 后应改渲染级交互测试）。
properties(13)/anchorEditor(6)/propertyEditors(5)/batchEdit(5)/arrayDialogs(6)/projectTree(8)/hotReloadPanel(5)/
textureBrowser(6)/templatePanel(6)/presetGroup(6)/preferences(5)/mdxViewer(5)/canvas(6)/toolbarMenuBar(5)/
historyPanel(5)/utilityPanels(5)/propertiesPanel(5)/sidePanel(5)/canvasHelpers(7)/anchorVizHandles(4)/miscPanels(5)。
**wiringExtra.test.ts（4 测）**补齐 StylePresetPanel/FrameGroupPanel/UpdateChecker 三组件边界。
**教训**：多行字符串断言过脆——用 indexOf 顺序断言（语义等价抗格式化）。

### 真实数据大样本往返守卫（本轮，转正）

`tests/ow3compare/roundtrip.real.test.ts`（guarded，war3.mpq）：全量 42 个 Glue FDF →
parseFDF(useKernelLayout) → FDF 导出 → importFromFDFText → 断言 42/42 全通过、
1371 帧无一抛错。这是对 18 轮导出/导入工作在**真实数据上的总验证**——
真实语法变体（数值格式、模板引用、空字段）全部被往返消化。

**探针自身教训**：首轮大样本 42 个全挂，是探针忘了 `await` 异步导出（mock 未完成时读
`mock.calls.at(-1)` 得 undefined，报 `undefined[1]`）——不是产品缺陷。定位方法：
单文件最小复现成功 → 对比差异 → 发现 await 缺失。**大样本验证前先确认探针自身正确**。

### JASS/LUA/TS 代码导出完善（本轮）

`src/utils/codeExport.ts` 的三语言导出长期只用 `toContain('子串')` 断言，**从未验证产物是否合法**，
因此 9 个缺陷长期漏网（全部经探针实测确认）。新增 `src/utils/codegen/`：
- `identifiers.ts`：`toIdentifier`（净化 + 保字规避 + 重名去重）、`escapeJassString`（`"`→`""`、`\`→`\\`、换行→`\n`）、
  `escapeLuaString`（`"`→`\"`）、`sanitizeLibraryName`。
- `identifiers.test.ts`（29 测）从"转换规则"侧验证；`jassExport.parity.test.ts`（17 测）从"产物合法性"侧验证。

**已修 9 项缺陷**（P0 编译失败 / P1 语法错误 / P2 语义错误）：
1. 锚点 `relativeTo` 原样输出 **frame id**（JASS 无此变量）→ 改为解析成变量名；
   注意 `relativeTo` 可能是 **id 或 name**（`fdfKernelTransformer` L274-281 会转 id，但按名查不到时保留原名，
   编辑器手工工程/测试夹具常写 name），故两者都尝试（`resolveRelativeVar`）。解析不到则**降级为绝对锚点**。
2. 文本未转义双引号 → `escapeJassString` / `escapeLuaString`
3. 纹理反斜杠未转义（`\W` 被当转义序列）→ 同上
4/5. 帧名含空格/连字符/数字开头 → `toIdentifier` 净化
6. 重复帧名重复声明 → 声明去重
7. `libraryName` 未净化 → `sanitizeLibraryName`
8. **子帧先于父帧创建**（父仍 `null`，锚定静默失败）→ `buildFrameOrder` **拓扑排序**（父先子后）
9. `parentId` 悬空直接抛 `Cannot read properties of undefined` → `resolveParentExpr` 降级为 origin frame

**端到端验证**：真实 war3.mpq 抽查 4 个 Glue 屏幕（含 104 帧的 `CampaignMenu`），
产物通过合法性体检（声明名合法 / 引号成对 / 括号成对），无问题。

**注意（行为变更）**：修正了 `codeExport.test.ts` 两处过时断言——LUA 默认纹理现为转义后的
`UI\\Widgets\\...`；TS 相对锚点现为 `this.parent`（原为裸 `parent`，IDE 会报未定义）。

### 代码导出「功能完整性」补齐（本轮）

上一轮修的是"产物不合法"；本轮修的是"**功能没导出**"。审计发现 `ProjectData` 有 **8 个字段
在导出中零引用**（用户在编辑器勾选后导出即静默丢失）：`hideHeroBar / hideMiniMap / hideResources /
hideButtonBar / hidePortrait / hideChat / originMode / appInterface`（只有 `hideGameUI` 被用到）。

**已修 1 处 API 错名（会导致编译失败）**：
- `FrameSetStepSize` → **`FrameSetStepValue`**。依据 openwar3 `compat/lua/japi/dzapi/frame.ts`
  与 Blz 原生 API，只有 `FrameSetStepValue`；本仓库的错名会让每个 SLIDER/SCROLLBAR 的步长调用
  编译失败。三语言（JASS/LUA/TS）同步。

**已接入 6 个隐藏开关 + originMode（`buildHideStatements` / `originFrameExpr`）**：
- 依据 openwar3 `compat/lua/japi/dzapi/frame.ts` 的 origin frame 类型编号：
  `3=HERO_BUTTON`、`8=MINIMAP`、`10=SIMPLE_BUTTON`（上按钮栏）、`13=CHAT_MSG`、`16=PORTRAIT`。
  隐藏方式为 `GetOriginFrame(TYPE, i)` + `FrameSetVisible(..., false)`；英雄栏有 7 个按钮（index 0..6）。
- **`hideResources` 必须按名字隐藏**：openwar3 `compat/frames.ts` 明确注释 `HideOriginFrames(true)`
  **不含**控制台美术、资源栏与黑色 `ConsoleUIBackdrop`（这些只能 `BlzGetFrameByName` 取），
  故走 `GetFrameByName("ResourceBar"/"ConsoleUIBackdrop", 0)`。
- `originMode`：本轮**首次接入**（此前全仓库零引用）。`worldframe` → `ORIGIN_FRAME_SIMPLE_UI`
  （对应 `DzGetSimpleUIParent` 的 `GetOriginFrame(18,0)`），其余 → `ORIGIN_FRAME_GAME_UI`。
  **如实说明**：openwar3 的 dzapi **没有为 consoleui 提供独立的 origin 类型常量**，
  故 `consoleui` 仍以 GAME_UI 为根，其差异只体现在隐藏策略上——这一点已写进测试注释。
- `appInterface`：仍**未接入**（导出语义不明，未见权威依据，不臆造）。

**测试**：`src/utils/codegen/exportFeatures.test.ts`（16 测，先写成 12 个失败用例再修复转绿），
覆盖 API 正确名、6 个隐藏开关在 JASS/LUA/TS 三语言、originMode 三种模式。

**端到端验证**：真实 war3.mpq 两个屏幕 × 三语言（含 104 帧 CampaignMenu）全部通过——
引号/括号成对、无 StepSize 错名、7 个隐藏项全部落地。

### 代码导出「视觉属性」补齐（本轮）

继续补**背景/纹理/可见性/对齐**。审计发现的缺口（全部先写成失败用例确认）：

1. **BACKDROP 背景纹理读错字段**：代码读 `frame.texture`，但 BACKDROP 的背景字段是
   `backdropBackground`——**带背景的 backdrop 全部落到默认值，背景永远不生效**。
   已改 `backdropTextureOf()`（优先 `backdropBackground`，回落 `texture`），三语言同步。
2. **`texCoord` 从未导出**：`DzFrameSetTexCoord(f, left, right, top, bottom)` 收四个数值
   （openwar3 dzapi 确认），此前完全丢弃 → 多纹理 atlas 帧指错区域。已加 `FrameSetTexCoord`。
3. **`visible: false` 从未导出**：编辑器里隐藏的帧在游戏里仍可见。已加 `FrameSetVisible(..., false)`。
4. **`horAlign` / `verAlign` 从未导出**：已映射为 `FrameSetTextAlignment(f, TEXTALIGN_*, TEXTALIGN_*)`
   （left→LEFT / right→RIGHT / start→TOP / flex-end→BOTTOM / 其余→CENTER/MIDDLE）。
5. **三语言行为不一致（端到端发现）**：同一真实 FDF，JASS/LUA 产出 42 个 `FrameSetTexture`，
   而 **TS 产出 0**——TS 用 `if (tex) {...}` 条件包裹，JASS/LUA 则"无纹理回落默认背景"。
   已统一为同一语义（三语言均 42），并加回归用例锁定"三语言数量必须相等"。

**注意（口径澄清）**：`FrameSetTexture` 的第 4 参（fixed-scale）恒为 `true`，**不是平铺开关**；
`backdropTileBackground` 的正解需要不同的 API，本轮**未接入**（未见权威依据，不臆造），
测试只锁定纹理/texCoord/可见性/对齐四项。

**测试**：`src/utils/codegen/exportVisual.test.ts`（12 测，先写成 5 个失败用例再修复转绿）。
**端到端**：真实 `BattleNetTemplates.fdf`(83 帧) 与 `CampaignMenu.fdf`(104 帧) × 三语言全部 OK。

### FDF 导出九宫格边框补齐（本轮）

上面的 `backdropTileBackground` 之所以"未接入"，查证后确认原因：**WC3 根本没有运行时 backdrop API**。
核对 openwar3 的 60 个 Dz 函数清单，其中**没有任何** `FrameSetBackdrop/EdgeFile/CornerFile` 类函数——
backdrop 的边框（EdgeFile/CornerFile/四边/CornerFlags/CornerSize/背景尺寸/内边距/平铺）**全部是 FDF 模板属性**，
只能在 FDF 里声明，运行时改不了。

由此转向修 **FDF 导出**（`src/utils/exportUtils.ts` 的 `generateFrameFDF`）：此前 BACKDROP 分支只输出 2 行且**硬编码**：

```
BackdropBackground "${frame.texture}"          // 字段错（应为 backdropBackground）
BackdropCornerFlags "UL|UR|BL|BR|T|L|B|R"      // 硬编码，覆盖用户设置
```

后果：① 背景读错字段；② **编辑器里设的角标志被硬编码值静默覆盖，永远导不出去**。
现已改为按字段如实导出：`BackdropBackground`(优先 backdropBackground，回落 texture)、
`BackdropEdgeFile`、`BackdropCornerFile`、`BackdropTopFile`/`BottomFile`/`LeftFile`/`RightFile`、
`BackdropCornerFlags`、`BackdropCornerSize`、`BackdropBackgroundSize`、`BackdropBackgroundInsets`、
`BackdropTileBackground`。

**测试**：`exportBackdrop.test.ts`（9 测，先 9/9 全红再修复转绿）；
`exportBackdropRoundtrip.test.ts`（1 测）做**回读验证**——导出的 FDF 交给内核 `parseFdf` 重新解析，
断言字段值一致（不是只看字符串包含）。

> 注意：`exportToFDF` 默认分支会调 `alert()`，在 node 测试环境不存在；测试须传 `onShowAlert` 回调绕过。

### FDF 导出文本/对齐/纹理字段补齐（本轮）

上一轮只修了 BACKDROP。本轮审计 `generateFrameFDF` 的其余分支，发现 4 类问题：

1. **文本引号未转义（最危险）**：`Text "${frame.text}"` 直接插入。
   **探针实测的精确行为**：FDF 里未转义的 `Text "He said "hi""` 让内核 `parseFdf`
   **不抛错**，但把文本**静默截断**成 `He said `（`hi` 丢失）。即产物"看起来能解析"、
   内容却是错的——比直接报错更难发现。已改用 `escapeJassString`（FDF 同样用双写引号）。
   `ButtonText` / `EditTextFrame` 同步修复。
2. **`horAlign` 分支只输出 `FrameFont`**：既没写对齐属性，又把字体名硬编码 `MasterFont`、
   字号错取 `textScale`——用户设的对齐完全丢失。已改为分别输出
   `FontJustificationH`（left→JUSTIFYLEFT / right→JUSTIFYRIGHT / center→JUSTIFYCENTER）
   与 `FrameFont`。
3. **`verAlign` 完全没有导出**。已加 `FontJustificationV`
   （start→JUSTIFYTOP / flex-end→JUSTIFYBOTTOM / center→JUSTIFYMIDDLE）。
4. **纹理属性未导出**：`texCoord` → `TexCoord l, r, t, b`；`alphaMode` → `AlphaMode "..."`；
   `decorateFileNames` → `DecorateFileNames`。均为通用属性，对所有帧类型生效。

**测试**：`exportText.test.ts`（12 测，先 9/10 红再修复转绿）。
引号相关用例**从"不抛错"改为断言"回读后文本不被截断"**——前者会假绿（parser 本就容错）。

### 属性面板接线补齐（本轮，UI→FrameData 环节）

导出链路修完后做系统性比对：`FrameData` 的 backdrop 字段清单 vs 属性面板可编辑字段，
发现 **`backdropCornerFile` / `backdropTopFile` / `backdropBottomFile` / `backdropLeftFile` /
`backdropRightFile` 五个字段在编辑器里没有任何输入控件**——`FrameData→导出`修好了，
但 `UI→FrameData` 缺失，用户根本设不了值，导出修好也用不上。

已在 `TypeSpecificProperties.tsx` 的"边框纹理"之后补 5 个 `FilePath` 输入框
（沿用同 pattern：`value={selectedFrame.X || ''}` + `onChange={handleChange('X', v||undefined)}`）。

**测试**：`src/components/properties/propertiesWiring.test.ts`（13 测）——
**接线守卫（wiring guard）**：因未装 jsdom 无法渲染组件，改用静态断言锁
"全部 13 个可导出 backdrop 字段在面板里都有 value 读取 + onChange 回写"。
这不是行为测试的替代品，而是该约束下的诚实守卫；若将来引入 jsdom，应改为渲染级交互测试。

### 导入往返断裂修复（本轮，fdfImport + fdfLexer 两处）

导出侧修完后审计**导入方向**（`fdfImport`），发现往返链路两端都断：

**断点 1：导入不写回可编辑字段。** `extractBackdropData` 原来只读 3 个属性
（background/edgeFile/cornerFlags），且**只进 `fdfMetadata.fdfBackdrop` 元数据**——
从不写 `frame.backdropBackground` 等字段。后果：**导入带背景的 FDF → 属性面板显示空 →
再导出 → 背景丢失**。现已读取全部 13 个 backdrop 属性（含新增的 cornerFile/四边/尺寸/
内边距/平铺/混合），并同时写回可编辑字段 + 保留元数据（既有测试不破坏）。
`FontJustificationH/V` 逆映射为 `horAlign/verAlign`（未知常量不写回，不臆造）。

**断点 2（端到端探针抓到的更深 bug）：旧 lexer 不支持双写引号转义。**
单独测导出（产物正确）与单独测导入（mock AST）都绿，但把 `exportToFDF` 真实产物喂给
`importFromFDFText` 时文本仍被截断。探针定案：`fdfKernelParser` 正确处理 `""` → 三段，
而旧 `FDFLexer.readString` 的循环条件 `while (current !== quote)` **在第一个 " 就终止**，
把 FDF 双写转义 `""` 误判为字符串结束。修复要点：双写检测必须放在循环**条件之后、
退出判断之前**——我第一次把检测写进循环体，被 while 条件先拦住，探针仍显示旧结果，
第二次才修对。现 `while (current)` + 循环内先判双写再判真结束引号，
`"He said ""hi"""` 正确解析为 `He said "hi"`（与内核 parser 语义一致）。

**教训**：各环节独立测试全绿 ≠ 链路通。**端到端往返测试（导出产物→真 parser→字段比对）
是唯一能抓住这类断裂的守卫**（`fullRoundtrip.test.ts`，2 测，不 mock parser）。

**测试**：`fdfImportRoundtrip.test.ts`（27 测，先 15/16 红）+ `fullRoundtrip.test.ts`（2 测）。
覆盖率中途跌至 99.47%，按未覆盖分支逐一补真实用例（布尔大小写变体、非法四元组、
未知 JUSTIFY 常量）恢复 100，无 v8-ignore。

### war3ProcessManager 进程管理审计（本轮，修复恢复策略脆弱耦合）

进程管理器（224 行，27 测）审计发现 **1 处脆弱耦合**：
`isCurrentProcessRunning` 只查内存 `currentPid`，而 `getCurrentPid` 有
localStorage 恢复副作用——当前调用链（projectStore 自动导出）恰好**先调
getCurrentPid** 才正确工作。单独调用 `isCurrentProcessRunning`（如未来新
调用点）会漏掉 localStorage 中已记录的 PID 而误报"未运行"。

**修复**：`isCurrentProcessRunning` 统一改用 `getCurrentPid()`（内存+存储恢复），
行为对现有调用链不变，消除隐式时序依赖。测试扩到 28 测（单独调用从
localStorage 恢复并正确查询）。

其余审计结论：killCurrentProcess 三级降级（普通权限→UAC 提升→进程名兜底）
语义正确；UAC 取消后清理记录导致后续降级为"结束所有进程"——可用性降级
非正确性问题，如实记录。
### 导入链路历史轮次（L401-L461 原始记录压缩，结论仍全部有效）

「导入写回扩展/索引错位、textColor、textScale、visible/ButtonText 往返」四段历史
审计的**最终结论**（细节见 git 历史 e2c 前后各轮提交与对应测试文件）：
- 导入全部字段**真写回**（text/texture/texCoord/alphaMode/textColor/textScale/
  ButtonText），元数据仅作附加保留；undefined/空串不覆盖陷阱已用测试锁定
- 属性名不匹配类断裂（导出名≠导入查找名）已全部兼容 `Text|SetText`、
  `FrameFont|SetFontSize` 两种风格——**教训**：mock AST 测试永远抓不到这类断裂，
  只有端到端穿透（`fullRoundtrip.test.ts`）能抓
- `visible` 无 FDF 模板属性（运行时 API 职责）——不臆造，如实边界
### 编辑字段 ↔ 导出/导入全对账（多轮结论归并）

对 war3.mpq 全量 FDF 属性名扫描实证后完成全部对账：**Control/Highlight/Font 系 13 字段**（ControlBackdrop 89 次/
ControlDisabledBackdrop 48/Pushed 26/MouseOver 18/DisabledPushed 2/Style 19——值为模板名；HighlightType 40/
HighlightAlphaFile·Mode 各 36；FontShadowColor·Offset 各 34/FontHighlightColor 31/FontDisabledColor 28——颜色四数值/
ButtonPushedTextOffset 10 双数值/EditCursorColor 4 三数值无 alpha）接入 FDF 导出+真写回（enhanceFrameWithFDF
controlFields，asNumArray 形状校验，undefined/空串不覆盖）；**SLIDER 系 4 字段**（SliderMinValue/MaxValue/
InitialValue/StepSize 各 13 次）+ **模板引用 3 字段**（SliderThumbButtonFrame/ScrollBarInc·DecButtonFrame）闭环导出+导入
（minValue=0 用 !== null && !isNaN 防 falsy 丢弃）；**EditBox**：EditCursorColor 三数值接入（alpha 按语法丢弃）、
EditBorderSize 是数值非颜色（editBorderColor 无对应模板属性不输出）、editTextColor 无属性不输出；**FrameFont**：
frame.text 存在即输出（不再要求 horAlign/textScale），字体名 frame.font || 'MasterFont'；**剩余字段收口**：alpha/
checked/sliderLayout* 无模板属性（运行时 API 职责）、locked/isRelative/layerStyle 编辑器元数据合理不导出、
fontFlags 无语法依据、textureFile 与 texture 重复——**无遗留"能设但导不出"未查证项**。运行时链路（luaGenerator/
codeExport）对 Control/Font 系零引用是语义正确（模板名唯一表达渠道是 FDF 模板导出）。appInterface 经查证 WC3 FDF
语法不存在（72 文件 0 次）/openwar3 无此概念——建模自造字段，是否删除属产品决策（涉及类型/store/测试多处）。

### luaGenerator 导出链路补齐（本轮）

审计发现 `src/utils/luaGenerator.ts`（33KB，`codeExport` 之外的**另一条独立导出链路**）有 4 类问题：

1. **texCoord 参数顺序错**：`frame.texCoord` 定义为 `[left, right, top, bottom]`，但产物写成
   `API.SetTexCoord(frame, left, top, right, bottom)` —— **`right`/`top` 互换，纹理区域裁错**。
   引擎 `DzFrameSetTexCoord(f, l, r, t, b)` 要求 right 在 top 之前（openwar3 dzapi 确认）。
   已修：API 包装形参与调用点都改成 `(left, right, top, bottom)`。
   **既有测试 `luaGenerator.test.ts` 曾把错误顺序当成期望值**（输入 `[0,32,16,48]` 却断言
   `(0, 16, 32, 48)`），已同步更正为 `(0, 32, 16, 48)`。
2. **Reforged 分支的 `SetTexCoord` 是空壳**：函数体只 `print("...可能不支持")`、**不设置任何值**，
   即 Reforged 下 texCoord 完全失效。已改为真正调用 `BlzFrameSetTexCoord(frame, l, r, t, b)`。
3. **6 个隐藏开关 + hideGameUI 全未接入**。已补 `generateHideOriginCode()`：
   `GetOriginFrame(TYPE,i)` + `ShowFrame(...,false)`；英雄栏 7 个按钮；
   `hideResources` 按名字取 `ResourceBar`/`ConsoleUIBackdrop`（`HideOriginFrames` 不覆盖）。
4. **文本对齐未接入**。已按 `horAlign/verAlign` → `TEXTALIGN_*` 输出 `SetTextAlignment`。

配套补齐 loader 包装（此前 loader 里没有这些函数）：`API.GetOriginFrame` / `API.GetFrameByName` /
`API.HideOriginFrames` / `API.SetTextAlignment`，japi 分支与 Reforged 分支各一套。

**如实说明（不臆造）**：`alphaMode` **无法在运行时设置**——`DzFrameSetTexture` 只有
`(frame, path, texCoord, fixedScale)` 四个参数，没有任何 alphaMode 接口；它属 FDF 模板属性，
由 FDF 导出承担。测试只断言"产物不得伪装成支持"（不生成不存在的 `SetAlphaMode`）。

**测试**：`luaGenerator.guard.test.ts`（16 测，先 11/12 红再修复转绿）。
注意 `generate()` 只产出 Frame 创建代码，API 包装在 `generateLoaderScript()` 里——两者需分开断言。

### 画布交互几何与渲染器单测（历史归并，rounds 30-33 结论）

- useCanvasDrag/useCanvasResize 纯几何抽到 frameTransforms.ts（22 测；n 只改高度、s 改 y+高度语义已钉死）；
  round 83 起 useCanvasPan（canvasViewTransforms 7 测）、useHotReloadSync（hotReloadLua 8 测）同模式抽取，
  **6 hook 测试缺口清零**（useTextureLoader 已删、useKeyboardShortcuts 纯事件分发）。
- 渲染器：ShaderLib 23 测（材质映射/alphaMode 含 DISABLE/UV/纹理所有权——updateMaterial 不释放 Cache 拥有的纹理，
  managedTexture 机制已删；AlphaMode DISABLE 经 IDA 0x6f09b8a0 取证为引擎合法值并接入三解析点）+ TextureCache 7 测 + 所有权集成 2 测。
  SceneGraphManager 无直接单测（需真实 GPU），可确定性部分由 pixelSnap/ShaderLib 覆盖，GPU 光栅在 psnr t1/t2/t4 验证。

### 编辑器命令层测试（`src/commands`，当前目标「编辑器端单测 + 完整编辑功能」）
- 命令层 `src/commands/*.ts`（20 个命令类）不在覆盖率门 `include`（`src/utils/**`）内，不要求 100%，
  但作为编辑器真实编辑操作（对齐/统一尺寸/z 序/复制/帧 CRUD 的 undo-redo）需行为级覆盖。
- 已新增 4 个测试文件 + 1 个共享构造：
  - `src/commands/FrameCommands.test.ts`（17 测）、`src/commands/AlignCommands.test.ts`（23 测）、
    `src/commands/DuplicateZIndexSize.test.ts`（17 测）、`src/commands/ArrayCommands.test.ts`（9 测）；
  - `src/commands/__test_helpers__.ts`：`makeTestFrame/makeTestFrameFixed/makeTestProject` 复用构造。
- 每个测试文件必须沿用 `uiStore.test.ts` 头部：`vi.mock('../utils/hotReloadExporter')` +
  `vi.mock('../utils/war3ProcessManager')` + `vi.stubGlobal('localStorage', ...)`（projectStore 底部 subscribe
  在 setTimeout 里访问 localStorage/进程管理器）。
- `beforeEach` 顺序须为「先 reset UI 状态，再 seed project」，否则 seed 的 project 会被 reset 覆盖（已踩坑修正）。

### projectStore 测试补齐（本轮，抓到真实崩溃缺陷）

`src/store/projectStore.ts`（20KB 编辑器核心）此前**无专属测试**（uiStore.test.ts
只间接引用）。已补 `projectStore.test.ts`（8 测）：addFrame/addFrames（含 rootFrameIds
更新）、updateFrame 局部合并、getFrame、toggleFrameLock/Visibility、removeFrame、
updateGeneralSettings。mock 头部照抄 uiStore.test.ts（stubGlobal 必须在 import 前）。

**已修真实崩溃缺陷**：`removeFrame` 假设 `frame.children` 恒存在（`frame.children.forEach`），
删除无 `children` 字段的帧（**导入 FDF 的帧常缺该字段**）直接抛 TypeError。
已改 `(frame.children ?? [])`。既有命令层测试没抓到它，因为 `__test_helpers__` 构造的
帧都带 children——**只有补齐"最小帧"用例才暴露**（又一次"测试夹具比产品更完整"的教训）。

**横向排查（续本轮）：同款缺陷共 5 处，全部修复**。`children` 可选字段的
无防护访问遍及 addFrame（`[...parentFrame.children, id]`）、addFrames
（`.includes` + spread）、updateFrame（parentId 变更的旧/新父两侧 `.filter`/spread）、
deleteFrame（`.filter`）——**导入 FDF 后任何涉及父子关系的编辑操作都可能崩溃**。
测试扩到 10 测（先 2/10 红）：addFrame 到无 children 父帧、addFrames 父子同批导入。
防护模式统一为 `(parentFrame.children ?? [])`。

**数组编辑器补测（续本轮）**：tableArray/circleArray/guide/stylePreset 的
增改删与清空（6 测，行为全部正常——数组编辑器无 children 同款缺陷）；
applyStylePreset 样式合并（含"非目标帧不受影响"与"未知 presetId no-op"2 测）；
saveFrameAsPreset 样式捕获（含未知帧 no-op）；group 增改删与成员去重；
setRace/loadWar3Skins（种族纹理切换：loadWar3Skins 存储、setRace 按键名/路径反查
换纹理且无关纹理不动、未加载 skins 时 no-op——mock `war3SkinsParser` 控制动态 import）。
`projectStore.test.ts` 现共 **22 测**。store 层全部 action 有行为测试。

### commandStore 审计（本轮）

`src/store/commandStore.ts`（undo/redo 栈）逻辑核查：execute 先执行后入栈 ✓、
undo 后新 execute 清空 redo（分支语义）✓、空栈 no-op ✓——语义正确。

**已修 1 缺陷**：undoStack **无上限**——长期编辑无限增长（命令闭包持有旧 state，
泄漏风险）。已加 `MAX_UNDO_HISTORY = 100`，最旧出栈（行业标准量级）。

**测试**：`src/store/commandStore.test.ts`（7 测，先 1/7 红）——含分支语义、
往返恢复、上限三条此前无覆盖的行为。commandStore 是纯 zustand store，
不依赖 projectStore/hotReloadExporter，**无需** uiStore.test.ts 那套 mock 头部。

---

## 3. 覆盖率 100% 的执行规则（诚实原则）

实现「真 100%」的方式，禁止刷分。

1. **禁止**用 `v8 ignore` 之类的全局抹除来伪造覆盖（blanket faking / `v8 ignore file`）。
2. 优先**补真实测试**去触达分支，而不是忽略。凡是「正常 FDF 语法 / 真实语义」可达的分支，一律写测试。
3. `v8 ignore`（块级 `/* v8 ignore start -- reason */ ... /* v8 ignore end */` 优先，因为它能抑制**分支**）**仅**用于被证明**结构性不可达**的分支，且必须**为每个忽略点写一行具体理由**（说明调用点不变式 / 语法约束 / 互斥逻辑）。
   - 注意：单行 `// v8 ignore next` 只抑制 statement/line，**不**抑制 branch；要抑制分支必须用块级形式，且 `start` 要放在构造体之前、`end` 放在其闭合 `}` 之后。
4. 判定分支是否可达，用**实证**（probe 测试 / 探针输入）而非猜测；一个 malformed-but-tolerated 的输入若能真的走到分支，就在测试里覆盖它。

### 命令速查（scoped 覆盖率）
```bash
# 单文件作用域（作参考排查用，非权威；权威看全量 npm run test:coverage）
node node_modules/vitest/vitest.mjs run tests/fdfKernel/transformer.test.ts \
  --coverage --coverage.include="src/utils/fdfKernelTransformer.ts" \
  --coverage.reporter=text
```

### 已用 v8-ignore 的位置（全部带理由，改动前先审视是否仍成立）
- `exportUtils.ts` L181（`generateAnchorFDF` 恒返回 SetPoint 串）、L274 整块（`project` 入参非可选，恒真）。
- `fdfKernelScene.ts`：L44 `CANVAS_POINT` 全键已定义；L107 锚点首参恒为点名；L135/138/139/142/153/186 等系调用点不变式或布局终值非 NaN、`FdfLibrary.resolve` 恒非空。
- `fdfKernelTransformer.ts` L204：`anchor` 的 `vals[0] ?? ''` 与 `aNum(args[1])` 互斥——若 args 全空可触发此回落，但 args 空会让 `aNum(args[1])` 对 undefined 读 `.n` 先崩溃，故正常路径该分支不可达。

> 新增 v8-ignore 前，先在这里记下新位置与理由；若某忽略点后来被证明可达，应改回真实测试。

---

## 4. 内核（fdfKernel）规范

- 内核文件：`src/utils/fdfKernel{Types,Parser,Transformer,Library,Layout,Scene}.ts`（`fdfKernelTypes.ts` 仅类型定义，无运行时代码，可安全排除在覆盖率统计外）。
- 内核测试：`tests/fdfKernel/`、`src/utils/*.test.ts`。
- 与参考实现（openwar3，只读）保持契约一致：`Arg` 类型 `{ s, n, str }`、FrameData 结构、锚点语义与坐标映射都需与参考逐步对齐。
- 干净的等价抓手（green guard）：`91/91` BLP 逐字节一致、世界矩形→像素矩形一致、render PSNR 收敛。改动内核/渲染/桥接时不得破坏这些对拍。

### 4.1 语义仲裁优先级（**遇到不确定一律按此办理**）

排序：**① WC3 引擎真机行为（IDA 反汇编）> ② openwar3 实现 > ③ 本仓库现有实现**。
当三者冲突时以高优先级为准，并同步更新本文件与守卫测试。

**凡遇到"某处语义不确定"的问题，必须做 IDA 取证，不得靠猜、不得靠"两种都合理"含糊过去。**

- 反汇编数据库：`d:/tools/dump/war3/Game.dll.i64`（imagebase `0x6f000000`）。
  用 IDA MCP 打开：`idb_open`（`mode=prefer_headless`），随后用
  `decompile` / `disasm` / `xrefs_to` / `find_regex` / `get_bytes` 分析。
- 取证步骤（按序）：
  1. 先找字符串/常量定位（`find_regex` 搜点名如 `SetPoint`、`TOPRIGHT`、`CENTER`），再 `xrefs_to` 到代码。
  2. 对定位到的函数 `decompile`，读真实控制流与浮点常量（如 `0.5`、`0.333`、`1.0`）。
  3. 把结论落成**测试断言**（如 `singleanchor.openwar3.test.ts` 那样逐点锁定），而不是只写注释。
  4. 若 IDA 结论与 openwar3 不同，以 IDA 为准，并在此处记录差异与地址。
- 记录要求：每次 IDA 取证都要在提交信息与本节写下**函数地址/字符串地址 + 结论**，便于复核。

---

## 5. 提交（Git）约定

- 分支：`main`。
- 提交信息用中文、`fix:`/`feat:`/`chore:`/`test:`/`docs:` 前缀，参考历史如：
  `fix(parser): respect explicit SetPoint over SetAllPoints`
  `feat(renderer): ...`、`test(fdfKernel): ...`
- **提交前**：跑一遍第 2 节门禁；并把本文件的「覆盖基线/规则/ignore 清单」校对为当前事实。
- 有大量未跟踪的临时排查产物（`coverage/`、`.covtmp*`、`cov*`、`_covinspect*`、`_g.txt`、`.coverage-arm-finder.mjs` 等）时，先确认不被误提交（有 `.gitignore` 就落实，否则下一条）。
- `.class`/临时文件、`node_modules`、`coverage/` 等不得进入提交。

---

## 6. 维护本文件

每次迭代需要做的事情，按顺序：
1. 改动源码/测试后，先过第 2 节门禁。
2. **更新本文件**里因本次改动而变化的：
   - 覆盖基线数字（全量 `npm run test:coverage` 结果）
   - v8-ignore 清单（新增/删除/理由变化）
   - 命令、路径、里程碑状态
3. 提交前用 `git status` 确认无遗漏/无误提交，然后提交并更新提交说明。

---

## 7. 命令回顾

| 目的 | 命令 |
|---|---|
| 单测全绿 | `npm run test` |
| 全量覆盖率（权威） | `npm run test:coverage` |
| 内核 + 参考对拍回归 | `node node_modules/vitest/vitest.mjs run tests/fdfKernel tests/ow3compare` |
| 类型检查 | `npx tsc --noEmit`（源码须 0 报错） |
| 浏览器 PSNR（守护） | `tests/ow3compare/browser/`（psnr.mjs/node） |