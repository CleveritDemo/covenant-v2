import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneBrainstormsListButtonProps {
  label: string
  pressed: boolean
  disabled?: boolean
  disabledTitle?: string
  /**
   * Salas vivas. Va en el aria-label porque el número es la información: con
   * salas en paralelo, «pressed» solo dice cuál estás mirando.
   */
  liveCount?: number
  onClick: () => void
}

/** Botón toolbar icon-only: listar/crear salas de brainstorm. */
export const PlaneBrainstormsListButton: React.FC<PlaneBrainstormsListButtonProps> = ({
  label,
  pressed,
  disabled = false,
  disabledTitle,
  liveCount = 0,
  onClick,
}) => {
  const base = liveCount > 0 ? `${label} · ${liveCount}` : label
  const title = disabled ? (disabledTitle || label) : base
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
        <Icon name="messages" size={12} />
      </button>
    </Tooltip>
  )
}
