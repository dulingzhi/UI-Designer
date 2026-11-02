import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 接线守卫（wiring guard）：PropertyEditors 是属性面板的通用受控控件库
 * （ColorPicker/TextField/MultiSelect 等）。锁定三条不变式：
 * 1. 受控模式——value 读取 + onChange 回写成对；
 * 2. 文本清空语义——空串统一归一为 undefined（FrameData 可选字段）；
 * 3. 颜色 RGBA 合并——alpha 单独编辑时保持 RGB 三通道不丢。
 */
const src = readFileSync(join(__dirname, 'PropertyEditors.tsx'), 'utf-8');

describe('PropertyEditors 接线守卫', () => {
  it('颜色控件是受控组件（value + onChange 成对）', () => {
    expect(src).toContain('value={hexColor}');
    expect(src).toContain('onChange={(e) => onChange(fromHex(e.target.value, alpha))}');
  });

  it('alpha 编辑合并进四元组（不丢 RGB）', () => {
    expect(src).toContain('onChange([value[0], value[1], value[2], newAlpha])');
  });

  it('文本清空语义：空串归一为 undefined（可选字段）', () => {
    expect(src).toContain("onChange={(e) => onChange(e.target.value || undefined)}");
  });

  it('MultiSelect 空选归一为 undefined', () => {
    expect(src).toContain('onChange(newValue.length > 0 ? newValue : undefined)');
  });

  it('颜色十六进制与 RGBA 互转工具被使用', () => {
    expect(src).toContain('fromHex(');
    expect(src).toContain('toHex(');
  });
});
