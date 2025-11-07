import React from 'react';
import { useProjectStore } from '../store/projectStore';
import './RaceSwitcher.css';

type Race = 'Human' | 'Orc' | 'NightElf' | 'Undead' | 'Default';

const RACE_OPTIONS: { value: Race; label: string; icon: string; color: string }[] = [
  { value: 'Human', label: '人族', icon: '👑', color: '#4a9eff' },
  { value: 'Orc', label: '兽族', icon: '⚔️', color: '#ff4a4a' },
  { value: 'NightElf', label: '暗夜精灵', icon: '🌙', color: '#b44aff' },
  { value: 'Undead', label: '不死族', icon: '💀', color: '#4aff4a' },
  { value: 'Default', label: '默认', icon: '🎨', color: '#888' },
];

export const RaceSwitcher: React.FC = () => {
  const currentRace = useProjectStore((state) => state.project.currentRace || 'Human');
  const setRace = useProjectStore((state) => state.setRace);
  const war3Skins = useProjectStore((state) => state.project.war3Skins);
  const [showDropdown, setShowDropdown] = React.useState(false);

  // 调试信息
  React.useEffect(() => {
    console.log('[RaceSwitcher] 组件渲染，war3Skins 状态:', war3Skins ? '已加载' : '未加载');
    if (war3Skins) {
      console.log('[RaceSwitcher] 当前种族:', currentRace);
    }
  }, [war3Skins, currentRace]);

  // 只有加载了 war3skins.txt 时才显示切换器
  if (!war3Skins) {
    return null;
  }

  const currentOption = RACE_OPTIONS.find(opt => opt.value === currentRace) || RACE_OPTIONS[0];

  return (
    <div className="race-switcher-toolbar">
      <button
        className="toolbar-btn-icon race-switcher-button"
        onClick={() => setShowDropdown(!showDropdown)}
        title={`当前种族: ${currentOption.label}`}
        style={{ borderColor: showDropdown ? currentOption.color : undefined }}
      >
        <span className="race-icon">{currentOption.icon}</span>
      </button>
      
      {showDropdown && (
        <>
          <div className="race-dropdown-overlay" onClick={() => setShowDropdown(false)} />
          <div className="race-dropdown">
            {RACE_OPTIONS.map((option) => (
              <button
                key={option.value}
                className={`race-option ${option.value === currentRace ? 'active' : ''}`}
                onClick={() => {
                  setRace(option.value);
                  setShowDropdown(false);
                }}
                style={{ borderLeftColor: option.color }}
              >
                <span className="race-option-icon">{option.icon}</span>
                <span className="race-option-label">{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
