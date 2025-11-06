import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
}

// 文件操作图标
export const NewFileIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M9.5 1H3.5C3.22386 1 3 1.22386 3 1.5V14.5C3 14.7761 3.22386 15 3.5 15H12.5C12.7761 15 13 14.7761 13 14.5V5L9.5 1Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9 1V5H13" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const OpenFileIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M1 3.5C1 3.22386 1.22386 3 1.5 3H5L6.5 5H14.5C14.7761 5 15 5.22386 15 5.5V12.5C15 12.7761 14.7761 13 14.5 13H1.5C1.22386 13 1 12.7761 1 12.5V3.5Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const SaveIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M12 15H2V5H10L12 7V15Z" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 1V5H10V1" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 9H10" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 编辑操作图标
export const UndoIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M3 7H11C12.6569 7 14 8.34315 14 10C14 11.6569 12.6569 13 11 13H6" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 5L3 7L5 9" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const RedoIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M13 7H5C3.34315 7 2 8.34315 2 10C2 11.6569 3.34315 13 5 13H10" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M11 5L13 7L11 9" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 对齐图标
export const AlignLeftIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="8" height="3" stroke={color}/>
    <rect x="2" y="10" width="12" height="3" stroke={color}/>
    <line x1="1.5" y1="1" x2="1.5" y2="15" stroke={color}/>
  </svg>
);

export const AlignCenterHIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="4" y="3" width="8" height="3" stroke={color}/>
    <rect x="2" y="10" width="12" height="3" stroke={color}/>
    <line x1="8" y1="1" x2="8" y2="15" stroke={color}/>
  </svg>
);

export const AlignRightIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="6" y="3" width="8" height="3" stroke={color}/>
    <rect x="2" y="10" width="12" height="3" stroke={color}/>
    <line x1="14.5" y1="1" x2="14.5" y2="15" stroke={color}/>
  </svg>
);

export const AlignTopIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="2" width="3" height="8" stroke={color}/>
    <rect x="10" y="2" width="3" height="12" stroke={color}/>
    <line x1="1" y1="1.5" x2="15" y2="1.5" stroke={color}/>
  </svg>
);

export const AlignCenterVIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="4" width="3" height="8" stroke={color}/>
    <rect x="10" y="2" width="3" height="12" stroke={color}/>
    <line x1="1" y1="8" x2="15" y2="8" stroke={color}/>
  </svg>
);

export const AlignBottomIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="6" width="3" height="8" stroke={color}/>
    <rect x="10" y="2" width="3" height="12" stroke={color}/>
    <line x1="1" y1="14.5" x2="15" y2="14.5" stroke={color}/>
  </svg>
);

// 分布图标
export const DistributeHIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="5" width="3" height="6" stroke={color}/>
    <rect x="6.5" y="5" width="3" height="6" stroke={color}/>
    <rect x="11" y="5" width="3" height="6" stroke={color}/>
  </svg>
);

export const DistributeVIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="5" y="2" width="6" height="3" stroke={color}/>
    <rect x="5" y="6.5" width="6" height="3" stroke={color}/>
    <rect x="5" y="11" width="6" height="3" stroke={color}/>
  </svg>
);

// 大小图标
export const SameWidthIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="3" width="10" height="4" stroke={color}/>
    <rect x="3" y="9" width="10" height="4" stroke={color}/>
    <path d="M3 1L3 15M13 1L13 15" stroke={color} strokeDasharray="2 2"/>
  </svg>
);

export const SameHeightIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="3" width="4" height="10" stroke={color}/>
    <rect x="9" y="3" width="4" height="10" stroke={color}/>
    <path d="M1 3L15 3M1 13L15 13" stroke={color} strokeDasharray="2 2"/>
  </svg>
);

export const SameSizeIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="6" height="6" stroke={color}/>
    <rect x="8" y="8" width="6" height="6" stroke={color}/>
  </svg>
);

// 层级图标
export const BringToFrontIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="6" y="2" width="8" height="8" fill={color} fillOpacity="0.3" stroke={color}/>
    <rect x="2" y="6" width="8" height="8" fill="white" stroke={color}/>
  </svg>
);

export const BringForwardIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="5" y="3" width="8" height="8" fill={color} fillOpacity="0.2" stroke={color}/>
    <rect x="3" y="5" width="8" height="8" fill="white" stroke={color}/>
  </svg>
);

export const SendBackwardIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="3" y="3" width="8" height="8" fill="white" stroke={color}/>
    <rect x="5" y="5" width="8" height="8" fill={color} fillOpacity="0.2" stroke={color}/>
  </svg>
);

export const SendToBackIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="8" height="8" fill="white" stroke={color}/>
    <rect x="6" y="6" width="8" height="8" fill={color} fillOpacity="0.3" stroke={color}/>
  </svg>
);

// 导出图标
export const ExportIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <path d="M8 2V10M8 2L5 5M8 2L11 5" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M2 10V13C2 13.5523 2.44772 14 3 14H13C13.5523 14 14 13.5523 14 13V10" stroke={color} strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// 帮助图标
export const HelpIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <circle cx="8" cy="8" r="6" stroke={color}/>
    <path d="M6 6C6 4.89543 6.89543 4 8 4C9.10457 4 10 4.89543 10 6C10 7.10457 9.10457 8 8 8V9" stroke={color} strokeLinecap="round"/>
    <circle cx="8" cy="11.5" r="0.5" fill={color}/>
  </svg>
);

// WC3 资源浏览器图标
export const TextureBrowserIcon: React.FC<IconProps> = ({ size = 16, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="3" width="12" height="10" rx="1" stroke={color}/>
    <path d="M2 6H14" stroke={color}/>
    <rect x="4" y="8" width="3" height="3" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="0.5"/>
    <rect x="8.5" y="8" width="3" height="3" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="0.5"/>
    <circle cx="5.5" cy="9.5" r="0.8" fill={color}/>
    <circle cx="10" cy="9.5" r="0.8" fill={color}/>
  </svg>
);
