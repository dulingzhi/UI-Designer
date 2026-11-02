import { useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { useCommandStore } from '../store/commandStore';
import { RemoveFrameCommand, BatchRemoveFrameCommand, UpdateFrameCommand, CopyFrameCommand, PasteFrameCommand, CopyStyleCommand, PasteStyleCommand } from '../commands/FrameCommands';
import { DuplicateFrameCommand } from '../commands/DuplicateFrameCommand';
import { saveProject, loadProject, exportCode } from '../utils/fileOperations';
import { exportProject } from '../utils/codeExport';

export const useKeyboardShortcuts = (
  currentFilePath: string | null,
  setCurrentFilePath: (path: string | null) => void,
  setScale?: (scale: number | ((prev: number) => number)) => void,
  centerCanvas?: () => void,
  onDeleteRequest?: (targets: string[]) => void,
  onNewProjectRequest?: () => void,
  onShowAlert?: (options: { title: string; message: string; type: 'info' | 'warning' | 'danger' }) => void
) => {
  const { project, clearGuides } = useProjectStore();
  const { selectedFrameId } = useUIStore();
  const { undo, redo, canUndo, canRedo, executeCommand } = useCommandStore();


  // round 127：方向键多选微调——selectedFrameIds 全部成员（无选中回退主帧）。
  // 单帧走 executeCommand（正常入栈）；多帧组合命令一次 Ctrl+Z 全撤（r126 拖拽同款语义）。
  const nudgeSelected = (dx: number, dy: number) => {
    const ui = useUIStore.getState();
    const proj = useProjectStore.getState().project;
    const ids = ui.selectedFrameIds.length > 0 ? ui.selectedFrameIds : (ui.selectedFrameId ? [ui.selectedFrameId] : []);
    const cmds: UpdateFrameCommand[] = [];
    for (const id of ids) {
      const f = proj.frames[id];
      if (f) cmds.push(new UpdateFrameCommand(id, { x: f.x + dx, y: f.y + dy }));
    }
    if (cmds.length === 1) {
      executeCommand(cmds[0]);
    } else if (cmds.length > 1) {
      useCommandStore.getState().pushCommand({
        execute: () => cmds.forEach(c => c.execute()),
        undo: () => [...cmds].reverse().forEach(c => c.undo()),
        redo: () => cmds.forEach(c => c.redo()),
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略在输入框中的按键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // F1 独立处理 - 打开帮助
      if (e.key === 'F1') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('openShortcutHelp'));
        return;
      }

      // ========== Ctrl 组合键 ==========
      if (e.ctrlKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            handleSave();
            break;
          case 'z':
            e.preventDefault();
            if (canUndo()) undo();
            break;
          case 'y':
            e.preventDefault();
            if (canRedo()) redo();
            break;
          case 'c':
            e.preventDefault();
            handleCopy();
            break;
          case 'x':
            e.preventDefault();
            // 剪切 = 复制 + 删除（帮助面板早已宣称；补实现）
            handleCopy();
            handleCutDelete();
            break;
          case 'v':
            e.preventDefault();
            handlePaste();
            break;
          case 'd':
            e.preventDefault();
            handleDuplicate();
            break;
          case 'o':
            e.preventDefault();
            handleOpen();
            break;
          case 'n':
            e.preventDefault();
            handleNew();
            break;
          case 'j':
            e.preventDefault();
            copyToClipboard('jass');
            break;
          case 'l':
            e.preventDefault();
            copyToClipboard('lua');
            break;
          case 't':
            e.preventDefault();
            copyToClipboard('ts');
            break;
          case 'a':
            e.preventDefault();
            handleSelectAll();
            break;
          case ';':
            e.preventDefault();
            clearGuides();
            break;
          case ',':
            e.preventDefault();
            window.dispatchEvent(new CustomEvent('openPreferences'));
            break;
          // 缩放（帮助面板宣称；Ctrl+= 是 Ctrl+Shift+= 即 Ctrl+加号 的原生键位）
          case '=':
          case '+':
            e.preventDefault();
            if (setScale) setScale((prev: number) => Math.min(5, prev * 1.1));
            break;
          case '-':
            e.preventDefault();
            if (setScale) setScale((prev: number) => Math.max(0.1, prev * 0.9));
            break;
          case '0':
            e.preventDefault();
            if (setScale) setScale(1);
            break;
        }
      }

      // ========== Ctrl + Shift 组合键 ==========
      else if (e.ctrlKey && e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (canRedo()) redo();
            break;
          case 's':
            e.preventDefault();
            handleSaveAs();
            break;
          case 'c':
            e.preventDefault();
            handleCopyStyle();
            break;
          case 'v':
            e.preventDefault();
            handlePasteStyle();
            break;
          case 'a':
            e.preventDefault();
            handleInvertSelection();
            break;
          case 'j':
            e.preventDefault();
            exportToFile('jass');
            break;
          case 'l':
            e.preventDefault();
            exportToFile('lua');
            break;
          case 't':
            e.preventDefault();
            exportToFile('ts');
            break;
        }
      }

      // ========== Alt 组合键 ==========
      else if (e.altKey && !e.shiftKey && !e.ctrlKey) {
        const scaleMap: Record<string, number> = {
          '1': 1.0,
          '2': 0.5,
          '3': 0.33,
          '4': 0.25,
        };

        if (scaleMap[e.key]) {
          e.preventDefault();
          if (setScale) setScale(scaleMap[e.key]);
        }

        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          if (centerCanvas) centerCanvas();
        }
      }

      // ========== Alt + Shift 组合键 ==========
      else if (e.altKey && e.shiftKey && !e.ctrlKey) {
        const scaleMap: Record<string, number> = {
          '1': 1.0,
          '2': 2.0,
          '3': 3.0,
          '4': 4.0,
        };

        if (scaleMap[e.key]) {
          e.preventDefault();
          if (setScale) setScale(scaleMap[e.key]);
        }

        // 背景图快捷键
        if (e.key.toLowerCase() === 's') {
          e.preventDefault();
          useProjectStore.getState().updateGeneralSettings({ backgroundImage: '/backgrounds/wc3-with-ui.png' });
        }
        if (e.key.toLowerCase() === 'h') {
          e.preventDefault();
          useProjectStore.getState().updateGeneralSettings({ backgroundImage: '/backgrounds/wc3-no-ui.png' });
        }
      }

      // ========== 无修饰键 ==========
      else if (!e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Delete/Backspace: 删除（支持多选）
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault();
          const selectedIds = useUIStore.getState().selectedFrameIds;

          // 过滤掉锁定的控件
          const unlocked = selectedIds.filter(id => {
            const frame = project.frames[id];
            return frame && !frame.locked;
          });

          // 如果有删除请求回调，使用它（会显示确认框）
          if (onDeleteRequest && unlocked.length > 0) {
            onDeleteRequest(unlocked);
          }
          // 否则直接执行删除（兼容旧逻辑）
          else if (unlocked.length > 1) {
            executeCommand(new BatchRemoveFrameCommand(unlocked));
          } else if (unlocked.length === 1) {
            executeCommand(new RemoveFrameCommand(unlocked[0]));
          } else if (selectedFrameId) {
            // 兼容旧的单选逻辑
            const frame = project.frames[selectedFrameId];
            if (frame && !frame.locked) {
              if (onDeleteRequest) {
                onDeleteRequest([selectedFrameId]);
              } else {
                executeCommand(new RemoveFrameCommand(selectedFrameId));
              }
            }
          }
        }

        // Escape: 取消选择
        if (e.key === 'Escape') {
          useUIStore.getState().selectFrame(null);
        }

        // 方向键: 微调位置（普通 0.01；精细调整见下方 Shift+方向键分支）
        // round 127：多选微调——selectedFrameIds 全部成员同步步进，组合命令一次撤销
        if (selectedFrameId && project.frames[selectedFrameId]) {
          const step = 0.01;
          switch (e.key) {
            case 'ArrowLeft':
              e.preventDefault();
              nudgeSelected(-step, 0);
              break;
            case 'ArrowRight':
              e.preventDefault();
              nudgeSelected(step, 0);
              break;
            case 'ArrowUp':
              e.preventDefault();
              nudgeSelected(0, step);
              break;
            case 'ArrowDown':
              e.preventDefault();
              nudgeSelected(0, -step);
              break;
          }
        }
      }

      // ========== Shift + 方向键：精细微调 ==========
      // 修复：原实现把 Shift 步长判断放在 !e.shiftKey 分支内（恒 false），
      // Shift 精细调整(0.001)是死功能——Shift+方向键落入 Ctrl+Shift 分支尾无 case 静默无操作。
      // 现独立分支：Shift+方向键以 0.001 步长微调（Ctrl/Alt 未按下时）。
      else if (e.shiftKey && !e.ctrlKey && !e.altKey && selectedFrameId && project.frames[selectedFrameId]) {
        const step = 0.001; // Shift=精细调整(0.001)

        switch (e.key) {
          case 'ArrowLeft':
            e.preventDefault();
            nudgeSelected(-step, 0);
            break;
          case 'ArrowRight':
            e.preventDefault();
            nudgeSelected(step, 0);
            break;
          case 'ArrowUp':
            e.preventDefault();
            nudgeSelected(0, step);
            break;
          case 'ArrowDown':
            e.preventDefault();
            nudgeSelected(0, -step);
            break;
        }
      }
    };
    const handleSave = async () => {
      try {
        const path = await saveProject(project, currentFilePath || undefined);
        if (path) {
          setCurrentFilePath(path);
          window.dispatchEvent(new CustomEvent('project-state-reset'));
          console.log('✅ 项目已保存:', path);
        }
      } catch (error) {
        console.error('❌ 保存失败:', error);
        onShowAlert?.({ title: '错误', message: '保存失败: ' + error, type: 'danger' });
      }
    };

    const handleSaveAs = async () => {
      try {
        const path = await saveProject(project);
        if (path) {
          setCurrentFilePath(path);
          window.dispatchEvent(new CustomEvent('project-state-reset'));
          console.log('✅ 项目已另存为:', path);
        }
      } catch (error) {
        console.error('❌ 另存为失败:', error);
        onShowAlert?.({ title: '错误', message: '另存为失败: ' + error, type: 'danger' });
      }
    };

    const handleOpen = async () => {
      try {
        const result = await loadProject();
        if (result) {
          // 直接替换整个项目状态
          useProjectStore.setState({ project: result.project });
          useUIStore.getState().selectFrame(null);
          setCurrentFilePath(result.path);
          window.dispatchEvent(new CustomEvent('project-state-reset'));
          console.log('✅ 项目已打开:', result.path);
        }
      } catch (error) {
        console.error('❌ 打开失败:', error);
        onShowAlert?.({ title: '错误', message: '打开失败: ' + error, type: 'danger' });
      }
    };

    const handleNew = () => {
      if (onNewProjectRequest) {
        onNewProjectRequest();
      } else {
        // 降级处理：使用原生 confirm
        if (confirm('创建新项目将丢失未保存的更改。是否继续？')) {
          useProjectStore.getState().resetProject();
          setCurrentFilePath(null);
          window.dispatchEvent(new CustomEvent('project-state-reset'));
          console.log('✅ 新项目已创建');
        }
      }
    };

    const handleDuplicate = () => {
      if (selectedFrameId) {
        executeCommand(new DuplicateFrameCommand(selectedFrameId));
        console.log('✅ 控件已复制');
      }
    };

    const handleCopy = () => {
      if (selectedFrameId) {
        executeCommand(new CopyFrameCommand(selectedFrameId));
        console.log('✅ 已复制到剪贴板');
      }
    };

    const handleCutDelete = () => {
      // 剪切的删除半步：与 Delete 键同语义（过滤锁定帧，走确认框或命令层）
      if (!selectedFrameId) return;
      const frame = project.frames[selectedFrameId];
      if (!frame || frame.locked) return;
      if (onDeleteRequest) {
        onDeleteRequest([selectedFrameId]);
      } else {
        executeCommand(new RemoveFrameCommand(selectedFrameId));
      }
    };

    const handlePaste = () => {
      // 粘贴到当前位置，稍微偏移
      executeCommand(new PasteFrameCommand(0.02, 0.02));
      console.log('✅ 已粘贴');
    };

    const handleCopyStyle = () => {
      if (selectedFrameId) {
        executeCommand(new CopyStyleCommand(selectedFrameId));
        console.log('✅ 已复制样式');
      }
    };

    const handlePasteStyle = () => {
      const { selectedFrameIds } = useUIStore.getState();
      if (selectedFrameIds.length > 0) {
        executeCommand(new PasteStyleCommand(selectedFrameIds));
        console.log(`✅ 已粘贴样式到 ${selectedFrameIds.length} 个控件`);
      } else if (selectedFrameId) {
        executeCommand(new PasteStyleCommand([selectedFrameId]));
        console.log('✅ 已粘贴样式');
      }
    };

    const handleSelectAll = () => {
      // 获取所有控件ID
      const allFrameIds = Object.keys(project.frames);
      if (allFrameIds.length > 0) {
        useUIStore.getState().selectMultipleFrames(allFrameIds);
        console.log(`✅ 已全选 ${allFrameIds.length} 个控件`);
      }
    };

    const handleInvertSelection = () => {
      const { selectedFrameIds } = useUIStore.getState();
      const allFrameIds = Object.keys(project.frames);
      // 反选：选中未选中的，取消选中已选中的
      const newSelection = allFrameIds.filter(id => !selectedFrameIds.includes(id));
      useUIStore.getState().selectMultipleFrames(newSelection);
      console.log(`✅ 已反选，当前选中 ${newSelection.length} 个控件`);
    };

    const copyToClipboard = async (language: 'jass' | 'lua' | 'ts') => {
      try {
        const code = exportProject(project, language);
        await navigator.clipboard.writeText(code);
        console.log(`✅ ${language.toUpperCase()} 代码已复制到剪贴板`);
        // 可以添加Toast通知
      } catch (error) {
        console.error('❌ 复制到剪贴板失败:', error);
        onShowAlert?.({ title: '错误', message: '复制失败: ' + error, type: 'danger' });
      }
    };

    const exportToFile = async (language: 'jass' | 'lua' | 'ts') => {
      try {
        const code = exportProject(project, language);
        const path = await exportCode(code, language);
        if (path) {
          console.log(`✅ 代码已导出到: ${path}`);
        }
      } catch (error) {
        console.error('❌ 导出失败:', error);
        onShowAlert?.({ title: '错误', message: '导出失败: ' + error, type: 'danger' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFrameId, currentFilePath, project, canUndo, canRedo, executeCommand, setScale, centerCanvas]);
};
