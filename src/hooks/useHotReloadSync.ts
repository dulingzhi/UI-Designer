// useHotReloadSync.ts
// 负责订阅 Zustand Store 下的 Frame 变更，并使用 requestAnimationFrame 节流，
// 将最新状态打包成 JSON 发给 Rust TCP Server

import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useProjectStore } from '../store/projectStore';
import { ProjectData } from '../types';
import { buildHotReloadLua } from '../utils/hotReloadLua';

export type HotReloadStatus = 'idle' | 'connected' | 'error';

export function useHotReloadSync() {
  const [status, setStatus] = useState<HotReloadStatus>('idle');
  const project = useProjectStore(state => state.project);
  
  const pendingUpdateRef = useRef<ProjectData | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastSyncTimeRef = useRef<number>(0);
  const isServerRunning = useRef(false);

  // 1. 监测服务端状态灯
  useEffect(() => {
    const unlisten = listen<string>('hot-reload-status', (event) => {
      setStatus(event.payload as HotReloadStatus);
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // 2. 启动/关闭服务器 (通常由 UI 上的按钮调用，但这里提供封装)
  const startServer = async () => {
    if (isServerRunning.current) return;
    try {
      const port = await invoke<number>('start_hot_reload_server');
      console.log('TCP Server started on port:', port);
      isServerRunning.current = true;
    } catch (e) {
      console.error('Failed to start TCP server:', e);
      setStatus('error');
    }
  };

  // 3. 节流发送数据
  const sendUpdate = async () => {
    if (!pendingUpdateRef.current || status !== 'connected') {
      rafIdRef.current = null;
      return;
    }

    const data = pendingUpdateRef.current;
    pendingUpdateRef.current = null;

    // 逐帧生成同步 Lua（纯逻辑已抽到 hotReloadLua.ts，可单测）
    const luaCode = buildHotReloadLua(data.frames);

    try {
      await invoke('send_hot_reload_update', {
        data: luaCode
      });
      lastSyncTimeRef.current = performance.now();
    } catch (e) {
      // 哪怕发送失败也先不报警，可能断开了
    }

    rafIdRef.current = null;
  };

  // 4. 侦测 projectStore 变化
  useEffect(() => {
    if (status !== 'connected') return;

    // 只在项目数据真实变动时记下 pendingUpdate
    pendingUpdateRef.current = project;

    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        // 其实可以进一步节流（例如最高 60fps 也稍微长一点点，防止序列化开销）
        const now = performance.now();
        if (now - lastSyncTimeRef.current >= 16) {
          sendUpdate();
        } else {
          // 如果发得太快，推迟到下个循环
          rafIdRef.current = requestAnimationFrame(sendUpdate);
        }
      });
    }
  
  return () => {

    // round 165：卸载清理 pending rAF（否则卸载后仍触发 sendUpdate）

    if (rafIdRef.current) {

      cancelAnimationFrame(rafIdRef.current);

      rafIdRef.current = null;

    }

  };
}, [project, status]);

  return { status, startServer };
}
