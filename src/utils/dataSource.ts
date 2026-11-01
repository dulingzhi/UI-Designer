/**
 * 统一资源数据源抽象（对标 openwar3 `src/vfs/types.ts` 的 DataSource 语义）。
 *
 * 目标：把"路径归一化 + 多层档案优先 + exists/read/list"从 `mpqManager.ts` 中解耦，
 * 为将来接入 CASC / 本地目录 / 局域网资源等留出统一接口。
 *
 * 本模块是**纯前端逻辑**，不 import 任何 Tauri / Rust 运行时：
 * Rust 后端通过 `MpqFns` 接口注入（见 `MpqDataSource`），因此可以在 node/vitest 中直接单测。
 */

/** 路径分隔符合一化逻辑：FDF/WC3 内部使用反斜杠 `\`，但外部常给 `/`。 */
export function normalizeMpqPath(path: string): string {
  return path.trim().replace(/\//g, '\\').replace(/^\\+/, '');
}

/**
 * 统一资源数据源接口。
 *
 * - `exists(path)`  是否存在该资源；
 * - `read(path)`    读取资源字节（异步），找不到返回 `null`；
 * - `list()`        该数据源内部的文件路径清单（用于搜索/浏览）。
 */
export interface DataSource {
  readonly label: string;
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<ArrayBuffer | null>;
  list(): string[];
}

/**
 * Rust 后端最小能力接口（由 `MpqDataSource`/`MPQManager` 消费）。
 * 抽出来是为了单测：用内存实现替换真实 `invoke`。
 */
export interface MpqFsFile {
  name: string;
  size: number;
}
export interface MpqFns {
  /** 从单个档案读文件；找不到返回 null。 */
  readFile(archivePath: string, fileName: string): Promise<ArrayBuffer | null>;
  /** 列出一个档案的全部文件（来自 listfile），含大小。 */
  listFiles(archivePath: string): Promise<MpqFsFile[]>;
  /**
   * 快速存在性查询（后端 `has_mpq_file`，精度 listfile）。
   * 可选：未提供时 `exists` 退化为基于 listfile 的包含判断。
   */
  hasFile?(archivePath: string, fileName: string): Promise<boolean>;
}

/** 单个 MPQ 档案的定位信息。 */
export interface MpqArchiveSource {
  /** 展示用档案名，如 `War3xLocal.mpq`。 */
  name: string;
  /** 档案在文件系统中的完整路径。 */
  path: string;
}

/**
 * 单个 MPQ 档案的 DataSource 适配器。
 * 读与列文件都走注入的 `MpqFns`，因此不依赖真实 Tauri 运行时可测。
 */
export class MpqDataSource implements DataSource {
  readonly label: string;
  private fileList: string[] | null = null;
  private listPromise: Promise<string[]> | null = null;

  constructor(
    private archive: MpqArchiveSource,
    private fns: MpqFns,
  ) {
    this.label = archive.name;
  }

  /** 档案文件系统路径（供上层构造多层读取时透传）。 */
  get archivePath(): string {
    return this.archive.path;
  }

  private async loadList(): Promise<string[]> {
    if (!this.listPromise) {
      this.listPromise = this.fns.listFiles(this.archive.path).then(
        (files) => files.map((f) => f.name.replace(/\//g, '\\').toLowerCase()),
        () => {
          // listfile 不可用时降级为空列表，避免一个坏档案拖垮整棵树。
          this.listPromise = null;
          return [] as string[];
        },
      );
    }
    return this.listPromise;
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizeMpqPath(path);
    if (this.fns.hasFile) return this.fns.hasFile(this.archive.path, normalized);
    const key = normalized.toLowerCase();
    return (await this.loadList()).includes(key);
  }

  async read(path: string): Promise<ArrayBuffer | null> {
    const normalized = normalizeMpqPath(path);
    return this.fns.readFile(this.archive.path, normalized);
  }

  list(): string[] {
    return this.fileList ?? [];
  }

  /** 预取并暴露文件清单（供上层合并列表后搜索/浏览）。 */
  async prefetchList(): Promise<void> {
    this.fileList = await this.loadList();
  }
}

/**
 * 多层数据源：按**高优先级在前**的层栈依次查找，首个命中生效。
 * 与 openwar3 `LayeredDataSource` 语义一致（用于 MPQ profile 低优先在前反转后入栈）。
 */
export class LayeredDataSource implements DataSource {
  get label(): string {
    return this.layers.map((l) => l.label).join('+');
  }

  constructor(private layers: DataSource[]) {}

  /** 层栈（高优先在前）。 */
  get layersList(): readonly DataSource[] {
    return this.layers;
  }

  async exists(path: string): Promise<boolean> {
    const normalized = normalizeMpqPath(path);
    for (const layer of this.layers) {
      if (await layer.exists(normalized)) return true;
    }
    return false;
  }

  async read(path: string): Promise<ArrayBuffer | null> {
    const normalized = normalizeMpqPath(path);
    for (const layer of this.layers) {
      const data = await layer.read(normalized);
      if (data) return data;
    }
    return null;
  }

  list(): string[] {
    const merged = new Map<string, string>();
    // 高优先在前：先出现的层覆盖后出现的同名项（高优先层的路径保留）。
    for (const layer of this.layers) {
      for (const name of layer.list()) {
        const key = name.toLowerCase();
        if (!merged.has(key)) merged.set(key, name);
      }
    }
    return Array.from(merged.values()).sort();
  }
}

/**
 * 测试/内存用数据源：直接由内存 map 驱动。
 * 也用于把"客户端本机文件目录"作为一层接入。
 */
export class InMemoryDataSource implements DataSource {
  readonly label: string;
  private files: Map<string, ArrayBuffer>;

  constructor(label: string, files: Record<string, string | ArrayBuffer | Uint8Array> = {}) {
    this.label = label;
    this.files = new Map();
    for (const [p, content] of Object.entries(files)) {
      this.files.set(normalizeMpqPath(p).toLowerCase(), toArrayBuffer(content));
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(normalizeMpqPath(path).toLowerCase());
  }

  async read(path: string): Promise<ArrayBuffer | null> {
    return this.files.get(normalizeMpqPath(path).toLowerCase()) ?? null;
  }

  list(): string[] {
    return Array.from(this.files.keys());
  }
}

function toArrayBuffer(content: string | ArrayBuffer | Uint8Array): ArrayBuffer {
  if (content instanceof ArrayBuffer) return content;
  if (content instanceof Uint8Array) return content.buffer.slice(content.byteOffset, content.byteOffset + content.byteLength);
  return new TextEncoder().encode(content).buffer;
}