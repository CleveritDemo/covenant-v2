import React from 'react'
import type { IconName } from '../components/ui/Icon'
import { Icon } from '../components/ui/Icon'
import './PlaneContextCard.css'

export interface PlaneContextCardProps {
  name: string
  icon: IconName
  color: string
  shared?: boolean
  /** Fila con ícono + nombre (lista de contextos del agente). */
  showName?: boolean
  /** Clic: p. ej. abrir chat del agente. */
  onOpen?: () => void
}

/** Contexto anidado en la mini del agente (ícono o fila con nombre). */
export const PlaneContextCard: React.FC<PlaneContextCardProps> = ({
  name,
  icon,
  color,
  shared = false,
  showName = false,
  onOpen,
}) => (
  <button
    type="button"
    className={[
      'plane-context-card',
      showName ? 'plane-context-card--labeled' : '',
      shared ? 'plane-context-card--shared' : '',
    ].filter(Boolean).join(' ')}
    style={{ '--context-color': color } as React.CSSProperties}
    aria-label={name}
    onClick={event => {
      event.preventDefault()
      event.stopPropagation()
      onOpen?.()
    }}
    onPointerDown={event => event.stopPropagation()}
  >
    <Icon name={icon} size={showName ? 10 : 12} aria-hidden />
    {showName ? (
      <span className="plane-context-card__name">{name}</span>
    ) : null}
  </button>
)
