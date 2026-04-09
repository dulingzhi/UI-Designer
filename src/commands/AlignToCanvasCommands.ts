import { Command } from '../store/commandStore';
import { useProjectStore } from '../store/projectStore';
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

type AlignToCanvasType = 'left' | 'right' | 'top' | 'bottom' | 'centerH' | 'centerV';

// 画布尺寸（4:3区域）
const CANVAS_WIDTH = WC3_MAX_X;
const CANVAS_HEIGHT = WC3_MAX_Y;

// 对齐到画布命令
export class AlignToCanvasCommand implements Command {
  private frameId: string;
  private alignType: AlignToCanvasType;
  private oldPosition: { x: number; y: number } | null = null;

  constructor(frameId: string, alignType: AlignToCanvasType) {
    this.frameId = frameId;
    this.alignType = alignType;
  }

  execute(): void {
    const store = useProjectStore.getState();
    const frame = store.getFrame(this.frameId);
    
    if (!frame) {
      console.warn('[AlignToCanvasCommand] Frame not found:', this.frameId);
      return;
    }

    // 保存原始位置
    this.oldPosition = { x: frame.x, y: frame.y };

    let newX = frame.x;
    let newY = frame.y;

    switch (this.alignType) {
      case 'left':
        // 左对齐：对齐到画布左边缘
        newX = 0;
        break;

      case 'right':
        // 右对齐：对齐到画布右边缘
        newX = CANVAS_WIDTH - frame.width;
        break;

      case 'top':
        // 顶对齐：对齐到画布顶边缘（顶边 = 0.6）
        newY = CANVAS_HEIGHT - frame.height;
        break;

      case 'bottom':
        // 底对齐：对齐到画布底边缘
        newY = 0;
        break;

      case 'centerH':
        // 水平居中
        newX = (CANVAS_WIDTH - frame.width) / 2;
        break;

      case 'centerV':
        // 垂直居中
        newY = (CANVAS_HEIGHT - frame.height) / 2;
        break;
    }

    store.updateFrame(this.frameId, { x: newX, y: newY });
    console.log(`[AlignToCanvasCommand] Aligned ${frame.name} to canvas ${this.alignType}`);
  }

  undo(): void {
    if (this.oldPosition) {
      const store = useProjectStore.getState();
      store.updateFrame(this.frameId, { x: this.oldPosition.x, y: this.oldPosition.y });
    }
  }

  redo(): void {
    this.execute();
  }
}
