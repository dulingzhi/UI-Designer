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
import { CreateCircleArrayCommand } from './CircleArrayCommand';
import { CreateTableArrayCommand } from './TableArrayCommand';
import { makeTestFrameFixed, makeTestProject } from './__test_helpers__';

function seedSource(id = 'src'): void {
  const src = makeTestFrameFixed(id, { name: 'Gem', x: 0.2, y: 0.2, width: 0.1, height: 0.1, children: [] });
  useProjectStore.setState({
    project: makeTestProject({ frames: { [id]: src }, rootFrameIds: [id] }),
  });
}

function frameIds(): string[] { return Object.keys(useProjectStore.getState().project.frames); }
function frame(id: string) { return useProjectStore.getState().getFrame(id)!; }

describe('CreateCircleArrayCommand', () => {
  beforeEach(() => seedSource());

  it('reuses source as element[0], creates count-1 children, registers array data', () => {
    const cmd = new CreateCircleArrayCommand('src', 0.5, 0.3, 0.2, 4, 0);
    cmd.execute();

    const ids = frameIds();
    expect(ids.length).toBe(4); // 1 源 + 3 新增
    expect(frame('src').name).toBe('Gem[0]');
    expect(frame('src').arrayId).toMatch(/^circle-array-/);

    // 环形数据
    const arrays = useProjectStore.getState().project.circleArrays;
    expect(arrays.length).toBe(1);
    const arr = arrays[0];
    expect(arr.count).toBe(4);
    expect(arr.elements.length).toBe(4);
    // 首元素位于 initialAngle=0 的 (centerX+radius, centerY)
    expect(frame(arr.elements[0]).x).toBeCloseTo(0.7);
    expect(frame(arr.elements[0]).y).toBeCloseTo(0.3);
  });

  it('places elements on the circle at correct angles', () => {
    const cmd = new CreateCircleArrayCommand('src', 0, 0, 1, 4, 0);
    cmd.execute();
    const arr = useProjectStore.getState().project.circleArrays[0];
    arr.elements.forEach((id, i) => {
      const angle = (Math.PI * 2) / 4 * i;
      const f = frame(id);
      expect(f.x).toBeCloseTo(Math.cos(angle), 5);
      expect(f.y).toBeCloseTo(Math.sin(angle), 5);
    });
  });

  it('undo removes created children, restores source name, and removes array data', () => {
    const cmd = new CreateCircleArrayCommand('src', 0.5, 0.3, 0.2, 4, 0);
    cmd.execute();
    const created = frameIds().filter(id => id !== 'src');
    expect(created.length).toBe(3);

    cmd.undo();
    expect(frameIds()).toEqual(['src']);
    expect(frame('src').name).toBe('Gem');
    expect(frame('src').arrayId).toBeUndefined();
    expect(useProjectStore.getState().project.circleArrays.length).toBe(0);
  });

  it('redo re-creates the array', () => {
    const cmd = new CreateCircleArrayCommand('src', 0.5, 0.3, 0.2, 3, 0);
    cmd.execute();
    cmd.undo();
    cmd.redo();
    expect(frameIds().length).toBe(3);
    expect(useProjectStore.getState().project.circleArrays.length).toBe(1);
  });

  it('does nothing when source frame does not exist', () => {
    expect(() => new CreateCircleArrayCommand('missing', 0, 0, 1, 4, 0).execute()).not.toThrow();
    // beforeEach 已灌入 src，execute 应早退，不新增任何帧/数组
    expect(frameIds()).toEqual(['src']);
    expect(useProjectStore.getState().project.circleArrays.length).toBe(0);
  });
});

describe('CreateTableArrayCommand', () => {
  beforeEach(() => seedSource());

  it('reuses source as element[0], creates rows*cols-1 children, registers array data', () => {
    const cmd = new CreateTableArrayCommand('src', 2, 3, 0.01, 0.02);
    cmd.execute();

    const ids = frameIds();
    expect(ids.length).toBe(6); // 2*3
    expect(frame('src').name).toBe('Gem[0]');

    const arrays = useProjectStore.getState().project.tableArrays;
    expect(arrays.length).toBe(1);
    expect(arrays[0].rows).toBe(2);
    expect(arrays[0].cols).toBe(3);
    expect(arrays[0].elements.length).toBe(6);
  });

  it('positions elements in a grid respecting gaps and Y-up', () => {
    const cmd = new CreateTableArrayCommand('src', 2, 3, 0.01, 0.02);
    cmd.execute();
    const arr = useProjectStore.getState().project.tableArrays[0];
    // element 索引: [0]=src(0,0), [1]=(1,0),(2,0),(0,1),(1,1),(2,1)
    const expectPos = (idx: number, row: number, col: number) => {
      const f = frame(arr.elements[idx]);
      // deltas depend on width/height of source element
      expect(f.x).toBeCloseTo(0.2 + col * (0.1 + 0.01));
      expect(f.y).toBeCloseTo(0.2 - row * (0.1 + 0.02));
    };
    expectPos(0, 0, 0);
    expectPos(1, 0, 1);
    expectPos(2, 0, 2);
    expectPos(3, 1, 0);
    expectPos(4, 1, 1);
    expectPos(5, 1, 2);
  });

  it('undo removes created children, restores source name, and removes array data', () => {
    const cmd = new CreateTableArrayCommand('src', 2, 2, 0.01, 0.02);
    cmd.execute();
    expect(frameIds().length).toBe(4);
    cmd.undo();
    expect(frameIds()).toEqual(['src']);
    expect(frame('src').name).toBe('Gem');
    expect(useProjectStore.getState().project.tableArrays.length).toBe(0);
  });

  it('does nothing when source frame does not exist', () => {
    expect(() => new CreateTableArrayCommand('missing', 2, 2, 0, 0).execute()).not.toThrow();
    expect(frameIds()).toEqual(['src']);
    expect(useProjectStore.getState().project.tableArrays.length).toBe(0);
  });
});