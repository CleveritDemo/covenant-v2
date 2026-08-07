import React from 'react'
import type { AppTheme } from '@themes/presets'

interface ThemeChipProps {
  theme: AppTheme
  isActive: boolean
  isFocused: boolean
  onSelect: () => void
  onHover: () => void
}

export const ThemeChip: React.FC<ThemeChipProps> = ({
  theme,
  isActive,
  isFocused,
  onSelect,
  onHover,
}) => {
  const bg = theme.vars['--bg'] ?? theme.xterm.background
  const accent = theme.vars['--accent'] ?? theme.xterm.cursor

  return (
    <button
      type="button"
      className={[
        'theme-picker-chip',
        isActive ? 'theme-picker-chip--active' : '',
        isFocused ? 'theme-picker-chip--focus' : '',
      ].filter(Boolean).join(' ')}
      style={{ '--swatch-bg': bg, '--swatch-accent': accent } as React.CSSProperties}
      role="option"
      aria-selected={isActive}
      aria-label={theme.name}
      onClick={onSelect}
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      <span className="theme-picker-chip-palette" aria-hidden="true">
        <span className="theme-picker-chip-swatch-bg" />
        <span className="theme-picker-chip-swatch-accent" />
      </span>
      <span className="theme-picker-chip-name">{theme.name}</span>
    </button>
  )
}
