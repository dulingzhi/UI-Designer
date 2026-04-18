# 视觉回归测试 (Visual Regression)

## 目的
对编辑器画布渲染输出进行像素级监督，量化 "100% 对齐 WC3 1.27a" 的进度。

## 验收准则
| 指标 | 阈值 | 说明 |
|------|------|------|
| PSNR | ≥ 45 dB | 峰值信噪比，越高越像 |
| diffRatio | ≤ 0.001 | 不同像素占比 ≤ 0.1% |
| maxChannelDiff | ≤ 1 | 单通道误差 ≤ 1/255 |

三项**全部满足**才视为通过。

## 当前状态 (Phase 0)
- ✅ `compare.ts` — pixelmatch + pngjs 比对工具（含 PSNR 计算）
- ✅ `compare.test.ts` — 自检测试，验证比对链路本身工作
- ✅ `SceneGraphManager.snapshotPNG()` — 渲染器侧导出 PNG bytes
- ⏳ `tests/baselines/*.png` — 基线图（待补充）
- ⏳ `render.test.ts` — 端到端：加载 FDF → 渲染 → 对比基线（待补充）

## 基线获取（待实现）
两种方案：
1. **自参考基线**（短期）：当前渲染器输出 → 写盘 → 后续改动作为回归对比
2. **WC3 实机基线**（长期）：在 1.27a 客户端跑同样 FDF，截屏抠图

短期建议：先自参考，每次 shader/几何修改后**手动 review diff PNG**，确认改动符合预期后更新基线。

## 跑测试
```bash
bun vitest run tests/visual-regression
```

## 文件
- `compare.ts` — 比对核心
- `compare.test.ts` — 比对工具自检
- `(future) render.ts` — headless renderer 封装
- `(future) baselines/` — 基线 PNG
