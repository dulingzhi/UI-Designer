/**
 * 测试所有控件类型
 */

import { FrameType } from '../src/types';

console.log('🔍 测试所有控件类型定义\n');
console.log('='.repeat(80));

interface FrameTypeInfo {
  name: string;
  value: number;
  category: string;
}

const frameTypes: FrameTypeInfo[] = [
  // 基础容器
  { name: 'ORIGIN', value: FrameType.ORIGIN, category: '基础容器' },
  { name: 'FRAME', value: FrameType.FRAME, category: '基础容器' },
  { name: 'BACKDROP', value: FrameType.BACKDROP, category: '基础容器' },
  { name: 'SIMPLEFRAME', value: FrameType.SIMPLEFRAME, category: '基础容器' },
  
  // 文本控件
  { name: 'TEXT_FRAME', value: FrameType.TEXT_FRAME, category: '文本控件' },
  { name: 'SIMPLEFONTSTRING', value: FrameType.SIMPLEFONTSTRING, category: '文本控件' },
  { name: 'TEXTAREA', value: FrameType.TEXTAREA, category: '文本控件' },
  
  // 按钮控件
  { name: 'BUTTON', value: FrameType.BUTTON, category: '按钮控件' },
  { name: 'GLUETEXTBUTTON', value: FrameType.GLUETEXTBUTTON, category: '按钮控件' },
  { name: 'GLUEBUTTON', value: FrameType.GLUEBUTTON, category: '按钮控件' },
  { name: 'SIMPLEBUTTON', value: FrameType.SIMPLEBUTTON, category: '按钮控件' },
  { name: 'BROWSER_BUTTON', value: FrameType.BROWSER_BUTTON, category: '按钮控件' },
  { name: 'SCRIPT_DIALOG_BUTTON', value: FrameType.SCRIPT_DIALOG_BUTTON, category: '按钮控件' },
  { name: 'INVIS_BUTTON', value: FrameType.INVIS_BUTTON, category: '按钮控件' },
  
  // 交互控件
  { name: 'CHECKBOX', value: FrameType.CHECKBOX, category: '交互控件' },
  { name: 'EDITBOX', value: FrameType.EDITBOX, category: '交互控件' },
  { name: 'SLIDER', value: FrameType.SLIDER, category: '交互控件' },
  { name: 'SCROLLBAR', value: FrameType.SCROLLBAR, category: '交互控件' },
  { name: 'LISTBOX', value: FrameType.LISTBOX, category: '交互控件' },
  { name: 'MENU', value: FrameType.MENU, category: '交互控件' },
  { name: 'POPUPMENU', value: FrameType.POPUPMENU, category: '交互控件' },
  
  // 图形控件
  { name: 'SPRITE', value: FrameType.SPRITE, category: '图形控件' },
  { name: 'MODEL', value: FrameType.MODEL, category: '图形控件' },
  { name: 'HIGHLIGHT', value: FrameType.HIGHLIGHT, category: '图形控件' },
  
  // 状态栏
  { name: 'SIMPLESTATUSBAR', value: FrameType.SIMPLESTATUSBAR, category: '状态栏' },
  { name: 'STATUSBAR', value: FrameType.STATUSBAR, category: '状态栏' },
  
  // 其他控件
  { name: 'CONTROL', value: FrameType.CONTROL, category: '其他控件' },
  { name: 'DIALOG', value: FrameType.DIALOG, category: '其他控件' },
  { name: 'TIMERTEXT', value: FrameType.TIMERTEXT, category: '其他控件' },
];

// 按分类分组
const categories = new Map<string, FrameTypeInfo[]>();
frameTypes.forEach(ft => {
  if (!categories.has(ft.category)) {
    categories.set(ft.category, []);
  }
  categories.get(ft.category)!.push(ft);
});

// 打印分类统计
console.log('\n📊 控件类型统计:\n');
for (const [category, types] of categories) {
  console.log(`${category}: ${types.length}个`);
  types.forEach(type => {
    console.log(`  ✓ ${type.name.padEnd(25)} = ${type.value}`);
  });
  console.log();
}

console.log('='.repeat(80));
console.log(`\n总计: ${frameTypes.length} 个控件类型`);
console.log('='.repeat(80));

// 验证枚举值没有重复
const values = frameTypes.map(ft => ft.value);
const uniqueValues = new Set(values);
if (values.length !== uniqueValues.size) {
  console.error('\n❌ 错误: 存在重复的枚举值!');
  const duplicates = values.filter((v, i) => values.indexOf(v) !== i);
  console.error('重复值:', [...new Set(duplicates)]);
  process.exit(1);
} else {
  console.log('\n✅ 所有枚举值唯一');
}

// 测试导入导出映射
console.log('\n🔄 测试FDF类型映射:\n');

const fdfTypeMap: Record<string, number> = {
  'FRAME': FrameType.FRAME,
  'BACKDROP': FrameType.BACKDROP,
  'TEXT': FrameType.TEXT_FRAME,
  'BUTTON': FrameType.BUTTON,
  'GLUETEXTBUTTON': FrameType.GLUETEXTBUTTON,
  'CHECKBOX': FrameType.CHECKBOX,
  'EDITBOX': FrameType.EDITBOX,
  'SLIDER': FrameType.SLIDER,
  'SPRITE': FrameType.SPRITE,
  'MODEL': FrameType.MODEL,
};

for (const [fdfType, enumValue] of Object.entries(fdfTypeMap)) {
  console.log(`  ${fdfType.padEnd(20)} → FrameType.${FrameType[enumValue]} (${enumValue})`);
}

console.log('\n✅ 控件类型测试完成!');
