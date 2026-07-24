import React from 'react'
import './SettingToggle.css'

export interface SettingToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  title: string
  description: string
  disabled?: boolean
  hint?: string
}

/** Toggle de ajuste con título + descripción + switch (fila completa). */
export const SettingToggle: React.FC<SettingToggleProps> = ({
  checked,
  onChange,
  title,
  description,
  disabled = false,
  hint,
}) => (
  <button
    type="button"
    className={['setting-toggle', checked ? 'setting-toggle--on' : ''].filter(Boolean).join(' ')}
    disabled={disabled}
    aria-pressed={checked}
    title={hint}
    onClick={() => onChange(!checked)}
  >
    <span className="setting-toggle__copy">
      <strong>{title}</strong>
      <span>{description}</span>
    </span>
    <span className="setting-toggle__switch" aria-hidden="true">
      <span className="setting-toggle__knob" />
    </span>
  </button>
)
