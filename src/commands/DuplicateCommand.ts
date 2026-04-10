import { Command } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { FrameData } from '../types';

/**
 * 复制控件命令
 * 复制选中的控件，新控件位置稍微偏移
 */
export class DuplicateCommand implements Command {
  private frameId: string;
  private duplicatedFrameId: string | null = null;
  private duplicatedFrame: FrameData | null = null;
  private parentId: string | null = null;

  constructor(frameId: string) {
    this.frameId = frameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frame = store.getFrame(this.frameId);
    if (!frame) return;

    // 生成新的ID和名称
    this.duplicatedFrameId = `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const baseName = frame.name.replace(/\s*\(副本\s*\d*\)$/, '');
    
    // 查找同名副本的数量
    let copyCount = 1;
    const copyPattern = new RegExp(`^${baseName}\\s*\\(副本\\s*(\\d*)\\)$`);
    Object.values(store.project.frames).forEach((f: FrameData) => {
      const match = f.name.match(copyPattern);
      if (match) {
        const num = match[1] ? parseInt(match[1]) : 1;
        if (num >= copyCount) {
          copyCount = num + 1;
        }
      }
    });

    const newName = copyCount === 1 
      ? `${baseName} (副本)`
      : `${baseName} (副本 ${copyCount})`;

    // 创建副本，位置偏移 0.02 单位
    this.duplicatedFrame = {
      ...frame,
      id: this.duplicatedFrameId,
      name: newName,
      x: frame.x + 0.02,
      y: frame.y - 0.02,
      children: [],
      locked: false,
      anchors: frame.anchors.map(anchor => ({ ...anchor })),
    };

    // 找到父节点
    this.parentId = null;
    for (const [id, f] of Object.entries(store.project.frames)) {
      if (f.children?.includes(this.frameId)) {
        this.parentId = id;
        break;
      }
    }

    // 添加到项目
    store.addFrame(this.duplicatedFrame);

    // 如果有父节点，添加到父节点的children
    if (this.parentId) {
      const parent = store.getFrame(this.parentId);
      if (parent) {
        store.updateFrame(this.parentId, {
          children: [...parent.children, this.duplicatedFrameId],
        });
      }
    }

    // 选中新创建的副本
    useUIStore.getState().selectFrame(this.duplicatedFrameId);

    console.log(`复制控件 ${frame.name} -> ${newName}`);
  }

  undo(): void {
    if (!this.duplicatedFrameId) return;

    const store = useProjectStore.getState();

    // 从父节点移除
    if (this.parentId) {
      const parent = store.getFrame(this.parentId);
      if (parent) {
        store.updateFrame(this.parentId, {
          children: parent.children.filter(id => id !== this.duplicatedFrameId),
        });
      }
    }

    // 删除副本
    store.removeFrame(this.duplicatedFrameId);

    // 恢复选择原控件
    useUIStore.getState().selectFrame(this.frameId);

    console.log(`撤销复制: 已删除 ${this.duplicatedFrameId}`);
  }

  redo(): void {
    this.execute();
  }
}
