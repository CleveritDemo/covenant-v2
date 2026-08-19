import React from 'react'
import './OptionRow.css'

export interface OptionRowProps {
  icon?: React.ReactNode
  title: string
  hint?: string
  onClick: () => void
  selected?: boolean
  disabled?: boolean
}

/** Fila de opción sin caja: icono plano + título + hint. */
export const OptionRow: React.FC<OptionRowProps> = ({
  icon,
  title,
  hint,
  onClick,
  selected = false,
  disabled = false,
}) => (
  <button
    type="button"
    className={['option-row', selected ? 'option-row--selected' : ''].filter(Boolean).join(' ')}
    disabled={disabled}
    aria-pressed={selected || undefined}
    onClick={onClick}
  >
    {icon != null ? (
      <span className="option-row__icon" aria-hidden="true">
        {icon}
      </span>
    ) : null}
    <span className="option-row__body">
      <span className="option-row__title">{title}</span>
      {hint ? <span className="option-row__hint">{hint}</span> : null}
    </span>
  </button>
)
