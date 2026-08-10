import React from 'react'

interface SettingsSectionProps {
  title: string
  /** Id de salto para el buscador de ajustes. */
  anchor?: string
  children: React.ReactNode
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, anchor, children }) => (
  <section className="settings-section" id={anchor}>
    <h3 className="settings-section-title">{title}</h3>
    <div className="settings-section__body">
      {children}
    </div>
  </section>
)

interface SettingsFieldProps {
  /** Texto o nodo (p. ej. marca + nombre del CLI). */
  label: React.ReactNode
  hint?: React.ReactNode
  /** Problema de este campo. Sustituye al hint mientras esté presente. */
  error?: React.ReactNode
  htmlFor?: string
  compact?: boolean
  children: React.ReactNode
}

export const SettingsField: React.FC<SettingsFieldProps> = ({
  label,
  hint,
  error,
  htmlFor,
  compact,
  children,
}) => (
  <label
    className={['settings-label', compact ? 'settings-label--compact' : ''].filter(Boolean).join(' ')}
    htmlFor={htmlFor}
  >
    <span className="settings-label__text">{label}</span>
    {children}
    {error
      ? <span className="settings-field-error" role="alert">{error}</span>
      : hint && <span className="settings-hint">{hint}</span>}
  </label>
)
