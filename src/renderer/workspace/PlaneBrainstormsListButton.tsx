import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
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
}) => {
  const title = disabled ? (disabledTitle || label) : label
  return (
    <Tooltip content={title}>
      <button
        type="button"
        className={[
          'plane-loops-button',
          'plane-loops-button--icon-only',
          pressed ? 'plane-loops-button--pressed' : '',
        ].filter(Boolean).join(' ')}
        aria-label={title}
        aria-pressed={pressed}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name="brain" size={13} />
      </button>
    </Tooltip>
  )
}
