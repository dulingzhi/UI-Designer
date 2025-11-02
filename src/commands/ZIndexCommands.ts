import { Command } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';

type ZIndexAction = 'moveUp' | 'moveDown' | 'bringToFront' | 'sendToBack';

// Z-Index调整命令
export class ZIndexCommand implements Command {
  private frameId: string;
  private action: ZIndexAction;
  private oldZIndex: number = 0;
  private newZIndex: number = 0;

  constructor(frameId: string, action: ZIndexAction) {
    this.frameId = frameId;
    this.action = action;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frame = store.getFrame(this.frameId);
    if (!frame) {
      console.warn('[ZIndexCommand] Frame not found:', this.frameId);
      return;
    }

    this.oldZIndex = frame.z;

    // 获取所有控件的 z-index
    const allFrames = Object.values(store.project.frames);
    const zIndexes = allFrames.map(f => f.z).sort((a, b) => a - b);
    const uniqueZIndexes = [...new Set(zIndexes)];

    switch (this.action) {
      case 'moveUp':
        // 上移一层：找到下一个更大的 z-index
        const higherZIndexes = uniqueZIndexes.filter(z => z > frame.z);
        if (higherZIndexes.length > 0) {
          this.newZIndex = higherZIndexes[0];
        } else {
          this.newZIndex = frame.z; // 已经是最高层
        }
        break;

      case 'moveDown':
        // 下移一层：找到下一个更小的 z-index
        const lowerZIndexes = uniqueZIndexes.filter(z => z < frame.z);
        if (lowerZIndexes.length > 0) {
          this.newZIndex = lowerZIndexes[lowerZIndexes.length - 1];
        } else {
          this.newZIndex = frame.z; // 已经是最低层
        }
        break;

      case 'bringToFront':
        // 置顶：设为最大 z-index + 1
        const maxZ = Math.max(...zIndexes);
        this.newZIndex = maxZ >= frame.z ? maxZ + 1 : frame.z;
        break;

      case 'sendToBack':
        // 置底：设为最小 z-index - 1
        const minZ = Math.min(...zIndexes);
        this.newZIndex = minZ <= frame.z ? minZ - 1 : frame.z;
        break;
    }

    if (this.newZIndex !== this.oldZIndex) {
      store.updateFrame(this.frameId, { z: this.newZIndex });
      console.log(`[ZIndexCommand] ${this.action}: ${this.oldZIndex} -> ${this.newZIndex}`);
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    store.updateFrame(this.frameId, { z: this.oldZIndex });
  }

  redo(): void {
    const store = useProjectStore.getState();
    store.updateFrame(this.frameId, { z: this.newZIndex });
  }
}
