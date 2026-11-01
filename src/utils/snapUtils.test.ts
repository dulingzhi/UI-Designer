import { describe, it, expect } from 'vitest';
import { GuideLine as CustomGuideLine } from '../types';
import { calculateSnap, snapToCanvasEdges } from './snapUtils';

const BL = { x: 0, y: 0, width: 100, height: 100 };

describe('calculateSnap', () => {
  it('returns original position when snap disabled', () => {
    const res = calculateSnap(10, 20, 50, 30, [BL], false);
    expect(res).toEqual({ x: 10, y: 20, snapped: false, guidelines: [] });
  });

  it('returns original when no other frames near', () => {
    const res = calculateSnap(500, 500, 50, 30, [{ x: 0, y: 0, width: 100, height: 100 }]);
    expect(res.x).toBe(500);
    expect(res.y).toBe(500);
    expect(res.snapped).toBe(false);
  });

  it('snaps left edges', () => {
    const res = calculateSnap(2, 10, 50, 30, [BL]);
    expect(res.x).toBe(0);
    expect(res.snapped).toBe(true);
    expect(res.guidelines).toContainEqual({ type: 'vertical', position: 0, source: 'edge' });
  });

  it('snaps right edges', () => {
    const res = calculateSnap(50, 10, 50, 30, [BL]);
    // dragRight=100 == otherRight=100
    expect(res.x).toBe(50); // otherRight - width = 100-50
    expect(res.snapped).toBe(true);
  });

  it('snaps centers horizontally', () => {
    const res = calculateSnap(28, 10, 44, 30, [BL]);
    // dragCenterX=50 == otherCenterX=50 => snapX = 50 - 22 = 28
    expect(res.x).toBe(28);
    expect(res.snapped).toBe(true);
  });

  it('snaps left-to-right adjacency', () => {
    const res = calculateSnap(98, 10, 50, 30, [BL]);
    // dragLeft=98 == otherRight=100 within 5 => snapX=100
    expect(res.x).toBe(100);
    expect(res.snapped).toBe(true);
  });

  it('snaps right-to-left adjacency', () => {
    const res = calculateSnap(-48, 10, 50, 30, [BL]);
    // dragRight=2, otherLeft=0, diff 2 <5 => snapX = 0-50 = -50
    expect(res.x).toBe(-50);
    expect(res.snapped).toBe(true);
  });

  it('snaps top edges vertically', () => {
    const res = calculateSnap(10, 2, 50, 30, [BL]);
    expect(res.y).toBe(0);
    expect(res.snapped).toBe(true);
  });

  it('snaps bottom edges vertically', () => {
    const res = calculateSnap(10, 50, 50, 50, [BL]); // dragBottom=100 == 100
    expect(res.y).toBe(50);
    expect(res.snapped).toBe(true);
  });

  it('snaps centers vertically', () => {
    const res = calculateSnap(10, 35, 50, 30, [BL]);
    // dragCenterY=50 == otherCenterY=50 => snapY = 50-15 = 35
    expect(res.y).toBe(35);
    expect(res.snapped).toBe(true);
  });

  it('snaps top-to-bottom adjacency', () => {
    const res = calculateSnap(10, 98, 50, 30, [BL]);
    // dragTop=98 == otherBottom=100 => snapY = 100
    expect(res.y).toBe(100);
    expect(res.snapped).toBe(true);
  });

  it('snaps bottom-to-top adjacency', () => {
    const res = calculateSnap(10, -28, 50, 30, [BL]);
    // dragBottom=2, otherTop=0 => snapY = 0-30 = -30
    expect(res.y).toBe(-30);
    expect(res.snapped).toBe(true);
  });

  it('breaks early when both X and Y snap against the same frame', () => {
    // BL={0,0,100,100}; dragLeft=2 (snapX=0), dragTop=2 (snapY=0) -> snappedX&&snappedY -> break
    const res = calculateSnap(2, 2, 50, 30, [BL]);
    expect(res.x).toBe(0);
    expect(res.y).toBe(0);
    expect(res.snapped).toBe(true);
  });

  it('snaps only X when only X needs snapping', () => {
    const res = calculateSnap(2, 555, 50, 30, [BL]);
    expect(res.x).toBe(0);
    expect(res.y).toBe(555);
    expect(res.snapped).toBe(true);
  });

  it('snaps with custom vertical guide', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'vertical', position: 40 }];
    const res = calculateSnap(38, 555, 50, 30, [], true, guides);
    expect(res.x).toBe(40);
    expect(res.snapped).toBe(true);
  });

  it('snaps with custom vertical guide right edge', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'vertical', position: 40 }];
    const res = calculateSnap(-8, 555, 50, 30, [], true, guides);
    // dragRight = -8+50 = 42, diff from 40 = 2 <5 => snapX=40-50=-10
    expect(res.x).toBe(-10);
  });

  it('snaps with custom vertical guide center', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'vertical', position: 40 }];
    const res = calculateSnap(13, 555, 50, 30, [], true, guides);
    // dragCenterX = 13+25 = 38, diff 2 => snapX = 40-25 = 15
    expect(res.x).toBe(15);
  });

  it('snaps with custom horizontal guide top edge', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'horizontal', position: 40 }];
    const res = calculateSnap(100, 38, 50, 30, [], true, guides);
    expect(res.y).toBe(40);
  });

  it('snaps with custom horizontal guide bottom edge', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'horizontal', position: 40 }];
    const res = calculateSnap(100, 12, 50, 30, [], true, guides);
    // dragBottom=42 diff 2 => snapY=40-30=10
    expect(res.y).toBe(10);
  });

  it('snaps with custom horizontal guide center', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'horizontal', position: 40 }];
    const res = calculateSnap(100, 23, 50, 30, [], true, guides);
    // dragCenterY=38 diff 2 => snapY=40-15=25
    expect(res.y).toBe(25);
  });

  it('uses snapped position as baseline for guides (x already snapped by frame, then vertical guide center)', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'vertical', position: 60 }];
    // frame snap: dragLeft 2 -> x=0 (snappedX=true), so vertical guide skipped
    const res = calculateSnap(2, 555, 50, 30, [BL], true, guides);
    expect(res.x).toBe(0);
  });

  it('breaks early when both axes snap to custom guides', () => {
    const guides: CustomGuideLine[] = [
      { id: 'gv', orientation: 'vertical', position: 40 },
      { id: 'gh', orientation: 'horizontal', position: 40 },
    ];
    const res = calculateSnap(38, 38, 50, 30, [], true, guides);
    expect(res.x).toBe(40); // snapX
    expect(res.y).toBe(40); // snapY
    expect(res.snapped).toBe(true);
  });

  it('skips vertical frame check once X already snapped (multiple frames)', () => {
    // iter1 snaps X on BL; iter2 (far frame) re-evaluates !snappedX = false
    const res = calculateSnap(2, 555, 50, 30, [BL, { x: 999, y: 999, width: 1, height: 1 }]);
    expect(res.x).toBe(0);
    expect(res.snapped).toBe(true);
  });

  it('skips horizontal frame check once Y already snapped (multiple frames)', () => {
    const res = calculateSnap(555, 2, 50, 30, [BL, { x: 999, y: 999, width: 1, height: 1 }]);
    expect(res.y).toBe(0);
    expect(res.snapped).toBe(true);
  });

  it('does not snap to a vertical guide that matches no edge/center', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'vertical', position: 200 }];
    const res = calculateSnap(100, 555, 50, 30, [], true, guides);
    expect(res.x).toBe(100);
    expect(res.snapped).toBe(false);
  });

  it('does not snap to a horizontal guide that matches no edge/center', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'horizontal', position: 200 }];
    const res = calculateSnap(100, 555, 50, 30, [], true, guides);
    expect(res.y).toBe(555);
    expect(res.snapped).toBe(false);
  });

  it('does not snap to guides when already snapped on same axis by frames', () => {
    const guides: CustomGuideLine[] = [{ id: 'g1', orientation: 'horizontal', position: 60 }];
    const res = calculateSnap(10, 2, 50, 30, [BL], true, guides);
    expect(res.y).toBe(0); // snapped by frame top first
  });
});

