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
  `parseFDF()` 默认分支 + `fdfImport.ts`/`fdfIncludeResolver.ts` 供编辑器直接 API / 模板继承 / 导出往返使用，刻意保留旧 transformer（"阶段 E 收尾"按现状记录），
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
4. **类型检查**：`npx tsc --noEmit`。**源码（src，非 `*.test.ts`）必须 0 报错**。测试文件的既有松散类型报错可暂缓，但新增代码不得引入新的错误。

最新全量基线：
- `116 passed | 2 skipped` 测试文件，`2037 passed | 5 skipped` 测试
- 内核/对拍：`18 passed | 2 skipped` 文件，`444 passed | 5 skipped` 测试（含真实数据往返守卫）
- `All files` 覆盖：`100 / 100 / 100 / 100`

### AnchorEditor 接线守卫（本轮）

`AnchorEditor`（锚点编辑器——SetPoint/FramePoint 9 点是内核对拍语义的编辑入口）
此前无任何测试。接线守卫转正：

**测试**：`src/components/properties/anchorEditorWiring.test.ts`（6 测）——
9 个 FramePoint 选项齐全（内核对拍语义的编辑入口）、所有修改走不可变数组更新 +
`handleChange('anchors', …)` 单出口（≥4 处回写）、`createDefaultAnchors` 兜底、
`detectAnchorConflicts` 冲突检测被消费、删除走 `filter` 不可变操作。
现状正确（6/6 一次通过），守卫锁定防止回归。

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

### 导入写回扩展 + 索引错位修复（本轮，续）

上轮修复后端到端探针继续深挖，又抓到 3 处：

1. **文本/纹理同样只进元数据**：`SetText/SetTexture/SetTexCoord/SetAlphaMode` 只存
   `fdfString`/`fdfTexture` 元数据，不写 `frame.text/texture/texCoord/alphaMode`。
   已写回（`SetText` 直接读属性而非元数据——空串在元数据里会被 falsy 过滤成 undefined，
   编辑器需要保留「导入了空文本」的语义）。`exportUtils` 的 BACKDROP 分支补写
   `SetTexture`（有效背景，backdropBackground 优先），使 `texture` 字段可往返。
2. **`undefined` 覆盖陷阱**：写回 `backdropFields` 时 `undefined` 字段会抹掉 transformer
   已解析的值（如无值属性 `BackdropTileBackground` → transformer 解析为 `true`，
   被我的 `undefined` 覆盖丢失）。已改为过滤 `undefined` 再展开。
3. **`body[index]` 索引错位（本轮最重要的发现）**：产物头部有 `Include` 行，
   AST `body[0]` 是 Include 节点，而 `importFromFDFEnhanced`/`importFromFDFText` 用
   `frames[index] ↔ body[index]` 对齐——**Include 让全部增强（含元数据）被跳过**。
   旧实现下所有真实导入其实都没走到 enhance！已改为按 `FrameDefinition` 序号对齐。
   既有测试 "maps frame to ast body beyond first element" **把错位行为当成了期望**
   （与 luaGenerator 的 texCoord 同款"测试认证 bug"），已更正。

**测试**：`fdfImportText.test.ts`（8 测，先 5/8 红）；
`fullRoundtrip.test.ts` 扩到 3 测（backdrop/文本/纹理全字段穿透）。
注意：`SetTexture` 导出的是**有效背景**（backdropBackground 优先于 texture），
往返后 `texture === 有效背景` 是预期语义，不是丢失。

### textColor 往返 + 属性名不匹配修复（本轮，续 2）

1. **textColor 三断链**：属性面板可设（TextProperties 有绑定）→ FDF 导出**零引用** →
   导入也不读。已修：导出按 WC3 语义把颜色内嵌进 `Text`（`|cffRRGGBB...|r`，与 codeExport
   的 JASS 编码一致，无独立模板属性）；导入剥离还原为 `text + textColor`
   （前缀不完整时原样保留，不臆造）。
