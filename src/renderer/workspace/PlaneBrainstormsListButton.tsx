import React from 'react'
import { Icon } from '../components/ui/Icon'
import './PlaneLoopsButton.css'

export interface PlaneBrainstormsListButtonProps {
  label: string
  pressed: boolean
  disabled?: boolean
  disabledTitle?: string
  onClick: () => void
}

/** Botón toolbar icon-only: listar/crear salas de brainstorm. */
export const PlaneBrainstormsListButton: React.FC<PlaneBrainstormsListButtonProps> = ({
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
      'plane-loops-button--icon-only',
      pressed ? 'plane-loops-button--pressed' : '',
    ].filter(Boolean).join(' ')}
    title={disabled && disabledTitle ? disabledTitle : label}
    aria-label={label}
    aria-pressed={pressed}
    disabled={disabled}
    onClick={onClick}
  >
    <Icon name="brain" size={13} />
  </button>
)
