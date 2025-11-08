import React, { useState, useRef, useEffect, lazy } from 'react';
import './PropertyEditors.css';

// 动态导入 WC3TextureBrowser（避免循环依赖和减小初始包体积）
const WC3TextureBrowser = lazy(() => 
  import('./WC3TextureBrowser').then(module => ({ 
    default: module.WC3TextureBrowser 
  }))
);

// ==================== 接口定义 ====================

interface BaseEditorProps {
  label: string;
  disabled?: boolean;
  tooltip?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

// ==================== 颜色选择器 (RGBA) ====================

interface ColorPickerProps extends BaseEditorProps {
  value?: number[]; // [R, G, B, A] 范围 0-1
  onChange: (value: number[]) => void;
  showAlpha?: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  label,
  value = [1, 1, 1, 1],
  onChange,
  showAlpha = true,
  disabled,
  tooltip,
}) => {
  // 转换为hex颜色
  const toHex = (rgba: number[]) => {
    const r = Math.round(rgba[0] * 255).toString(16).padStart(2, '0');
    const g = Math.round(rgba[1] * 255).toString(16).padStart(2, '0');
    const b = Math.round(rgba[2] * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  };

  // 从hex转换回rgba
  const fromHex = (hex: string, alpha: number): number[] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return [r, g, b, alpha];
  };

  const hexColor = toHex(value);
  const alpha = value[3] ?? 1;

  return (
    <div className="property-editor color-picker" title={tooltip}>
      <label>{label}</label>
      <div className="color-picker-controls">
        <div className="color-preview" style={{ backgroundColor: hexColor, opacity: alpha }}>
          <input
            type="color"
            value={hexColor}
            onChange={(e) => onChange(fromHex(e.target.value, alpha))}
            disabled={disabled}
          />
        </div>
        <div className="color-values">
          <span className="color-hex">{hexColor.toUpperCase()}</span>
          {showAlpha && (
            <div className="alpha-control">
              <label>α</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={alpha}
                onChange={(e) => {
                  const newAlpha = parseFloat(e.target.value);
                  onChange([value[0], value[1], value[2], newAlpha]);
                }}
                disabled={disabled}
              />
              <span className="alpha-value">{(alpha * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==================== 下拉选择器 (单选) ====================

interface SelectProps extends BaseEditorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  options: SelectOption[];
  placeholder?: string;
  allowClear?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder = '请选择',
  allowClear = true,
  disabled,
  tooltip,
}) => {
  return (
    <div className="property-editor select-editor" title={tooltip}>
      <label>{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
        disabled={disabled}
      >
        {allowClear && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
};

// ==================== 多选下拉框 ====================

interface MultiSelectProps extends BaseEditorProps {
  value?: string[];
  onChange: (value: string[] | undefined) => void;
  options: SelectOption[];
  placeholder?: string;
}

export const MultiSelect: React.FC<MultiSelectProps> = ({
  label,
  value = [],
  onChange,
  options,
  placeholder = '选择多个选项',
  disabled,
  tooltip,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const toggleOption = (optValue: string) => {
    const newValue = value.includes(optValue)
      ? value.filter((v) => v !== optValue)
      : [...value, optValue];
    onChange(newValue.length > 0 ? newValue : undefined);
  };

  const selectedLabels = value
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="property-editor multi-select-editor" ref={containerRef} title={tooltip}>
      <label>{label}</label>
      <div className="multi-select-container">
        <div
          className={`multi-select-display ${isOpen ? 'open' : ''}`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <span className="selected-text">
            {selectedLabels || placeholder}
          </span>
          <span className="dropdown-arrow">▼</span>
        </div>
        {isOpen && (
          <div className="multi-select-dropdown">
            {options.map((opt) => (
              <label key={opt.value} className="multi-select-option">
                <input
                  type="checkbox"
                  checked={value.includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                  disabled={disabled}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== 数值滑块 ====================

interface SliderProps extends BaseEditorProps {
  value?: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  showInput?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value = 0,
  onChange,
  min,
  max,
  step = 1,
  unit = '',
  showInput = true,
  disabled,
  tooltip,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="property-editor slider-editor" title={tooltip}>
      <label>{label}</label>
      <div className="slider-controls">
        <div className="slider-track-container">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            disabled={disabled}
            style={{
              background: `linear-gradient(to right, #4a9eff 0%, #4a9eff ${percentage}%, #333 ${percentage}%, #333 100%)`,
            }}
          />
        </div>
        {showInput && (
          <div className="slider-value-input">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val)) onChange(Math.min(Math.max(val, min), max));
              }}
              disabled={disabled}
            />
            {unit && <span className="unit">{unit}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== 开关 ====================

interface SwitchProps extends BaseEditorProps {
  value?: boolean;
  onChange: (value: boolean) => void;
}

export const Switch: React.FC<SwitchProps> = ({
  label,
  value = false,
  onChange,
  disabled,
  tooltip,
}) => {
  return (
    <div className="property-editor switch-editor" title={tooltip}>
      <label>{label}</label>
      <div
        className={`switch ${value ? 'on' : 'off'} ${disabled ? 'disabled' : ''}`}
        onClick={() => !disabled && onChange(!value)}
      >
        <div className="switch-slider"></div>
      </div>
      <span className="switch-label">{value ? '开' : '关'}</span>
    </div>
  );
};

// ==================== 文件路径选择器 ====================

interface FilePathProps extends BaseEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suggestions?: string[];
  showWC3Browser?: boolean; // 是否显示 WC3 资源浏览器按钮
}

export const FilePath: React.FC<FilePathProps> = ({
  label,
  value = '',
  onChange,
  placeholder = '输入文件路径',
  suggestions = [],
  showWC3Browser = true,
  disabled,
  tooltip,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showBrowser, setShowBrowser] = useState(false);

  useEffect(() => {
    if (value && suggestions.length > 0) {
      const valueStr = String(value).toLowerCase();
      const filtered = suggestions.filter((s) => {
        const sStr = String(s).toLowerCase();
        return sStr.includes(valueStr);
      });
      setFilteredSuggestions(filtered);
    } else {
      setFilteredSuggestions(suggestions);
    }
  }, [value, suggestions]);

  return (
    <div className="property-editor filepath-editor" title={tooltip}>
      <label>{label}</label>
      <div className="filepath-input-container">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {showWC3Browser && (
          <button
            className="wc3-browser-button"
            onClick={() => setShowBrowser(true)}
            disabled={disabled}
            title="浏览 WC3 资源"
          >
            📁
          </button>
        )}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="filepath-suggestions">
            {filteredSuggestions.slice(0, 10).map((suggestion, idx) => (
              <div
                key={idx}
                className="filepath-suggestion-item"
                onClick={() => {
                  onChange(suggestion);
                  setShowSuggestions(false);
                }}
              >
                {suggestion}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {showBrowser && (
        <React.Suspense fallback={<div>加载中...</div>}>
          <WC3TextureBrowser
            onSelect={(path: string) => {
              onChange(path);
              setShowBrowser(false);
            }}
            onClose={() => setShowBrowser(false)}
            currentPath={value}
          />
        </React.Suspense>
      )}
    </div>
  );
};

// ==================== 向量编辑器 (2D/3D/4D) ====================

interface VectorEditorProps extends BaseEditorProps {
  value?: number[];
  onChange: (value: number[]) => void;
  dimensions: 2 | 3 | 4;
  labels?: string[];
  step?: number;
  min?: number;
  max?: number;
}

export const VectorEditor: React.FC<VectorEditorProps> = ({
  label,
  value = [],
  onChange,
  dimensions,
  labels = ['X', 'Y', 'Z', 'W'],
  step = 0.001,
  min,
  max,
  disabled,
  tooltip,
}) => {
  const handleChange = (index: number, newValue: string) => {
    const val = newValue ? parseFloat(newValue) : 0;
    if (!isNaN(val)) {
      const newVector = [...value];
      newVector[index] = val;
      onChange(newVector);
    }
  };

  // 格式化显示值：根据 step 确定小数位数
  const formatValue = (val: number): string => {
    if (step >= 1) return val.toFixed(0);
    if (step >= 0.1) return val.toFixed(1);
    if (step >= 0.01) return val.toFixed(2);
    return val.toFixed(3);
  };

  return (
    <div className="property-editor vector-editor" title={tooltip}>
      <label>{label}</label>
      <div className="vector-inputs">
        {Array.from({ length: dimensions }).map((_, idx) => (
          <div key={idx} className="vector-input-group">
            <span className="vector-label">{labels[idx]}</span>
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              value={formatValue(value[idx] ?? 0)}
              onChange={(e) => handleChange(idx, e.target.value)}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

// ==================== 文本区域 ====================

interface TextAreaProps extends BaseEditorProps {
  value?: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  value = '',
  onChange,
  rows = 3,
  placeholder,
  disabled,
  tooltip,
}) => {
  return (
    <div className="property-editor textarea-editor" title={tooltip}>
      <label>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  );
};
