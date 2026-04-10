import { Command } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import { FrameData } from '../types';
import { nanoid } from 'nanoid';
import { createDefaultAnchors } from '../utils/anchorUtils';

// 复制 Frame 命令
export class DuplicateFrameCommand implements Command {
  private newFrameId: string;
  private newFrame: FrameData | null = null;
  private previousSelection: string | null;

  constructor(frameId: string, offsetX: number = 0.02, offsetY: number = 0.02) {
    this.newFrameId = nanoid();
    this.previousSelection = useUIStore.getState().selectedFrameId;
    
    // 创建副本 Frame
    const originalFrame = useProjectStore.getState().getFrame(frameId);
    if (originalFrame) {
      const newX = Math.min(0.8 - originalFrame.width, originalFrame.x + offsetX);
      const newY = Math.min(0.6 - originalFrame.height, originalFrame.y + offsetY);
      
      this.newFrame = {
        ...originalFrame,
        id: this.newFrameId,
        name: originalFrame.name + '_copy',
        x: newX,
        y: newY,
        anchors: createDefaultAnchors(newX, newY, originalFrame.width, originalFrame.height),
        children: [], // 暂不复制子元素
      };
    }
  }

  execute(): void {
    if (this.newFrame) {
      const store = useProjectStore.getState();
      store.addFrame(this.newFrame);
      useUIStore.getState().selectFrame(this.newFrameId);
    }
  }

  undo(): void {
    useProjectStore.getState().removeFrame(this.newFrameId);
    useUIStore.getState().selectFrame(this.previousSelection);
  }

  redo(): void {
    this.execute();
  }
}
