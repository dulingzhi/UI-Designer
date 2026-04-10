import { create } from 'zustand';
import { FrameData } from '../types';
import { useProjectStore } from './projectStore';

interface UIState {
  // 选择状态
  selectedFrameId: string | null;
  selectedFrameIds: string[];
  
  // 剪贴板
  clipboard: FrameData | null;
  styleClipboard: Partial<FrameData> | null;
  
  // 搜索高亮
  highlightedFrameIds: string[];
  
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
  
  // 组选择
  selectGroup: (groupId: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedFrameId: null,
  selectedFrameIds: [],
  clipboard: null,
  styleClipboard: null,
  highlightedFrameIds: [],

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
      styleClipboard: {
        textColor: frame.textColor,
        textScale: frame.textScale,
        horAlign: frame.horAlign,
        verAlign: frame.verAlign,
        texture: frame.texture,
        text: frame.text,
      },
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
