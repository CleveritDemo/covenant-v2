import React, { useEffect, useState } from 'react'
import { getThemeChromeProfile, type AppTheme } from '@themes/presets'
import { useT } from '@i18n/useT'

interface ThemePreviewProps {
  theme: AppTheme
  currentThemeId: string
}

/** Mini Covenant abstracto: titlebar, tabs, workspace y dock IA con el mood del tema. */
export const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, currentThemeId }) => {
  const { t } = useT()
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
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    setSwitching(true)
    const id = window.setTimeout(() => setSwitching(false), 180)
    return () => window.clearTimeout(id)
  }, [theme.id])

  const tpVars = {
    '--tp-bg': bg,
    '--tp-border': border,
    '--tp-accent': accent,
    '--tp-surface': surface,
    '--tp-muted': muted,
    '--tp-fg': fg,
    '--tp-tab-active': tabActive,
    '--tp-tab-inactive': tabInactive,
  } as React.CSSProperties

  return (
    <div
      className={[
        'theme-picker-preview',
        'theme-picker-preview--app',
        switching ? 'theme-picker-preview--switching' : '',
      ].filter(Boolean).join(' ')}
      data-tab-shape={chrome.tabShape}
      data-theme-id={theme.id}
      style={tpVars}
    >
      <div className="theme-picker-tp-shell" aria-hidden="true">
        <div className="theme-picker-tp-titlebar">
          <span className="theme-picker-tp-titlebar-dot" />
          <span className="theme-picker-tp-titlebar-dot" />
          <span className="theme-picker-tp-titlebar-dot" />
          <span className="theme-picker-tp-titlebar-mark" />
        </div>
        <div className="theme-picker-tp-tabbar">
          <div className="theme-picker-tp-tabs">
            <div className="theme-picker-tp-tab theme-picker-tp-tab--active">
              <span className="theme-picker-tp-tab-label" />
            </div>
            <div className="theme-picker-tp-tab">
              <span className="theme-picker-tp-tab-label" />
            </div>
          </div>
          <div className="theme-picker-tp-tab-add" />
        </div>
        <div className="theme-picker-tp-body">
          <div className="theme-picker-tp-workspace">
            <div className="theme-picker-tp-pane">
              <div className="theme-picker-tp-card theme-picker-tp-card--primary" />
              <div className="theme-picker-tp-card theme-picker-tp-card--muted" />
              <div className="theme-picker-tp-card-row">
                <span className="theme-picker-tp-pill" />
                <span className="theme-picker-tp-pill theme-picker-tp-pill--accent" />
              </div>
            </div>
            <div className="theme-picker-tp-pane theme-picker-tp-pane--split">
              <div className="theme-picker-tp-canvas" />
              <div className="theme-picker-tp-shape" />
            </div>
          </div>
          <aside className="theme-picker-tp-dock">
            <div className="theme-picker-tp-dock-head" />
            <div className="theme-picker-tp-dock-block" />
            <div className="theme-picker-tp-dock-block theme-picker-tp-dock-block--accent" />
            <div className="theme-picker-tp-dock-input" />
          </aside>
        </div>
      </div>
      <div className="theme-picker-preview-meta">
        <span className="theme-picker-preview-name">{theme.name}</span>
        {active && (
          <span className="theme-picker-preview-active">{t('themePicker.inUse')}</span>
        )}
      </div>
    </div>
  )
}
