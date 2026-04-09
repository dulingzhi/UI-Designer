import { describe, it, expect } from 'vitest';
import {
  wc3ToPixelX,
  wc3ToPixelY,
  wc3ToPixelYBottom,
  wc3ToPixelW,
  wc3ToPixelH,
  pixelToWc3X,
  pixelToWc3Y,
  pixelDeltaToWc3X,
  pixelDeltaToWc3Y,
  clampWc3,
  clampWc3Size,
} from './coordinateService';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  CANVAS_MARGIN,
  CANVAS_EFFECTIVE_WIDTH,
} from '../constants';

describe('coordinateService', () => {
  describe('wc3ToPixelX', () => {
    it('maps 0 to left margin', () => {
      expect(wc3ToPixelX(0)).toBe(CANVAS_MARGIN); // 240
    });

    it('maps 0.8 to right margin', () => {
      expect(wc3ToPixelX(0.8)).toBe(CANVAS_WIDTH - CANVAS_MARGIN); // 1680
    });

    it('maps 0.4 to center', () => {
      expect(wc3ToPixelX(0.4)).toBe(CANVAS_MARGIN + CANVAS_EFFECTIVE_WIDTH / 2); // 960
    });
  });

  describe('wc3ToPixelY', () => {
    it('maps 0 to canvas bottom (top-down pixel = 1080)', () => {
      expect(wc3ToPixelY(0)).toBe(CANVAS_HEIGHT); // 1080
    });

    it('maps 0.6 to canvas top (top-down pixel = 0)', () => {
      expect(wc3ToPixelY(0.6)).toBe(0);
    });

    it('maps 0.3 to center', () => {
      expect(wc3ToPixelY(0.3)).toBe(CANVAS_HEIGHT / 2); // 540
    });
  });

  describe('wc3ToPixelYBottom', () => {
    it('maps 0 to 0', () => {
      expect(wc3ToPixelYBottom(0)).toBe(0);
    });

    it('maps 0.6 to full height', () => {
      expect(wc3ToPixelYBottom(0.6)).toBe(CANVAS_HEIGHT);
    });
  });

  describe('wc3ToPixelW / wc3ToPixelH', () => {
    it('maps full WC3 width to effective canvas width', () => {
      expect(wc3ToPixelW(0.8)).toBe(CANVAS_EFFECTIVE_WIDTH); // 1440
    });

    it('maps full WC3 height to canvas height', () => {
      expect(wc3ToPixelH(0.6)).toBe(CANVAS_HEIGHT); // 1080
    });
  });

  describe('pixelToWc3X', () => {
    it('maps left margin to 0', () => {
      expect(pixelToWc3X(CANVAS_MARGIN)).toBe(0);
    });

    it('maps right margin to 0.8', () => {
      expect(pixelToWc3X(CANVAS_WIDTH - CANVAS_MARGIN)).toBeCloseTo(0.8);
    });
  });

  describe('pixelToWc3Y', () => {
    it('maps 0 to 0', () => {
      expect(pixelToWc3Y(0)).toBe(0);
    });

    it('maps full height to 0.6', () => {
      expect(pixelToWc3Y(CANVAS_HEIGHT)).toBeCloseTo(0.6);
    });
  });

  describe('round-trip conversions', () => {
    it('wc3 → pixel → wc3 X is identity', () => {
      const values = [0, 0.1, 0.4, 0.8];
      for (const v of values) {
        expect(pixelToWc3X(wc3ToPixelX(v))).toBeCloseTo(v, 10);
      }
    });

    it('wc3 → pixel → wc3 Y is identity', () => {
      const values = [0, 0.15, 0.3, 0.6];
      for (const v of values) {
        expect(pixelToWc3Y(wc3ToPixelYBottom(v))).toBeCloseTo(v, 10);
      }
    });
  });

  describe('pixelDelta conversions', () => {
    it('full effective width delta maps to 0.8', () => {
      expect(pixelDeltaToWc3X(CANVAS_EFFECTIVE_WIDTH)).toBeCloseTo(0.8);
    });

    it('full height delta maps to 0.6', () => {
      expect(pixelDeltaToWc3Y(CANVAS_HEIGHT)).toBeCloseTo(0.6);
    });
  });

  describe('clampWc3', () => {
    it('clamps negative x/y to 0', () => {
      const result = clampWc3(-0.1, -0.2, 0.1, 0.1);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });

    it('clamps x+w > 0.8', () => {
      const result = clampWc3(0.75, 0.3, 0.1, 0.1);
      expect(result.x).toBeCloseTo(0.7); // 0.8 - 0.1
    });

    it('clamps y+h > 0.6', () => {
      const result = clampWc3(0.3, 0.55, 0.1, 0.1);
      expect(result.y).toBe(0.5); // 0.6 - 0.1
    });

    it('passes through valid values', () => {
      const result = clampWc3(0.2, 0.2, 0.1, 0.1);
      expect(result.x).toBe(0.2);
      expect(result.y).toBe(0.2);
    });
  });

  describe('clampWc3Size', () => {
    it('enforces minimum size', () => {
      const result = clampWc3Size(0.2, 0.2, 0, 0);
      expect(result.w).toBe(0.01);
      expect(result.h).toBe(0.01);
    });

    it('clamps width to available space', () => {
      const result = clampWc3Size(0.7, 0.5, 0.5, 0.5);
      expect(result.w).toBeCloseTo(0.1); // 0.8 - 0.7
      expect(result.h).toBeCloseTo(0.1); // 0.6 - 0.5
    });
  });
});
