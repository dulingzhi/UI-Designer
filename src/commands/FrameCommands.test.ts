import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock hotReloadExporter / war3ProcessManager（避免 localStorage/进程依赖），与 uiStore.test.ts 同款
vi.mock('../utils/hotReloadExporter', () => ({
  hotReloadConfig: { enabled: false, outputPath: '', war3Path: '' },
  updateHotReloadConfig: vi.fn(),
  exportForHotReload: vi.fn(),
}));
vi.mock('../utils/war3ProcessManager', () => ({
  war3ProcessManager: {
    getCurrentPid: vi.fn(() => null),
    setPid: vi.fn(),
    clearPid: vi.fn(),
  },
}));
vi.stubGlobal('localStorage', {
  getItem: vi.fn(() => null),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(() => null),
});

import { useProjectStore } from '../store/projectStore';
import { useUIStore } from '../store/uiStore';
import {
  CreateFrameCommand,
  RemoveFrameCommand,
  UpdateFrameCommand,
  MoveFrameCommand,
  ChangeParentCommand,
  CopyFrameCommand,
  PasteFrameCommand,
  BatchRemoveFrameCommand,
  CopyStyleCommand,
  CopyFramesCommand,
  PasteFramesCommand,
  PasteStyleCommand,
} from './FrameCommands';
import { makeTestFrameFixed, makeTestProject } from './__test_helpers__';

function resetStores(overrides: { project?: ReturnType<typeof useProjectStore.getState>['project'] } = {}): void {
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [], clipboard: null, styleClipboard: null });
  useProjectStore.setState({
    project: overrides.project ?? makeTestProject({ frames: {}, rootFrameIds: [] }),
  });
}

describe('CreateFrameCommand', () => {
  beforeEach(() => resetStores());

  it('adds the frame, selects it, and undo/redo works', () => {
    const frame = makeTestFrameFixed('cfg');
    const cmd = new CreateFrameCommand(frame);

    cmd.execute();
    expect(useProjectStore.getState().getFrame('cfg')).toBe(frame);
    expect(useUIStore.getState().selectedFrameId).toBe('cfg');

    cmd.undo();
    expect(useProjectStore.getState().getFrame('cfg')).toBeUndefined();
    expect(useUIStore.getState().selectedFrameId).toBeNull();

    cmd.redo();
    expect(useProjectStore.getState().getFrame('cfg')).toBe(frame);
    expect(useUIStore.getState().selectedFrameId).toBe('cfg');
  });

  it('restores previous selection on undo', () => {
    useUIStore.setState({ selectedFrameId: 'prev' });
    const prevCtor = useUIStore.getState().selectedFrameId;
    const cmd = new CreateFrameCommand(makeTestFrameFixed('cfg'));

    cmd.execute();
    expect(useUIStore.getState().selectedFrameId).toBe('cfg');

    cmd.undo();
    expect(useUIStore.getState().selectedFrameId).toBe(prevCtor);
  });
});

describe('RemoveFrameCommand', () => {
  beforeEach(() => {
    resetStores();
  });

  it('removes, restores on undo, removes again on redo', () => {
    const f = makeTestFrameFixed('a', { x: 0.3 });
    useProjectStore.setState({ project: makeTestProject({ frames: { a: f }, rootFrameIds: ['a'] }) });

    const cmd = new RemoveFrameCommand('a');
    cmd.execute();
    expect(useProjectStore.getState().getFrame('a')).toBeUndefined();

    cmd.undo();
    expect(useProjectStore.getState().getFrame('a')).toEqual(f);

    cmd.redo();
    expect(useProjectStore.getState().getFrame('a')).toBeUndefined();
  });

  it('is no-op when frame does not exist (undo does not re-add)', () => {
    const cmd = new RemoveFrameCommand('missing');
    cmd.execute();
    expect(useProjectStore.getState().getFrame('missing')).toBeUndefined();
    cmd.undo(); // 不应抛错
    expect(useProjectStore.getState().getFrame('missing')).toBeUndefined();
  });
});

describe('UpdateFrameCommand', () => {
  beforeEach(() => {
    resetStores();
    const f = makeTestFrameFixed('a', { text: 'old', x: 0.1 });
    useProjectStore.setState({ project: makeTestProject({ frames: { a: f }, rootFrameIds: ['a'] }) });
  });

  function frameById() {
    return useProjectStore.getState().getFrame('a')!;
  }

  it('applies updates, restores previous state on undo, and re-applies on redo', () => {
    const cmd = new UpdateFrameCommand('a', { text: 'new', x: 0.5 });
    cmd.execute();
    expect(frameById().text).toBe('new');
    expect(frameById().x).toBe(0.5);

    cmd.undo();
    expect(frameById().text).toBe('old');
    expect(frameById().x).toBe(0.1);

    cmd.redo();
    expect(frameById().text).toBe('new');
    expect(frameById().x).toBe(0.5);
  });

  it('is a no-op when frame does not exist', () => {
    const cmd = new UpdateFrameCommand('zzz', { text: 'x' });
    expect(() => cmd.execute()).not.toThrow();
    expect(() => cmd.undo()).not.toThrow();
  });
});

