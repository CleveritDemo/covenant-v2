import React from 'react'
import { getThemeChromeProfile, type AppTheme } from '@themes/presets'

interface ThemePreviewProps {
  theme: AppTheme
  currentThemeId: string
}

export const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, currentThemeId }) => {
  const v = theme.vars
  const xt = theme.xterm
  const bg = v['--bg'] ?? xt.background
  const fg = v['--text'] ?? xt.foreground
  const muted = v['--text-muted'] ?? xt.brightBlack
  const border = v['--border'] ?? xt.black
  const accent = v['--accent'] ?? xt.cursor
  const surface = v['--surface'] ?? xt.black
  const tabActive = v['--tab-active-bg'] ?? bg
  const tabInactive = v['--tab-inactive-bg'] ?? surface
  const active = theme.id === currentThemeId
  const chrome = getThemeChromeProfile(theme)

  const tpVars = {
    '--tp-bg': bg,
    '--tp-border': border,
    '--tp-accent': accent,
    '--tp-surface': surface,
    '--tp-muted': muted,
    '--tp-fg': fg,
    '--tp-tab-active': tabActive,
    '--tp-tab-inactive': tabInactive,
    '--tp-xterm-bg': xt.background,
    '--tp-xterm-fg': xt.foreground,
    '--tp-xterm-cyan': xt.cyan,
    '--tp-xterm-green': xt.green,
    '--tp-xterm-blue': xt.blue,
    '--tp-xterm-bright-black': xt.brightBlack,
  } as React.CSSProperties

  return (
    <div
      className="theme-picker-preview theme-picker-preview--terminal-app"
      data-tab-shape={chrome.tabShape}
      style={tpVars}
    >
      <div className="theme-picker-tp-shell" aria-hidden="true">
        <div className="theme-picker-tp-titlebar" />
        <div className="theme-picker-tp-tabbar">
          <div className="theme-picker-tp-tabs">
            <div className="theme-picker-tp-tab theme-picker-tp-tab--active">Shell 1</div>
            <div className="theme-picker-tp-tab">Shell 2</div>
          </div>
          <div className="theme-picker-tp-tab-add">+</div>
        </div>
        <div className="theme-picker-tp-term">
          <div className="theme-picker-tp-line">
            <span className="theme-picker-tp-user">user</span>
            <span className="theme-picker-tp-muted">@</span>
            <span className="theme-picker-tp-host">host</span>
            <span className="theme-picker-tp-muted">:</span>
            <span className="theme-picker-tp-path">~/proyecto</span>
            <span className="theme-picker-tp-prompt">$ </span>
            <span className="theme-picker-tp-cmd">ls -la</span>
          </div>
          <div className="theme-picker-tp-line theme-picker-tp-line--dim">total 24</div>
          <div className="theme-picker-tp-line">
            <span className="theme-picker-tp-dir">drwxr-xr-x</span>
            <span className="theme-picker-tp-line--dim">  5 user  staff  160 Jan  2 10:00 .</span>
          </div>
          <div className="theme-picker-tp-line">
            <span className="theme-picker-tp-user">user</span>
            <span className="theme-picker-tp-muted">@</span>
            <span className="theme-picker-tp-host">host</span>
            <span className="theme-picker-tp-muted">:</span>
            <span className="theme-picker-tp-path">~/proyecto</span>
            <span className="theme-picker-tp-prompt">$ </span>
            <span className="theme-picker-tp-cursor">▌</span>
          </div>
        </div>
      </div>
      <div className="theme-picker-preview-meta">
        <span className="theme-picker-preview-name">{theme.name}</span>
        {active && <span className="theme-picker-preview-active">*</span>}
      </div>
    </div>
  )
}
