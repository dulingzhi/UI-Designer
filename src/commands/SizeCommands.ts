import { Command } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { FrameData } from '../types';

type SizeType = 'width' | 'height' | 'both';

// 统一大小命令
export class UnifySizeCommand implements Command {
  private frameIds: string[];
  private sizeType: SizeType;
  private oldSizes: Map<string, { width: number; height: number }> = new Map();

  constructor(frameIds: string[], sizeType: SizeType) {
    this.frameIds = frameIds;
    this.sizeType = sizeType;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frames = this.frameIds.map(id => store.getFrame(id)).filter(Boolean) as FrameData[];
    
    if (frames.length < 2) {
      console.warn('[UnifySizeCommand] Need at least 2 frames to unify size');
      return;
    }

    // 保存原始大小
    frames.forEach(frame => {
      this.oldSizes.set(frame.id, { width: frame.width, height: frame.height });
    });

    // 使用第一个控件的大小作为参考
    const referenceFrame = frames[0];
    
    frames.forEach(frame => {
      if (frame.id !== referenceFrame.id) {
        const updates: Partial<FrameData> = {};
        
        if (this.sizeType === 'width' || this.sizeType === 'both') {
          updates.width = referenceFrame.width;
        }
        
        if (this.sizeType === 'height' || this.sizeType === 'both') {
          updates.height = referenceFrame.height;
        }
        
        store.updateFrame(frame.id, updates);
      }
    });

    console.log(`[UnifySizeCommand] Unified ${this.sizeType} for ${frames.length} frames`);
  }

  undo(): void {
    const store = useProjectStore.getState();
    this.oldSizes.forEach((size, frameId) => {
      store.updateFrame(frameId, { width: size.width, height: size.height });
    });
  }

  redo(): void {
    this.execute();
  }
}
