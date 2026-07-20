import React from 'react'

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => (
  <section className="settings-section">
    <h3 className="settings-section-title">{title}</h3>
    <div className="settings-section__body">
      {children}
    </div>
  </section>
)

interface SettingsFieldProps {
  label: string
  hint?: React.ReactNode
  htmlFor?: string
  compact?: boolean
  children: React.ReactNode
}

export const SettingsField: React.FC<SettingsFieldProps> = ({
  label,
  hint,
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
    {hint && <span className="settings-hint">{hint}</span>}
  </label>
)
