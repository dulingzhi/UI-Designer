import { describe, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseFDF } from '../../src/utils/fdf';
import { importFromFDFText } from '../../src/utils/fdfImport';
import type { ProjectData } from '../../src/types';

const dialogMocks = vi.hoisted(() => ({ save: vi.fn() }));
const fsMocks = vi.hoisted(() => ({ writeTextFile: vi.fn(), writeFile: vi.fn() }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: dialogMocks.save }));
vi.mock('@tauri-apps/plugin-fs', () => ({ writeTextFile: fsMocks.writeTextFile, writeFile: fsMocks.writeFile }));
vi.mock('../src/utils/fdfExporter', () => ({
  FDFExporterEnhanced: function FDFExporterEnhanced() { this.exportEnhanced = () => ''; },
}));

import { exportToFDF } from '../../src/utils/exportUtils';

const OW3 = 'd:/Projects/openwar3/.sim-build/src';
const MPQ = 'E:/GAMES/WAR3/war3.mpq';
const bb = (p: string) => { const b = readFileSync(p); return new Uint8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const _req = createRequire(import.meta.url);
const load = (m: string) => _req(join(OW3, m));
const usable = existsSync(join(OW3, 'vfs/mpq.js')) && existsSync(MPQ);

describe('真实全量 FDF 导出→导入大样本验证', () => {
  it('run', async () => {
    if (!usable) { console.log('SKIP'); return; }
    const ds = new (load('vfs/mpq.js')).MpqDataSource('war3.mpq', bb(MPQ));
    const files = (ds.list() as string[]).filter((n) => n.startsWith('UI\\FrameDef\\Glue\\') && n.endsWith('.fdf')).sort();
    let totalFrames = 0, okExports = 0, failExports = 0, okImports = 0, failImports = 0;
    const problems: string[] = [];

    for (const path of files) {
      try {
        const src = new TextDecoder('latin1').decode(ds.rawBytes(path)!);
        const fds = parseFDF(src, { useKernelLayout: true });
        const frames: Record<string, any> = {};
        for (const f of fds) frames[f.id] = f;
        const proj = {
          version: 2, libraryName: 'RT', originMode: 'gameui', exportVersion: 'reforged',
          hideGameUI: false, hideHeroBar: false, hideMiniMap: false, hideResources: false,
          hideButtonBar: false, hidePortrait: false, hideChat: false, appInterface: '',
          frames, rootFrameIds: fds.filter((f: any) => !f.parentId).map((f: any) => f.id),
        } as unknown as ProjectData;

        let fdf: string;
        try {
          dialogMocks.save.mockResolvedValue('/out/x.fdf');
          fsMocks.writeTextFile.mockResolvedValue(undefined as never);
          await exportToFDF(proj, false, () => {});
          fdf = fsMocks.writeTextFile.mock.calls.at(-1)![1] as string;
          okExports += 1;
        } catch (e) {
          failExports += 1;
          problems.push(`${path}: 导出抛错 ${(e as Error).message.slice(0, 90)}`);
          continue;
        }

        try {
          const imported = importFromFDFText(fdf);
          okImports += 1;
          totalFrames += imported.length;
        } catch (e) {
          failImports += 1;
          problems.push(`${path}: 导入抛错 ${(e as Error).message.slice(0, 90)}`);
        }
      } catch (e) {
        problems.push(`${path}: 解析抛错 ${(e as Error).message.slice(0, 90)}`);
      }
    }
    console.log(`files=${files.length} exports OK=${okExports} FAIL=${failExports} imports OK=${okImports} FAIL=${failImports} frames=${totalFrames}`);
    for (const p of problems.slice(0, 12)) console.log(`  问题: ${p}`);
  });
});