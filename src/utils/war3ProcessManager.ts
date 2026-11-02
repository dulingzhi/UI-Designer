// War3 进程管理器 - 管理War3进程和热重载监听

import { isProcessRunning, killProcess, killProcessElevated, isWar3Running, killWar3Processes } from './kkweDetector';
import { getHotReloadExporter } from './hotReloadExporter';
import { useProjectStore } from '../store/projectStore';

class War3ProcessManager {
  private currentPid: number | null = null;

  /**
   * 获取当前War3进程ID (从内存或localStorage)
   */
  getCurrentPid(): number | null {
    // 优先返回内存中的PID
    if (this.currentPid !== null) {
      return this.currentPid;
    }
    
    // 尝试从localStorage恢复
    const pidStr = localStorage.getItem('war3_process_pid');
    if (pidStr) {
      const pid = parseInt(pidStr);
      if (!isNaN(pid)) {
        this.currentPid = pid;
        return pid;
      }
    }
    
    return null;
  }

  /**
   * 设置当前War3进程ID (War3.exe的真实PID)
   */
  async setProcess(pid: number): Promise<void> {
    this.currentPid = pid;
    
    // 保存到localStorage
    localStorage.setItem('war3_process_pid', pid.toString());
    
    console.log('[War3进程] 已设置War3.exe进程: PID=', pid);
    
    // 等待一下再验证进程是否存在
    setTimeout(async () => {
      const running = await isProcessRunning(pid);
      console.log('[War3进程] 验证进程状态: PID=', pid, '运行=', running);
      if (!running) {
        console.warn('[War3进程] ⚠️  警告：设置的PID进程不存在，可能启动器已退出');
      }
    }, 2000);
  }

  /**
   * 检查当前进程是否正在运行
   */
  async isCurrentProcessRunning(): Promise<boolean> {
    // 统一用 getCurrentPid（内存 + localStorage 恢复）：
    // 若单独调用本方法（未先调 getCurrentPid/restoreFromStorage），旧行为只查内存
    // 会漏掉 localStorage 中已记录的 PID——隐式依赖调用方先恢复，属脆弱耦合。
    const pid = this.getCurrentPid();
    if (pid === null) {
      console.log('[War3进程] 无当前PID，返回false');
      return false;
    }

    console.log('[War3进程] 检查War3.exe进程状态: PID=', pid);
    const running = await isProcessRunning(pid);
    console.log('[War3进程] War3.exe运行状态: PID=', pid, '运行=', running);
    return running;
  }

