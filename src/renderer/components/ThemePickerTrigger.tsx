import React from 'react'
import { useT } from '@i18n/useT'
import { getTheme } from '@themes/presets'
import { Button } from './ui/Button'
import './ThemePickerTrigger.css'

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
    <span className="theme-picker-trigger">
      <Button
        variant="ghost"
        size="sm"
        tabIndex={-1}
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
      </Button>
    </span>
  )
}
