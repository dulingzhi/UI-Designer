import React from 'react';
import './ContextMenu.css';

export interface ContextMenuItem {
  label?: string;
  action?: () => void;
  disabled?: boolean;
  separator?: boolean;
  shortcut?: string;
  icon?: string;
  submenu?: ContextMenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [submenuState, setSubmenuState] = React.useState<{ index: number; x: number; y: number } | null>(null);

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onClose]);

  // 调整菜单位置，防止超出屏幕
  React.useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (rect.right > viewportWidth) {
        adjustedX = viewportWidth - rect.width - 5;
      }

      if (rect.bottom > viewportHeight) {
        adjustedY = viewportHeight - rect.height - 5;
      }

      if (adjustedX !== x || adjustedY !== y) {
        menuRef.current.style.left = `${adjustedX}px`;
        menuRef.current.style.top = `${adjustedY}px`;
      }
    }
  }, [x, y]);

  const handleItemClick = (item: ContextMenuItem, index: number, e: React.MouseEvent) => {
    if (item.disabled || !item.action) {
      e.stopPropagation();
      return;
    }

    if (item.submenu) {
      e.stopPropagation();
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setSubmenuState({
        index,
        x: rect.right,
        y: rect.top
      });
      return;
    }

    item.action();
    onClose();
  };

  const handleMouseEnter = (index: number, hasSubmenu: boolean) => {
    if (hasSubmenu) {
      // 悬停时显示子菜单（如果有）
      return;
    }
    // 关闭子菜单（如果在其他项上）
    if (submenuState && submenuState.index !== index) {
      setSubmenuState(null);
    }
  };

  return (
    <>
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: x, top: y }}
      >
        {items.map((item, index) => {
          if (item.separator) {
            return <div key={index} className="context-menu-separator" />;
          }

          return (
            <div
              key={index}
              className={`context-menu-item ${item.disabled ? 'disabled' : ''} ${item.submenu ? 'has-submenu' : ''}`}
              onClick={(e) => handleItemClick(item, index, e)}
              onMouseEnter={() => handleMouseEnter(index, !!item.submenu)}
            >
              {item.icon && <span className="context-menu-icon">{item.icon}</span>}
              <span className="context-menu-label">{item.label}</span>
              {item.shortcut && <span className="context-menu-shortcut">{item.shortcut}</span>}
              {item.submenu && <span className="context-menu-arrow">▶</span>}
            </div>
          );
        })}
      </div>

      {/* 子菜单 */}
      {submenuState && items[submenuState.index]?.submenu && (
        <ContextMenu
          x={submenuState.x}
          y={submenuState.y}
          items={items[submenuState.index].submenu!}
          onClose={onClose}
        />
      )}
    </>
  );
};