describe('snapToCanvasEdges', () => {
  it('returns original when nothing near edge', () => {
    const res = snapToCanvasEdges(100, 100, 50, 50, 500, 400);
    expect(res.x).toBe(100);
    expect(res.y).toBe(100);
    expect(res.guidelines).toHaveLength(0);
  });

  it('snaps left and top edges to margin', () => {
    const res = snapToCanvasEdges(1, 1, 50, 50, 500, 400, 0);
    expect(res.x).toBe(0);
    expect(res.y).toBe(0);
    expect(res.guidelines).toHaveLength(2);
  });

  it('snaps left edge with margin', () => {
    const res = snapToCanvasEdges(8, 50, 50, 50, 500, 400, 10);
    expect(res.x).toBe(10);
  });

  it('snaps right edge', () => {
    const res = snapToCanvasEdges(454, 50, 50, 50, 500, 400);
    // x+width=504, canvasWidth - margin = 500, diff 4 <5 -> snapX=450
    expect(res.x).toBe(450);
  });

  it('snaps bottom edge', () => {
    const res = snapToCanvasEdges(50, 354, 50, 50, 500, 400);
    // y+height=404, canvasHeight=400, diff 4 <5 => snapY=350
    expect(res.y).toBe(350);
  });

  it('snaps to canvas center', () => {
    const res = snapToCanvasEdges(228, 178, 44, 44, 500, 400);
    // frameCenterX=250, canvasCenterX=250 => snapX=250-22=228
    // frameCenterY=200, canvasCenterY=200 => snapY=200-22=178
    expect(res.x).toBe(228);
    expect(res.y).toBe(178);
  });

  it('snaps only X center', () => {
    const res = snapToCanvasEdges(228, 55, 44, 44, 500, 400);
    expect(res.x).toBe(228);
    expect(res.y).toBe(55);
  });
});