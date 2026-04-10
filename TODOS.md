# TODOS

## UI 重构 (from /plan-ceo-review, 2026-04-10)

### P1 — 必须做

- [x] **添加 vitest 测试框架 + 基础测试** ✅ 2026-04-10
  - Why: 重构安全网, 没有测试的重构是赌博
  - Scope: 安装 vitest, 为 CoordinateService 和 anchorUtils 核心函数写单元测试
  - Effort: S (CC: ~15min)
  - Depends on: 无
  - Files: package.json, vitest.config.ts (新), src/utils/anchorUtils.ts, src/utils/coordinateService.ts (新)

- [x] **拆分 Canvas.tsx** ✅ 2026-04-11
  - Why: 1502行烂泥球, 渲染+交互+坐标+纹理全混在一起, 新功能开发成本高
  - Scope: 提取 useCanvasDrag, useCanvasResize, useCanvasPan hooks; Canvas.tsx 从 ~1600 行降至 ~1076 行
  - Effort: M (CC: ~30min)
  - Depends on: vitest + constants 提取
  - Files: src/components/Canvas.tsx → src/hooks/useCanvasDrag.ts, src/hooks/useCanvasResize.ts, src/hooks/useCanvasPan.ts

- [x] **拆分 Store: UI 状态与 Domain 状态分离** ✅ 2026-04-11
  - Why: selectedFrameId/clipboard 等 UI 状态和 frames 域数据混在 750 行文件中, 容易互相影响
  - Scope: 新建 uiStore.ts 存放 selection/clipboard/highlight; projectStore 只保留 project 数据
  - Result: uiStore.ts (125 行), projectStore.ts 从 ~1020 行降至 ~900 行; 15 个文件 import 路径更新
  - Depends on: 无
  - Files: src/store/uiStore.ts (新), src/store/projectStore.ts, 5 commands + 7 components + 2 hooks + App.tsx

### P2 — 应该做

- [x] **拆分 PropertiesPanel** ✅ 2026-04-11
  - Why: 1532行, 20+属性类型堆在一个文件, 加新控件类型要在巨函数里加 case
  - Scope: 提取 AnchorEditor, TextProperties, TextureProperties, TypeSpecificProperties, BatchEditPanel; PropertiesPanel 从 ~1623 行降至 ~498 行
  - Effort: M (CC: ~30min)
  - Depends on: Store 拆分完成
  - Files: src/components/PropertiesPanel.tsx → src/components/properties/{AnchorEditor,TextProperties,TextureProperties,TypeSpecificProperties,BatchEditPanel}.tsx

- [x] **提取坐标常量和转换函数** ✅ 2026-04-10
  - Why: CANVAS_WIDTH/HEIGHT/MARGIN 在 Canvas.tsx 和 anchorUtils.ts 重复定义; 转换公式散布 10+ 处
  - Scope: 新建 src/constants.ts + src/utils/coordinateService.ts, 提供 wc3ToPixelX/Y, pixelToWc3X/Y
  - Effort: S (CC: ~10min)
  - Depends on: 无
  - Files: src/constants.ts (新), src/utils/coordinateService.ts (新), src/components/Canvas.tsx, src/utils/anchorUtils.ts
