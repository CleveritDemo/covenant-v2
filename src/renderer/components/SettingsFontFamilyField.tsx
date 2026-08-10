import React from 'react'
import { Input } from './ui/Input'
import { Select, type SelectOption } from './ui/Select'

export interface SettingsFontFamilyFieldProps {
  label: string
  hint: string
  warning?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  customLabel: string
  placeholder: string
}

/**
 * Selector de catálogo + nombre libre en una fila: misma fuente, dos formas de elegirla.
 */
export const SettingsFontFamilyField: React.FC<SettingsFontFamilyFieldProps> = ({
  label,
  hint,
  warning,
  value,
  options,
  onChange,
  customLabel,
  placeholder,
}) => (
  <div className="settings-font-field">
    <span className="settings-font-field__label">{label}</span>
    <div className="settings-font-field__row">
      <div className="settings-font-field__select">
        <Select
          size="sm"
          value={value}
          onChange={onChange}
          options={options}
          aria-label={label}
        />
      </div>
      <div className="settings-font-field__custom">
        <Input
          type="text"
          size="sm"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={`${label}: ${customLabel}`}
          aria-invalid={warning ? true : undefined}
        />
      </div>
    </div>
    <span className="settings-hint">{hint}</span>
    {warning ? (
      <span className="settings-field-error" role="alert">{warning}</span>
    ) : null}
  </div>
)
