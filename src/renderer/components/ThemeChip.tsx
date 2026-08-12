import React from 'react'
import type { AppTheme } from '@themes/presets'

interface ThemeChipProps {
  theme: AppTheme
  isActive: boolean
  isFocused: boolean
  onSelect: () => void
  onHover: () => void
}

/** Card de tema: círculos de paleta + nombre; el color se lee sin depender del texto. */
export const ThemeChip: React.FC<ThemeChipProps> = ({
  theme,
  isActive,
  isFocused,
  onSelect,
  onHover,
}) => {
  const bg = theme.vars['--bg'] ?? theme.xterm.background
  const surface = theme.vars['--surface'] ?? theme.xterm.black
  const accent = theme.vars['--accent'] ?? theme.xterm.cursor
  const muted = theme.vars['--text-muted'] ?? theme.vars['--border'] ?? theme.xterm.brightBlack

  return (
    <button
      type="button"
      className={[
        'theme-picker-chip',
        isActive ? 'theme-picker-chip--active' : '',
        isFocused ? 'theme-picker-chip--focus' : '',
      ].filter(Boolean).join(' ')}
      style={{
        '--swatch-bg': bg,
        '--swatch-surface': surface,
        '--swatch-accent': accent,
        '--swatch-muted': muted,
      } as React.CSSProperties}
      role="option"
      aria-selected={isActive}
      aria-label={theme.name}
      onClick={onSelect}
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      <span className="theme-picker-chip-palette" aria-hidden="true">
        <span className="theme-picker-chip-orb theme-picker-chip-orb--bg" />
        <span className="theme-picker-chip-orb theme-picker-chip-orb--surface" />
        <span className="theme-picker-chip-orb theme-picker-chip-orb--accent" />
        <span className="theme-picker-chip-orb theme-picker-chip-orb--muted" />
      </span>
      <span className="theme-picker-chip-name">{theme.name}</span>
      {isActive && (
        <span className="theme-picker-chip-check" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2.5 6.2L4.8 8.5L9.5 3.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  )
}
