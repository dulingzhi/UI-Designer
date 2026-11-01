import { describe, it, expect, beforeEach, vi } from 'vitest';

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
import { DuplicateCommand } from './DuplicateCommand';
import { DuplicateFrameCommand } from './DuplicateFrameCommand';
import { ZIndexCommand } from './ZIndexCommands';
import { UnifySizeCommand } from './SizeCommands';
import { makeTestFrameFixed, makeTestProject } from './__test_helpers__';

function seed(records: Record<string, Partial<ReturnType<typeof makeTestFrameFixed>>>): void {
  const frames: Record<string, ReturnType<typeof makeTestFrameFixed>> = {};
  Object.entries(records).forEach(([id, ov]) => {
    frames[id] = makeTestFrameFixed(id, ov);
  });
  useProjectStore.setState({
    project: makeTestProject({ frames, rootFrameIds: Object.keys(records) }),
  });
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [], clipboard: null, styleClipboard: null });
}

function frame(id: string) { return useProjectStore.getState().getFrame(id); }

describe('DuplicateCommand', () => {
  beforeEach(() => seed({ src: { name: 'Box', x: 0.1, y: 0.3, width: 0.2, height: 0.1, anchors: [] } }));

  it('duplicates a root frame with _副本 suffix and offset, then undoes', () => {
    const cmd = new DuplicateCommand('src');
    cmd.execute();

    const frames = useProjectStore.getState().project.frames;
    const dup = Object.values(frames).find(f => f.name === 'Box (副本)');
    expect(dup).toBeDefined();
    expect(dup!.id).not.toBe('src');
    expect(dup!.x).toBeCloseTo(0.12);
    expect(dup!.y).toBeCloseTo(0.28);
    expect(useUIStore.getState().selectedFrameId).toBe(dup!.id);

    cmd.undo();
    expect(useProjectStore.getState().getFrame(dup!.id)).toBeUndefined();
    expect(useUIStore.getState().selectedFrameId).toBe('src');
  });

  it('increments copy number when a (副本) already exists', () => {
    seed({
      src: { name: 'Box', x: 0.1, y: 0.3 },
      dup1: { name: 'Box (副本)' },
      dup2: { name: 'Box (副本 2)' },
    });
    const cmd = new DuplicateCommand('src');
    cmd.execute();
    const dup = Object.values(useProjectStore.getState().project.frames).find(f => f.name === 'Box (副本 3)');
    expect(dup).toBeDefined();
  });

  it('attaches duplicate under a parent and removes from parent on undo', () => {
    seed({
      parent: { name: 'Parent', children: ['child'] },
      child: { name: 'Child', parentId: 'parent', x: 0.1, y: 0.2, anchors: [] },
    });
    // 让 rootFrameIds 只含 parent
    useProjectStore.setState(s => ({
      project: { ...s.project, rootFrameIds: ['parent'] },
    }));

    const cmd = new DuplicateCommand('child');
    cmd.execute();
    const parent = frame('parent')!;
    const dupId = Object.values(useProjectStore.getState().project.frames).find(f => f.name === 'Child (副本)')!.id;
    expect(parent.children).toContain(dupId);

    cmd.undo();
    const parentAfter = frame('parent')!;
    expect(parentAfter.children).not.toContain(dupId);
    expect(useProjectStore.getState().getFrame(dupId)).toBeUndefined();
  });

  it('does nothing when frame does not exist', () => {
    const cmd = new DuplicateCommand('missing');
    expect(() => cmd.execute()).not.toThrow();
  });
});

describe('DuplicateFrameCommand', () => {
  beforeEach(() => seed({ src: { name: 'Box', x: 0.3, y: 0.3, width: 0.2, height: 0.1 } }));

  it('creates a _copy frame offset within bounds, selects it, and undoes', () => {
    const cmd = new DuplicateFrameCommand('src', 0.02, 0.02);
    cmd.execute();

    const dup = Object.values(useProjectStore.getState().project.frames).find(f => f.name === 'Box_copy');
    expect(dup).toBeDefined();
    expect(dup!.id).not.toBe('src');
    expect(dup!.x).toBeGreaterThanOrEqual(0);
    expect(dup!.x).toBeLessThanOrEqual(0.6);
    expect(useUIStore.getState().selectedFrameId).toBe(dup!.id);

    cmd.undo();
    expect(useProjectStore.getState().getFrame(dup!.id)).toBeUndefined();
  });
});