2. **属性名不匹配（探针抓到的又一层断裂）**：导出写的属性名是 **`Text`**（模板属性），
   导入查找的却是 **`SetText`**（运行时调用风格）——名字不匹配使真实产物的剥离从未生效；
   mock 测试手写 `SetText` 掩盖了断裂。已兼容查找两种名字。

**教训（第二次验证）**：mock AST 的导入测试永远无法发现"属性名对不上"这类断裂，
只有端到端穿透（`fullRoundtrip.test.ts`，现 4 测）能抓到。

**测试**：`fdfImportColor.test.ts`（4 测，先 2/4 红）+ fullRoundtrip 颜色穿透用例。

### textScale 经 FrameFont 往返（本轮，续 3）

同款名字断裂：导出写 `FrameFont "MasterFont", size, ""`（第 2 参为字号），导入只查
`SetFont`/`SetFontSize`——textScale 在真实链路上无法往返。已修：`FrameFont` 第 2 参
（数值）优先写回 `textScale`，回落 `SetFontSize`（运行时风格仍支持）；非数组/参数不足/
字号非数值时**不设置**（不臆造）。

**测试**：`fdfImportFont.test.ts`（5 测，先 2/5 红）+ fullRoundtrip textScale 穿透用例
（5 测）。端到端一次通过——导出侧 `FrameFont` 名字本就与导入查找匹配。

### visible 语义边界 + ButtonText/EditTextFrame 往返（本轮，续 4）

1. **`visible` 的诚实边界（查证后不加戏）**：核对 openwar3，`Visible` 只存在于运行时
   API（`BlzFrameSetVisible`），**FDF 模板语法没有可见性属性**——模板定义的帧默认可见。
   故 FDF 导出不写 visible 是**正确现状**（无处安放），可见性导出的职责属于 codeExport
   （已写 `FrameSetVisible`）。如实记录，不臆造模板属性。
2. **ButtonText / EditTextFrame 往返断裂**：导出侧按钮/编辑框的文本以 `ButtonText` /
   `EditTextFrame` 承载（数据源都是 `frame.text`），导入只查 `SetText`/`Text`——
   按钮文本往返丢失。已纳入文本源链（颜色剥离同款处理）。

**测试**：`fdfImportText.test.ts` 扩到 11 测（先 3/11 红）；
`fullRoundtrip.test.ts` 扩到 **6 测**（新增按钮文本穿透）。

### Control/Highlight/Font 系导出（本轮，真实语法实证接入）

系统性反向审计：属性面板可编辑的 **25 个字段**在 FDF/JASS 导出中零引用——"能设但导不出"
的同款断裂，规模比 backdrop 更大。按 §4.1 查证：对 war3.mpq 全量 FDF 属性名扫描，
**实证拿到真实语法**（出现次数即真实写法）：

- `ControlBackdrop` 89 次、`ControlDisabledBackdrop` 48、`ControlPushedBackdrop` 26、
  `ControlMouseOverHighlight` 18、`ControlDisabledPushedBackdrop` 2、`ControlStyle` 19
  —— 值为**模板名**（如 "AdvancedPopupMenuBackdrop"），非文件路径
- `HighlightType` 40、`HighlightAlphaFile` 36、`HighlightAlphaMode` 36
- `FontShadowColor` 34、`FontShadowOffset` 34、`FontHighlightColor` 31、`FontDisabledColor` 28
  —— 颜色为**四数值空格分隔**（`0.0 0.0 0.0 0.9`）
- `ButtonPushedTextOffset` 10（双数值）
- `EditCursorColor` 4（本轮未接，留待下轮查参数格式）

已接入其中 **13 个字段**的 FDF 导出（通用属性段，对所有帧类型生效）。
**如实记录未接入项**（真实 FDF 中无对应模板属性，不臆造）：`tooltip`（运行时
`DzFrameSetTooltip`）、`listBoxItems`、`multiline`、`maxChars`、`backgroundArt`（模型子帧，
需嵌套定义）、`cameraYaw/Pitch/Distance`（相机字段非 FDF 属性）。

