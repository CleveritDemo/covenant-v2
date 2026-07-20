import React from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import './PlaneContextCard.css'

export interface PlaneContextCardProps {
  name: string
  icon: IconName
  color: string
  shared?: boolean
  /** Clic: p. ej. abrir config del agente (sin tooltip). */
  onOpen?: () => void
}

/** Ícono de contexto anidado en la mini del agente. */
export const PlaneContextCard: React.FC<PlaneContextCardProps> = ({
  name,
  icon,
  color,
  shared = false,
  onOpen,
}) => (
  <button
    type="button"
    className={[
      'plane-context-card',
      shared ? 'plane-context-card--shared' : '',
    ].filter(Boolean).join(' ')}
    style={{ color }}
    aria-label={name}
    onClick={event => {
      event.preventDefault()
      event.stopPropagation()
      onOpen?.()
    }}
    onPointerDown={event => event.stopPropagation()}
  >
    <Icon name={icon} size={12} aria-hidden />
  </button>
)
