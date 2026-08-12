import React from 'react'
import { sanitizeMusicVolume } from '@shared/configSchema'
import { useT } from '@i18n/useT'
import { Toggle } from './ui/Toggle'
import './ThemePickerAudioControls.css'

export interface ThemePickerAudioPartial {
  musicEnabled?: boolean
  musicVolume?: number
}

interface Props {
  musicEnabled: boolean
  musicVolume: number
  onAudioConfigChange: (partial: ThemePickerAudioPartial) => void
}

/** Fila compacta bajo el preview: toggle + volumen + porcentaje. */
export const ThemePickerAudioControls: React.FC<Props> = ({
  musicEnabled,
  musicVolume,
  onAudioConfigChange,
}) => {
  const { t } = useT()
  const volumePct = Math.round(sanitizeMusicVolume(musicVolume) * 100)

  return (
    <div className="theme-picker-audio" data-theme-picker-audio>
      <div className="theme-picker-audio__row">
        <Toggle
          checked={musicEnabled}
          onChange={checked => onAudioConfigChange({ musicEnabled: checked })}
          label={t('themePicker.audioToggle')}
          title={t('themePicker.audioToggleHint')}
          compact
        />
        <input
          id="theme-picker-music-volume"
          type="range"
          className="theme-picker-audio__slider"
          min={0}
          max={100}
          step={1}
          value={volumePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={volumePct}
          aria-label={t('themePicker.audioVolume')}
          onChange={e => {
            onAudioConfigChange({
              musicVolume: sanitizeMusicVolume(Number(e.target.value) / 100),
            })
          }}
        />
        <span className="theme-picker-audio__value" aria-hidden>
          {volumePct}%
        </span>
      </div>
      <p className="theme-picker-audio__hint">{t('themePicker.audioHint')}</p>
    </div>
  )
}
