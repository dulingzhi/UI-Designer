/**
 * 属性面板接线守卫（wiring guard）。
 *
 * 背景：本仓库未安装 jsdom / @testing-library，无法渲染 React 组件做行为级单测。
 * 但「编辑器 UI → FrameData」这一环曾发生过真实缺口：backdrop 的
 * corner/top/bottom/left/right 五个纹理字段在 `FrameData` 里有定义、在 FDF 导出里有
 * 支持（见 exportBackdrop.test.ts），却**没有任何输入控件**——用户在编辑器里根本设不了，
 * 导出链路修好了也用不上。
 *
 * 因此这里用静态断言锁定：**所有可导出的 backdrop 字段都必须在属性面板有接线**
 * （value 读取 + onChange 回写）。这不是行为测试的替代品，而是该约束下的诚实守卫；
 * 若将来引入 jsdom，应改为真正的渲染级交互测试。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const panelSrc = readFileSync(
  join(__dirname, 'TypeSpecificProperties.tsx'),
  'utf-8',
);

/** FrameData 中可由用户设置、且 FDF 导出会写出的全部 backdrop 字段。 */
const EXPORTABLE_BACKDROP_FIELDS = [
  'backdropBackground',
  'backdropEdgeFile',
  'backdropCornerFile',
  'backdropTopFile',
  'backdropBottomFile',
  'backdropLeftFile',
  'backdropRightFile',
  'backdropCornerFlags',
  'backdropCornerSize',
  'backdropBackgroundSize',
  'backdropBackgroundInsets',
  'backdropTileBackground',
  'backdropBlendAll',
] as const;

describe('属性面板接线守卫：可导出的 backdrop 字段必须可编辑', () => {
  for (const field of EXPORTABLE_BACKDROP_FIELDS) {
    it(`${field} 在属性面板有 value 读取与 onChange 回写`, () => {
      const re = new RegExp(`selectedFrame\\.${field}\\s*\\|\\|`);
      const reNullable = new RegExp(`selectedFrame\\.${field}\\s*\\?\\?`);
      const reDirect = new RegExp(`value=\\{selectedFrame\\.${field}`);
      expect(
        re.test(panelSrc) || reNullable.test(panelSrc) || reDirect.test(panelSrc),
        `面板缺少 ${field} 的 value 读取`,
      ).toBe(true);

      const reSet = new RegExp(`handleChange\\('${field}'`);
      expect(reSet.test(panelSrc), `面板缺少 ${field} 的 onChange 回写`).toBe(true);
    });
  }
});