**测试**：`exportControlProps.test.ts`（11 测，先 10/11 红）。

### EditBox 颜色系查证（本轮，续）

同款真实语法扫描（放宽 Edit*/TextColor 模式），实证结果**与编辑器字段语义有出入**：

- `EditCursorColor` 4 次：**三数值**（`1.0 1.0 1.0`，语法无 alpha）→ 已接入，
  `editCursorColor` 第 4 分量（alpha）按语法丢弃（如实记录）
- 真实语法是 `EditBorderSize`（数值，如 0.009）而**非颜色**——编辑器的
  `editBorderColor` 字段没有对应模板属性，**如实不输出**；若要支持需先加
  `editBorderSize` 字段 + UI（另行决策，本轮不加）
- `editTextColor`：真实 FDF **无 EditTextColor** 属性（EditBox 文本颜色由子
  TEXT 帧字体处理），**如实不输出**

**测试**：`exportControlProps.test.ts` 扩到 13 测（先 1/13 红；
editTextColor/editBorderColor 的"不输出"断言天然通过——现状正确）。

### appInterface 查证（本轮：字段本身无引擎语义）

之前多轮记录的"`appInterface` 未接入（语义不明，不臆造）"本轮彻底查证：

- **war3.mpq 全部 72 个 FDF/TOC 文件中 `AppInterface` 出现 0 次**——它在 WC3
  FDF 语法中不存在
- openwar3 全仓库亦无此概念
- 本仓库现状：类型有定义、store 初始为 `''`、`updateGeneralSettings` 的 Pick
  白名单**不含它**、无 UI 控件、导出导入均零引用——即**全链路断**

结论：它不是"未接入的功能"，而是**建模时自造、无可接入引擎语义的字段**。
按诚实原则如实记录；是否删除字段属产品决策（涉及类型/store/测试多处与存档兼容性），
本轮不动代码。若未来确认删除，需同步移除 `updateGeneralSettings` 白名单核对项。

### SLIDER 系 FDF 导出（本轮，真实语法实证）

核对 FDF 导出（`exportUtils`）的 SLIDER 帧：**只输出类型名**，
`minValue/maxValue/sliderInitialValue/stepSize` 四字段全丢（codeExport 运行时侧早已写
`FrameSetMinMaxValue`/`FrameSetStepValue`，FDF 侧缺失）。真实语法扫描实证：

- `SliderMinValue` 13 次、`SliderMaxValue` 13 次、`SliderInitialValue` 13 次、
  `SliderStepSize` 13 次（数值型）
- **注意**：FDF 模板名是 `SliderStepSize` —— 与运行时 API `FrameSetStepValue`
  **不同名但并存**，不矛盾（前者是模板属性，后者是运行时调用；之前修正的是后者）
- 另实证 `SliderThumbButtonFrame` / `ScrollBarIncButtonFrame` / `ScrollBarDecButtonFrame`
  （模板引用型，对应 FrameData 的 *Ref 字段，本轮未接——需模板依赖排序，另行处理）

已接入 4 字段的 FDF 导出（`!== undefined` 判断，0 值也会如实输出）。
**测试**：`exportControlProps.test.ts` 扩到 15 测（先 1/15 红；含"未设置不输出"用例）。

### SLIDER 系导入写回（本轮，闭环）

`enhanceFrameWithFDF` 补 `SliderMinValue/MaxValue/InitialValue/StepSize` 四字段写回
（与导出互逆）。**关键点**：数值用 `!== null && !isNaN` 判断——`minValue=0` 是合法值，
不得按 falsy 丢弃（与之前 `BackdropTileBackground` 的 undefined 覆盖陷阱同类教训）。

**测试**：`fdfImportRoundtrip.test.ts` 扩到 42 测（先 3/42 红，含 0 值用例）；
`fullRoundtrip.test.ts` 扩到 **8 测**（新增 SLIDER 穿透，断言 `minValue === 0` 原样回来）。

### SLIDER/ScrollBar 模板引用型导出+导入（本轮，闭环）

