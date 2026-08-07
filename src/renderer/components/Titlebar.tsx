import React from 'react'
import type { AppConfig } from '@shared/configSchema'
import { getTheme } from '@themes/presets'
import { useT } from '@i18n/useT'
import { TitlebarMusicControls } from './TitlebarMusicControls'
import { FontSizeControl } from './FontSizeControl'
import { ThemePickerTrigger } from './ThemePickerTrigger'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import './Titlebar.css'

interface TitlebarProps {
  config: AppConfig
  fontSize: number
  fontSizeMin: number
  fontSizeMax: number
  themePickerOpen: boolean
  onFontIncrease: () => void
  onFontDecrease: () => void
  onOpenThemePicker: () => void
  onOpenOrganizations: () => void
  onOpenSettings: () => void
  onConfigPatch?: (partial: Partial<AppConfig>) => void | Promise<void>
}

export const Titlebar: React.FC<TitlebarProps> = ({
  config,
  fontSize,
  fontSizeMin,
  fontSizeMax,
  themePickerOpen,
  onFontIncrease,
  onFontDecrease,
  onOpenThemePicker,
  onOpenOrganizations,
  onOpenSettings,
  onConfigPatch,
}) => {
  const { t } = useT()
  const theme = getTheme(config.themeId)

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-actions">
        <TitlebarMusicControls config={config} onOpenSettings={onOpenSettings} onConfigPatch={onConfigPatch} />

        <FontSizeControl
          fontSize={fontSize}
          min={fontSizeMin}
          max={fontSizeMax}
          onIncrease={onFontIncrease}
          onDecrease={onFontDecrease}
        />

        <ThemePickerTrigger
          themeId={config.themeId}
          themeName={theme.name}
          isOpen={themePickerOpen}
          onClick={onOpenThemePicker}
        />

        <Button
          variant="icon"
          tabIndex={-1}
          onClick={onOpenOrganizations}
          title={t('titlebar.organizationsTitle')}
          aria-label={t('titlebar.organizationsAriaLabel')}
        >
          <Icon name="users" size={15} />
        </Button>

        <Button
          variant="icon"
          tabIndex={-1}
          onClick={onOpenSettings}
          title={t('titlebar.settingsTitle')}
          aria-label={t('titlebar.settingsAriaLabel')}
        >
          <Icon name="settings" size={15} />
        </Button>
      </div>
    </div>
  )
}
