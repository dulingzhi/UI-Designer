/**
 * mpq-file 类型声明
 */

declare module 'mpq-file' {
  export default class MPQArchive {
    constructor(buffer: ArrayBuffer);
    
    /**
     * 获取文件列表
     */
    getFileList(): string[];
    
    /**
     * 读取文件内容
     */
    getFile(fileName: string): ArrayBuffer;
    
    /**
     * 检查文件是否存在
     */
    hasFile(fileName: string): boolean;
  }
}