`SliderThumbButtonFrame` / `ScrollBarIncButtonFrame` / `ScrollBarDecButtonFrame`
三字段闭环（导出+导入写回）。**修正此前判断**："需模板依赖排序"实属过度谨慎——
`ControlBackdrop` 也是模板名引用，已照实输出；引用解析由引擎按名处理，
引用找不到属用户数据问题，导出侧照实输出引用名字符串即可。

**测试**：`exportControlProps.test.ts` 扩到 18 测（先 2/18 红）；
`fdfImportRoundtrip.test.ts` 扩到 43 测（含三字段写回断言）。

### FrameFont 修复（本轮：字体硬编码 + 输出条件双重缺口）

对账编辑字段全集 vs FDF 导出，发现 `frame.font`（用户选择的字体名）被
`FrameFont "MasterFont"` **硬编码忽略**。修用例时暴露第二层缺口：
FrameFont 原输出条件是 `horAlign/textScale 存在`——**只有文本、无对齐的文本帧
根本没有 FrameFont**，真实引擎可能不渲染文本。

已修：`frame.text` 存在即输出 FrameFont；字体名用 `frame.font || 'MasterFont'`。
**测试**：`exportText.test.ts` 扩到 14 测（先 2/14 红——两条失败分别锁定两个缺口）。

### 剩余编辑字段的真实语法查证（本轮，收口）

对账后剩余未导出的编辑字段，经 war3.mpq 全量扫描实证：
- `alpha` / `checked` / `sliderLayoutHorizontal` / `sliderLayoutVertical`：
  真实 FDF 中**无对应模板属性**（AlphaMode 是纹理属性非帧属性）——运行时 API 职责，
  如实记录不臆造
- `locked` / `isRelative` / `layerStyle`：编辑器元数据，非 FDF 属性——合理不导出
- `fontFlags`：真实语法未见（`SetFontFlags` 是运行时调用），如实记录
- `textureFile`：与 `texture` 语义重复（导出侧已走 `texture`），非缺口

至此编辑字段 ↔ FDF 导出的对账**全部有结论**：可导出的全部接入，
无语法依据的如实记录，无遗留"能设但导不出"的未查证项。

### Control/Font 系导入写回（本轮，收口）

上轮如实记录的"只进元数据"口径升级为**真写回**（backdrop 同款处理）：
`enhanceFrameWithFDF` 新增 `controlFields` 映射——

- 8 个字符串字段（ControlBackdrop/Pushed/Disabled/MouseOver/Style、Highlight 三系）直写
- 6 个数值数组字段（FontHighlightColor/DisabledColor/ShadowColor 四元、
  FontShadowOffset/ButtonPushedTextOffset 二元、EditCursorColor 三元）经 `asNumArray`
  形状校验（长度不符/非数值不设置，不臆造）
- undefined/空串不覆盖（陷阱同前）；`rawProperties` 元数据同时保留

**测试**：`fdfImportRoundtrip.test.ts` 扩到 39 测（先 12/39 红）；
`fullRoundtrip.test.ts` Control/Font 穿透用例口径**升级为断言真写回**
（text/数值往返值逐项比对），7/7 通过。属性面板现可显示这批属性的导入值。

### 运行时链路对 Control/Font 系的覆盖查证（本轮，收口）

核对 `luaGenerator` 与 `codeExport`（两条运行时链路）对 14 个新接入字段的处理：
**全部零引用——且这是语义正确，不是缺陷**。证据链：

- ControlBackdrop 系值为**模板名**，运行时无 `SetControlBackdrop` 类 API
  （模板引用靠 `BlzCreateFrame(templateName, ...)` 创建，模板本身在 FDF 里声明）
- dzapi 60 函数与 Blz 原生集（`src/compat/prelude.ts`）均无
  Shadow/CursorColor/HighlightAlpha 类 native
- 结论：这批属性**唯一表达渠道就是 FDF 模板导出**（已接入）；运行时链路
  不写它们是正确现状。如实记录，防止未来误当缺口"补齐"出不存在的 API 调用。

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

### 画布交互几何抽纯函数（本轮）

