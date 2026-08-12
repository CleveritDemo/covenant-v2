import React from 'react'
import { useT } from '@i18n/useT'
import { Toggle } from './ui/Toggle'
import './ThemePickerAudioControls.css'

export interface ThemePickerAudioPartial {
  musicEnabled?: boolean
}

interface Props {
  musicEnabled: boolean
  onAudioConfigChange: (partial: ThemePickerAudioPartial) => void
}

/** Fila compacta bajo el preview: solo toggle de audio del tema. */
export const ThemePickerAudioControls: React.FC<Props> = ({
  musicEnabled,
  onAudioConfigChange,
}) => {
  const { t } = useT()

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
      </div>
      <p className="theme-picker-audio__hint">{t('themePicker.audioHint')}</p>
    </div>
  )
}
