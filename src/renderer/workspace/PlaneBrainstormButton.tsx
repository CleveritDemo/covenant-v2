import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneLoopsButton.css'

export interface PlaneBrainstormButtonProps {
  label: string
  pressed: boolean
  disabled?: boolean
  disabledTitle?: string
  onClick: () => void
}

/** Botón de brainstorm en la barra del plano (piel Loops). */
export const PlaneBrainstormButton: React.FC<PlaneBrainstormButtonProps> = ({
  label,
  pressed,
  disabled = false,
  disabledTitle,
  onClick,
}) => (
  <button
    type="button"
    className={[
      'plane-loops-button',
      pressed ? 'plane-loops-button--pressed' : '',
    ].filter(Boolean).join(' ')}
    title={disabled && disabledTitle ? disabledTitle : label}
    aria-label={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="brain" size={13} />
    <span className="plane-loops-button__label">{label}</span>
  </button>
)
