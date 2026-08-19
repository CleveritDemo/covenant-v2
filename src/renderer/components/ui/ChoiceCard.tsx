import React from 'react'
import './ChoiceCard.css'

/** `warn`: opción con consecuencias (p. ej. permisos Auto); se tiñe al elegirla. */
export type ChoiceCardTone = 'default' | 'warn'

export interface ChoiceCardProps {
  selected?: boolean
  disabled?: boolean
  tone?: ChoiceCardTone
  onClick: () => void
  children: React.ReactNode
  icon?: React.ReactNode
  role?: 'radio' | 'listitem' | 'button'
  'aria-checked'?: boolean
  'aria-pressed'?: boolean
}

export const ChoiceCard: React.FC<ChoiceCardProps> = ({
  selected = false,
  disabled = false,
  tone = 'default',
  onClick,
  children,
  icon,
  role,
  'aria-checked': ariaChecked,
  'aria-pressed': ariaPressed,
}) => (
  <button
    type="button"
    role={role}
    aria-checked={ariaChecked}
    aria-pressed={ariaPressed}
    disabled={disabled}
    className={[
      'choice-card',
      selected ? 'choice-card--selected' : '',
      icon ? 'choice-card--with-icon' : '',
      tone === 'warn' ? 'choice-card--warn' : '',
    ].filter(Boolean).join(' ')}
    onClick={onClick}
  >
    {icon != null && (
      <span className="choice-card__icon" aria-hidden="true">
        {icon}
      </span>
    )}
    <span className="choice-card__content">
      {children}
    </span>
  </button>
)