审计 `src/hooks/` 发现 **6 个 hook 全部没有测试**（`useCanvasDrag` / `useCanvasPan` /
`useCanvasResize` / `useHotReloadSync` / `useKeyboardShortcuts` / `useTextureLoader`）。
它们依赖 React hooks，而本仓库**未安装 jsdom / happy-dom / @testing-library**，
无法渲染 hook 做单测。

因此把 `useCanvasDrag` / `useCanvasResize` 里重复内联的**纯几何计算**抽到
`src/utils/frameTransforms.ts`（可单测，两块逻辑合并去重）：
- `clampRectToCanvas`：钳制到 0..0.8 / 0..0.6，最小尺寸 0.01，且尺寸收紧后起点再钳一次
- `snapRect` / `computeDragRect` / `computeResizeRect`（含 Shift 保比例）

**关键约束：语义必须严格对齐原 hook，不得反转。** 抽取时我一度把 n/s 方向做成
"n 改 y+高度、s 只改高度"，与 `useCanvasResize` 现有实现**正好相反**；已按原实现改为
"n 只改高度、s 改 y+高度（保持上边不动）"，并在测试里钉死这两条。

两个 hook 现分别调用 `computeDragRect` / `computeResizeRect`，行为不变（全量测试 1885 绿）。
**注意**：`useKeyboardShortcuts` 经核查每个分支都调用了 `preventDefault` 并忽略输入框内按键，
行为正确，但因其纯属事件分发、无独立几何逻辑，本轮未抽函数。

**测试**：`src/utils/frameTransforms.test.ts`（22 测）。
`useCanvasPan` / `useHotReloadSync` / `useTextureLoader` 仍无测试——它们以 DOM/IO 副作用为主，
无 DOM 环境时无法诚实覆盖，如实记录为缺口。

### 渲染器单测缺口补齐（本轮）

审计 `src/renderer` 全部模块后发现：`backdropLayout / buttonState / highlightColor / highlightType /
editBoxBorder / hitTest / layerStyle / fontResolver / textLayout / backdropBlend / backdropSplitEdges /
pixelSnap / popupMenuVisibility / constants` **均已有测试**，唯独 `ShaderLib` 与 `TextureCache` 没有
（此前 `psnr.real.test.ts` 只是间接用了 `TextureCache` 实例，未对其行为断言）。已补：
- `tests/visual-regression/shaderLib.test.ts`（23 测）：材质映射（基色/NOSHADING/alpha 归一化/钳制）、
  alphaMode → alphaTest 与混合（BLEND vs ADD 的差异在 `blendDst`）、DISABLE 语义、
  纹理 UV（repeat/offset/wrap 默认与覆盖）、`updateMaterial` 原地更新与**纹理所有权**（不释放 Cache 的纹理）。
- `tests/visual-regression/textureOwnership.test.ts`（2 测）：材质 ↔ TextureCache 所有权集成回归。
- `tests/visual-regression/textureCache.test.ts`（7 测）：路径归一化、1×1 品红 fallback 及其 sRGB/LinearFilter
  参数、失败后从缓存移除允许重试、LRU 上限不崩、`dispose` 幂等。
- **`SceneGraphManager` 仍无直接单测**：其构造需要真实 GPU（private ctor + `create()` 走 WebGPU/WebGL 回退），
  无法在纯单测中实例化。它消费的几何由 `pixelSnap`（已测）给出、材质由 `ShaderLib`（本文件已测）给出，
  故**可确定性断言的部分已覆盖**；GPU 光栅结果只在 `psnr.real.test.ts` 的 t1/t2/t4 三个公平基元上验证。

**ShaderLib 已知问题（已在测试中以"已知问题"用例固定，非期望语义）**：
1. `material.needsUpdate = true` 在 NodeMaterial 上读回为 `undefined`（写入不产生可断言读回值）。
   仅影响可断言性，不影响 THREE 内部响应。**未修**，测试锁定现状。

