import React from 'react'
import { useT } from '@i18n/useT'
import { getTheme } from '@themes/presets'

interface ThemePickerTriggerProps {
  themeId: string
  themeName: string
  isOpen: boolean
  onClick: () => void
}

/** Trigger de tema en titlebar (swatches vía CSS vars). */
export const ThemePickerTrigger: React.FC<ThemePickerTriggerProps> = ({
  themeId,
  themeName,
  isOpen,
  onClick,
}) => {
  const { t } = useT()
  const theme = getTheme(themeId)
  const bg = theme.vars['--bg'] ?? theme.xterm.background
  const accent = theme.vars['--accent'] ?? theme.xterm.cursor

  return (
    <button
      type="button"
      tabIndex={-1}
      className="theme-picker-trigger"
      style={{ '--swatch-bg': bg, '--swatch-accent': accent } as React.CSSProperties}
      onClick={onClick}
      aria-label={t('themePicker.triggerTitle')}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
    >
      <span className="theme-picker-trigger-palette" aria-hidden="true">
        <span className="theme-picker-trigger-swatch-bg" />
        <span className="theme-picker-trigger-swatch-accent" />
      </span>
      <span className="theme-picker-trigger-label">{themeName}</span>
    </button>
  )
}
