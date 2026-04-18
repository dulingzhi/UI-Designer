# Engineering Review: WEBGL_RENDERING_PLAN.md

> Reviewer: /plan-eng-review  
> Date: 2026-04-11  
> Plan: [WEBGL_RENDERING_PLAN.md](./WEBGL_RENDERING_PLAN.md)  
> Branch: main  
> Status: **PASS — 3 must-fix RESOLVED, 3 should-fix (2 resolved in plan, 1 pending)**

---

## Review Summary

| Category | Score | Notes |
|----------|-------|-------|
| Architecture | 9/10 | 三层设计 + CSS transform 驱动 pan/zoom，modelBridge Phase 5 设计完整 |
| Code Quality | 9/10 | Shader 精确、TextureCache 用前端解码零 IPC 开销、错误处理完善 |
| Test Coverage | 5/10 | 计划了 4 项测试但缺少 4 项关键测试 (sync, hitTest, 交互回归等) |
| Performance | 8/10 | BLP IPC 瓶颈已消除，dirty flag 渲染，共享 geometry |
| **Overall** | **8/10** | Must-fix 全部解决，方案大幅简化 |

---

## Scope Challenge 决议

| 决议 | 选择 |
|------|------|
| TextureCache | 包装现有 textureLoader.ts，只加 DataURL→THREE.DataTexture GPU 上传层 |
| SDF 字体 | 用 tinysdf / msdf-bmfont 现成库，不自写 fontAtlasGenerator.ts |
| hitTest 时机 | Phase 1 就做，降低 Phase 5 风险 |
| 渲染循环 | dirty flag + 单次 requestAnimationFrame，不跑 60fps |
| PlaneGeometry | 固定 1x1 + mesh.scale.set(w, h, 1)，永不重建几何体 |

---

## Issue Tracker

### Must-Fix (实现前必须解决) — ✅ 全部已解决

#### MF-1: ~~applyTransform() camera 数学可能不正确~~ ✅ RESOLVED
- **Section**: Architecture 1-1
- **原风险**: CSS `transform: scale(s) translate(ox, oy)` 的变换顺序是右到左 (先 translate 后 scale)。计划中 `camera.left = -offsetX / scale` 的公式需要严格推导验证。
- **Resolution**: **彻底删除 applyTransform()**。WebGL `<canvas>` 放入 `canvas-wrapper` 内部，继承 CSS transform。Camera 固定在 `(0, 1920, 1080, 0)` 永不改变。Pan/Zoom 完全由 CSS 处理，消除所有 camera 数学。
- **推导发现**: 现有 Canvas.tsx/useCanvasDrag.ts 的坐标转换 `(e.clientX - canvasBounds.left - offset.x * scale) / scale` 存在预置 bug（getBoundingClientRect 已包含 transform，多减了 `offset.x * scale`），但因 drag delta 差值抵消而不影响操作。此 bug 与 WebGL 方案无关，不在本 PR 修复范围。

#### MF-2: ~~modelBridge.ts 设计空白 + WebGL Context 冲突~~ ✅ RESOLVED
- **Section**: Architecture 1-2
- **原风险**: 现有 ModelViewer.tsx 每个实例创建独立 WebGL context。浏览器限制 8-16 个 context。
- **Resolution**: Phase 1-4 保留 ModelViewer 为 DOM overlay（放在 canvas-wrapper 内，继承 CSS transform）。Phase 5 详细设计已写入计划：推荐方案 A（OffscreenCanvas → readPixels → DataTexture），备选方案 B（WebGL context sharing + state save/restore）。Context 限制在 Phase 1-4 ≤4 个 Model 时可接受。

#### MF-3: ~~BLP IPC 传输开销 (8-16MB JSON/纹理)~~ ✅ RESOLVED
- **Section**: Code Quality 2-1 + Performance 4-3
- **原风险**: `Vec<u8>` 通过 Tauri IPC 序列化为 JSON `number[]`。1024×1024 BLP = 4MB RGBA = 8-16MB JSON 字符串。
- **Resolution**: **完全不走 Rust IPC `decode_blp_to_rgba`**。审计发现现有 textureLoader.ts 已经使用前端 `blpDecoder.ts`（通过 `decodeBLPToDataURL` 调比 Rust `decode_blp_to_png` 返回 data URL string）。WebGL TextureCache 直接复用 `decodeBLP()` 获取 `ImageData` (RGBA Uint8ClampedArray)，零 JSON 序列化开销。BLP 原始文件字节（50-200KB）通过 MPQ/文件读取传到前端已够高效。

### Should-Fix (实现时顺带处理)

