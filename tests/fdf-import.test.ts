/**
 * FDF 导入功能单元测试
 * 测试 EscMenuMainPanel.fdf 的导入和转换
 * 
 * 运行方式: npm run test:fdf
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFDF } from '../src/utils/fdf.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简单的测试框架
class TestRunner {
  private passed = 0;
  private failed = 0;
  private currentSuite = '';

  describe(name: string, fn: () => void) {
    console.log(`\n📦 ${name}`);
    this.currentSuite = name;
    fn();
  }

  test(name: string, fn: () => void) {
    try {
      fn();
      this.passed++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      this.failed++;
      console.log(`  ❌ ${name}`);
      console.log(`     ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  expect(value: any) {
    return {
      toBe: (expected: any) => {
        if (value !== expected) {
          throw new Error(`Expected ${expected}, but got ${value}`);
        }
      },
      toEqual: (expected: any) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(value)}`);
        }
      },
      toBeDefined: () => {
        if (value === undefined) {
          throw new Error('Expected value to be defined');
        }
      },
      toBeGreaterThan: (expected: number) => {
        if (value <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected: number) => {
        if (value >= expected) {
          throw new Error(`Expected ${value} to be less than ${expected}`);
        }
      },
      toContain: (expected: any) => {
        if (!Array.isArray(value) || !value.includes(expected)) {
          throw new Error(`Expected array to contain ${expected}`);
        }
      },
      toBeUndefined: () => {
        if (value !== undefined) {
          throw new Error(`Expected value to be undefined, but got ${value}`);
        }
      },
    };
  }

  summary() {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`测试完成: ${this.passed} 通过, ${this.failed} 失败`);
    console.log('='.repeat(50));
    return this.failed === 0;
  }
}

const runner = new TestRunner();
const describe = runner.describe.bind(runner);
const test = runner.test.bind(runner);
const expect = runner.expect.bind(runner);

// 开始测试
describe('FDF Import - EscMenuMainPanel', () => {
  const fdfPath = path.join(__dirname, '../vendor/UI/FrameDef/UI/EscMenuMainPanel.fdf');
  const fdfContent = fs.readFileSync(fdfPath, 'utf-8');
  
  test('应该成功解析 FDF 文件', () => {
    const result = parseFDF(fdfContent);
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  test('应该正确解析 EscMenuMainPanel Frame', () => {
    const frames = parseFDF(fdfContent);
    const mainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
    
    expect(mainPanel).toBeDefined();
    expect(mainPanel?.name).toBe('EscMenuMainPanel');
  });

  test('SetAllPoints 应该生成两个锚点（TOPLEFT 和 BOTTOMRIGHT）', () => {
    const frames = parseFDF(fdfContent);
    const mainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
    
    expect(mainPanel?.anchors).toBeDefined();
    expect(mainPanel?.anchors.length).toBe(2);
    
    const topLeft = mainPanel?.anchors.find(a => a.point === 0); // TOPLEFT
    const bottomRight = mainPanel?.anchors.find(a => a.point === 8); // BOTTOMRIGHT
    
    expect(topLeft).toBeDefined();
    expect(bottomRight).toBeDefined();
  });

  test('顶层 Frame 的 SetAllPoints 应该使用画布绝对坐标', () => {
    const frames = parseFDF(fdfContent);
    const mainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
    
    const topLeft = mainPanel?.anchors.find(a => a.point === 0);
    const bottomRight = mainPanel?.anchors.find(a => a.point === 8);
    
    // 顶层 Frame 不应该有 relativeTo
    expect(topLeft?.relativeTo).toBeUndefined();
    expect(bottomRight?.relativeTo).toBeUndefined();
    
    // 坐标应该是画布范围
    expect(topLeft?.x).toBe(0);
    expect(topLeft?.y).toBe(0.6);
    expect(bottomRight?.x).toBe(0.8);
    expect(bottomRight?.y).toBe(0);
  });

  test('Width 和 Height 应该使用相对单位（而非像素）', () => {
    const frames = parseFDF(fdfContent);
    const helpButton = frames.find(f => f.name === 'HelpButton');
    
    expect(helpButton).toBeDefined();
    expect(helpButton?.width).toBe(0.11); // 相对单位
    expect(helpButton?.width).toBeLessThan(1); // 确保不是像素值
  });

  test('应该正确处理数组值（FDF 解析器 bug）', () => {
    const frames = parseFDF(fdfContent);
    
    // HelpButton 的 Width 后面紧跟 ButtonText 属性
    // 解析器可能将其合并成数组，我们应该只取第一个值
    const helpButton = frames.find(f => f.name === 'HelpButton');
    const tipsButton = frames.find(f => f.name === 'TipsButton');
    const confirmQuitButton = frames.find(f => f.name === 'ConfirmQuitQuitButton');
    
    expect(typeof helpButton?.width).toBe('number');
    expect(helpButton?.width).toBe(0.11);
    
    expect(typeof tipsButton?.width).toBe('number');
    expect(tipsButton?.width).toBe(0.11);
    
    expect(typeof confirmQuitButton?.width).toBe('number');
    expect(confirmQuitButton?.width).toBe(0.129);
  });

  test('relativeTo 应该使用 Frame ID 而非名称', () => {
    const frames = parseFDF(fdfContent);
    const pauseButton = frames.find(f => f.name === 'PauseButton');
    const mainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
    
    expect(pauseButton?.anchors).toBeDefined();
    const topAnchor = pauseButton?.anchors.find(a => a.point === 1); // TOP
    
    expect(topAnchor?.relativeTo).toBeDefined();
    // relativeTo 应该是 ID 格式（frame_xxx_xxx）而非名称
    expect(topAnchor?.relativeTo).toBe(mainPanel?.id);
  });

  test('嵌套 Frame 的 SetAllPoints 应该相对于父元素', () => {
    const frames = parseFDF(fdfContent);
    
    // 查找所有使用 SetAllPoints 的嵌套 Frame
    const nestedFramesWithSetAllPoints = frames.filter(f => 
      f.fdfMetadata?.setAllPoints && f.parentId
    );
    
    nestedFramesWithSetAllPoints.forEach(frame => {
      const parent = frames.find(f => f.id === frame.parentId);
      
      expect(frame.anchors.length).toBe(2);
      const topLeft = frame.anchors.find(a => a.point === 0);
      const bottomRight = frame.anchors.find(a => a.point === 8);
      
      // 应该相对于父元素
      expect(topLeft?.relativeTo).toBe(parent?.id);
      expect(bottomRight?.relativeTo).toBe(parent?.id);
      
      // 相对点应该对应
      expect(topLeft?.relativePoint).toBe(0); // TOPLEFT
      expect(bottomRight?.relativePoint).toBe(8); // BOTTOMRIGHT
      
      // 偏移应该为 0
      expect(topLeft?.x).toBe(0);
      expect(topLeft?.y).toBe(0);
      expect(bottomRight?.x).toBe(0);
      expect(bottomRight?.y).toBe(0);
    });
  });

  test('TEXT Frame 应该使用正确的默认高度', () => {
    const frames = parseFDF(fdfContent);
    
    // 查找所有 TEXT 类型的 Frame
    const textFrames = frames.filter(f => f.type === 13); // TEXT_FRAME = 13
    
    textFrames.forEach(frame => {
      // TEXT Frame 的默认高度应该是 0.012 而不是 100
      if (!frame.anchors || frame.anchors.length === 0) {
        expect(frame.height).toBeLessThan(0.1);
      }
    });
  });

  test('模板继承不应该复制锚点', () => {
    const frames = parseFDF(fdfContent);
    
    // PauseButton 继承自 EscMenuButtonTemplate
    const pauseButton = frames.find(f => f.name === 'PauseButton');
    
    // 按钮应该有自己的锚点定义（SetPoint TOP）
    expect(pauseButton?.anchors).toBeDefined();
    
    // 锚点应该引用实际的 Frame ID，而不是模板的 ID
    const topAnchor = pauseButton?.anchors.find(a => a.point === 1);
    if (topAnchor?.relativeTo) {
      const relativeFrame = frames.find(f => f.id === topAnchor.relativeTo);
      expect(relativeFrame).toBeDefined();
      expect(relativeFrame?.name).toBe('EscMenuMainPanel');
    }
  });

  test('父子关系应该正确建立', () => {
    const frames = parseFDF(fdfContent);
    const mainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
    
    // MainPanel 应该有子元素
    expect(mainPanel?.children).toBeDefined();
    expect(mainPanel?.children.length).toBeGreaterThan(0);
    
    // 检查子元素的 parentId
    mainPanel?.children.forEach(childId => {
      const child = frames.find(f => f.id === childId);
      expect(child?.parentId).toBe(mainPanel.id);
    });
  });

  test('所有 Frame 应该有有效的位置和尺寸', () => {
    const frames = parseFDF(fdfContent);
    
    frames.forEach(frame => {
      // 坐标应该是有效数字
      expect(typeof frame.x).toBe('number');
      expect(typeof frame.y).toBe('number');
      expect(typeof frame.width).toBe('number');
      expect(typeof frame.height).toBe('number');
      
      // 不应该是 NaN
      expect(isNaN(frame.x)).toBe(false);
      expect(isNaN(frame.y)).toBe(false);
      expect(isNaN(frame.width)).toBe(false);
      expect(isNaN(frame.height)).toBe(false);
      
      // 尺寸应该是正数
      expect(frame.width).toBeGreaterThan(0);
      expect(frame.height).toBeGreaterThan(0);
    });
  });

  test('坐标应该在合理范围内（相对单位）', () => {
    const frames = parseFDF(fdfContent);
    
    frames.forEach(frame => {
      // X 坐标应该大致在 -0.2 到 1.0 范围内（允许一些超出画布的元素）
      expect(frame.x).toBeGreaterThan(-0.5);
      expect(frame.x).toBeLessThan(1.5);
      
      // Y 坐标同理
      expect(frame.y).toBeGreaterThan(-0.5);
      expect(frame.y).toBeLessThan(1.0);
      
      // 宽度和高度应该在合理范围内
      expect(frame.width).toBeLessThan(2.0);
      expect(frame.height).toBeLessThan(2.0);
    });
  });

  test('相对锚点计算应该正确', () => {
    const frames = parseFDF(fdfContent);
    
    // LoadGameButton 相对于 SaveGameButton 的 BOTTOM
    const loadButton = frames.find(f => f.name === 'LoadGameButton');
    const saveButton = frames.find(f => f.name === 'SaveGameButton');
    
    expect(loadButton).toBeDefined();
    expect(saveButton).toBeDefined();
    
    const topAnchor = loadButton?.anchors.find(a => a.point === 1); // TOP
    expect(topAnchor?.relativeTo).toBe(saveButton?.id);
    expect(topAnchor?.relativePoint).toBe(7); // BOTTOM
    expect(topAnchor?.x).toBe(0);
    expect(topAnchor?.y).toBe(-0.002); // 偏移
  });

  test('特殊按钮的宽度应该正确解析', () => {
    const frames = parseFDF(fdfContent);
    
    const buttonWidths = [
      { name: 'HelpButton', width: 0.11 },
      { name: 'TipsButton', width: 0.11 },
      { name: 'ConfirmQuitQuitButton', width: 0.129 },
      { name: 'ConfirmQuitCancelButton', width: 0.129 },
      { name: 'HelpOKButton', width: 0.16 },
      { name: 'TipsBackButton', width: 0.115 },
      { name: 'TipsNextButton', width: 0.115 },
      { name: 'TipsOKButton', width: 0.115 },
    ];
    
    buttonWidths.forEach(({ name, width }) => {
      const button = frames.find(f => f.name === name);
      expect(button?.width).toBe(width);
    });
  });

  test('MainPanel 应该居中于 EscMenuMainPanel', () => {
    const frames = parseFDF(fdfContent);
    const mainPanel = frames.find(f => f.name === 'MainPanel');
    const escMenuMainPanel = frames.find(f => f.name === 'EscMenuMainPanel');
    
    expect(mainPanel).toBeDefined();
    expect(escMenuMainPanel).toBeDefined();
    
    // MainPanel 应该有 CENTER 锚点（没有显式 SetPoint 时的默认行为）
    expect(mainPanel?.anchors).toBeDefined();
    expect(mainPanel?.anchors.length).toBeGreaterThan(0);
    
    const centerAnchor = mainPanel?.anchors.find(a => a.point === 4); // CENTER
    expect(centerAnchor).toBeDefined();
    expect(centerAnchor?.relativeTo).toBe(escMenuMainPanel?.id);
    expect(centerAnchor?.relativePoint).toBe(4); // 相对于父元素的 CENTER
    expect(centerAnchor?.x).toBe(0);
    expect(centerAnchor?.y).toBe(0);
  });

  test('应该包含所有主要的 Frame', () => {
    const frames = parseFDF(fdfContent);
    const frameNames = frames.map(f => f.name);
    
    const expectedFrames = [
      'EscMenuMainPanel',
      'WouldTheRealOptionsTitleTextPleaseStandUp',
      'PauseButton',
      'SaveGameButton',
      'LoadGameButton',
      'OptionsButton',
      'HelpButton',
      'TipsButton',
      'EndGameButton',
      'ReturnButton',
      'ConfirmQuitTitleText',
      'ConfirmQuitMessageText',
      'ConfirmQuitQuitButton',
      'ConfirmQuitCancelButton',
    ];
    
    expectedFrames.forEach(name => {
      expect(frameNames).toContain(name);
    });
  });
});

// 运行测试并显示结果
const success = runner.summary();
process.exit(success ? 0 : 1);
