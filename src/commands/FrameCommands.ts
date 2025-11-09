import { Command } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { FrameData } from '../types';

// 创建Frame命令
export class CreateFrameCommand implements Command {
  private frame: FrameData;
  private previousSelection: string | null;

  constructor(frame: FrameData) {
    this.frame = frame;
    this.previousSelection = useProjectStore.getState().selectedFrameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    store.addFrame(this.frame);
    store.selectFrame(this.frame.id);
  }

  undo(): void {
    const store = useProjectStore.getState();
    store.removeFrame(this.frame.id);
    store.selectFrame(this.previousSelection);
  }

  redo(): void {
    this.execute();
  }
}

// 删除Frame命令
export class RemoveFrameCommand implements Command {
  private frameId: string;
  private frameData: FrameData | null = null;
  private previousSelection: string | null;

  constructor(frameId: string) {
    this.frameId = frameId;
    this.previousSelection = useProjectStore.getState().selectedFrameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    this.frameData = store.getFrame(this.frameId) || null;
    store.removeFrame(this.frameId);
  }

  undo(): void {
    if (this.frameData) {
      const store = useProjectStore.getState();
      store.addFrame(this.frameData);
      store.selectFrame(this.previousSelection);
    }
  }

  redo(): void {
    this.execute();
  }
}

// 更新Frame属性命令
export class UpdateFrameCommand implements Command {
  private frameId: string;
  private updates: Partial<FrameData>;
  private previousState: Partial<FrameData> = {};

  constructor(frameId: string, updates: Partial<FrameData>) {
    this.frameId = frameId;
    this.updates = updates;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frame = store.getFrame(this.frameId);
    
    if (frame) {
      // 保存之前的状态
      Object.keys(this.updates).forEach(key => {
        const k = key as keyof FrameData;
        (this.previousState as any)[k] = frame[k];
      });
      
      store.updateFrame(this.frameId, this.updates);
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    store.updateFrame(this.frameId, this.previousState);
  }

  redo(): void {
    const store = useProjectStore.getState();
    store.updateFrame(this.frameId, this.updates);
  }
}

// 移动Frame命令
export class MoveFrameCommand implements Command {
  private frameId: string;
  private newX: number;
  private newY: number;
  private oldX: number = 0;
  private oldY: number = 0;

  constructor(frameId: string, x: number, y: number) {
    this.frameId = frameId;
    this.newX = x;
    this.newY = y;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frame = store.getFrame(this.frameId);
    
    if (frame) {
      this.oldX = frame.x;
      this.oldY = frame.y;
      store.updateFrame(this.frameId, { x: this.newX, y: this.newY });
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    store.updateFrame(this.frameId, { x: this.oldX, y: this.oldY });
  }

  redo(): void {
    this.execute();
  }
}

// 修改父级命令
export class ChangeParentCommand implements Command {
  private frameId: string;
  private newParentId: string | null;
  private oldParentId: string | null = null;

  constructor(frameId: string, newParentId: string | null) {
    this.frameId = frameId;
    this.newParentId = newParentId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frame = store.getFrame(this.frameId);
    
    if (frame) {
      this.oldParentId = frame.parentId;
      // updateFrame 会自动处理父子关系的更新
      store.updateFrame(this.frameId, { parentId: this.newParentId });
    }
  }

  undo(): void {
    const store = useProjectStore.getState();
    // updateFrame 会自动处理父子关系的恢复
    store.updateFrame(this.frameId, { parentId: this.oldParentId });
  }

  redo(): void {
    this.execute();
  }
}

// 复制Frame命令
export class CopyFrameCommand implements Command {
  private frameId: string;

  constructor(frameId: string) {
    this.frameId = frameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    store.copyToClipboard(this.frameId);
  }

  undo(): void {
    // 复制操作不需要撤销
  }

  redo(): void {
    this.execute();
  }
}

// 粘贴Frame命令
export class PasteFrameCommand implements Command {
  private pastedFrameIds: string[] = [];
  private previousSelection: string | null;
  private offsetX: number;
  private offsetY: number;

