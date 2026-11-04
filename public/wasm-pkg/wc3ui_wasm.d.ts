/* tslint:disable */
/* eslint-disable */

/**
 * BLP 解码结果（与桌面端 `BlpImageData` 同形：width/height/RGBA 字节）。
 */
export class BlpImage {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    /**
     * RGBA 字节（长度 = width * height * 4）。
     */
    data(): Uint8Array;
    /**
     * 图像高度（像素）。
     */
    readonly height: number;
    /**
     * 图像宽度（像素）。
     */
    readonly width: number;
}

/**
 * 解码 BLP 为 RGBA（对应桌面端命令 `decode_blp_to_rgba`）。
 */
export function decode_blp_to_rgba(blp_data: Uint8Array | number[]): BlpImage;

/**
 * 关闭归档、释放其占用的内存。
 */
export function mpq_close(handle: number): void;

/**
 * 判断文件是否存在。
 */
export function mpq_has_file(handle: number, name: string): boolean;

/**
 * 列出归档内全部文件名（JSON 数组字符串）。
 */
export function mpq_list(handle: number): string;

/**
 * 打开 MPQ 归档（字节流），返回句柄 ID。前端持有 ID 复用之。
 */
export function mpq_open(archive: Uint8Array | number[]): number;

/**
 * 读取文件内容。
 */
export function mpq_read_file(handle: number, name: string): Uint8Array;

/**
 * 解析 MDX 模型为 JSON 字符串（对应桌面端命令 `parse_mdx_file` 的返回）。
 */
export function parse_mdx_file(mdx_data: Uint8Array | number[]): string;

/**
 * WASM 模块版本（供前端探测加载成功）。
 */
export function wasm_version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_blpimage_free: (a: number, b: number) => void;
    readonly blpimage_data: (a: number) => [number, number];
    readonly blpimage_height: (a: number) => number;
    readonly blpimage_width: (a: number) => number;
    readonly decode_blp_to_rgba: (a: number, b: number) => [number, number, number];
    readonly mpq_close: (a: number) => [number, number];
    readonly mpq_has_file: (a: number, b: number, c: number) => [number, number, number];
    readonly mpq_list: (a: number) => [number, number, number, number];
    readonly mpq_open: (a: number, b: number) => [number, number, number];
    readonly mpq_read_file: (a: number, b: number, c: number) => [number, number, number, number];
    readonly parse_mdx_file: (a: number, b: number) => [number, number, number, number];
    readonly wasm_version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
