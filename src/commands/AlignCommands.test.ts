import { describe, it, expect, beforeEach, vi } from 'vitest';

// 与 uiStore.test.ts 同款 mock，避免 localStorage/进程依赖
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
import { AlignCommand, DistributeCommand, EqualSpacingCommand } from './AlignCommands';
import { AlignToCanvasCommand } from './AlignToCanvasCommands';
import { makeTestFrameFixed, makeTestProject } from './__test_helpers__';
import { WC3_MAX_X, WC3_MAX_Y } from '../constants';

function seed(frameIds: string[]): void {
  const positioned: Record<string, ReturnType<typeof makeTestFrameFixed>> = {};
  frameIds.forEach((id) => {
    positioned[id] = makeTestFrameFixed(id, { x: 0.1, y: 0.1, width: 0.2, height: 0.1 });
  });
  useProjectStore.setState({
    project: makeTestProject({
      frames: positioned,
      rootFrameIds: frameIds,
    }),
  });
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
}

// 有序帧：a 在最下/最左，c 在最上/最右，便于对齐断言
function seedAligned(): void {
  useProjectStore.setState({
    project: makeTestProject({
      frames: {
        a: makeTestFrameFixed('a', { x: 0.1, y: 0.1, width: 0.2, height: 0.1 }),
        b: makeTestFrameFixed('b', { x: 0.4, y: 0.3, width: 0.15, height: 0.08 }),
        c: makeTestFrameFixed('c', { x: 0.6, y: 0.5, width: 0.2, height: 0.1 }),
      },
      rootFrameIds: ['a', 'b', 'c'],
    }),
  });
  useUIStore.setState({ selectedFrameId: null, selectedFrameIds: [] });
}

function frame(id: string) { return useProjectStore.getState().getFrame(id)!; }

describe('AlignCommand', () => {
  beforeEach(() => seedAligned());

  const TYPES = ['left', 'right', 'top', 'bottom', 'centerH', 'centerV'] as const;

  it.each(TYPES)('aligns type=%s to the reference (first) frame', (alignType) => {
    const ref = frame('a');
    const cmd = new AlignCommand(['a', 'b', 'c'], alignType);
    cmd.execute();

    const expected: Record<string, { x: number; y: number }> = {};
    const compute = (targetId: string) => {
      const t = frame(targetId);
      switch (alignType) {
        case 'left': return { x: ref.x, y: t.y };
        case 'right': return { x: ref.x + ref.width - t.width, y: t.y };
        case 'top': return { x: t.x, y: ref.y + ref.height - t.height };
        case 'bottom': return { x: t.x, y: ref.y };
        case 'centerH': return { x: ref.x + ref.width / 2 - t.width / 2, y: t.y };
        case 'centerV': return { x: t.x, y: ref.y + ref.height / 2 - t.height / 2 };
      }
    };
    ['a', 'b', 'c'].forEach(id => { expected[id] = compute(id); });

    expect(frame('b').x).toBeCloseTo(expected.b.x);
    expect(frame('b').y).toBeCloseTo(expected.b.y);
  });

  it('restores all positions on undo, re-applies on redo', () => {
    const before = { a: { x: frame('a').x, y: frame('a').y }, b: { x: frame('b').x, y: frame('b').y } };
    const cmd = new AlignCommand(['a', 'b'], 'left');
    cmd.execute();
    expect(frame('b').x).toBeCloseTo(frame('a').x);

    cmd.undo();
    expect(frame('b').x).toBeCloseTo(before.b.x);
    expect(frame('b').y).toBeCloseTo(before.b.y);

    cmd.redo();
    expect(frame('b').x).toBeCloseTo(frame('a').x);
  });

  it('warns and does nothing when fewer than 2 frames', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const b0 = { ...frame('b') };
    const cmd = new AlignCommand(['b'], 'left');
    cmd.execute();
    expect(warn).toHaveBeenCalled();
    expect(frame('b')).toMatchObject(b0);
    warn.mockRestore();
  });
});

