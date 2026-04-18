import { create } from 'zustand';
import { FrameData } from '../types';
import { useProjectStore } from './projectStore';
import type { ButtonState } from '../renderer/buttonState';

/** 样式复制/粘贴涉及的属性列表 */
export const STYLE_PROPERTIES: (keyof FrameData)[] = [
  // 文本
  'textColor', 'textScale', 'horAlign', 'verAlign', 'text',
  'font', 'fontSize', 'fontFlags',
  'fontHighlightColor', 'fontDisabledColor', 'fontShadowOffset', 'fontShadowColor',
  // 纹理
  'texture', 'textureFile', 'texCoord', 'alphaMode', 'decorateFileNames',
  // Backdrop
  'backdropBackground', 'backdropTileBackground', 'backdropBackgroundSize',
  'backdropBackgroundInsets', 'backdropEdgeFile', 'backdropCornerSize',
  'backdropCornerFlags', 'backdropBlendAll',
  // 按钮状态
  'controlBackdrop', 'controlPushedBackdrop', 'controlDisabledBackdrop',
  'controlMouseOverHighlight', 'buttonPushedTextOffset',
  // 高亮
  'highlightType', 'highlightAlphaFile', 'highlightAlphaMode',
];

interface UIState {
  // 选择状态
  selectedFrameId: string | null;
  selectedFrameIds: string[];
  
  // 剪贴板
  clipboard: FrameData | null;
  styleClipboard: Partial<FrameData> | null;
  
  // 搜索高亮
  highlightedFrameIds: string[];
  
  // Canvas 显示状态
  showGrid: boolean;
  showAnchors: boolean;
  showRulers: boolean;
  snapToGrid: boolean;
  gridSize: number;

  // Button/Checkbox 预览态 — 全局状态, 让 Canvas 显示 normal/pushed/disabled/mouseover
  // 哪张 backdrop + 对应的 text offset/color. 默认 'normal'.
  buttonPreviewState: ButtonState;
  
  // 选择操作
  selectFrame: (id: string | null) => void;
  toggleSelectFrame: (id: string) => void;
  selectMultipleFrames: (ids: string[]) => void;
  clearSelection: () => void;
  
  // 搜索高亮
  setHighlightedFrames: (ids: string[]) => void;
  clearHighlightedFrames: () => void;
  
  // 剪贴板操作
  copyToClipboard: (frameId: string) => void;
  copyStyleToClipboard: (frameId: string) => void;
  pasteStyleFromClipboard: (targetFrameIds: string[]) => void;
  
  // Canvas 显示操作
  setShowGrid: (v: boolean) => void;
  setShowAnchors: (v: boolean) => void;
  setShowRulers: (v: boolean) => void;
  setSnapToGrid: (v: boolean) => void;
  setGridSize: (v: number) => void;
  setButtonPreviewState: (v: ButtonState) => void;
  
  // 组选择
  selectGroup: (groupId: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedFrameId: null,
  selectedFrameIds: [],
  clipboard: null,
  styleClipboard: null,
  highlightedFrameIds: [],
  showGrid: true,
  showAnchors: false,
  showRulers: true,
  snapToGrid: true,
  gridSize: 0.01,
  buttonPreviewState: 'normal',

  selectFrame: (id) => set({
    selectedFrameId: id,
    selectedFrameIds: id ? [id] : [],
  }),

  toggleSelectFrame: (id) => set((state) => {
    const isSelected = state.selectedFrameIds.includes(id);
    const newSelectedIds = isSelected
      ? state.selectedFrameIds.filter(fid => fid !== id)
      : [...state.selectedFrameIds, id];

    return {
      selectedFrameIds: newSelectedIds,
      selectedFrameId: newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null,
    };
  }),

  selectMultipleFrames: (ids) => set({
    selectedFrameIds: ids,
    selectedFrameId: ids.length > 0 ? ids[ids.length - 1] : null,
  }),

  clearSelection: () => set({
    selectedFrameId: null,
    selectedFrameIds: [],
  }),

  setHighlightedFrames: (ids) => set({ highlightedFrameIds: ids }),

  clearHighlightedFrames: () => set({ highlightedFrameIds: [] }),

  setShowGrid: (v) => set({ showGrid: v }),
  setShowAnchors: (v) => set({ showAnchors: v }),
  setShowRulers: (v) => set({ showRulers: v }),
  setSnapToGrid: (v) => set({ snapToGrid: v }),
  setGridSize: (v) => set({ gridSize: v }),
  setButtonPreviewState: (v) => set({ buttonPreviewState: v }),

  copyToClipboard: (frameId) => {
    const { project } = useProjectStore.getState();
    const frame = project.frames[frameId];
    if (!frame) return;

    const cloneFrameRecursive = (f: FrameData): FrameData => {
      return {
        ...f,
        children: f.children.map(childId => {
          const childFrame = project.frames[childId];
          return childFrame ? cloneFrameRecursive(childFrame) : null;
        }).filter(Boolean) as any[],
      };
    };

    set({ clipboard: cloneFrameRecursive(frame) });
  },

  copyStyleToClipboard: (frameId) => {
    const { project } = useProjectStore.getState();
    const frame = project.frames[frameId];
    if (!frame) return;

    set({
      styleClipboard: Object.fromEntries(
        STYLE_PROPERTIES
          .filter(key => frame[key] !== undefined)
          .map(key => [key, frame[key]])
      ),
    });
  },

  pasteStyleFromClipboard: (targetFrameIds) => {
    const { styleClipboard } = get();
    if (!styleClipboard) return;

    const { project, setProject } = useProjectStore.getState();
    const updatedFrames = { ...project.frames };

    targetFrameIds.forEach(frameId => {
      const frame = updatedFrames[frameId];
      if (frame && !frame.locked) {
        updatedFrames[frameId] = { ...frame, ...styleClipboard };
      }
    });

    setProject({ ...project, frames: updatedFrames });
  },

  selectGroup: (groupId) => {
    const { project } = useProjectStore.getState();
    const group = (project.frameGroups || []).find(g => g.id === groupId);
    if (group) {
      set({ selectedFrameIds: [...group.frameIds] });
    }
  },
}));
