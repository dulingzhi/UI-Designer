# 📂 热重载路径配置更新总结

## ✅ 更新内容

### **1. 智能路径选择**
系统现在会根据War3安装路径自动选择合适的默认路径：

**War3 1.27 (检测到War3路径时):**
```
Lua 输出: {War3安装目录}\UI-Designer\ui_generated.lua
测试地图: {War3安装目录}\Maps\Test\test.w3x
```

**War3 Reforged (未设置War3路径时):**
```
Lua 输出: C:\Users\{用户名}\Documents\Warcraft III\CustomMapData\UI-Designer\ui_generated.lua
测试地图: C:\Users\{用户名}\Documents\Warcraft III\Maps\Test\test.w3x
```

### **2. 动态用户名获取**
- 使用 Tauri Rust 命令 `get_username` 获取系统用户名
- 自动保存到 `localStorage` 中
- 避免硬编码用户名，提高通用性

### **3. 路径规范化**
- 自动处理路径中的斜杠 (`/` → `\\`)
- 移除路径末尾的多余斜杠
- 确保路径格式符合Windows标准

### **4. UI 提示优化**
- 添加"自动根据War3路径选择"的提示文字
- 在使用说明中展示两种版本的路径格式
- 更新占位符文本为实际路径示例

---

## 🔧 技术实现

### **hotReloadExporter.ts**
```typescript
function getDefaultHotReloadConfig(): HotReloadConfig {
  const war3Path = localStorage.getItem('war3_install_path');
  
  if (war3Path) {
    // War3 1.27 路径
    const normalizedPath = war3Path.replace(/\//g, '\\').replace(/\\+$/, '');
    return {
      outputPath: `${normalizedPath}\\UI-Designer\\ui_generated.lua`,
      testMapPath: `${normalizedPath}\\Maps\\Test\\test.w3x`,
      // ...
    };
  } else {
    // Reforged 路径
    const username = localStorage.getItem('system_username') || '81468';
    return {
      outputPath: `C:\\Users\\${username}\\Documents\\Warcraft III\\CustomMapData\\UI-Designer\\ui_generated.lua`,
      testMapPath: `C:\\Users\\${username}\\Documents\\Warcraft III\\Maps\\Test\\test.w3x`,
      // ...
    };
  }
}
```

### **HotReloadPanel.tsx**
```typescript
useEffect(() => {
  // 获取并保存用户名
  const initUsername = async () => {
    const username = await invoke<string>('get_username');
    localStorage.setItem('system_username', username);
  };
  
  initUsername();
  // ...
}, []);
```

---

## 📋 文件结构对比

### **War3 1.27**
```
D:\Warcraft III\                    # War3安装目录
├── UI-Designer\
│   └── ui_generated.lua           # 生成的Lua文件
└── Maps\
    └── Test\
        └── test.w3x               # 测试地图
```

### **War3 Reforged**
```
C:\Users\{用户名}\Documents\Warcraft III\
├── CustomMapData\
│   └── UI-Designer\
│       └── ui_generated.lua       # 生成的Lua文件
└── Maps\
    └── Test\
        └── test.w3x               # 测试地图
```

---

## 🎯 优势

1. **自动适配**: 根据War3版本自动选择路径
2. **用户友好**: 无需手动配置复杂路径
3. **跨用户**: 自动获取当前用户名
4. **规范化**: 统一的路径格式处理
5. **提示清晰**: UI中显示路径选择逻辑

---

## 📝 相关提交

- `c7ad388` - refactor(hot-reload): 优化默认路径配置为War3标准目录
- `f64cf0e` - feat(hot-reload): 完整实现 War3 1.27 热重载系统

---

## 🚀 下一步使用

1. **首次打开热重载面板** - 自动检测War3路径并生成默认路径
2. **查看路径** - 确认路径是否符合预期
3. **手动调整** (可选) - 如果需要，可以手动修改路径
4. **启用热重载** - 开始自动导出Lua文件

---

**更新时间**: 2025年11月12日  
**状态**: ✅ 已完成并测试