  /**
   * 结束当前War3进程
   * @throws 当用户取消UAC或其他无法恢复的错误时抛出
   */
  async killCurrentProcess(): Promise<void> {
    if (!this.currentPid) {
      console.log('[War3进程] 无当前PID，尝试结束所有War3进程...');
      await this.killAllWar3Processes();
      return;
    }
    
    console.log('[War3进程] 准备结束War3.exe进程: PID=', this.currentPid);
    
    try {
      // 第一步：尝试普通权限结束
      await killProcess(this.currentPid);
      console.log('[War3进程] ✅ War3.exe进程已结束: PID=', this.currentPid);
      
      // 成功结束后清理记录
      const oldPid = this.currentPid;
      this.currentPid = null;
      localStorage.removeItem('war3_process_pid');
      console.log('[War3进程] 已清理进程记录: PID=', oldPid);
      
    } catch (error) {
      const errorMsg = String(error);
      console.error('[War3进程] ❌ 普通权限结束进程失败: PID=', this.currentPid, '错误=', error);
      
      // 检查是否是权限错误
      if (errorMsg.includes('Access is denied') || errorMsg.includes('拒绝访问')) {
        console.warn('[War3进程] ⚠️ 权限不足，尝试使用管理员权限（会弹出UAC）...');
        
        const pidToKill = this.currentPid!; // 非空断言，前面已检查过
        
        try {
          // 第二步：尝试管理员权限结束（会弹出UAC）
          await killProcessElevated(pidToKill);
          console.log('[War3进程] ✅ 已通过管理员权限结束进程: PID=', pidToKill);
          
          // 成功结束后清理记录
          this.currentPid = null;
          localStorage.removeItem('war3_process_pid');
          console.log('[War3进程] 已清理进程记录: PID=', pidToKill);
          
        } catch (elevatedError) {
          const elevatedMsg = String(elevatedError);
          console.error('[War3进程] ❌ 管理员权限结束进程失败:', elevatedError);
          
          // 用户取消了UAC
          if (elevatedMsg.includes('canceled') || elevatedMsg.includes('取消')) {
            this.currentPid = null;
            localStorage.removeItem('war3_process_pid');
            throw new Error('用户取消了权限提升，请手动关闭War3.exe后重试。');
          }
          
          // 管理员权限也失败，尝试最后的备用方案
          console.log('[War3进程] 尝试使用进程名结束所有War3进程...');
          try {
            await this.killAllWar3Processes();
            console.log('[War3进程] ✅ 已通过进程名结束War3进程');
            
            this.currentPid = null;
            localStorage.removeItem('war3_process_pid');
          } catch (fallbackError) {
            console.error('[War3进程] ❌ 所有方案均失败:', fallbackError);
            this.currentPid = null;
            localStorage.removeItem('war3_process_pid');
            throw new Error('无法结束War3进程，请手动关闭War3.exe后重试。');
          }
        }
      } else {
        // 其他错误：尝试备用方案
        console.log('[War3进程] 尝试使用进程名结束所有War3进程...');
        try {
          await this.killAllWar3Processes();
          console.log('[War3进程] ✅ 已通过进程名结束War3进程');
          
          this.currentPid = null;
          localStorage.removeItem('war3_process_pid');
        } catch (fallbackError) {
          console.error('[War3进程] ❌ 备用方案也失败:', fallbackError);
          this.currentPid = null;
          localStorage.removeItem('war3_process_pid');
          throw fallbackError;
        }
      }
    }
  }

  /**
   * 检查War3.exe是否正在运行 (通过进程名)
   */
  async isWar3Running(): Promise<boolean> {
    try {
      return await isWar3Running();
    } catch (error) {
      console.error('[War3进程] 检查War3运行状态失败:', error);
      return false;
    }
  }

  /**
   * 结束所有War3.exe进程
   */
  async killAllWar3Processes(): Promise<void> {
    try {
      await killWar3Processes();
      console.log('[War3进程] ✅ 已结束所有War3.exe进程');
      this.currentPid = null;
      localStorage.removeItem('war3_process_pid');
    } catch (error) {
      console.error('[War3进程] ❌ 结束所有War3进程失败:', error);
      throw error;
    }
  }

  /**
   * 从localStorage恢复进程监听（应用启动时调用）
   */
  async restoreFromStorage(): Promise<void> {
    const pidStr = localStorage.getItem('war3_process_pid');
    if (!pidStr) return;

    const pid = parseInt(pidStr);
    if (isNaN(pid)) {
      localStorage.removeItem('war3_process_pid');
      return;
    }

    // 检查进程是否还在运行
    const running = await isProcessRunning(pid);
    if (running) {
      this.currentPid = pid;
      console.log('[War3进程] 从存储恢复War3.exe进程记录: PID=', pid);
    } else {
      localStorage.removeItem('war3_process_pid');
      console.log('[War3进程] 存储的War3进程已不存在，清除记录');
    }
  }

  /**
   * 手动触发导出（用于测试）
   */
  async triggerExport(): Promise<void> {
    const configStr = localStorage.getItem('hotReloadConfig');
    if (!configStr) return;

    const config = JSON.parse(configStr);
    if (!config.enabled) return;

    const { project } = useProjectStore.getState();
    await getHotReloadExporter(config).export(project, true);
  }
}

// 全局单例
export const war3ProcessManager = new War3ProcessManager();
