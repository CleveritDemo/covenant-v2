import React from 'react'
import type { AppConfig } from '@shared/configSchema'
import { getTheme } from '@themes/presets'
import { useT } from '@i18n/useT'
import { TitlebarMusicControls } from './TitlebarMusicControls'
import { TitlebarClock } from './TitlebarClock'
import { FontSizeControl } from './FontSizeControl'
import { ThemePickerTrigger } from './ThemePickerTrigger'
import { UpdateBanner } from './UpdateBanner'
import { Button } from './ui/Button'
import { Icon } from './ui/Icon'
import { Tooltip } from './ui/Tooltip'
import './Titlebar.css'

interface TitlebarProps {
  config: AppConfig
  configReady?: boolean
  fontSize: number
  fontSizeMin: number
  fontSizeMax: number
  themePickerOpen: boolean
  onFontIncrease: () => void
  onFontDecrease: () => void
  onOpenThemePicker: () => void
  onOpenOrganizations: () => void
  onOpenSettings: () => void
  onMusicPausedChange?: (paused: boolean) => void
  hideOrganizations?: boolean
  offline?: boolean
}

export const Titlebar: React.FC<TitlebarProps> = ({
  config,
  configReady = true,
  fontSize,
  fontSizeMin,
  fontSizeMax,
  themePickerOpen,
  onFontIncrease,
  onFontDecrease,
  onOpenThemePicker,
  onOpenOrganizations,
  onOpenSettings,
  onMusicPausedChange,
  hideOrganizations = false,
  offline = false,
}) => {
  const { t } = useT()
  const theme = getTheme(config.themeId)

  const wordmark = offline ? (
    <Tooltip content={t('titlebar.offlineTooltip')}>
      <div
        className="titlebar__wordmark titlebar__wordmark--offline"
        role="status"
        aria-live="polite"
      >
        <span className="titlebar__wordmark-dot" aria-hidden="true" />
        Covenant
      </div>
    </Tooltip>
  ) : (
    <div className="titlebar__wordmark" aria-hidden="true">Covenant</div>
  )

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      {wordmark}
      <UpdateBanner />
      <div className="titlebar-actions">
        <FontSizeControl
          fontSize={fontSize}
          min={fontSizeMin}
          max={fontSizeMax}
          onIncrease={onFontIncrease}
          onDecrease={onFontDecrease}
        />

        <TitlebarMusicControls
          config={config}
          configReady={configReady}
          onMusicPausedChange={onMusicPausedChange}
        />

        <ThemePickerTrigger
          themeId={config.themeId}
          themeName={theme.name}
          isOpen={themePickerOpen}
          onClick={onOpenThemePicker}
        />

        <TitlebarClock />

        {!hideOrganizations && (
          <Button
            variant="icon"
            size="sm"
            tabIndex={-1}
            onClick={onOpenOrganizations}
            aria-label={t('titlebar.organizationsAriaLabel')}
          >
            <Icon name="users" size={15} />
          </Button>
        )}

        <Button
          variant="icon"
          size="sm"
          tabIndex={-1}
          onClick={onOpenSettings}
          aria-label={t('titlebar.settingsAriaLabel')}
        >
          <Icon name="settings" size={15} />
        </Button>
      </div>
    </div>
  )
}