describe('MoveFrameCommand', () => {
  beforeEach(() => {
    resetStores();
    const f = makeTestFrameFixed('a', { x: 0.1, y: 0.2 });
    useProjectStore.setState({ project: makeTestProject({ frames: { a: f }, rootFrameIds: ['a'] }) });
  });

  function frameById() {
    return useProjectStore.getState().getFrame('a')!;
  }

  it('moves, restores on undo, re-moves on redo', () => {
    const cmd = new MoveFrameCommand('a', 0.5, 0.6);
    cmd.execute();
    expect(frameById().x).toBe(0.5);
    expect(frameById().y).toBe(0.6);

    cmd.undo();
    expect(frameById().x).toBe(0.1);
    expect(frameById().y).toBe(0.2);

    cmd.redo();
    expect(frameById().x).toBe(0.5);
    expect(frameById().y).toBe(0.6);
  });

  it('is a no-op when frame does not exist', () => {
    const cmd = new MoveFrameCommand('zzz', 0.9, 0.9);
    expect(() => cmd.execute()).not.toThrow();
  });
});

describe('ChangeParentCommand', () => {
  beforeEach(() => {
    resetStores();
    const parent = makeTestFrameFixed('parent', { children: [] });
    const child = makeTestFrameFixed('child', { parentId: null, children: [] });
    useProjectStore.setState({
      project: makeTestProject({
        frames: { parent, child },
        rootFrameIds: ['parent', 'child'],
      }),
    });
  });

  function parent() { return useProjectStore.getState().getFrame('parent')!; }
  function child() { return useProjectStore.getState().getFrame('child')!; }

  it('assigns child to parent, updates parent children, and undoes', () => {
    const cmd = new ChangeParentCommand('child', 'parent');
    cmd.execute();

    expect(child().parentId).toBe('parent');
    expect(parent().children).toContain('child');
    expect(useProjectStore.getState().project.rootFrameIds).not.toContain('child');

    cmd.undo();
    expect(child().parentId).toBeNull();
    expect(parent().children).not.toContain('child');
    expect(useProjectStore.getState().project.rootFrameIds).toContain('child');

    cmd.redo();
    expect(child().parentId).toBe('parent');
  });
});

describe('CopyFrameCommand', () => {
  beforeEach(() => {
    resetStores();
    const f = makeTestFrameFixed('a', { text: 'hello' });
    useProjectStore.setState({ project: makeTestProject({ frames: { a: f }, rootFrameIds: ['a'] }) });
  });

  it('copies to clipboard; undo/redo are no-ops', () => {
    const cmd = new CopyFrameCommand('a');
    cmd.execute();
    expect(useUIStore.getState().clipboard?.id).toBe('a');
    expect(() => cmd.undo()).not.toThrow();
    cmd.redo();
    expect(useUIStore.getState().clipboard?.id).toBe('a');
  });
});

describe('PasteFrameCommand', () => {
  beforeEach(() => {
    resetStores();
  });

  function setClipboard(f: { id: string; name: string; x: number; y: number; children?: any[]; parentId?: string | null }) {
    useUIStore.setState({
      clipboard: {
        ...makeTestFrameFixed(f.id),
        name: f.name,
        x: f.x,
        y: f.y,
        parentId: f.parentId ?? null,
        children: f.children ?? [],
      } as any,
    });
  }

  it('pastes a new frame with offset name/x/y and selects it', () => {
    setClipboard({ id: 'src', name: 'Box', x: 0.1, y: 0.1 });
    const cmd = new PasteFrameCommand(0.01, 0.01);
    cmd.execute();

    const frames = useProjectStore.getState().project.frames;
    const pasted = Object.values(frames).find(f => f.name === 'Box_副本');
    expect(pasted).toBeDefined();
    expect(pasted!.id).not.toBe('src');
    expect(pasted!.x).toBeCloseTo(0.11);
    expect(pasted!.y).toBeCloseTo(0.11);
    expect(useUIStore.getState().selectedFrameId).toBe(pasted!.id);

    cmd.undo();
    expect(useProjectStore.getState().getFrame(pasted!.id)).toBeUndefined();

    cmd.redo(); // redo 重新粘贴，生成全新 id
    const pastedAgain = Object.values(useProjectStore.getState().project.frames).find(f => f.name === 'Box_副本');
    expect(pastedAgain).toBeDefined();
    expect(pastedAgain!.id).not.toBe(pasted!.id);
  });

  it('recursively pastes children under the new root', () => {
    setClipboard({
      id: 'root', name: 'Root', x: 0, y: 0,
      children: [makeTestFrameFixed('child1', { name: 'Child1' })],
    });
    const cmd = new PasteFrameCommand();
    cmd.execute();

    const frames = useProjectStore.getState().project.frames;
    const pastedRoot = Object.values(frames).find(f => f.name === 'Root_副本')!;
    expect(pastedRoot.children.length).toBe(1);
    const pastedChild = useProjectStore.getState().getFrame(pastedRoot.children[0]);
    expect(pastedChild!.name).toBe('Child1_副本');
    expect(pastedChild!.parentId).toBe(pastedRoot.id);
  });

  it('does nothing when clipboard is empty', () => {
    useUIStore.setState({ clipboard: null });
    const cmd = new PasteFrameCommand();
    cmd.execute();
    expect(Object.keys(useProjectStore.getState().project.frames).length).toBe(0);
  });
});