#### SF-1: ~~TextureCache 错误处理 + fallback~~ ✅ RESOLVED IN PLAN
- **Section**: Code Quality 2-4
- **问题**: getTexture() 加载失败时 pending Map 不清理，后续请求永远等待已失败的 Promise。
- **Resolution**: 计划已更新 — `getTexture()` 增加 try/catch/finally: catch 返回品红占位纹理 (1×1 magenta DataTexture)，finally 清理 pending Map。

#### SF-2: ~~GPU Texture dispose 与 textureLoader LRU 同步~~ — DEFERRED
- **Section**: Performance 4-2
- **问题**: TextureCache 包装 textureLoader 后，textureLoader LRU 淘汰 entry 时，对应的 THREE.Texture 也需要 dispose()。
- **Status**: TextureCache 现在不依赖 textureLoader 缓存（直接读文件+解码），有自己的 gpuCache。Phase 5 优化时添加 LRU 淘汰 + texture.dispose()。

#### SF-3: 添加缺失测试
- **Section**: Test 3-1  
- **缺失测试**:
  1. `sceneGraphManager.test.ts` — sync() 增删改帧、z-order 排序、dispose 清理
  2. ~~`applyTransform.test.ts`~~ — 已删除 applyTransform，不再需要 [MF-1]
  3. `hitTest.test.ts` — 点击空白区域返回 null、重叠帧返回最上层、帧移动后 hitTest 更新
  4. 交互回归测试 — 拖拽/resize/pan 在 WebGL 模式下功能不退化

---

## NOT in Scope (误入风险)

以下内容**不在本计划范围**，实现时不要碰：

| 误入诱惑 | 说明 |
|----------|------|
| 修改 coordinateService.ts | 零改动，所有坐标转换已正确 |
| 修改 projectStore.ts | 帧数据结构不变 |
| 修改 useCanvasDrag/Resize/Pan | 交互层不变，WebGL canvas 设 pointer-events: none |
| 添加新的 FrameType | 本计划渲染现有 28 种，不增加新类型 |
| 修改 FDF 导入/导出 | 数据层不变 |
| 游戏运行时接口 | 这是编辑器渲染，不是游戏引擎 |
| war3skins.txt 解析逻辑 | 已有实现，复用 resolveTexturePath |

---

## What Already Exists (复用清单)

| 组件 | 文件 | 复用方式 |
|------|------|---------|
| WC3↔像素坐标 | `src/utils/coordinateService.ts` | 直接调用，零改动 |
| BLP 解码 (Rust) | `src-tauri/src/blp_handler.rs` | 现有 decode_blp_to_png 已被前端 textureLoader 使用；WebGL 路径改用前端 decodeBLP() |
| BLP 解码 (JS) | `src/utils/blpDecoder.ts` | **主路径**：decodeBLP() → ImageData (RGBA) → THREE.DataTexture |
| 纹理缓存 + LRU | `src/utils/textureLoader.ts` | TextureCache 包装使用 |
| war3skins 路径解析 | Canvas.tsx `resolveTexturePath()` | 提取为工具函数，TextureCache 复用 |
| Pan/Zoom hook | `src/hooks/useCanvasPan.ts` | 零改动 |
| Drag hook | `src/hooks/useCanvasDrag.ts` | 零改动 |
| Resize hook | `src/hooks/useCanvasResize.ts` | 零改动 |
| 帧数据 store | `src/store/projectStore.ts` | 零改动 |
| 帧类型定义 | `src/types/index.ts` | 零改动 |
| 3D MDX 渲染 | `src/components/ModelViewer.tsx` | Phase 1-4 保留，Phase 5 由 modelBridge 替代 |
| 逆向工程数据 | `docs/WC3_RENDERING_REVERSE_ENGINEERING.md` | 转为 `src/renderer/constants.ts` |

---

## TODOS.md 更新建议

现有 TODOS.md 所有 P1/P2 已完成。建议追加：

```markdown
## WebGL 渲染引擎 (from /plan-eng-review, 2026-04-11)

### P0 — 实现前必须解决
- [x] ~~**MF-1: applyTransform camera 数学验证**~~ — 删除 applyTransform，用 CSS transform ✅
- [x] ~~**MF-2: modelBridge 详细设计**~~ — Phase 1-4 DOM overlay + Phase 5 OffscreenCanvas ✅
- [x] ~~**MF-3: BLP IPC 传输优化**~~ — 改用前端 blpDecoder.ts，零 IPC 开销 ✅

### P1 — 实现时顺带
- [x] ~~**SF-1: TextureCache 错误处理**~~ — try/catch + fallback 纹理 ✅ (已写入计划)
- [ ] **SF-2: GPU Texture dispose 同步** — Phase 5 添加 LRU 淘汰 + dispose
- [ ] **SF-3: 补充缺失测试** — sync/hitTest/交互回归

### Implementation Notes
- 渲染循环: dirty flag + 单次 rAF（不跑 60fps 循环）
- PlaneGeometry: 固定 1x1 + mesh.scale，不在 resize 时重建
- SDF 字体: 用 tinysdf/msdf-bmfont 库，不自写 atlas 生成器
- Vite GLSL: 用 `import ... from './shader.frag?raw'` + vite-env.d.ts 类型声明
- 纹理双加载: Phase 1-4 CSS textureLoader 和 WebGL TextureCache 共存
- resolveTexturePath: 从 Canvas.tsx 提取为独立工具函数
- z-order: 确保 mesh.position.z 正确反映帧嵌套层级
```

