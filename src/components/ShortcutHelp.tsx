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
      { keys: 'Ctrl + N', description: '新建项目' },
      { keys: 'Ctrl + O', description: '打开项目' },
      { keys: 'Ctrl + S', description: '保存项目' },
      { keys: 'Ctrl + Shift + S', description: '另存为' },
    ]},
    { category: '编辑操作', items: [
      { keys: 'Ctrl + Z', description: '撤销' },
      { keys: 'Ctrl + Y / Ctrl + Shift + Z', description: '重做' },
      { keys: 'Ctrl + D', description: '复制选中控件' },
      { keys: 'Delete / Backspace', description: '删除选中控件' },
      { keys: 'Esc', description: '取消选择' },
    ]},
    { category: '控件微调', items: [
      { keys: '方向键', description: '移动控件 (步长 0.01)' },
      { keys: 'Shift + 方向键', description: '精细移动 (步长 0.001)' },
    ]},
    { category: '画布操作', items: [
      { keys: 'Alt + 滚轮', description: '缩放画布' },
      { keys: 'Alt + 拖拽 / 中键拖拽', description: '平移画布' },
      { keys: 'Alt + C', description: '画布居中' },
      { keys: 'Alt + 1/2/3/4', description: '缩放到 100%/50%/33%/25%' },
      { keys: 'Alt + Shift + 1/2/3/4', description: '缩放到 100%/200%/300%/400%' },
    ]},
    { category: '导出功能', items: [
      { keys: 'Ctrl + J', description: '复制 JASS 代码到剪贴板' },
      { keys: 'Ctrl + L', description: '复制 Lua 代码到剪贴板' },
      { keys: 'Ctrl + T', description: '复制 TypeScript 代码到剪贴板' },
      { keys: 'Ctrl + Shift + J/L/T', description: '导出代码到文件' },
    ]},
    { category: '背景切换', items: [
      { keys: 'Alt + Shift + S', description: '切换到带UI背景' },
      { keys: 'Alt + Shift + H', description: '切换到无UI背景' },
    ]},
  ];

  return (
    <div className="shortcut-help-overlay" onClick={onClose}>
      <div className="shortcut-help-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="shortcut-help-header">
          <h2>快捷键帮助</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="shortcut-help-content">
          {shortcuts.map((category, idx) => (
            <div key={idx} className="shortcut-category">
              <h3>{category.category}</h3>
              <table>
                <tbody>
                  {category.items.map((item, i) => (
                    <tr key={i}>
                      <td className="shortcut-keys">{item.keys}</td>
                      <td className="shortcut-desc">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        
        <div className="shortcut-help-footer">
          <button onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
};