// DuplicateFrameCommand 的 x 受 Math.min(0.8 - width, x+offset) 限制；断言见上方 inline

describe('ZIndexCommand', () => {
  function seedZ(ids: [string, number][]) {
    const records: Record<string, Partial<ReturnType<typeof makeTestFrameFixed>>> = {};
    ids.forEach(([id, z]) => { records[id] = { z }; });
    seed(records);
  }

  it('moves up one level to next higher z', () => {
    seedZ([['a', 1], ['b', 2], ['c', 3]]);
    const cmd = new ZIndexCommand('b', 'moveUp');
    cmd.execute();
    expect(frame('b')!.z).toBe(3);
    cmd.undo();
    expect(frame('b')!.z).toBe(2);
  });

  it('moveUp stays when already highest', () => {
    seedZ([['a', 1], ['b', 2]]);
    const cmd = new ZIndexCommand('b', 'moveUp');
    cmd.execute();
    expect(frame('b')!.z).toBe(2);
  });

  it('moves down one level to next lower z', () => {
    seedZ([['a', 1], ['b', 2], ['c', 3]]);
    const cmd = new ZIndexCommand('b', 'moveDown');
    cmd.execute();
    expect(frame('b')!.z).toBe(1);
    cmd.undo();
    expect(frame('b')!.z).toBe(2);
  });

  it('moveDown stays when already lowest', () => {
    seedZ([['a', 1], ['b', 2]]);
    const cmd = new ZIndexCommand('a', 'moveDown');
    cmd.execute();
    expect(frame('a')!.z).toBe(1);
  });

  it('bringToFront sets z to max+1', () => {
    seedZ([['a', 1], ['b', 2], ['c', 3]]);
    const cmd = new ZIndexCommand('a', 'bringToFront');
    cmd.execute();
    expect(frame('a')!.z).toBe(4);
    cmd.undo();
    expect(frame('a')!.z).toBe(1);
  });

  it('sendToBack sets z to min-1', () => {
    seedZ([['a', 1], ['b', 2], ['c', 3]]);
    const cmd = new ZIndexCommand('c', 'sendToBack');
    cmd.execute();
    expect(frame('c')!.z).toBe(0);
    cmd.undo();
    expect(frame('c')!.z).toBe(3);
  });

  it('warns and does nothing when frame not found', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seedZ([['a', 1]]);
    expect(() => new ZIndexCommand('missing', 'moveUp').execute()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('UnifySizeCommand', () => {
  beforeEach(() => {
    seed({
      a: { width: 0.2, height: 0.1 },
      b: { width: 0.3, height: 0.15 },
      c: { width: 0.25, height: 0.12 },
    });
  });

  it.each(['width', 'height', 'both'] as const)('unifies %s to reference frame', (sizeType) => {
    const cmd = new UnifySizeCommand(['a', 'b', 'c'], sizeType);
    cmd.execute();

    if (sizeType === 'width' || sizeType === 'both') {
      expect(frame('b')!.width).toBeCloseTo(0.2);
      expect(frame('c')!.width).toBeCloseTo(0.2);
    } else {
      expect(frame('b')!.width).toBeCloseTo(0.3); // 未变
    }
    if (sizeType === 'height' || sizeType === 'both') {
      expect(frame('b')!.height).toBeCloseTo(0.1);
      expect(frame('c')!.height).toBeCloseTo(0.1);
    }
  });

  it('restores sizes on undo and re-applies on redo', () => {
    const cmd = new UnifySizeCommand(['a', 'b', 'c'], 'width');
    cmd.execute();
    expect(frame('b')!.width).toBeCloseTo(0.2);
    cmd.undo();
    expect(frame('b')!.width).toBeCloseTo(0.3);
    cmd.redo();
    expect(frame('b')!.width).toBeCloseTo(0.2);
  });

  it('warns and does nothing when fewer than 2 frames', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seed({ a: { width: 0.2, height: 0.1 } });
    const cmd = new UnifySizeCommand(['a'], 'both');
    cmd.execute();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});