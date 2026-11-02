import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：锚点可视化与缩放手柄。
 * AnchorVisualizer 的 9 点坐标映射必须与 WC3 FramePoint 语义一致（内核对拍语义的视觉呈现）；
 * ResizeHandles 8 方向齐全（n/s/e/w + 四角）。
 */
const viz = readFileSync(join(__dirname, 'AnchorVisualizer.tsx'), 'utf-8');
const handles = readFileSync(join(__dirname, 'ResizeHandles.tsx'), 'utf-8');

describe('AnchorVisualizer/ResizeHandles 接线守卫', () => {
  it('9 个 FramePoint 锚点坐标映射齐全且语义正确', () => {
    // 角点：TOPLEFT=(0,0)、TOPRIGHT=(w,0)、BOTTOMLEFT=(0,h)、BOTTOMRIGHT=(w,h)
    expect(viz).toContain('[FramePoint.TOPLEFT]: { x: 0, y: 0 }');
    expect(viz).toContain('[FramePoint.TOPRIGHT]: { x: width, y: 0 }');
    expect(viz).toContain('[FramePoint.BOTTOMLEFT]: { x: 0, y: height }');
    expect(viz).toContain('[FramePoint.BOTTOMRIGHT]: { x: width, y: height }');
    // 边中点与中心
    expect(viz).toContain('[FramePoint.CENTER]: { x: width / 2, y: height / 2 }');
    expect(viz).toContain('[FramePoint.LEFT]: { x: 0, y: height / 2 }');
    expect(viz).toContain('[FramePoint.RIGHT]: { x: width, y: height / 2 }');
    expect(viz).toContain('[FramePoint.TOP]: { x: width / 2, y: 0 }');
    expect(viz).toContain('[FramePoint.BOTTOM]: { x: width / 2, y: height }');
  });

  it('锚点坐标以三位小数展示（引擎坐标系精度）', () => {
    expect(viz).toContain('anchor.x.toFixed(3)');
    expect(viz).toContain('anchor.y.toFixed(3)');
  });

  it('锚点与相对点均有可读名称（point/relativePoint 双展示）', () => {
    expect(viz).toContain('getAnchorName(anchor.point)');
    expect(viz).toContain('getAnchorName(anchor.relativePoint)');
  });

  it('ResizeHandles：8 方向手柄齐全（n/s/e/w + ne/nw/se/sw）', () => {
    expect(handles).toContain("| 'ne' | 'nw' | 'se' | 'sw';");
    for (const d of ['resize-handle-n"', 'resize-handle-s"', 'resize-handle-e"', 'resize-handle-w"',
      'resize-handle-ne"', 'resize-handle-nw"', 'resize-handle-se"', 'resize-handle-sw"']) {
      expect(handles, `缺少方向 ${d}`).toContain(`className="resize-handle ${d}`);
    }
  });
});