describe('DistributeCommand', () => {
  beforeEach(() => seedAligned());

  it('distributes horizontally keeping first/last fixed', () => {
    const cmd = new DistributeCommand(['a', 'b', 'c'], 'horizontal');
    cmd.execute();

    expect(frame('a').x).toBeCloseTo(0.1);
    expect(frame('c').x).toBeCloseTo(0.6);
    // 中间控件位于空隙平均位置
    const a = frame('a'); const c = frame('c'); const b = frame('b');
    // gap = ((c.x+c.w) - a.x - (a.w+b.w+c.w)) / 2
    const gap = ((c.x + c.width) - a.x - (a.width + b.width + c.width)) / 2;
    expect(b.x).toBeCloseTo(a.x + a.width + gap);
  });

  it('distributes vertically keeping first/last fixed', () => {
    const cmd = new DistributeCommand(['a', 'b', 'c'], 'vertical');
    cmd.execute();

    const a = frame('a'); const b = frame('b'); const c = frame('c');
    // 垂直：排序 a(0.1) b(0.3) c(0.5)，首尾（a,c）不动（a 最低、c 最高）
    expect(a.y).toBeCloseTo(0.1);
    const gap = ((c.y + c.height) - a.y - (a.height + b.height + c.height)) / 2;
    expect(b.y).toBeCloseTo(0.1 + a.height + gap);
  });

  it('warns and does nothing when fewer than 3 frames', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seed(['a', 'b']);
    const beforeA = { ...frame('a') };
    const cmd = new DistributeCommand(['a', 'b'], 'horizontal');
    cmd.execute();
    expect(warn).toHaveBeenCalled();
    expect(frame('a')).toMatchObject(beforeA);
    warn.mockRestore();
  });

  it('undo restores all positions', () => {
    const cmd = new DistributeCommand(['a', 'b', 'c'], 'horizontal');
    cmd.execute();
    const beforeB = 0.4;
    cmd.undo();
    expect(frame('b').x).toBeCloseTo(beforeB);
  });
});

describe('EqualSpacingCommand', () => {
  beforeEach(() => seedAligned());

  it('equalizes horizontal gaps keeping first frame fixed', () => {
    // a(0.1,bw0.2)->right0.3; b(0.4,bw0.15)->right0.55; c(0.6,bw0.2)
    // gaps: 0.4-0.3=0.1 ; 0.6-0.55=0.05 => avg 0.075
    const cmd = new EqualSpacingCommand(['a', 'b', 'c'], 'horizontal');
    cmd.execute();

    const a = frame('a'); const b = frame('b'); const c = frame('c');
    const avgGap = 0.075;
    expect(a.x).toBeCloseTo(0.1); // 首帧不动
    expect(b.x).toBeCloseTo(0.1 + a.width + avgGap);
    expect(c.x).toBeCloseTo(b.x + b.width + avgGap);
  });

  it('equalizes vertical gaps keeping first frame fixed', () => {
    const cmd = new EqualSpacingCommand(['a', 'b', 'c'], 'vertical');
    cmd.execute();

    const a = frame('a'); const b = frame('b'); const c = frame('c');
    // 垂直按 y 排序 a b c；a(0.1,h0.1) b(0.3,h0.08) c(0.5,h0.1)
    // gaps: (0.3-(0.1+0.1))=0.1 ; (0.5-(0.3+0.08))=0.12 => avg 0.11
    const avgGap = 0.11;
    expect(a.y).toBeCloseTo(0.1); // 首帧不动
    expect(b.y).toBeCloseTo(0.1 + a.height + avgGap);
    expect(c.y).toBeCloseTo(b.y + b.height + avgGap);
  });

  it('warns and does nothing when fewer than 3 frames', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    seed(['a', 'b']);
    const cmd = new EqualSpacingCommand(['a', 'b'], 'horizontal');
    cmd.execute();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('AlignToCanvasCommand', () => {
  beforeEach(() => seed(['a']));

  const TYPES = ['left', 'right', 'top', 'bottom', 'centerH', 'centerV'] as const;

  it.each(TYPES)('aligns frame to canvas %s', (alignType) => {
    const cmd = new AlignToCanvasCommand('a', alignType);
    cmd.execute();

    const f = frame('a');
    const width = f.width;
    const height = f.height;
    switch (alignType) {
      case 'left': expect(f.x).toBeCloseTo(0); break;
      case 'right': expect(f.x).toBeCloseTo(WC3_MAX_X - width); break;
      case 'centerH': expect(f.x).toBeCloseTo((WC3_MAX_X - width) / 2); break;
      case 'bottom': expect(f.y).toBeCloseTo(0); break;
      case 'top': expect(f.y).toBeCloseTo(WC3_MAX_Y - height); break;
      case 'centerV': expect(f.y).toBeCloseTo((WC3_MAX_Y - height) / 2); break;
    }
  });

  it('restores original position on undo and re-applies on redo', () => {
    const original = { x: frame('a').x, y: frame('a').y };
    const cmd = new AlignToCanvasCommand('a', 'left');
    cmd.execute();
    expect(frame('a').x).toBeCloseTo(0);

    cmd.undo();
    expect(frame('a').x).toBeCloseTo(original.x);
    expect(frame('a').y).toBeCloseTo(original.y);

    cmd.redo();
    expect(frame('a').x).toBeCloseTo(0);
  });

  it('warns and does nothing when frame not found', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => new AlignToCanvasCommand('missing', 'left').execute()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});