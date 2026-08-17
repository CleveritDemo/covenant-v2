import React from 'react'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import './PlaneLoopsButton.css'

export interface PlaneWorkspaceButtonProps {
  label: string
  /** Segunda línea del tooltip: qué es el plano, para quien recién entra. */
  hint?: string
  /** Sin overlay encima: el plano es el módulo a la vista. */
  pressed: boolean
  onClick: () => void
}

/**
 * El plano, como un módulo más del riel. Es el estado por defecto —agentes,
 * terminales y composer— y antes solo se volvía a él cerrando el overlay de
 * turno; ahora se marca como los demás y tiene su propia forma de volver.
 */
export const PlaneWorkspaceButton: React.FC<PlaneWorkspaceButtonProps> = ({
  label,
  hint,
  pressed,
  onClick,
}) => (
  <Tooltip content={label} hint={hint}>
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
      <Icon name="workspace" size={13} />
    </button>
  </Tooltip>
)
