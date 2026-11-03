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
  // round 142：未保存修改标志（加载/新建前确认用；beforeunload 也读此值）
  dirty: boolean;
    setDirty: (dirty: boolean) => void;
  // 选择状态
  selectedFrameId: string | null;
  selectedFrameIds: string[];
  
  // 剪贴板
  clipboard: FrameData | null;
  // 决策项 5：多选复制剪贴板（顶层选择集快照，各含子树；与单帧 clipboard 并存）
  clipboardFrames: FrameData[];
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
  copyFramesToClipboard: (frameIds: string[]) => void;
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
  dirty: false,
  selectedFrameId: null,
  selectedFrameIds: [],
  clipboard: null,
  clipboardFrames: [],
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

  setDirty: (dirty) => set({ dirty }),
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

  // 决策项 5：多选复制——仅复制"选择集内不含祖先"的顶层帧（避免父子双份），
  // 各帧带完整子树快照；粘贴端 PasteFramesCommand 逐帧还原并保留相互 parent 关系。
  copyFramesToClipboard: (frameIds) => {
    const { project } = useProjectStore.getState();
    const selected = frameIds.filter(id => project.frames[id]);
    const hasAncestorInSet = (id: string): boolean => {
      let p = project.frames[id]?.parentId ?? null;
      while (p) {
        if (selected.includes(p)) return true;
        p = project.frames[p]?.parentId ?? null;
      }
      return false;
    };
    const topIds = selected.filter(id => !hasAncestorInSet(id));
    if (topIds.length === 0) return;

    const cloneFrameRecursive = (f: FrameData): FrameData => {
      return {
        ...f,
        children: f.children.map(childId => {
          const childFrame = project.frames[childId];
          return childFrame ? cloneFrameRecursive(childFrame) : null;
        }).filter(Boolean) as any[],
      };
    };

    set({ clipboardFrames: topIds.map(id => cloneFrameRecursive(project.frames[id])) });
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
      // round 105 修复两处：
      // ① 同步 selectedFrameId=最后成员（与 selectMultipleFrames/toggleSelectFrame
      //    语义一致——原实现只设 ids，组选择后属性面板残留旧选中帧）
      // ② frameIds 可选防御（手编辑存档 JSON 可能缺字段，spread undefined 抛错）
      const ids = [...(group.frameIds || [])];
      set({
        selectedFrameIds: ids,
        selectedFrameId: ids.length > 0 ? ids[ids.length - 1] : null,
      });
    }
  },
}));
