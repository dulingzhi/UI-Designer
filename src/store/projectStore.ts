import { create } from 'zustand';
import { ProjectData, FrameData, TableArrayData, CircleArrayData } from '../types';
import { createDefaultAnchors } from '../utils/anchorUtils';

interface ProjectState {
  project: ProjectData;
  selectedFrameId: string | null;
  selectedFrameIds: string[]; // 多选支持
  clipboard: FrameData | null; // 剪贴板，存储被复制的控件
  
  // 项目操作
  setProject: (project: ProjectData) => void;
  resetProject: () => void;
  
  // Frame操作
  addFrame: (frame: FrameData) => void;
  updateFrame: (id: string, updates: Partial<FrameData>) => void;
  removeFrame: (id: string) => void;
  deleteFrame: (id: string) => void; // 别名，等同于 removeFrame
  getFrame: (id: string) => FrameData | undefined;
  
  // 选择操作
  selectFrame: (id: string | null) => void;
  toggleSelectFrame: (id: string) => void; // Ctrl+点击切换选择
  selectMultipleFrames: (ids: string[]) => void; // 框选多个
  clearSelection: () => void;
  
  // 锁定操作
  toggleFrameLock: (id: string) => void;
  
  // 剪贴板操作
  copyToClipboard: (frameId: string) => void;
  
  // 通用设置
  updateGeneralSettings: (settings: Partial<Pick<ProjectData, 'libraryName' | 'originMode' | 'backgroundImage' | 'hideGameUI' | 'hideHeroBar' | 'hideMiniMap' | 'hideResources' | 'hideButtonBar' | 'hidePortrait' | 'hideChat'>>) => void;
  
  // Array操作
  addTableArray: (array: TableArrayData) => void;
  updateTableArray: (id: string, updates: Partial<TableArrayData>) => void;
  removeTableArray: (id: string) => void;
  
  addCircleArray: (array: CircleArrayData) => void;
  updateCircleArray: (id: string, updates: Partial<CircleArrayData>) => void;
  removeCircleArray: (id: string) => void;
}

