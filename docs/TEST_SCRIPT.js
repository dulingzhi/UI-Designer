/**
 * 快速测试脚本
 * 
 * 复制以下代码到浏览器控制台运行
 */

// 方法 1: 运行所有测试
import('/src/utils/fdfTestRunner.ts').then(async (module) => {
  console.log('🚀 开始运行所有测试...');
  const results = await module.runAllTests();
  console.log('✅ 测试完成！', results);
});

// 方法 2: 只运行基础测试
import('/src/utils/fdfTestRunner.ts').then(async (module) => {
  const results = await module.runBasicTests();
  console.log('基础测试结果:', results);
});

// 方法 3: 只运行 WC3 文件测试
import('/src/utils/fdfTestRunner.ts').then(async (module) => {
  const results = await module.runWC3Tests();
  console.log('WC3 文件测试结果:', results);
});

// 方法 4: 只运行统计分析
import('/src/utils/fdfTestRunner.ts').then(async (module) => {
  const results = await module.analyzeWC3FDF();
  console.log('统计分析结果:', results);
});
