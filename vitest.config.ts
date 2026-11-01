/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // 独立自建 runner 的脚本型 `*.test.ts`(自带 process.exit / 直接执行),
    // 由各自的 tsx 脚本运行 (见 package.json test:fdf 等), 不应被 vitest 当作套件拾取。
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/blp-decoder.test.ts',
      'tests/mpq-manager.test.ts',
      'tests/texture-loader.test.ts',
      'tests/fdf-import.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html'],
      include: ['src/utils/**/*.ts'],
      // 两个文件无运行时可执行语句，v8 无从度量，且无法通过测试产生"行"覆盖：
      //  - fdfImportExport.ts: 纯 re-export 桶文件（无自实现逻辑，仅转发导入导出 API）。
      //  - fdfKernelTypes.ts: 仅含 TypeScript interface（纯类型，编译后无运行时代码）。
      exclude: [
        'src/utils/**/*.test.ts',
        'src/utils/fdfImportExport.ts',
        'src/utils/fdfKernelTypes.ts',
      ],
      all: true,
    },
  },
});