describe('BatchRemoveFrameCommand', () => {
  beforeEach(() => {
    resetStores();
    const a = makeTestFrameFixed('a');
    const b = makeTestFrameFixed('b');
    useProjectStore.setState({ project: makeTestProject({ frames: { a, b }, rootFrameIds: ['a', 'b'] }) });
  });

  it('removes all, restores all on undo, re-removes on redo', () => {
    const cmd = new BatchRemoveFrameCommand(['a', 'b']);
    cmd.execute();
    expect(useProjectStore.getState().getFrame('a')).toBeUndefined();
    expect(useProjectStore.getState().getFrame('b')).toBeUndefined();
    expect(useUIStore.getState().selectedFrameId).toBeNull();

    cmd.undo();
    expect(useProjectStore.getState().getFrame('a')).toBeDefined();
    expect(useProjectStore.getState().getFrame('b')).toBeDefined();

    cmd.redo();
    expect(useProjectStore.getState().getFrame('a')).toBeUndefined();
  });
});

describe('CopyStyleCommand / PasteStyleCommand', () => {
  beforeEach(() => {
    resetStores();
    const src = makeTestFrameFixed('src', { textColor: '#ff0000', text: 'hi' });
    const tgt = makeTestFrameFixed('tgt', { textColor: '#000000', text: 'yo', locked: false });
    useProjectStore.setState({ project: makeTestProject({ frames: { src, tgt }, rootFrameIds: ['src', 'tgt'] }) });
    useUIStore.setState({ styleClipboard: null });
  });

  it('copies style then pastes it onto target; undo restores target; redo re-applies', () => {
    const copy = new CopyStyleCommand('src');
    copy.execute();
    expect(useUIStore.getState().styleClipboard?.textColor).toBe('#ff0000');

    const paste = new PasteStyleCommand(['tgt']);
    paste.execute();
    expect(useProjectStore.getState().getFrame('tgt')!.textColor).toBe('#ff0000');

    paste.undo();
    expect(useProjectStore.getState().getFrame('tgt')!.textColor).toBe('#000000');

    paste.redo();
    expect(useProjectStore.getState().getFrame('tgt')!.textColor).toBe('#ff0000');
  });

  it('does nothing when no style in clipboard', () => {
    useUIStore.setState({ styleClipboard: null });
    const paste = new PasteStyleCommand(['tgt']);
    expect(() => paste.execute()).not.toThrow();
    expect(useProjectStore.getState().getFrame('tgt')!.textColor).toBe('#000000');
  });

  it('does not change locked target frames', () => {
    const locked = makeTestFrameFixed('locked', { textColor: '#00ff00', locked: true });
    useProjectStore.setState({
      project: makeTestProject({ frames: { src: makeTestFrameFixed('src', { textColor: '#ff0000' }), locked }, rootFrameIds: ['src', 'locked'] }),
    });
    useUIStore.getState().copyStyleToClipboard('src');
    const paste = new PasteStyleCommand(['locked']);
    paste.execute();
    expect(useProjectStore.getState().getFrame('locked')!.textColor).toBe('#00ff00');
  });
});

describe('决策项 5：多选复制/粘贴', () => {
  beforeEach(() => {
    useUIStore.getState().clearSelection();
    const { project } = useProjectStore.getState();
    const f = (id: string, parentId: string | null = null): FrameData => ({ ...makeTestFrameFixed(id), parentId, children: [] });
    useProjectStore.setState({ project: { ...project, frames: { a: f('a'), b: f('b'), c: f('c', 'a') }, rootFrameIds: ['a', 'b'] } });
  });

  it('CopyFramesCommand：父子同选时只复制顶层帧（避免双份）', () => {
    new CopyFramesCommand(['a', 'b', 'c']).execute();
    const { clipboardFrames } = useUIStore.getState();
    expect(clipboardFrames.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('PasteFramesCommand：多根帧粘贴+统一偏移，undo 全部删除', () => {
    new CopyFramesCommand(['a', 'b']).execute();
    const cmd = new PasteFramesCommand(0.1, 0.1);
    cmd.execute();
    const { project } = useProjectStore.getState();
    const newIds = Object.keys(project.frames).filter(id => !['a', 'b', 'c'].includes(id));
    expect(newIds.length).toBe(2);
    const originals = ['a', 'b'].map(id => project.frames[id]);
    expect(newIds.every(id => {
      const f = project.frames[id];
      const orig = originals.find(o => o.name === f.name.replace('_副本', ''));
      return orig && Math.abs(f.x - (orig.x + 0.1)) < 1e-9 && Math.abs(f.y - (orig.y + 0.1)) < 1e-9;
    })).toBe(true);
    cmd.undo();
    const after = useProjectStore.getState().project;
    expect(Object.keys(after.frames).filter(id => !['a', 'b', 'c'].includes(id)).length).toBe(0);
  });
});
