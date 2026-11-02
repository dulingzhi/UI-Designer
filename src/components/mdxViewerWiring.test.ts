import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：MDXModelViewer 是 MDX 模型预览入口。
 * 锁定：异步取消防护（cancelled 竞态）、资源释放（dispose）、
 * WebGPU→WebGL2 回退、错误兜底。
 */
const src = readFileSync(join(__dirname, 'MDXModelViewer.tsx'), 'utf-8');

describe('MDXModelViewer 接线守卫', () => {
  it('异步加载有 cancelled 竞态防护（每步检查）', () => {
    expect(src).toContain('let cancelled = false;');
    expect(src).toContain('if (cancelled) { mdxModel.dispose(); return; }');
    expect(src).toContain('if (cancelled) { renderer.dispose(); return; }');
  });

  it('卸载时设置 cancelled（effect cleanup）', () => {
    expect(src).toContain('cancelled = true;');
  });

  it('WebGPU 初始化失败回退 WebGL2', () => {
    expect(src).toContain('new WebGPURenderer({ canvas, antialias: true, alpha: true })');
    expect(src).toContain('[MDXModelViewer] WebGPU 初始化失败，回退到 WebGL:');
  });

  it('模型加载失败有显式错误消息（不静默）', () => {
    expect(src).toContain('无法加载模型');
    expect(src).toContain('[MDXModelViewer] 加载失败:');
    expect(src).toContain('if (!cancelled) setError(');
  });

  it('三态 UI：loading/error/正常渲染', () => {
    expect(src).toContain('{loading && (');
    expect(src).toContain('{error && (');
    expect(src).toContain('!loading && !error');
  });
});
