import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  readTextFile: vi.fn(),
  readDir: vi.fn(),
  parseFDFToAST: vi.fn(),
  parseFDF: vi.fn(),
  exportFDF: vi.fn(),
  validateFDF: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }));
vi.mock('@tauri-apps/plugin-fs', () => ({ readTextFile: mocks.readTextFile, readDir: mocks.readDir }));
vi.mock('./fdf', () => ({
  parseFDFToAST: mocks.parseFDFToAST,
  parseFDF: mocks.parseFDF,
  exportFDF: mocks.exportFDF,
  validateFDF: mocks.validateFDF,
}));
// fdfExporter likely has no Tauri deps but guard anyway
import * as fdfImportExport from './fdfImportExport';

describe('fdfImportExport barrel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('re-exports all functions and classes', () => {
    expect(typeof fdfImportExport.importFromFDFEnhanced).toBe('function');
    expect(typeof fdfImportExport.importFDFFolder).toBe('function');
    expect(typeof fdfImportExport.importFromFDFText).toBe('function');
    expect(typeof fdfImportExport.applyTemplateInheritance).toBe('function');
    expect(typeof fdfImportExport.applyTemplateInheritanceToAll).toBe('function');
    expect(typeof fdfImportExport.FDFExporter).toBe('function');
    expect(typeof fdfImportExport.FDFTemplateManager).toBe('function');
    expect(typeof fdfImportExport.templateManager).toBe('object');
    expect(typeof fdfImportExport.parseFDF).toBe('function');
    expect(typeof fdfImportExport.parseFDFToAST).toBe('function');
    expect(typeof fdfImportExport.exportFDF).toBe('function');
    expect(typeof fdfImportExport.validateFDF).toBe('function');
  });

  it('delegates importFromFDFText to the underlying implementation', () => {
    // The re-exported importFromFDFText uses parseFDFToAST from fdf (mocked)
    mocks.parseFDFToAST.mockImplementation(() => { throw new Error('delegated'); });
    expect(() => fdfImportExport.importFromFDFText('x')).toThrow('delegated');
  });
});