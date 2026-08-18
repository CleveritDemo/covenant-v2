import React from 'react'
import { Icon } from '../components/ui/Icon'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneWikiMapButtonProps {
  label: string
  pressed: boolean
  /** Sweep o curador trabajando con el mapa cerrado. */
  busy?: boolean
  onClick: () => void
}

/** Botón toolbar icon-only: abrir/cerrar el mapa neuronal 3D de la wiki. */
export const PlaneWikiMapButton: React.FC<PlaneWikiMapButtonProps> = ({
  label,
  pressed,
  busy = false,
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
      <Icon name="wiki-graph" size={13} />
      {busy && !pressed ? <PlaneBusyDot placement="corner" size="sm" /> : null}
    </button>
  </Tooltip>
)
