import React from 'react'
import './ContextCheckOption.css'

export interface ContextCheckOptionProps {
  name: string
  kindLabel: string
  checked: boolean
  onChange: () => void
  disabled?: boolean
  /** panel = lista de modal; menu = dropdown compacto */
  appearance?: 'panel' | 'menu'
  emphasize?: boolean
  title?: string
}

/** Opción multi-select de contexto (checkbox + nombre + kind). */
export const ContextCheckOption: React.FC<ContextCheckOptionProps> = ({
  name,
  kindLabel,
  checked,
  onChange,
  disabled = false,
  appearance = 'panel',
  emphasize = false,
  title,
}) => (
  <label
    className={[
      'context-check-option',
      `context-check-option--${appearance}`,
      checked ? 'context-check-option--on' : '',
      emphasize ? 'context-check-option--emphasize' : '',
    ].filter(Boolean).join(' ')}
    aria-label={title}
  >
    <input
      type="checkbox"
      role="option"
      aria-selected={checked}
      checked={checked}
      disabled={disabled}
      onChange={onChange}
    />
    {appearance === 'menu' ? (
      <span className="context-check-option__check" aria-hidden="true" />
    ) : null}
    <span className="context-check-option__name">{name}</span>
    <span className="context-check-option__kind">{kindLabel}</span>
  </label>
)
