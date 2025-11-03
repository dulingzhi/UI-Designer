import React from 'react';
import './ShortcutHelp.css';

interface ShortcutHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutHelp: React.FC<ShortcutHelpProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const shortcuts = [
    { category: '文件操作', items: [
      { keys: 'Ctrl+N', description: '新建项目' },
      { keys: 'Ctrl+O', description: '打开项目' },
      { keys: 'Ctrl+S', description: '保存项目' },
      { keys: 'Ctrl+Shift+S', description: '另存为' },
    ]},
    { category: '编辑操作', items: [
      { keys: 'Ctrl+Z', description: '撤销' },
      { keys: 'Ctrl+Y', description: '重做' },
      { keys: 'Ctrl+C', description: '复制选中控件' },
      { keys: 'Ctrl+V', description: '粘贴控件' },
      { keys: 'Ctrl+X', description: '剪切控件' },
      { keys: 'Ctrl+D', description: '快速复制选中控件' },
      { keys: 'Delete / Backspace', description: '删除选中控件' },
      { keys: 'Esc', description: '取消选择' },
    ]},
    { category: '控件微调', items: [
      { keys: '方向键', description: '移动控件 (步长 0.01)' },
      { keys: 'Shift+方向键', description: '精细移动 (步长 0.001)' },
    ]},
    { category: '画布操作', items: [
      { keys: 'Alt+滚轮', description: '缩放画布' },
      { keys: 'Alt+拖拽 / 中键拖拽', description: '平移画布' },
      { keys: 'Shift+左键拖拽', description: '框选多个控件' },
      { keys: 'Ctrl+点击', description: '多选/取消选择控件' },
      { keys: 'Alt+C', description: '画布居中' },
      { keys: 'Ctrl++', description: '放大画布' },
      { keys: 'Ctrl+-', description: '缩小画布' },
      { keys: 'Ctrl+0', description: '重置缩放 (100%)' },
      { keys: 'Alt+1/2/3/4', description: '缩放到 100%/50%/33%/25%' },
      { keys: 'Alt+Shift+1/2/3/4', description: '缩放到 100%/200%/300%/400%' },
    ]},
    { category: '导出功能', items: [
      { keys: 'Ctrl+J', description: '复制 JASS 代码到剪贴板' },
      { keys: 'Ctrl+L', description: '复制 Lua 代码到剪贴板' },
      { keys: 'Ctrl+T', description: '复制 TypeScript 代码到剪贴板' },
      { keys: 'Ctrl+Shift+J/L/T', description: '导出代码到文件' },
    ]},
    { category: '视图切换', items: [
      { keys: 'Alt+Shift+S', description: '切换到带UI背景' },
      { keys: 'Alt+Shift+H', description: '切换到无UI背景' },
    ]},
    { category: '帮助', items: [
      { keys: 'F1 / Ctrl+/', description: '显示快捷键帮助' },
    ]},
  ];

  return (
    <div className="shortcut-help-overlay" onClick={onClose}>
      <div className="shortcut-help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-help-header">
          <h2>快捷键参考</h2>
          <button className="shortcut-close-btn" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        
        <div className="shortcut-help-content">
          {shortcuts.map((category, idx) => (
            <div key={idx} className="shortcut-category">
              <h3>{category.category}</h3>
              <div className="shortcut-list">
                {category.items.map((item, i) => (
                  <div key={i} className="shortcut-item">
                    <kbd className="shortcut-keys">{item.keys}</kbd>
                    <span className="shortcut-desc">{item.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        
        <div className="shortcut-help-footer">
          <p className="shortcut-tip">💡 提示：大部分操作都支持撤销/重做</p>
          <button className="shortcut-close-footer-btn" onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