---

## Failure Modes

| # | 场景 | 影响 | 缓解 |
|---|------|------|------|
| ~~F1~~ | ~~applyTransform 数学错误~~ | ~~已消除~~ | MF-1: 删除 applyTransform，用 CSS transform ✅ |
| ~~F2~~ | ~~WebGL context 超限~~ | ~~Phase 1-4 可接受~~ | MF-2: Phase 5 modelBridge 统一 ✅ |
| ~~F3~~ | ~~BLP IPC 卡顿~~ | ~~已消除~~ | MF-3: 改用前端 blpDecoder.ts ✅ |
| ~~F4~~ | ~~纹理加载失败无 fallback~~ | ~~已修复~~ | SF-1: 品红占位 + pending 清理 ✅ |
| F5 | GPU 内存泄漏 (Texture 不 dispose) | 长时间使用后 Tauri 进程 OOM | Phase 5 添加 LRU 淘汰 + dispose |
| F6 | Phase 5 删除 CSS 渲染后交互退化 | 拖拽/选中/框选失灵 | SF-3 交互回归测试 |
| F7 | Shader 编译失败 (不同 GPU 驱动) | WebGL 渲染黑屏 | 加 shader 编译错误日志 + CSS fallback 开关 |

---

## Parallelization Strategy

```
Week 1-2 (Phase 1): Sequential — 基础架构必须先搭好
  ┌─ SceneGraphManager 骨架 (camera 固定，无 applyTransform)
  ├─ TextureCache (前端 blpDecoder.ts 解码 → DataTexture)
  ├─ 纯色矩形渲染 (验证 coordinate mapping + CSS transform 继承)
  └─ <canvas> 嵌入 canvas-wrapper 验证 pan/zoom

Week 3-4 (Phase 2): Parallel tracks
  Track A: ShaderLib + backdrop shader + 九宫格
  Track B: 非 BLP 纹理格式 (PNG/TGA) + OffscreenCanvas 解码

Week 5-6 (Phase 3): Parallel tracks
  Track A: SDF 字体 (tinysdf 集成)
  Track B: hitTest 实现 + 测试

Week 7-8 (Phase 4): Sequential — 控件渲染依赖 Phase 2-3
  交互控件 + ModelViewer DOM overlay 验证

Week 9-10 (Phase 5): Parallel tracks
  Track A: 删除 CSS 渲染 + 交互回归测试
  Track B: modelBridge + Batch rendering 优化 + LRU 纹理淘汰
```

---

## Review Readiness Dashboard

| Check | Status |
|-------|--------|
| 所有 must-fix issues 已解决 | ✅ 3/3 (MF-1, MF-2, MF-3) RESOLVED |
| 所有 should-fix issues 已标记 | ✅ SF-1 resolved, SF-2 deferred, SF-3 pending |
| Scope challenge 完成 | ✅ 5 decisions made |
| 测试覆盖缺口已识别 | ✅ 3 missing tests (applyTransform test removed) |
| NOT in scope 明确 | ✅ 7 items |
| 复用清单 | ✅ 12 existing components |
| TODOS 更新建议 | ✅ provided |
| Failure modes | ✅ 4/7 eliminated, 3 remaining |
| Parallelization | ✅ 5-phase strategy |

---

## Verdict

**PASS**. 三个 must-fix 全部解决：

1. **MF-1** ✅: 删除 `applyTransform()`，WebGL canvas 放入 CSS wrapper，camera 固定不变。
   经数学推导验证，原公式无法正确等价 CSS `scale(s) translate(ox, oy)` + transform-origin 50%50%。
   额外发现现有坐标转换存在预置 bug（不影响操作，因 delta 抵消）。
2. **MF-2** ✅: Phase 1-4 保留 ModelViewer DOM overlay；Phase 5 用 OffscreenCanvas→readPixels→DataTexture 桥接。
3. **MF-3** ✅: 改用前端 `blpDecoder.ts` 的 `decodeBLP()` 直接获取 RGBA ImageData，
   绕过 Rust IPC `decode_blp_to_rgba` 的 `Vec<u8>` JSON 序列化瓶颈。

**可以开始 Phase 1 编码。**
