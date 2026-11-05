/**
 * 平台层：Tauri 桌面 / 纯浏览器 双通道文件读写抽象。
 *
 * 目标（浏览器路径 B）：让编辑器在无 Tauri 的纯浏览器环境运行，
 * FDF 导入导出 + 可视化编辑可用；不可用的 Tauri 能力（MPQ/热重载/进程/用户名）降级。
 *
 * 设计约束：Tauri 分支必须与原调用**逐字节等价**，现有桌面用户行为不变。
 * 浏览器分支：File System Access API（Chrome/Edge）优先，
 * 不支持时回落 `<input type=file>` 读 + Blob 下载写。
 */

/** Tauri 运行时探测：`window.__TAURI_INTERNALS__` 由 Tauri 注入（v2）。 */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return typeof (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ !== 'undefined';
}

/**
 * 是否为"真实浏览器运行环境"（需要走浏览器文件分支）。
 *
 * 判定：有 `document` DOM 环境 **且** 无 Tauri 注入。
 * Node/vitest（含 jsdom）默认**不算**，以保留既有 Tauri mock 的测试语义——
 * 这是刻意的：单元测试 mock 的是 Tauri API，不是浏览器 API。
 */
export function isBrowserRuntime(): boolean {
  if (typeof document === 'undefined') return false;
  if (isTauri()) return false;
  // jsdom 提供 document 但无 file picker / Blob 下载的真实点击语义；
  // 以 import.meta.env.DEV 结合 jsdom 特征判定，避免误伤测试。
  const doc = document as Document & { defaultView?: Window | null };
  // 注：defaultView === window，其 __TAURI_INTERNALS__ 已由上方 isTauri() 检查过，
  // 此处无需重复判定（重复分支结构性不可达，已移除避免假覆盖率）。
  if (!doc.defaultView) return false;
  // jsdom 的 navigator.userAgent 含 "jsdom"；真实浏览器不含
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/jsdom/i.test(ua)) return false;
  return true;
}

/** 浏览器是否有 File System Access API（Chrome/Edge 支持，Firefox/Safari 无）。 */
export function hasFileSystemAccess(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as { showOpenFilePicker?: unknown; showSaveFilePicker?: unknown };
  return typeof w.showOpenFilePicker === 'function' && typeof w.showSaveFilePicker === 'function';
}

/** 读取文件内容的统一入口（Tauri 用 plugin-fs；浏览器用 File API）。 */
export async function readTextFileUniversal(path: string): Promise<string> {
  if (!isBrowserRuntime()) {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    return readTextFile(path);
  }
  // 浏览器分支：path 是 Blob URL / data URL / 用户选的临时标识
  const res = await fetch(path);
  if (!res.ok) throw new Error(`读取失败: ${path}`);
  return res.text();
}

/** 写入文件内容的统一入口（Tauri 用 plugin-fs；浏览器用下载或 FSA）。 */
export async function writeTextFileUniversal(path: string, content: string): Promise<void> {
  if (!isBrowserRuntime()) {
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, content);
    return;
  }
  // 浏览器分支：触发下载（path 作为建议文件名）
  downloadText(path, content);
}

/** 浏览器下载文本文件（Blob + a[download]）。 */
export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  if (typeof document === 'undefined') throw new Error('downloadText 需要浏览器环境');
  const blob = new Blob([content], { type: mime });
  downloadBlob(filename, blob);
}

/** 浏览器下载二进制文件。 */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟 revoke，避免部分浏览器点击瞬间取消
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** 弹出浏览器文件选择框，返回 File（取消返回 null）。 */
export function pickFileBrowser(accept = '.fdf,.w3ui,.txt,.json,.toc'): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') { resolve(null); return; }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    let settled = false;
    const done = (f: File | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(f);
    };
    input.onchange = () => done(input.files && input.files[0] ? input.files[0] : null);
    // 用户取消不会触发 change（浏览器差异），用 focus 兜底
    const onFocus = () => setTimeout(() => { if (!settled && (!input.files || input.files.length === 0)) done(null); }, 800);
    window.addEventListener('focus', onFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/**
 * 弹出**目录**选择框，返回目录内全部文件（取消返回 `null`）。
 *
 * ## 为什么可以选目录
 * 浏览器不允许**自动遍历**任意路径，但**允许用户主动选择一个目录**
 * 并把其中文件交给页面——这是标准能力，不需要特殊权限：
 * - 首选 File System Access API 的 `showDirectoryPicker()`（Chrome/Edge）；
 * - 不可用时回落到 `<input webkitdirectory>`（Chrome/Edge/Firefox/Safari 均支持）。
 *
 * 两条路径都返回 `File[]`；`webkitdirectory` 还带相对路径
 * （`webkitRelativePath`），便于按子目录筛选。
 */
export async function pickDirectoryBrowser(): Promise<File[] | null> {
  if (typeof document === 'undefined') return null;

  // 优先 File System Access API：用户体验更好（原生目录对话框，可记住上次位置）
  const w = window as unknown as {
    showDirectoryPicker?: () => Promise<{ values?: () => AsyncIterable<unknown> }>;
  };
  if (typeof w.showDirectoryPicker === 'function') {
    try {
      const dir = await w.showDirectoryPicker();
      // 仅取一层文件（MPQ 都在安装根目录）。递归会拖入 Data/ 等大量无关文件。
      const files: File[] = [];
      const entries = dir.values?.();
      if (entries) {
        for await (const entry of entries) {
          const e = entry as { kind?: string; getFile?: () => Promise<File> };
          if (e.kind === 'file' && typeof e.getFile === 'function') {
            files.push(await e.getFile());
          }
        }
      }
      return files;
    } catch (err) {
      // AbortError = 用户取消；其它错误（权限策略等）回落到 input 方案
      if ((err as { name?: string })?.name === 'AbortError') return null;
    }
  }

  // 回落：<input webkitdirectory>
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    // 非标准属性：控制"选择目录"，TS 的 DOM 类型未收录，故走属性赋值
    (input as unknown as { webkitdirectory: boolean }).webkitdirectory = true;
    (input as unknown as { directory: boolean }).directory = true; // 旧版 Safari
    input.style.display = 'none';
    input.multiple = true;
    let settled = false;
    const done = (files: File[] | null) => {
      if (settled) return;
      settled = true;
      input.remove();
      resolve(files);
    };
    input.onchange = () => {
      const list = input.files;
      done(list && list.length > 0 ? Array.from(list) : null);
    };
    const onFocus = () =>
      setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) done(null);
      }, 800);
    window.addEventListener('focus', onFocus, { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

/** 从浏览器 File 读取文本。 */
export async function readFileAsText(file: File): Promise<string> {
  return file.text();
}

/** 浏览器下"路径"的语义占位：File 对象无真实路径，用文件名。 */
export function browserPathOf(file: File): string {
  return file.name;
}
