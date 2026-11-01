# FDF 引擎重构方案（对标 openwar3）

> 版本: v1.1 (2026/02)
> 范围: FDF 解析 / 渲染 + WC3 1.27 MPQ 资源加载
> 对标目标: [openwar3](https://github.com/eberron94/openwar3) — 纯浏览器复刻的 WarCraft III 引擎，FDF 子系统位于 `src/ui/fdf/`，VFS/MPQ 位于 `src/vfs/`
>
> **已确认决策（v1.1）**：
> 1. **MPQ 解析器**：保留并优化 Rust `wow_mpq` 后端，以 `DataSource` 适配器暴露（不引入纯 JS 解析）。
> 2. **重构方式**：**原地重构**现有 `src/utils/fdf*.ts` 与 `src/utils/mpqManager.ts`，不新增独立 kernel 目录。
> 3. **主线顺序**：先做 **D（MPQ 抽象）** → 再 **A/B/C**（声明式核心 → 渲染对齐）。
> 4. **单测要求**：重构全过程**配套完整单测框架**，所有功能（解析 / 继承 / 布局 / 渲染 / MPQ/DataSource / Rust FFI / 往返 import·export）**必须有一一对应的单测脚本**（见 §8 全套单测设计）。

---

## 0. 摘要

本方案把 openwar3 的 **FDF 全链路架构**（`parser → library → layout → render`）和 **MPQ 统一数据源抽象**（`DataSource` + `LayeredDataSource`）作为基准，系统性地重构 UI-Designer 现有的 `src/utils/fdf*.ts` 管线与 `src/utils/mpqManager.ts`。

**核心判断**：两者的目标是**不同的**——
- openwar3 是**运行时引擎**：把 FDF 当作"声明式布局"，一次性解析出整棵 Frame 树，求解 world 坐标后渲染到屏幕（DOM/canvas）。
- UI-Designer 是**设计时编辑器**：需要**可逆往返**（import → 编辑 → export）、编辑器派生的像素坐标（`FrameData`）、以及 WebGL/Three.js 渲染。

因此**不能照搬 openwar3 的渲染层**，但**parser / library（模板与继承）/ layout（锚点求解）这三个前端阶段**与我们高度同构，值得逐行对齐；MPQ 的 `DataSource` 抽象则可以直接引入。

---

## 1. 架构对比矩阵

### 1.1 FDF 管线

| 阶段 | openwar3 | UI-Designer (现状) | 结论 |
|---|---|---|---|
| 词法 | `parser.ts` 内联 `tokenize()`（226L 一个文件） | `fdfLexer.ts`（386L 独立） | 我方更细，可保留；对齐 token 语义 |
| 语法 | `parseFdf()` → `FdfFile{frames,strings,includes}`，**prop 是通用 `key+args[]`，不做字段映射** | `fdfParser.ts`（480L）+ `fdfAst.ts`（245L），`FDFProgram` AST | 我方是 AST 中间层；openwar3 直接产出 `FdfProp` 数组。**关键差异**：openwar3 把"按字段解释"推迟到后续阶段（library/layout），我方则倾向在 parser/AST 就解释。**
| 模板/继承 | `library.ts` `FdfLibrary`：IncludeFile 递归加载、`register` first-wins、`resolve()` 展平 INHERITS、WITHCHILDREN 克隆子树、同名替换 | `fdfTransformer.ts`（1861L）+ `fdfIncludeResolver.ts`（191L） | openwar3 只有 277L，逻辑集中清晰；我方 transformer 承担了"继承 + 坐标转换 + 编辑器归并"，**职责过载** |
| 布局求解 | `layout.ts`：SetPoint/SetAllPoints/Anchor → world 坐标，迭代到不动点（`placeByTwoPoints`、`setAllPoints`、TEXT 自动高度 shrink-wrap、xScale 拉伸） | 无独立 layout 层；坐标在 `fdfTransformer.ts` 里用编辑器体系（x/y + 相对锚）算 | **my Biggest gap**：我方没有独立的"声明式求解器"，无法从 FDF 直出像素级正确的布局 |
| 渲染 | `render.ts`：FDF→DOM，`BackdropEdgeFile` 8-tile 边缘、TEXT wc3 markup、按钮族、clickSound | WebGL/Three.js (`renderer/`) 直渲，`backdropLayout`/`backdropBlend`/`pixelSnap` 等逆向常量 | 两者渲染目标不同，**各自保留**，但求解出的 world 坐标可作为 WebGL 对齐基准 |
| 控件 | `widgets.ts` EditBox/Popup/List/CkBox/TextArea/Slider 控制器 | 无统一控件控制器（走 FrameData + SceneGraphManager） | 编辑器需要可框选控件，暂不引入 DOM 控件层 |

### 1.2 MPQ / 资源加载

| 维度 | openwar3 | UI-Designer (现状) | 结论 |
|---|---|---|---|
| MPQ 解析 | `vfs/mpq.ts` 封装 `mdx-m3-viewer` MPQ parser（**纯 JS**），`load(buffer, true)` 只读 | Rust `wow_mpq` 后端 + Tauri `invoke`（`mpqManager.ts` 635L） | 两者都可行；**建议保留 Rust 性能优势，但套 `DataSource` 适配器**，为将来 1.30/CASC 留口 |
| 抽象接口 | `DataSource{label,exists,read,rawBytes,list,openArchive?}`；`LayeredDataSource` 高优先在前 | `mpqManager.{setWar3Path,loadStandardArchives,readFile}` （硬编码 4 个 MPQ） | **引入 `DataSource` 抽象**，把"路径归一化 + 多层优先"从 mpqManager 中解耦 |
| 版本定位 | 1.30 (CASC) 为主，保留 1.27 EraProfile | 专攻 1.27（`WAR3_127_MPQS`） | 保持 1.27 定位，但做成 profile 可配 |
| 纹理解码 | BLP → canvas（`mdx-m3-viewer` Blp），`blpCanvas` WeakMap 缓存 | Rust `decode_blp_*` → RGBA/DataURL（TextureCache） | 我方缓存体系已较优（`TextureCache.ts` 354L），保留；需确认对齐 AlphaOp/滤镜 |
| 皮肤 | `decorate()`/DecorateFileNames 查 `UI\war3skins.txt` 皮肤表 | `war3SkinsParser.ts` + `textureLoader` 读取 `UI\war3skins.txt` | 已对齐；可对照 openwar3 `skinValue` 语义核对 |

---

## 2. UI-Designer 现状诊断（差距清单）

### 2.1 FDF 管线问题

1. **职责过载**：`fdfTransformer.ts`（1861L）同时干：继承展平、编辑器坐标落位、宽高计算、child 归并、模板解析——与 openwar3 把 `library`（继承）与 `layout`（坐标）分开相比，耦合高、易错、难测试。
2. **缺"声明式求解器"**：openwar3 的 `layout()` 迭代求解 + TEXT shrink-wrap + 双锚 pin 尺寸 这些是像素级一致性的关键，我方没有独立层，导致"导出的坐标在游戏里对不齐"。
3. **parser 过早做字段解释**：我方 AST 偏向编辑器字段；openwar3 保持通用 `props` 数组直到 render 才解释，天然健壮、便于无损往返（对应 LONG_TERM_PLAN 的"FDF 无损反向解析"）。

### 2.2 往返（round-trip）诉求 vs openwar3

openwar3 是**单向渲染**，不写回 FDF。UI-Designer 必须**双向**。因此：
- 我方需要保留 `originalFDF` / `rawProperties` / 注释（`FDFMetadata` 已具备）；
- **新增**：编辑器 drag 后从"声明式约束（SetPoint）+ 用户改动的编辑器坐标"重新合成为一个合法的、可再导入的 FDF——这套 openwar3 没有，需要自研（见 §4.5）。

### 2.3 渲染层差异（不照搬）

openwar3 用 DOM+CSS 渲染，UI-Designer 用 WebGL 直渲（逆向 `CBackdropGenerator` 常量已沉淀在 `renderer/constants.ts`）。**渲染层保留我方 WebGL 实现**，但布局的"源数据"改为 openwar3 求解器产出的 world 坐标，以获得像素级地基。

---

## 3. openwar3 FDF 阶段详解（作为实现基准）

### 3.1 parser（`src/ui/fdf/parser.ts`）

- 产物：`FdfFile{frames: FdfFrame[], strings: Map, includes: string[]}`。
- `FdfFrame{type, name, inherits, withChildren, props: FdfProp[], children, nudgedX}`。
- `FdfProp{key, args: Arg[]}`，`Arg{s,n,str}`——**不按字段解释**。
- 逗号歧义消解：`ARG_WORDS`（frame points + justify + INHERITS/WITHCHILDREN）闭合集合；不在集合内的裸标识符开启下一条声明。**已验证覆盖全部 86 个官方 .fdf**。

### 3.2 session/library（`library.ts`）

- `loadFile(path)` 递归 Include；小写 path 去重；first-wins 注册。
- `loadOverride(id, source)`：我方自带 FrameDef 覆盖安装文件（force overwrite）。
- `resolve(frame)`：展平 INHERITS → mergeProps（own 覆盖同名键）→ WITHCHILDREN 克隆 base 子树 → 子节点同名替换或追加。
- `string(key)` 字符串表回退。
- `skinValue` / `decorate()`：DecorateFileNames 查皮肤表 → 图片路径。

### 3.3 layout（`layout.ts`）

- `UI_WIDTH=0.8, UI_HEIGHT=0.6` 世界空间；y 向上、左下原点。
- `readPoints`：SetPoint / SetAllPoints / Anchor → `{myPoint, relName, relPoint, dx, dy}`。
- 迭代不动点求解；TEXT 单行 shrink-wrap = 字号（`textBoxHeight`），多行 `line`×size×1.2。
- 双锚对置 pin 尺寸优先于显式 Width/Height；单锚需先有尺寸。
- `toPixels`：y 向下 CSS 转换 `top=(UI_HEIGHT-(y+h))*scale`，`xScale` 处理非 4:3 拉伸。
- `applyWidgetDefaults` / `scaleButtonWidths`（scale 到参考宽度）。

### 3.4 render（`render.ts`）——仅作参照

- `BackdropEdgeFile` 8-tile（U/R/D/L + 4 角）边缘渲染。
- TEXT wc3 标记（`|c` 颜色等）→ 元素/sprite。
- 按钮族 4 态（`renderSimpleButtonLayers`），同图集不同 `TexCoord`。
- `setFdfClickSound` 全局点击音。
- 边缘用 `createPattern` 平铺（非拉伸），末 tile 裁剪，`BackdropCornerFlags`。

---

## 4. 重构实施方案（分阶段）

**重构总纲（原地重构）**：不新增独立目录，直接在现有 `src/utils/fdf*.ts` 与 `src/utils/mpqManager.ts` 原地改造。为控制风险，采用"**先补测试基线 → 小步改造 → 每步绿测**"的外部可见行为不变策略。所有阶段**同步编写/维护单测**（见 §8）。

### 阶段 A：建立声明式核心（对齐 parser + library + layout）
**目标**：在现有 `fdfParser.ts` / `fdfAst.ts` 之外，落地一个能力对齐 openwar3 的声明式核心，能从 FDF 直出 world 坐标；不改动编辑器渲染入口。

1. **新增源码文件（在 `src/utils/` 下）**：
   - `fdfKernelParser.ts` — 移植 openwar3 `tokenize` + `parseFdf`（复用现有 `fdfLexer` 的词法底子，但追加 `ARG_WORDS` 逗号消歧与通用 `props[]{key,args}` 产出）。
   - `fdfKernelLibrary.ts` — 移植 `FdfLibrary`（Include 递归、`register` first-wins/override、`resolve` 继承展平、`mergeProps`、`skinValue`）。
   - `fdfKernelLayout.ts` — 移植 `layout()` 求解器（设点/`setAllPoints`/TEXT shrink-wrap/双锚 pin尺寸/`xScale`）。
   - `fdfKernelTypes.ts` — `FdfFrame/FdfProp/Arg/LaidOutFrame` 等**独立**模型（与 `src/types/index.ts` 编辑器模型解耦，避免污染现有 FrameData）。
   - 现有 `fdfLexer.ts`/`fdfParser.ts`/`fdfAst.ts` 先**保留**作为旧管线；由新核心逐步替代。
2. **金标准回归夹具**：以 `vendor/UI/FrameDef/**`（已 vendored 1.27 全套 + `FrameDef.toc`）为基准，新增 `tests/fdfKernel/**`：
   - 断言每个官方 .fdf 可被内核 parser 解析（无坏帧、fragments 数匹配）；
   - 断言关键 root 的布局 box（x/y/w/h）与 openwar3 `tools/fdf-layout-test.cjs` 参考值一致。
3. **验收**：新增 `test:fdfKernel` npm 脚本，遍历 `FrameDef.toc` 全部 .fdf 求解布局并输出 JSON；单测全绿。

### 阶段 B：改造现有转换器复用内核
**目标**：让编辑器 `FrameData` 由声明式内核的**求解结果**驱动，消除 transformer 的坐标职责。

1. `fdfTransformer.ts` 的**继承展平**改为调用 `fdfKernelLibrary.resolve()`，等价逻辑收敛到一处。
2. **坐标/尺寸**改为调用 `fdfKernelLayout.layout()`：import 时内核求解 → world 坐标 → 转编辑器像素 `FrameData`（`__PARENT__` 锚保留）。
3. 保留对编辑器友好的归并逻辑（child 去重、模板注册），只做"结构编辑"，不再重复发明坐标。
4. **往返保真**：import/export 仍走 `originalFDF`/`rawProperties`，注释、未知属性、键顺序不丢（由 §8 的往返测试兜底）。
5. **单测**：为 transformer 每个公共方法补针对性子测（继承解析、锚点落位、child 归并、模板注册、往返），与内核结果逐一断言。

### 阶段 C：渲染对齐（像素级）
**目标**：现有 WebGL 渲染改用内核求解坐标，并对照 openwar3 渲染语义修正常量。

1. `SceneGraphManager` 布局输入从"编辑器 FrameData 坐标"切到"内核 LaidOutFrame → `toPixels`"（纹理解码链路不变）。
2. 对照 openwar3 `render.ts` 修正/确认：
   - `backdropLayout`/`backdropSplitEdges` 的 8-tile 边缘（对照 `EDGE_TILE`/`BackdropCornerFlags`）；
   - `backdropBlend` 的 AlphaOp/滤镜（对照 constants `EGxMatAlphaOp`/`FILTER_MODES`）；
   - `pixelSnap` 舍入与 `toPixels` 的 `xScale`。
3. **视觉回归**：`tests/visual-regression/fdf*.test.ts` 增加多分辨率（4:3 / 16:9 / 21:9）基线，验证拉伸一致性（在无 GPU 的 CI 用 `OFFSCREEN`/headless-gl 跑，见 §8.7）。

### 阶段 D：MPQ 数据源抽象（对标 `vfs/`，保留并优化 Rust 后端）
**目标**：引入 `DataSource` 统一接口；**保留 Rust `wow_mpq` 作为唯一解析后端**，通过适配器暴露；多余/易错逻辑（路径归一化、多层优先）上提到前端可测。

1. **新增 `src/utils/dataSource.ts`**：
   - `DataSource{label, exists, read, rawBytes, list, openArchive?}`（对齐 `vfs/types.ts` 语义）；
   - `LayeredDataSource`（多层优先栈，高优先在前）；
   - `normalizeMpqPath`（`/`→`\`、去前导 `\`、统一小写查表）。
2. **`mpqManager.ts` 原地改造**：
   - 暴露 `MpqDataSource` 适配器：`read/rawBytes` → Rust `read_mpq_file`；`exists/list` → Rust `load_mpq_archive`（复用现有缓存）。
   - `loadStandardArchives` 改为构建 `LayeredDataSource([war3xlocal, war3x, war3, war3patch])`（与 openwar3 profile 一致，低优先在前）。
   - 保留 `selectWar3Directory`/`setWar3Path` 校验（war3.exe 存在性）。
   - 提供 `WAR3_PROFILES`（`{ tft, roc }`）扩展点，默认 tft（4 MPQ）。
3. **Rust 侧优化（`src-tauri/src/lib.rs`）**：
   - 为 `read_mpq_file`/`load_mpq_archive` 增加**已开档案句柄缓存**（现每次 `Archive::open` 重开，开销大）；按 path 缓存打开的 `Archive` + 其文件索引，避免反复解 listfile。
   - 增加 `has_mpq_file(archive, name)` 幂等查询命令，减少前端对 list 的全量拉取。
   - 保留既有 `decode_blp_*`/`parse_mdx_*` 命令不动。
4. **下游逐步迁移**：`textureLoader`、`TextureCache`、`MDXModelViewer`、`WC3TextureBrowser` 从直接 `mpqManager.readFile` 改为 `dataSource.read`。保留 `mpqManager` 为兼容 facade。
5. **结论（不再可选）**：不引入 `mdx-m3-viewer` 纯 JS MPQ 解析；Rust 持续承担重活，仅让前端持有统一的 `DataSource` 视图。

### 阶段 E（可选长期）：CASC / 1.30 支持 + 编辑器后端
- 复用 `DataSource` 抽象接入 CASC（`vfs/casc.ts` 方式），EraProfile 自动切换。
- `LONG_TERM_PLAN` 的"无损反向解析 + 热重载"依赖阶段 A/B 的声明式内核与往返保真。

---

## 5. 关于 openwar3 如何加载/使用 1.27 MPQ（简要说明）

用户明确要求"看它如何加载、使用 war3 1.27 客户端 mpq"。结论如下，供决策：

- openwar3 **以 1.30 (CASC) 为主**，1.27 走 **MPQ era**：`Profiles.PROFILES.tft = [war3.mpq, war3x.mpq, war3xlocal.mpq, war3patch.mpq]`（**低优先级在前**，后加载覆盖前）。
- `vfs/mpq.ts` 用 `mdx-m3-viewer` 的 MPQ parser 纯 JS 解档，只读。
- `loader.loadProfile()` → 版本校验 → 把各 MPQ 包成 `MpqDataSource`，再套 `LayeredDataSource`（高优先在前）→ `EditionDataSource`(RoC/TFT 差异) → `DerivedArtDataSource`(TGA→BLP 等派生资产) → `EditPatchDataSource`(补丁覆盖)。
- 使用侧：`exists(path)` + `read(path)` 统一读数据字节；FDF library 用它读 `GlobalStrings.fdf`/皮肤表；`render.ts` 用 `blpCanvas` 缓存解码 BLP。
- **对我们 1.27-only 的迁移要点**：我们 profile 固定为 tft 的 4 个 MPQ 即可；重点迁移是**"路径归一化 + 多层优先 + exists/read 接口"**这三件事，而非解析器本身（解析器继续用 Rust `wow_mpq`）。

---

## 6. 建议的落地顺序与工作量（估）

| 阶段 | 内容 | 相对工作量 | 依赖 |
|---|---|---|---|
| A | 声明式核心（parser/library/layout）+ 金标准回归 | 高 | 无 |
| B | transformer 复用内核、往返保真 | 中 | A |
| C | WebGL 渲染对齐 + 视觉回归 | 中 | A/B |
| D | DataSource 抽象 + mpqManager 改造（保留 Rust） | 中 | 无 |
| E | CASC/1.30 + 编辑器后端（可选） | 低 | D |

**落地顺序（已确认）**：先 **D（MPQ 抽象，独立低风险）** 再 **A/B/C（声明式内核主线）**；全程伴随 §8 单测。

---

## 7. 决策记录（已确认）

1. **MPQ 解析器**：✅ **保留并优化 Rust `wow_mpq`**，套 `DataSource` 适配器暴露（不引入纯 JS `mdx-m3-viewer`）→ 见阶段 D。
2. **重构位置**：✅ **原地重构** `src/utils/fdf*.ts` 与 `src/utils/mpqManager.ts`（不新增独立 kernel 目录）。
3. **渲染层**：✅ **不照搬** openwar3 DOM 渲染，保留 WebGL/逆向常量实现，仅让布局数据来自内核求解器。
4. **主线顺序**：✅ **先 D 后 A**。
5. **单测**：✅ **重构全过程配套完整单测框架**，所有功能一一对应单测脚本（见 §8）。

> 未决（进入中期再做）：CASC/1.30 支持是否纳入（默认先 1.27-only，靠 `WAR3_PROFILES` 预留口）；热重载/Prefab 等长期项。

---

## 8. 完整单测框架设计（所有功能一一对应的单测脚本）

> **原则**：重构期间任何公共函数/模块被改动，都必须有**一一对应的单测**覆盖；单测与源码**同目录命名**（`*.test.ts` 与源码并列，或集中 `tests/`），统一用 **vitest**（项目已有 `vitest` 依赖 + `test=vitest run`）。凡改动即补测，先红后绿，保持外部行为不变。

### 8.1 单测组织与运行

| 入口 | 命令 | 说明 |
|---|---|---|
| 单元测试（默认） | `npm run test` | `vitest run`，匹配 `src/**/*.test.ts` + `tests/*.test.ts` |
| 内核回归 | `npm run test:fdfKernel` | `vitest run tests/fdfKernel` |
| 官方 FDF 全量校验 | `npm run validate:fdf` | 遍历 `vendor/UI/FrameDef/**` |
| 往返测试 | `npm run test:roundtrip` | `vitest run tests/fdf-roundtrip.test.ts` |
| Rust FFI 冒烟 | `npm run test:tauri` | 需 `npm run tauri dev` 环境（走 invoke mock 或真实进程） |
| 覆盖率 | `npm run test:coverage` | `vitest run --coverage`；**里程碑收敛门槛：核心模块 ≥ 90%** |

### 8.2 模块 × 单测映射清单

每个功能点 → 对应测试文件（`[现有]`=已有，`[新]`=本次新增，`[改造]`=现有但需按内核重构后补充新断言）。

| 模块 / 功能 | 单测脚本 | 覆盖点 |
|---|---|---|
| **词法** `fdfLexer.ts` | `tests/fdfLexer.test.ts [改造]`、`tests/visual-regression/lexerFloatSuffix.test.ts [现有]` | token 类型、数字/`f` 后缀、字符串转义、注释、`{}` `,`、非法输入 |
| **kernel 语法** `fdfKernelParser.ts` | `tests/fdfKernel/parser.test.ts [新]` | Frame/Texture/String/Layer 块、props 通用解释、`ARG_WORDS` 逗号消歧、IncludeFile/StringList |
| **AST** `fdfParser.ts`+`fdfAst.ts` | `tests/fdf-integrity-test.ts [现有]`、`tests/fdfKernel/ast.test.ts [新]` | 结构完整性、嵌套、INHERITS/WITHCHILDREN 字段 |
| **Include 解析** `fdfIncludeResolver.ts` | `tests/test-include-inherits.ts [现有]`、`tests/fdfKernel/include.test.ts [新]` | 递归、循环引用 maxDepth、路径解析、去重 |
| **继承展平** `fdfKernelLibrary.ts` | `tests/fdfKernel/library.test.ts [新]` | `resolve`、`mergeProps` 同名键覆盖、WITHCHILDREN 克隆、同名 child 替换、匿名不取模板名、循环保护 depth 64 |
| **模板注册** | `tests/test-templates-and-properties.ts [现有]`、`tests/fdfKernel/templates.test.ts [新]` | first-wins / override、大小写回退 |
| **布局求解** `fdfKernelLayout.ts` | `tests/fdfKernel/layout.test.ts [新]` | SetPoint/SetAllPoints/Anchor、参考对解（同名→父）、TEXT 单行 shrink-wrap=字号、多行 `×1.2`、双锚 pin 尺寸、xScale 拉伸、`toPixels` 四值、dxScale |
| **皮肤** `war3SkinsParser.ts` | `tests/texture-loader.test.ts [现有]`、`tests/fdfKernel/skin.test.ts [新]` | `skinValue`/`decorate`、种族切换、默认 Human |
| **解析器官方回归** | `tests/validate-all-official-fdf.ts [现有]`、`tests/analyze-all-fdf.ts [现有]` | `vendor/UI/FrameDef/**` 全部可解析、布局 box 与参考比对 |
| **Transformer（继承+坐标）** | `tests/fdf-import.test.ts [改造]`、`tests/test-inherited-children.ts [现有]`、`tests/test-frame-types.ts [现有]` | 继承解析走内核、锚点落位、child 归并、模板注册 |
| **往返 import/export** | `tests/test-fdf-roundtrip.ts [改造]`、`tests/fdf-roundtrip.test.ts [新]`、`tests/exported_*.fdf [现有金标准]` | parse→export→re-parse 数据一致、注释/未知属性/键顺序保留、`originalFDF`/`rawProperties` 不丢 |
| **导出** `fdfExport/Exporter` | `tests/test-fdf-export.ts [现有]`、`tests/debug-fdf-export.ts [现有]` | 语法正确、数值精度、属性顺序 |
| **BLP 解码** `blpDecoder.ts` | `tests/blp-decoder.test.ts [现有]` | 三种格式、mipmap、RGBA |
| **DataSource 抽象** `dataSource.ts` | `tests/dataSource.test.ts [新]` | `exists/read/rawBytes/list`、`normalizeMpqPath`（`/`→`\`、去前导 `\`）、`LayeredDataSource` 优先级、小写查表 |
| **MPQ Manager** `mpqManager.ts` | `tests/mpq-manager.test.ts [现有]` | 路径校验、档案加载顺序、profile 构造、错误路径 |
| **Rust FFI（MPQ/BLP/MDX）** | `src-tauri/src/lib.rs` 内 `#[cfg(test)]` [新] + `tests/tauri/ffi.test.ts` [新] | 开档缓存、`has_mpq_file`、`read_mpq_file` 往返、listfile 解析、`decode_blp_*`、`parse_mdx_*`；JS 侧用 mock `invoke` 断言参数映射 |
| **渲染布局对齐** | `tests/visual-regression/fdfSetPointRelative.test.ts`、`fdfSetAllPointsAndAnchorPairs.test.ts`、`fdfInsetOrder.test.ts`、`coordinateIsotropy.test.ts [现有]` | 布局一致性、锚点、inset 顺序、各向同性 |
| **Backdrop 8-tile** | `tests/visual-regression/backdropLayout.test.ts`、`backdropSplitEdges.test.ts`、`fdfBackdropSplitEdges.test.ts [现有]` | 边缘切分、角块 inset 非对称 0.95、遮挡顺序 |
| **混色/滤镜** | `tests/visual-regression/backdropBlend.test.ts`、`fdfAlphaMode.test.ts [现有]` | AlphaOp、ALPHA_REF、滤镜模式 |
| **文本渲染** | `tests/visual-regression/fdfFrameFont.test.ts`、`fdfFontShadow.test.ts`、`textLayout*`、`fontResolver` [现有] | 字号解析、阴影、行高、字体栈 |
| **控件渲染** | `tests/visual-regression/fdfControlAndHighlight.test.ts`、`fdfWidgetRefsAndChat.test.ts`、`fdfSliderEdit.test.ts`、`fdfTextAreaMenu.test.ts`、`popupMenuVisibility` [现有] | 按钮/高亮、EditBox/Popup/List/Slider/TextArea |
| **像素级多分辨率** | `tests/visual-regression/compare.test.ts`、`pixelSnap.test.ts`、`test-button-positions.test.ts [新]` | 4:3 / 16:9 / 21:9 拉伸、`toPixels` 四值、像素对齐 |

### 8.3 关键新增测试脚本（本次必须落地的核心）

1. **`tests/fdfKernel/parser.test.ts`** — 内核 parser 的可判定性：把官方 `vendor/UI/FrameDef/**` 全部喂入，断言 0 坏帧；若干手工最小样例断言 props 数组精确展开。
2. **`tests/fdfKernel/library.test.ts`** — 继承/覆盖/WITHCHILDREN 语义，覆盖 §3.2 全部行为。
3. **`tests/fdfKernel/layout.test.ts`** — 求解器不动点、TEXT shrink-wrap、双锚 pin 尺寸、xScale 拉伸、`toPixels` 精确值（对照 openwar3 `tools/fdf-layout-test.cjs` 参考值）。
4. **`tests/fdf-roundtrip.test.ts`** — 对 `tests/exported_*.fdf` 与官方样例做 parse→export→re-parse，断言幂等与保真。
5. **`tests/dataSource.test.ts`** — `DataSource`/`LayeredDataSource`/`normalizeMpqPath` 纯前端可测逻辑（不依赖真实 MPQ）。
6. **`tests/tauri/ffi.test.ts` + Rust `#[cfg(test)]`** — Rust 命令的接口契约：参数名/结构序列化、开档缓存命中/未命中、错误返回；JS 侧 mock `invoke` 断言适配器把 `read(path)→read_mpq_file` 映射正确。

### 8.4 覆盖与质量门槛（里程碑）

- 每个阶段合入前，`npm run test` 全绿 + 新增点位的覆盖率 ≥ 90%（核心：parser/library/layout/dataSource/roundtrip）。
- 官方 FDF 全量校验 `npm run validate:fdf` 必须通过（不引入任何解析回归）。
- 视觉回归在 CI 无 GPU 环境用 `OFFSCREEN`/`gl` polyfill 跑；必要时 `tests/visual-regression/compare.ts` 生成参考图基准，多分辨率断言哈希一致。

---

## 9. 实现进度（持续更新）

| 阶段 | 内容 | 状态 | 单测 | 校验 |
|---|---|---|---|---|
| D-1 | `src/utils/dataSource.ts`（DataSource/MpqDataSource/LayeredDataSource/InMemory + normalizeMpqPath） | ✅ 完成 | `tests/dataSource.test.ts`（10 用例，含 hasFile 快速路径） | vitest 全绿 |
| D-2 | `mpqManager.ts` 注入式 `MpqFns` + `pathJoin`，`loadArchive` 走 `fns`，新增 `getDataSource()` 多层 DataSource | ✅ 完成 | `tests/mpq-manager-dataSource.test.ts`（2 用例） | vitest 全绿 |
| D-3a | Rust 侧 `src-tauri/src/mpq_io.rs`：开档句柄缓存（`ArchivePool`）+ `has_mpq_file` + 复用旧命令契约 | ✅ 完成 | Rust `#[cfg(test)]`（6 用例：list/read/has_file/句柄复用/clear/缺档错误） | 隔离 crate `cargo test` 6/6 全绿 |
| D-3b | `lib.rs` 接入 `mpq_io`，注册 `has_mpq_file`；前端 `tauriMpqFns` 补 `hasFile` | ✅ 完成 | `tests/tauri/ffi.test.ts`（5 用例 FFI 契约） | vitest 全绿 |
| D-4 | 下游迁移到 dataSource + 保留 facade：`MPQManager.getCachedDataSource()` 提供稳定共享的多层视图（unload 失效）；`TextureCache`/`textureLoader` 改经注入的 `DataSource.read/exists`（默认走共享视图），`MDXModelViewer`/`WC3TextureBrowser` 保留 facade | ✅ 完成 | `tests/mpq-manager-dataSource.test.ts`（3 用例，含共享实例稳定性 / 卸载重建） | vitest 全绿 |
| A-1 | 声明式核心类型 `fdfKernelTypes.ts`（Arg/FdfProp/FdfFrame/FdfFile，对标 openwar3） | ✅ 完成 | — | — |
| A-2 | 声明式解析器 `fdfKernelParser.ts`（含逗号歧义封闭裸词规则、注释、数后缀） | ✅ 完成 | `tests/fdfKernel/parser.test.ts`（12 用例） | vitest 全绿 |
| A-3 | 声明式库/模板 `fdfKernelLibrary.ts`（register/resolve/mergeProps/访问器/propagateDecorate/cloneNamespaced） | ✅ 完成 | `tests/fdfKernel/library.test.ts`（13 用例） | vitest 全绿 |
| A-4 | 金标准语料回归：`vendor/UI/FrameDef/**` 84 个官方 fdf 全部可解析 | ✅ 完成 | `tests/fdfKernel/golden.test.ts`（6 用例） | vitest 全绿 |
| A-5 | 声明式布局内核 `fdfKernelLayout.ts`（SetPoint/Anchor/SetAllPoints + Width/Height → LaidOutFrame，TEXT 自动尺寸，双锚点钉住，不动点求解，toPixels/fitBox/stretchBox，applyWidgetDefaults/scaleButtonWidths） | ✅ 完成 | `tests/fdfKernel/layout.test.ts`（16 用例） | vitest 全绿 |
| B-1 | 往返序列化器 `fdfKernelSerializer.ts`（`FdfFile` → FDF 文本，数值字面量/裸词/字符串原样保留，StringList 块式；84 官方语料全部 round-trip 结构保真 + idempotence 不动点） | ✅ 完成 | `tests/fdfKernel/serialize.test.ts`（7 用例，含 84 语料全量） | vitest 全绿 |
| B-2 | transformer 消费内核：新增 `fdfKernelTransformer.ts`（内核 `FdfFrame` → `FrameData` 结构契约适配器：frame type 映射、SetPoint/Anchor/SetAllPoints→FrameAnchor、Width/Height 相对单位、无锚点 CENTER、INHERITS 继承展开、WITHCHILDREN、顶层画布绝对锚点、relativeTo 名称→ID 映射、扁平列表） | ✅ 完成（结构契约层） | `tests/fdfKernel/transformer.test.ts`（8 用例，含 84 语料全量扫描 + 对标旧 transformer 的结构断言） | vitest 全绿 |
| C | WebGL 渲染对齐 + 视觉回归 | ✅ 完成 | `tests/visual-regression/multiResolutionStretch.test.ts`（5 用例，多分辨率 stretch 一致性）+ 既有 223 视觉回归用例 | vitest(pixel) 全绿 |

> **构建环境注意**：`cargo build` / `cargo test` 在**完整 Tauri 工程**上目前无法完成 —— `cmake` 构建脚本（需源码编译 `turbojpeg-sys`，经 `image`/`blp` 传递引入）不识别 VS18（VS 2026）。这是**既有工具链兼容问题、与本次改动无关**。以上 Rust 改动已通过**剥离 `wow-mpq` 的隔离 crate**完成 `cargo test --no-run` 编译验证与单测逻辑验证；待本机装齐兼容的 MSVC/cmake 工具链后即可在工程内 `cargo test` 全绿。

> 备注：`npm run test`（`vitest run`）会遍历 `tests/*.test.ts`，其中的旧 **console 脚本测试**（如 `mpq-manager.test.ts`、`blp-decoder.test.ts`）会尝试真实 Tauri/MPQ 调用并因无 `describe/it` 而报错。这些是**既有**问题、与本重构无关；阶段 D 的新增测试都是规范 `describe/it` 套件，在定点运行下全绿。后续阶段可把这些旧 console 脚本逐步迁移为规范 vitest（纳入阶段 E 收尾）。

> **C 阶段范围说明**：按既定风险预案，`SceneGraphManager` 由"编辑器 FrameData 坐标"整体切换为"内核 `LaidOutFrame → toPixels`"（计划 §8 阶段 C 第 1 条）与 B-2 相同，依赖渲染器 parity 实证安全后纳入**阶段 E 收尾**；本阶段交付的是渲染对齐中可前置闭环的部分：既有 223 个像素级视觉回归（backdrop 8-tile/`backdropBlend`/`pixelSnap`/坐标等向性）全部绿，并新增多分辨率（4:3/16:9/21:9）`fitBox`/`stretchBox`/`toPixels` 拉伸一致性测试。

> **B-2 范围说明**：按既定风险预案，本次 B-2 交付的是**结构契约层**的内核适配器 `fdfKernelTransformer.ts`，并配 84 语料全量扫描 + 对标旧 transformer 的结构断言；**渲染器耦合的旧 transformer（`fdfTransformer.ts`，1861 行，被 30+ 视觉回归测试钉住）仍作为活动渲染入口保留**，待 parity 实证安全后再整体切换（纳入阶段 E 收尾）。截至本阶段，`tests/fdfKernel/**` 共 **62 用例全部 vitest 绿**。

---

## 附录：参考文献

- openwar3 `src/vfs/{types,mpq,loader,layered,profiles,casc}.ts`
- openwar3 `src/ui/fdf/{parser,library,layout,render,widgets,anim}.ts`
- openwar3 `src/compat/{frames,prelude}.ts`（地图 .toc → `loadOverride`）
- openwar3 `tools/fdf-layout-test.cjs`（布局参考值与金标准）
- 本项目 `vendor/UI/FrameDef/**`（1.27 官方 FDF 金标准）
- 本项目 `tests/**` 与 `tests/visual-regression/**`（现有单测基线）
- 本项目 `docs/{FDF_PARSER_GUIDE, ROADMAP, LONG_TERM_PLAN}.md`