  constructor(offsetX: number = 0.01, offsetY: number = 0.01) {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.previousSelection = useProjectStore.getState().selectedFrameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const clipboard = store.clipboard;
    
    if (!clipboard) {
      console.warn('[PasteCommand] Nothing in clipboard');
      return;
    }

    // 递归粘贴控件及其子控件
    const pasteFrameRecursive = (
      sourceFrame: any, // clipboard 中存储的是完整的子控件数据
      parentId: string | null,
      isRoot: boolean = true
    ): string => {
      // 生成新ID
      const newId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // 创建新控件数据
      const newFrame: FrameData = {
        ...sourceFrame,
        id: newId,
        name: `${sourceFrame.name}_副本`,
        parentId,
        // 偏移位置（只对根控件偏移）
        x: isRoot ? sourceFrame.x + this.offsetX : sourceFrame.x,
        y: isRoot ? sourceFrame.y + this.offsetY : sourceFrame.y,
        children: [], // 先创建空的children数组
      };

      // 添加新控件
      store.addFrame(newFrame);
      this.pastedFrameIds.push(newId);

      // 递归粘贴子控件
      if (sourceFrame.children && Array.isArray(sourceFrame.children)) {
        sourceFrame.children.forEach((childFrame: any) => {
          if (childFrame && typeof childFrame === 'object') {
            pasteFrameRecursive(childFrame, newId, false);
          }
        });
      }

      return newId;
    };

    // 执行粘贴
    const newRootId = pasteFrameRecursive(clipboard, clipboard.parentId, true);
    
    // 选中新粘贴的控件
    store.selectFrame(newRootId);
    
    console.log('[PasteCommand] Pasted frames:', this.pastedFrameIds);
  }

  undo(): void {
    const store = useProjectStore.getState();
    // 删除所有粘贴的控件（从后向前删除，确保先删除子控件）
    [...this.pastedFrameIds].reverse().forEach(id => {
      store.removeFrame(id);
    });
    store.selectFrame(this.previousSelection);
  }

  redo(): void {
    this.execute();
  }
}

// 批量删除命令
export class BatchRemoveFrameCommand implements Command {
  private frameIds: string[];
  private framesData: Map<string, FrameData> = new Map();
  private previousSelection: string | null;

  constructor(frameIds: string[]) {
    this.frameIds = frameIds;
    this.previousSelection = useProjectStore.getState().selectedFrameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    // 保存所有要删除的控件数据
    this.frameIds.forEach(id => {
      const frame = store.getFrame(id);
      if (frame) {
        this.framesData.set(id, frame);
        store.removeFrame(id);
      }
    });
  }

  undo(): void {
    const store = useProjectStore.getState();
    // 恢复所有删除的控件
    this.framesData.forEach((frame) => {
      store.addFrame(frame);
    });
    store.selectFrame(this.previousSelection);
  }

  redo(): void {
    this.execute();
  }
}

// 复制样式命令
export class CopyStyleCommand implements Command {
  private frameId: string;

  constructor(frameId: string) {
    this.frameId = frameId;
  }

  execute(): void {
    const store = useProjectStore.getState();
    store.copyStyleToClipboard(this.frameId);
  }

  undo(): void {
    // 复制样式操作不需要撤销
  }

  redo(): void {
    this.execute();
  }
}

// 粘贴样式命令
export class PasteStyleCommand implements Command {
  private targetFrameIds: string[];
  private previousStyles: Map<string, Partial<FrameData>> = new Map();

  constructor(targetFrameIds: string[]) {
    this.targetFrameIds = targetFrameIds;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const styleClipboard = store.styleClipboard;
    
    if (!styleClipboard) {
      console.warn('[PasteStyleCommand] No style in clipboard');
      return;
    }

    // 保存当前样式以便撤销
    this.targetFrameIds.forEach(frameId => {
      const frame = store.project.frames[frameId];
      if (frame) {
        this.previousStyles.set(frameId, {
          textColor: frame.textColor,
          textScale: frame.textScale,
          horAlign: frame.horAlign,
          verAlign: frame.verAlign,
          texture: frame.texture,
          text: frame.text,
        });
      }
    });

    // 应用样式
    store.pasteStyleFromClipboard(this.targetFrameIds);
  }

  undo(): void {
    const store = useProjectStore.getState();
    
    this.previousStyles.forEach((style, frameId) => {
      store.updateFrame(frameId, style);
    });
  }

  redo(): void {
    const store = useProjectStore.getState();
    store.pasteStyleFromClipboard(this.targetFrameIds);
  }
}
