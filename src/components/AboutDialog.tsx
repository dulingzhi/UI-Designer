import React from 'react';
import './AboutDialog.css';
import packageJson from '../../package.json';

interface AboutDialogProps {
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const version = packageJson.version;
  const buildDate = new Date().toLocaleDateString('zh-CN');

  return (
    <div className="about-dialog-overlay" onClick={onClose}>
      <div className="about-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="about-header">
          <div className="about-icon">
            <svg viewBox="0 0 64 64" fill="none">
              <rect width="64" height="64" rx="8" fill="url(#gradient)" />
              <path
                d="M20 16L32 28L44 16M44 48L32 36L20 48M16 32H48"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="64" y2="64">
                  <stop offset="0%" stopColor="#007acc" />
                  <stop offset="100%" stopColor="#0098ff" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h2>Warcraft III UI Designer</h2>
          <div className="about-version">版本 {version}</div>
        </div>

        <div className="about-content">
          <div className="about-section">
            <h3>关于本软件</h3>
            <p>
              Warcraft III UI Designer 是一款专业的魔兽争霸3界面设计工具，
              为地图制作者提供可视化的UI编辑体验。
            </p>
          </div>

          <div className="about-section">
            <h3>功能特性</h3>
            <ul>
              <li>可视化拖拽编辑</li>
              <li>实时预览效果</li>
              <li>丰富的UI模板</li>
              <li>锚点系统支持</li>
              <li>多层级组件管理</li>
              <li>FDF格式导入导出</li>
            </ul>
          </div>

          <div className="about-section">
            <h3>技术栈</h3>
            <div className="tech-stack">
              <span className="tech-badge">React</span>
              <span className="tech-badge">TypeScript</span>
              <span className="tech-badge">Tauri</span>
              <span className="tech-badge">Vite</span>
            </div>
          </div>

          <div className="about-section">
            <h3>项目信息</h3>
            <table className="info-table">
              <tbody>
                <tr>
                  <td>版本号：</td>
                  <td>{version}</td>
                </tr>
                <tr>
                  <td>构建日期：</td>
                  <td>{buildDate}</td>
                </tr>
                <tr>
                  <td>开源协议：</td>
                  <td>MIT License</td>
                </tr>
                <tr>
                  <td>项目地址：</td>
                  <td>
                    <a
                      href="https://github.com/warcraft-iii/UI-Designer"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="about-section">
            <h3>开发者</h3>
            <p>
              由魔兽争霸3社区开发者倾情打造<br />
              感谢所有贡献者的支持！
            </p>
          </div>

          <div className="about-footer">
            <p className="copyright">
              © 2024 Warcraft III UI Designer. All rights reserved.
            </p>
          </div>
        </div>

        <div className="about-actions">
          <button className="btn-primary" onClick={onClose}>
            确定
          </button>
        </div>

        <button className="about-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>
    </div>
  );
};
