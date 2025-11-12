// 热重载面板组件 - 控制 War3 1.27 热重载功能

import React, { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { detectKKWE, launchMapWithKKWE, type KKWEInfo } from '../utils/kkweDetector';
import { getHotReloadExporter, DEFAULT_HOT_RELOAD_CONFIG, type HotReloadConfig } from '../utils/hotReloadExporter';
import './HotReloadPanel.css';

interface HotReloadPanelProps {
  onClose?: () => void;
}

export const HotReloadPanel: React.FC<HotReloadPanelProps> = ({ onClose }) => {
  const [kkweInfo, setKkweInfo] = useState<KKWEInfo>({ installed: false });
  const [config, setConfig] = useState<HotReloadConfig>(DEFAULT_HOT_RELOAD_CONFIG);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null);
  
  // 拖拽状态
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);
  
  // 初始化：检测 KKWE 并设置默认路径
  useEffect(() => {
    // 获取并保存用户名
    const initUsername = async () => {
      try {
        const username = await invoke<string>('get_username');
        localStorage.setItem('system_username', username);
      } catch (error) {
        console.warn('无法获取系统用户名:', error);
      }
    };
    
    initUsername();
    checkKKWE();
    
    // 从本地存储加载配置
    const savedConfig = localStorage.getItem('hotReloadConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        getHotReloadExporter(parsed);
      } catch (e) {
        console.error('加载热重载配置失败:', e);
      }
    } else {
      // 使用默认配置（已经根据War3路径动态生成）
      setConfig(DEFAULT_HOT_RELOAD_CONFIG);
    }
  }, []);
  
  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    // 排除按钮、输入框等交互元素
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'BUTTON' || 
      target.tagName === 'INPUT' ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('.panel-header-actions')
    ) {
      return;
    }
    
    if (target.closest('.panel-header')) {
      setIsDragging(true);
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);
  
  // 检测 KKWE
  const checkKKWE = async () => {
    setIsChecking(true);
    try {
      const info = await detectKKWE();
      setKkweInfo(info);
      if (info.installed) {
        showMessage('success', 'KKWE 已安装');
      } else {
        showMessage('error', 'KKWE 未安装，请下载安装');
      }
    } catch (error) {
      console.error('检测 KKWE 失败:', error);
      showMessage('error', `检测失败: ${error}`);
    } finally {
      setIsChecking(false);
    }
  };
  
  // 显示消息
  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };
  
  // 更新配置
  const updateConfig = (updates: Partial<HotReloadConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    getHotReloadExporter(newConfig);
    
    // 保存到本地存储
    localStorage.setItem('hotReloadConfig', JSON.stringify(newConfig));
  };
  
  // 初始化并启动测试
  const handleInitAndLaunch = async () => {
    if (!kkweInfo.installed) {
      showMessage('error', 'KKWE 未安装');
      return;
    }

    if (!kkweInfo.war3Path) {
      showMessage('error', '未检测到 War3 路径');
      return;
    }

    try {
      // 检查地图是否存在
      const fs = await import('@tauri-apps/plugin-fs');
      const mapExists = await fs.exists(config.testMapPath);
      
      // 如果地图不存在，先初始化
      if (!mapExists) {
        showMessage('info', '正在初始化模板地图...');
        const targetPath = await invoke<string>('extract_template_map', {
          war3Path: kkweInfo.war3Path,
          mapName: 'test.1.27.w3x'
        });
        
        // 更新测试地图路径
        updateConfig({ testMapPath: targetPath });
        showMessage('success', '模板地图初始化成功！');
        
        // 等待一下让用户看到消息
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 启动游戏
      showMessage('info', '正在启动 War3...');
      await launchMapWithKKWE(config.testMapPath, kkweInfo);
      showMessage('success', 'War3 启动成功！');
    } catch (error) {
      console.error('初始化或启动失败:', error);
      showMessage('error', `操作失败: ${error}`);
    }
  };
  
  
  return (
    <div 
      ref={panelRef}
      className="hot-reload-panel"
      style={{
        left: position.x ? `${position.x}px` : '50%',
        top: position.y ? `${position.y}px` : '50%',
        transform: position.x ? 'none' : 'translate(-50%, -50%)'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="panel-header" style={{ cursor: isDragging ? 'grabbing' : 'grab' }}>
        <h3>🔥 热重载配置 (War3 1.27)</h3>
        <div className="panel-header-actions">
          <button 
            className="btn-refresh" 
            onClick={(e) => {
              e.stopPropagation();
              checkKKWE();
            }}
            disabled={isChecking}
          >
            {isChecking ? '检测中...' : '🔄 重新检测'}
          </button>
          {onClose && (
            <button 
              className="btn-close" 
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              title="关闭面板"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      
      <div className="panel-content">
      {/* 消息提示 */}
      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}
      
      {/* KKWE 状态 */}
      <div className="kkwe-status">
        <div className="status-item">
          <strong>KKWE 状态:</strong>
          <span className={kkweInfo.installed ? 'status-ok' : 'status-error'}>
            {kkweInfo.installed ? '✅ 已安装' : '❌ 未安装'}
          </span>
        </div>
        
        {!kkweInfo.installed && (
          <div className="download-hint">
            <a href="http://www.kkwai.com/" target="_blank" rel="noopener noreferrer">
              📥 下载 KKWE (凯凯我编)
            </a>
          </div>
        )}
        
        {kkweInfo.installed && (
          <div className="kkwe-paths">
            <div className="path-item">
              <small>📁 KKWE: {kkweInfo.kkwePath}</small>
            </div>
            <div className="path-item">
              <small>🚀 启动器: {kkweInfo.launcherPath}</small>
            </div>
            {kkweInfo.war3Path && (
              <div className="path-item">
                <small>🎮 War3: {kkweInfo.war3Path}</small>
              </div>
            )}
          </div>
        )}
      </div>
      
      <hr />
      
      {/* 热重载开关 */}
      <div className="config-section">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
          />
          <span>启用热重载 (自动导出 Lua)</span>
        </label>
      </div>
      
      {/* 防抖延迟 */}
      <div className="config-section">
        <label>
          <strong>防抖延迟 (ms):</strong>
          <input
            type="number"
            value={config.debounceMs}
            onChange={(e) => updateConfig({ debounceMs: parseInt(e.target.value) || 500 })}
            min="0"
            max="5000"
            step="100"
          />
        </label>
      </div>
      
      <hr />
      
      {/* 使用说明 */}
      <div className="usage-hint">
        <h4>💡 使用说明:</h4>
        <ol>
          <li>确保已安装 KKWE (凯凯我编)</li>
          <li>系统自动配置路径：
            {kkweInfo.war3Path ? (
              // War3 1.27 版本
              <ul style={{ marginTop: '4px', marginLeft: '20px', fontSize: '0.9em' }}>
                <li><strong>War3 1.27</strong>
                  <br/>UI内容: <code>{config.outputPath}</code>
                  <br/>地图: <code>{config.testMapPath}</code>
                </li>
              </ul>
            ) : (
              // Reforged 版本
              <ul style={{ marginTop: '4px', marginLeft: '20px', fontSize: '0.9em' }}>
                <li><strong>War3 Reforged</strong>
                  <br/>UI内容: <code>{config.outputPath}</code>
                  <br/>地图: <code>{config.testMapPath}</code>
                </li>
              </ul>
            )}
          </li>
          <li>点击下方 "🚀 初始化并启动测试" 按钮，首次使用会自动释放内置模板地图</li>
          <li>启用热重载后，编辑器会自动导出 Lua 文件</li>
          <li>游戏内输入 <code>-reload</code> 或 <code>-rl</code> 刷新 UI</li>
        </ol>
      </div>
      
      {/* 初始化并启动测试 */}
      <div className="test-launch">
        <button
          className="btn-launch"
          onClick={(e) => {
            e.stopPropagation();
            handleInitAndLaunch();
          }}
          disabled={!kkweInfo.installed || !kkweInfo.war3Path}
        >
          🚀 初始化并启动测试
        </button>
        <small style={{ display: 'block', marginTop: '8px', color: '#888', textAlign: 'center' }}>
          自动检测并初始化模板地图，然后启动 War3
        </small>
      </div>
      </div>
    </div>
  );
};
