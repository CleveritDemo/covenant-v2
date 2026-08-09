import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlanePulseButtonProps {
  label: string
  pressed?: boolean
  onClick: () => void
}

/** Botón icon-only de Pulse en la barra del plano (piel Loops). */
export const PlanePulseButton: React.FC<PlanePulseButtonProps> = ({
  label,
  pressed = false,
  onClick,
}) => (
  <Tooltip content={label}>
    <button
      type="button"
      className={[
        'plane-loops-button',
        'plane-loops-button--icon-only',
        pressed ? 'plane-loops-button--pressed' : '',
      ].filter(Boolean).join(' ')}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      <Icon name="pulse" size={13} />
    </button>
  </Tooltip>
)
