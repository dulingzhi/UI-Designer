import { create } from 'zustand';
import { ProjectData, FrameData, TableArrayData, CircleArrayData } from '../types';
import { createDefaultAnchors } from '../utils/anchorUtils';

interface ProjectState {
  project: ProjectData;
  selectedFrameId: string | null;
  
  // 项目操作
  setProject: (project: ProjectData) => void;
  resetProject: () => void;
  
  // Frame操作
  addFrame: (frame: FrameData) => void;
  updateFrame: (id: string, updates: Partial<FrameData>) => void;
  removeFrame: (id: string) => void;
  getFrame: (id: string) => FrameData | undefined;
  
  // 选择操作
  selectFrame: (id: string | null) => void;
  
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

  setProject: (project) => {
    // 修复所有控件的锚点
    const fixedFrames: Record<string, FrameData> = {};
    Object.entries(project.frames).forEach(([id, frame]) => {
      // 确保每个控件都有锚点数组
      if (!frame.anchors || frame.anchors.length === 0) {
        fixedFrames[id] = {
          ...frame,
          anchors: createDefaultAnchors(frame.x, frame.y, frame.width, frame.height)
        };
        console.log(`[Store] Fixed missing anchors for frame: ${frame.name}`);
      } else {
        fixedFrames[id] = frame;
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

  addFrame: (frame) => set((state) => ({
    project: {
      ...state.project,
      frames: {
        ...state.project.frames,
        [frame.id]: frame,
      },
      rootFrameIds: frame.parentId === null 
        ? [...state.project.rootFrameIds, frame.id]
        : state.project.rootFrameIds,
    },
  })),

  updateFrame: (id, updates) => set((state) => {
    const frame = state.project.frames[id];
    if (!frame) return state;

    return {
      project: {
        ...state.project,
        frames: {
          ...state.project.frames,
          [id]: { ...frame, ...updates },
        },
      },
    };
  }),

  removeFrame: (id) => set((state) => {
    const { [id]: removed, ...remainingFrames } = state.project.frames;
    const frame = state.project.frames[id];
    
    if (!frame) return state;

    // 移除子元素的引用
    const updatedFrames = { ...remainingFrames };
    frame.children.forEach(childId => {
      if (updatedFrames[childId]) {
        updatedFrames[childId] = {
          ...updatedFrames[childId],
          parentId: frame.parentId,
        };
      }
    });

    return {
      project: {
        ...state.project,
        frames: updatedFrames,
        rootFrameIds: state.project.rootFrameIds.filter(fid => fid !== id),
      },
      selectedFrameId: state.selectedFrameId === id ? null : state.selectedFrameId,
    };
  }),

  getFrame: (id) => get().project.frames[id],

  selectFrame: (id) => set({ selectedFrameId: id }),

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
