import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { ConfirmDialog } from './ConfirmDialog';

interface UpdateCheckerProps {
  onUpdateAvailable?: (version: string) => void;
  checkOnMount?: boolean;
}

export function UpdateChecker({ onUpdateAvailable, checkOnMount = false }: UpdateCheckerProps) {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; body: string } | null>(null);
  const [showNoUpdateDialog, setShowNoUpdateDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showRelaunchDialog, setShowRelaunchDialog] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any>(null);

  const checkForUpdates = async (showNoUpdateMessage = false) => {
    if (checking || downloading) return;
    
    setChecking(true);
    try {
      const update = await check();
      
      if (update?.available) {
        const version = update.version;
        onUpdateAvailable?.(version);
        
        // 显示更新对话框
        setUpdateInfo({ version, body: update.body || '无更新说明' });
        setPendingUpdate(update);
        setShowUpdateDialog(true);
      } else if (showNoUpdateMessage) {
        setShowNoUpdateDialog(true);
      }
    } catch (error) {
      console.error('检查更新失败:', error);
      if (showNoUpdateMessage) {
        setErrorMessage(String(error));
        setShowErrorDialog(true);
      }
    } finally {
      setChecking(false);
    }
  };

  const handleConfirmUpdate = async () => {
    setShowUpdateDialog(false);
    if (!pendingUpdate) return;

    setDownloading(true);
    
    try {
      // 下载并安装更新
      await pendingUpdate.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            setDownloadProgress(0);
            console.log('开始下载更新...');
            break;
          case 'Progress':
            const progress = Math.round((event.data.downloaded / event.data.contentLength) * 100);
            setDownloadProgress(progress);
            console.log(`下载进度: ${progress}%`);
            break;
          case 'Finished':
            setDownloadProgress(100);
            console.log('下载完成');
            break;
        }
      });

      // 安装完成，提示重启
      setShowRelaunchDialog(true);
    } catch (error) {
      console.error('更新失败:', error);
      setErrorMessage(`更新失败: ${error}`);
      setShowErrorDialog(true);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  };

  const handleCancelUpdate = () => {
    setShowUpdateDialog(false);
    setPendingUpdate(null);
  };

  const handleRelaunch = async () => {
    setShowRelaunchDialog(false);
    await relaunch();
  };

  const handleSkipRelaunch = () => {
    setShowRelaunchDialog(false);
    setPendingUpdate(null);
  };

  useEffect(() => {
    if (checkOnMount) {
      // 延迟 3 秒后自动检查更新
      const timer = setTimeout(() => {
        checkForUpdates(false);
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [checkOnMount]);

  // 暴露 checkForUpdates 方法给父组件
  useEffect(() => {
    (window as any).checkForUpdates = () => checkForUpdates(true);
  }, []);

  return (
    <>
      {/* 更新发现对话框 */}
      {showUpdateDialog && updateInfo && (
        <ConfirmDialog
          title="发现新版本"
          message={`发现新版本 ${updateInfo.version}，是否立即更新？\n\n更新内容：\n${updateInfo.body}`}
          confirmText="立即更新"
          cancelText="稍后提醒"
          onConfirm={handleConfirmUpdate}
          onCancel={handleCancelUpdate}
          type="info"
        />
      )}

      {/* 无更新对话框 */}
      {showNoUpdateDialog && (
        <ConfirmDialog
          title="检查更新"
          message="当前已是最新版本"
          confirmText="确定"
          onConfirm={() => setShowNoUpdateDialog(false)}
          type="info"
        />
      )}

      {/* 错误对话框 */}
      {showErrorDialog && (
        <ConfirmDialog
          title="错误"
          message={errorMessage}
          confirmText="确定"
          onConfirm={() => setShowErrorDialog(false)}
          type="danger"
        />
      )}

      {/* 重启对话框 */}
      {showRelaunchDialog && (
        <ConfirmDialog
          title="更新完成"
          message="更新已下载完成，是否立即重启应用？"
          confirmText="立即重启"
          cancelText="稍后重启"
          onConfirm={handleRelaunch}
          onCancel={handleSkipRelaunch}
          type="info"
        />
      )}

      {/* 下载进度 */}
      {downloading && (
        <div className="update-progress-overlay">
          <div className="update-progress-dialog">
            <h3>正在下载更新</h3>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p>{downloadProgress}%</p>
          </div>
          <style>{`
            .update-progress-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.7);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 10000;
            }
            
            .update-progress-dialog {
              background: #2d2d30;
              border: 1px solid #3e3e42;
              border-radius: 8px;
              padding: 24px;
              min-width: 400px;
              color: #cccccc;
            }
            
            .update-progress-dialog h3 {
              margin: 0 0 16px 0;
              color: #ffffff;
              font-size: 16px;
              font-weight: 500;
            }
            
            .progress-bar {
              width: 100%;
              height: 8px;
              background: #3e3e42;
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 12px;
            }
            
            .progress-fill {
              height: 100%;
              background: #007acc;
              transition: width 0.3s ease;
            }
            
            .update-progress-dialog p {
              margin: 0;
              text-align: center;
              font-size: 14px;
            }
          `}</style>
        </div>
      )}
    </>
  );
}

export default UpdateChecker;