const createDefaultProject = (): ProjectData => ({
  libraryName: 'REFORGEDUIMAKER',
  originMode: 'gameui',
  hideGameUI: false,
  hideHeroBar: false,
  hideMiniMap: false,
  hideResources: false,
  hideButtonBar: false,
  hidePortrait: false,
  hideChat: false,
  appInterface: 'dark',
  frames: {},
  rootFrameIds: [],
  tableArrays: [],
  circleArrays: [],
});

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: createDefaultProject(),
  selectedFrameId: null,
  selectedFrameIds: [],
  clipboard: null,

  setProject: (project) => {
    // 修复所有控件的锚点和children字段
    const fixedFrames: Record<string, FrameData> = {};
    
    // 第一步：确保每个控件都有必要的字段
    Object.entries(project.frames).forEach(([id, frame]) => {
      // 确保每个控件都有锚点数组
      if (!frame.anchors || frame.anchors.length === 0) {
        fixedFrames[id] = {
          ...frame,
          anchors: createDefaultAnchors(frame.x, frame.y, frame.width, frame.height),
          children: frame.children || []
        };
        console.log(`[Store] Fixed missing anchors for frame: ${frame.name}`);
      } else {
        fixedFrames[id] = {
          ...frame,
          children: frame.children || []
        };
      }
    });
    
    // 第二步：重建父子关系索引（修复可能损坏的children数组）
    // 先清空所有children数组
    Object.values(fixedFrames).forEach(frame => {
      frame.children = [];
    });
    
    // 根据每个控件的parentId重建父控件的children数组
    Object.entries(fixedFrames).forEach(([id, frame]) => {
      if (frame.parentId && fixedFrames[frame.parentId]) {
        if (!fixedFrames[frame.parentId].children.includes(id)) {
          fixedFrames[frame.parentId].children.push(id);
        }
      }
    });
    
    set({ 
      project: {
        ...project,
        frames: fixedFrames
      }
    });
  },
  
  resetProject: () => set({ 
    project: createDefaultProject(),
    selectedFrameId: null
  }),

  addFrame: (frame) => set((state) => {
    const updatedFrames = {
      ...state.project.frames,
      [frame.id]: frame,
    };
    
    // 如果有父控件，需要更新父控件的children数组
    if (frame.parentId && state.project.frames[frame.parentId]) {
      const parentFrame = state.project.frames[frame.parentId];
      updatedFrames[frame.parentId] = {
        ...parentFrame,
        children: [...parentFrame.children, frame.id],
      };
    }
    
    return {
      project: {
        ...state.project,
        frames: updatedFrames,
        rootFrameIds: frame.parentId === null 
          ? [...state.project.rootFrameIds, frame.id]
          : state.project.rootFrameIds,
      },
    };
  }),

  updateFrame: (id, updates) => set((state) => {
    const frame = state.project.frames[id];
    if (!frame) return state;

    const updatedFrames = {
      ...state.project.frames,
      [id]: { ...frame, ...updates },
    };

    // 如果更新了parentId，需要同步更新父子关系
    if ('parentId' in updates && updates.parentId !== frame.parentId) {
      const oldParentId = frame.parentId;
      const newParentId = updates.parentId;

      // 从旧父控件的children中移除
      if (oldParentId && updatedFrames[oldParentId]) {
        const oldParent = updatedFrames[oldParentId];
        updatedFrames[oldParentId] = {
          ...oldParent,
          children: oldParent.children.filter(childId => childId !== id),
        };
      }

      // 添加到新父控件的children中
      if (newParentId && updatedFrames[newParentId]) {
        const newParent = updatedFrames[newParentId];
        updatedFrames[newParentId] = {
          ...newParent,
          children: [...newParent.children, id],
        };
      }
    }

    // 更新rootFrameIds
    let newRootFrameIds = state.project.rootFrameIds;
    if ('parentId' in updates) {
      if (updates.parentId === null && !newRootFrameIds.includes(id)) {
        // 变为根控件
        newRootFrameIds = [...newRootFrameIds, id];
      } else if (updates.parentId !== null && newRootFrameIds.includes(id)) {
        // 从根控件变为子控件
        newRootFrameIds = newRootFrameIds.filter(fid => fid !== id);
      }
    }

    return {
      project: {
        ...state.project,
        frames: updatedFrames,
        rootFrameIds: newRootFrameIds,
      },
    };
  }),

  removeFrame: (id) => set((state) => {
    const { [id]: removed, ...remainingFrames } = state.project.frames;
    const frame = state.project.frames[id];
    
    if (!frame) return state;

    // 更新子元素的父级引用
    const updatedFrames = { ...remainingFrames };
    frame.children.forEach(childId => {
      if (updatedFrames[childId]) {
        updatedFrames[childId] = {
          ...updatedFrames[childId],
          parentId: frame.parentId,
        };
      }
    });

    // 从父控件的children数组中移除当前控件
    if (frame.parentId && updatedFrames[frame.parentId]) {
      const parentFrame = updatedFrames[frame.parentId];
      updatedFrames[frame.parentId] = {
        ...parentFrame,
        children: parentFrame.children.filter(childId => childId !== id),
      };
    }

    return {
      project: {
        ...state.project,
        frames: updatedFrames,
        rootFrameIds: state.project.rootFrameIds.filter(fid => fid !== id),
      },
      selectedFrameId: state.selectedFrameId === id ? null : state.selectedFrameId,
    };
  }),

  // deleteFrame 是 removeFrame 的别名
  deleteFrame: (id) => get().removeFrame(id),

  getFrame: (id) => get().project.frames[id],

  selectFrame: (id) => set({ 
    selectedFrameId: id,
    selectedFrameIds: id ? [id] : []
  }),

  toggleSelectFrame: (id) => set((state) => {
    const isSelected = state.selectedFrameIds.includes(id);
    const newSelectedIds = isSelected
      ? state.selectedFrameIds.filter(fid => fid !== id)
      : [...state.selectedFrameIds, id];
    
    return {
      selectedFrameIds: newSelectedIds,
      selectedFrameId: newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null
    };
  }),

  selectMultipleFrames: (ids) => set({
    selectedFrameIds: ids,
    selectedFrameId: ids.length > 0 ? ids[ids.length - 1] : null
  }),

  clearSelection: () => set({
    selectedFrameId: null,
    selectedFrameIds: []
  }),

  toggleFrameLock: (id) => set((state) => {
    const frame = state.project.frames[id];
    if (!frame) return state;
    
    return {
      project: {
        ...state.project,
        frames: {
          ...state.project.frames,
          [id]: {
            ...frame,
            locked: !frame.locked
          }
        }
      }
    };
  }),

  copyToClipboard: (frameId) => {
    const state = get();
    const frame = state.project.frames[frameId];
    if (!frame) return;
    
    // 深拷贝控件数据（包括所有子控件）
    const cloneFrameRecursive = (frame: FrameData): FrameData => {
      return {
        ...frame,
        children: frame.children.map(childId => {
          const childFrame = state.project.frames[childId];
          return childFrame ? cloneFrameRecursive(childFrame) : null;
        }).filter(Boolean) as any[], // 暂时存储子控件的完整数据
      };
    };
    
    const clonedFrame = cloneFrameRecursive(frame);
    set({ clipboard: clonedFrame });
    console.log('[Store] Copied to clipboard:', clonedFrame.name);
  },

  updateGeneralSettings: (settings) => set((state) => ({
    project: {
      ...state.project,
      ...settings,
    },
  })),

  addTableArray: (array) => set((state) => ({
    project: {
      ...state.project,
      tableArrays: [...state.project.tableArrays, array],
    },
  })),

  updateTableArray: (id, updates) => set((state) => ({
    project: {
      ...state.project,
      tableArrays: state.project.tableArrays.map(arr =>
        arr.id === id ? { ...arr, ...updates } : arr
      ),
    },
  })),

  removeTableArray: (id) => set((state) => ({
    project: {
      ...state.project,
      tableArrays: state.project.tableArrays.filter(arr => arr.id !== id),
    },
  })),

  addCircleArray: (array) => set((state) => ({
    project: {
      ...state.project,
      circleArrays: [...state.project.circleArrays, array],
    },
  })),

  updateCircleArray: (id, updates) => set((state) => ({
    project: {
      ...state.project,
      circleArrays: state.project.circleArrays.map(arr =>
        arr.id === id ? { ...arr, ...updates } : arr
      ),
    },
  })),

  removeCircleArray: (id) => set((state) => ({
    project: {
      ...state.project,
      circleArrays: state.project.circleArrays.filter(arr => arr.id !== id),
    },
  })),
}));
