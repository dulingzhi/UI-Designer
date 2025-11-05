# 参考线功能更新日志

## 版本 0.5.0 - 2025-11-05

### 新增功能：自定义参考线系统

实现了完整的参考线系统，为设计师提供专业的辅助布局工具。

#### 主要更新

1. **类型定义** (`src/types/index.ts`)
   - 新增 `GuideLine` 接口定义
   - 在 `ProjectData` 中添加 `guides` 数组

2. **数据管理** (`src/store/projectStore.ts`)
   - 新增 `addGuide()` 方法 - 添加参考线
   - 新增 `updateGuide()` 方法 - 更新参考线位置或属性
   - 新增 `removeGuide()` 方法 - 删除单条参考线
   - 新增 `clearGuides()` 方法 - 清除所有参考线

3. **参考线组件** (`src/components/GuideLine.tsx`)
   - 实现参考线可视化
   - 支持拖拽移动参考线
   - 支持双击或右键删除参考线
   - 悬停时显示位置提示
   - 支持锁定状态和自定义颜色

4. **标尺增强** (`src/components/Ruler.tsx`)
   - 支持从标尺拖拽创建参考线
   - 水平标尺创建水平参考线
   - 垂直标尺创建垂直参考线
   - 拖拽时光标变化提示

5. **画布集成** (`src/components/Canvas.tsx`)
   - 渲染所有参考线
   - 处理参考线创建回调
   - 支持缩放和平移时参考线跟随

6. **吸附功能** (`src/utils/snapUtils.ts`)
   - 扩展 `calculateSnap()` 函数支持参考线吸附
   - 元素边缘吸附到参考线
   - 元素中心吸附到参考线
   - 5像素吸附阈值

7. **菜单集成** (`src/components/MenuBar.tsx`)
   - 在"查看"菜单添加"清除参考线"选项
   - 显示参考线数量状态
   - 无参考线时选项禁用

8. **键盘快捷键** (`src/hooks/useKeyboardShortcuts.ts`)
   - `Ctrl+;` - 清除所有参考线

9. **样式** (`src/components/GuideLine.css`)
   - 参考线默认蓝色半透明
   - 悬停时高亮显示
   - 锁定状态灰色显示
   - 位置提示样式

#### 技术特点

- **完全类型安全**: 使用TypeScript完整定义所有类型
- **响应式设计**: 参考线随画布缩放和平移自动调整
- **性能优化**: 使用React状态管理，避免不必要的重渲染
- **用户友好**: 直观的拖拽操作，清晰的视觉反馈
- **数据持久化**: 参考线随项目保存和加载

#### 使用示例

```typescript
// 添加垂直参考线
addGuide({
  id: 'guide-1',
  orientation: 'vertical',
  position: 200,
  color: '#00aaff'
});

// 添加水平参考线
addGuide({
  id: 'guide-2',
  orientation: 'horizontal',
  position: 300,
  locked: true  // 锁定，不可移动或删除
});

// 更新参考线位置
updateGuide('guide-1', { position: 250 });

// 删除参考线
removeGuide('guide-1');

// 清除所有参考线
clearGuides();
```

#### 操作指南

1. **创建参考线**: 从标尺拖拽到画布
2. **移动参考线**: 拖拽参考线到新位置
3. **删除参考线**: 双击或右键点击参考线
4. **清除所有**: `Ctrl+;` 或菜单选择

#### 已知限制

- 参考线不会导出到FDF/JASS代码（设计决策，仅用于辅助设计）
- 暂不支持参考线管理面板
- 暂不支持精确输入位置

#### 文件清单

新增文件：
- `src/components/GuideLine.tsx` - 参考线组件
- `src/components/GuideLine.css` - 参考线样式
- `GUIDELINE_FEATURE.md` - 功能说明文档
- `GUIDELINE_CHANGELOG.md` - 更新日志

修改文件：
- `src/types/index.ts`
- `src/store/projectStore.ts`
- `src/components/Ruler.tsx`
- `src/components/Canvas.tsx`
- `src/utils/snapUtils.ts`
- `src/components/MenuBar.tsx`
- `src/hooks/useKeyboardShortcuts.ts`

#### 兼容性

- ✅ 向后兼容：旧项目文件加载时自动初始化空参考线数组
- ✅ 数据完整性：参考线数据随项目保存
- ✅ 跨平台：所有平台统一体验

#### 下一步计划

- [ ] 参考线管理面板
- [ ] 精确位置输入
- [ ] 参考线预设模板
- [ ] 参考线导入/导出

---

**开发者**: AI Assistant  
**完成时间**: 2025-11-05  
**难度评级**: 中等  
**工时估计**: 2-3小时
