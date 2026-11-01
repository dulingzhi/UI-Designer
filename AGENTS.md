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
  **唯一有意不纳入的语义分歧**：无锚点子帧的默认落位——内核钉父控件 top-left（对齐 WC3 引擎），
  编辑器注入默认 `CENTER@父 CENTER`（对齐设计器交互），两者均为有意的产品语义，不对拍。
- **编辑器渲染一致 — 真实原版 UI 守卫**：`tests/ow3compare/editorrender.real.test.ts`（war3.mpq，41 屏）。
  走**产品真实路径** `parseFDF(src,{useKernelLayout:true})` → `SceneGraphManager.sync` 的
  `calculatePositionFromAnchors` 覆盖，量化"覆盖是否破坏内核 ground-truth 几何"。
  实测基线：`frames=1371  solver-null=202  overridden=1169  divergent=31`，一致率 **97.35%**（1138/1169）。
  31 帧分歧**全部是纯平移**（尺寸不变），按锚点形状：`[CENTER]=29,[LEFT]=1,[BOTTOMLEFT]=1`。
  **求解器已去递归**（见下条"去递归修正"），分歧由 61 帧降到 31 帧。
  **根因（实证，已更正）**：这 31 帧**不是单锚点语义分歧**——实测求解器结果与 openwar3 单锚点通用公式
  **完全一致**（`[CENTER]` 在两侧都是 `center - w/2, center - h/2`，因 `fx=fy=0.5`）。
  真正的差异出现在**内核 overlay 侧**：`fdfKernelScene` 的 overlay 值与独立 `layout()` 的 byName 值不同
  （同名模板帧在多父级下会被 byName 覆盖，实测出现 `kernel=(0.000,0.006)` 这类伪值）。属**待查**，
  这 31 帧如实保留、以快照锁定，不得当作已解决。
  注意：早期一版探针（把纯结构帧喂给求解器、未走产品路径）得出"1112/1191 分歧"，那是**探针路线错误**的假象。
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
  **仍未解决**：真实数据 31 帧分歧**不是**单锚点语义问题——实测求解器结果与 openwar3 公式一致；
  差异源于 `transformKernelFrames` 对**无锚点子帧注入 `CENTER@父 CENTER`**，而内核 `layout` 走
  "无锚点 → 钉父 top-left"兜底，两者语义本就不同（且引擎实际是 UNDEFINED）。
  这两处兜底都是本仓库自造的、引擎里**不存在**的行为，属待决问题，须按 §4.1 决定取舍。

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
- `93 passed | 2 skipped` 测试文件，`1729 passed | 5 skipped` 测试
- 内核/对拍：`17 passed | 2 skipped` 文件，`442 passed | 5 skipped` 测试
- `All files` 覆盖：`100 / 100 / 100 / 100`

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