**已修：材质擅自释放 TextureCache 拥有的纹理（所有权错误，非"泄漏"）**
- 原先记录为"首帧纹理泄漏（createMaterial 未标记 managedTexture）"——**定性错了**，实测方向相反。
- **根因（探针实证）**：`updateMaterial` 把传入纹理标为 `userData.managedTexture = true`，换图时
  执行 `oldTex.dispose()`。但 `SceneGraphManager` 的全部 14 处纹理来源都是 `TextureCache`
  （`loadTexture` / `loadBorderAtlas` / `getFallback`），纹理**归 Cache 所有**。于是：
  ① 被换下的纹理被材质销毁，而 Cache 仍持有它；
  ② Cache 后续淘汰/`dispose` 时对同一张纹理**再次 dispose**（double dispose）；
  ③ 缓存命中时返回**已销毁的纹理**（use-after-dispose）→ 渲染到失效纹理。
  探针实测：`update#2` 后 `texA` 已 disposed，而 `disposed=["A"]`、随后 `["A","B"]`。
- **修复**：`updateMaterial` **不再释放任何纹理**，只做 `material.map` 引用替换 + UV 参数应用；
  删除 `managedTexture` 标记机制（该机制本身建立在错误的所有权假设上，全仓库仅 ShaderLib 自用）。
  纹理生命周期完全由 `TextureCache` 负责（`ownedTextures` + `evictKey` + `dispose`）。
  特例：`getFallback()` 返回模块级单例，不归任何 cache 实例销毁（已用测试记录该事实）。
- **验证**：`shaderLib.test.ts`「纹理所有权」2 测（换图不销毁被换下纹理、共享纹理不受影响）；
  新增 `textureOwnership.test.ts`（2 测）做材质 ↔ Cache 集成回归。
  既有 PSNR 守卫与全部对拍仍绿。

**已修：AlphaMode `DISABLE` 被静默丢弃（IDA 取证驱动）**
- 症状：`parseAlphaMode` 的 switch 只识别 `ALPHAKEY/ADD/BLEND`，`'DISABLE'` 回落为 `BLEND`，
  导致不透明层仍设 `alphaTest=4/255`、`depthWrite=false`；同时三个解析点
  （`fdfTransformer.ts` 两处、`fdfImport.ts`、`fdfTemplates.ts`）的三值白名单会把 FDF 里的
  `AlphaMode "DISABLE"` 静默丢掉，`ShaderLib` 里那条正确的 DISABLE 处理逻辑成了死代码。
- **IDA 取证**（Game.dll，imagebase `0x6f000000`）：`ReaderTextureKeyword` @ `0x6f09b8a0`
  显式比较四个字符串并分别赋值——
  `"DISABLE"`(`0x6fa8600c`)→`GxMatAlpha_Disable`、`"BLEND"`(`0x6fa86014`)→`GxMatAlpha_Blend`、
  `"ALPHAKEY"`(`0x6fa8601c`)→`GxMatAlpha_AlphaKey`、`"ADD"`(`0x6fa86028`)→`GxMatAlpha_Add`。
  即 **DISABLE 是引擎合法取值**，不是本仓库自造的。
- 修复：`FrameData.alphaMode` / `FDFTextureData.alphaMode` 类型扩为
  `'DISABLE' | 'ALPHAKEY' | 'BLEND' | 'ADD'`；三个解析点白名单加入 `DISABLE`；
  `parseAlphaMode` 增加 `case 'DISABLE'`。
- 验证：`shaderLib.test.ts` 新增「DISABLE 语义（已修正）」3 测（NoBlending / depthWrite=true /
  alphaTest=0 / updateMaterial 切回）；`fdfTransformer.test.ts` 新增解析器接受 DISABLE（含小写）。
  既有 PSNR 守卫（t1/t2/t4）与全部对拍仍绿，未受影响。

> 注：`editorgeometry.parity.test.ts` 现走**产品真实路径**（`parseFDF(src,{useKernelLayout:true})`
> 让内核几何先 overlay 进 FrameData），再断言求解器覆盖不破坏该几何——与渲染真实数据流一致。

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