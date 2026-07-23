import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { Icon } from '../components/ui/Icon'
import './PlaneMiniFace.css'

export interface PlaneMiniFaceProps {
  name: string
  busy?: boolean
  provider?: AgentCliProvider
  statusLabel: string
  /** Densidad visual; compact reduce padding/gaps para listas y modales. */
  density?: 'default' | 'compact'
  configLabel?: string
  deleteLabel?: string
  onConfigure?: () => void
  onDelete?: () => void
  /** Contextos anidados (lista con nombres) debajo del cuerpo. */
  children?: React.ReactNode
}

/** Cara mini del agente: card con proveedor, estado y contextos. */
export const PlaneMiniFace: React.FC<PlaneMiniFaceProps> = ({
  name,
  busy = false,
  provider = 'claude',
  statusLabel,
  density = 'default',
  configLabel,
  deleteLabel,
  onConfigure,
  onDelete,
  children,
}) => (
  <div
    className={[
      'plane-mini-face',
      busy ? 'plane-mini-face--busy' : '',
      density === 'compact' ? 'plane-mini-face--compact' : '',
      provider === 'cursor' ? 'plane-mini-face--cursor' : 'plane-mini-face--claude',
    ].filter(Boolean).join(' ')}
  >
    <div className="plane-mini-face__glow" aria-hidden="true" />
    <div className="plane-mini-face__header">
      <div className="plane-mini-face__identity">
        <span className="plane-mini-face__name" title={name}>{name}</span>
        <span className="plane-mini-face__provider">
          <Icon name={provider === 'cursor' ? 'sparkles' : 'bot'} size={9} aria-hidden />
          {provider === 'cursor' ? 'Cursor' : 'Claude'}
        </span>
      </div>
      <div className="plane-mini-face__header-end">
        {onConfigure && configLabel ? (
          <button
            type="button"
            className="plane-mini-face__action"
            title={configLabel}
            aria-label={configLabel}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              onConfigure()
            }}
            onPointerDown={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerUp={event => event.stopPropagation()}
          >
            <Icon name="settings" size={11} />
          </button>
        ) : null}
        {onDelete && deleteLabel ? (
          <button
            type="button"
            className="plane-mini-face__action plane-mini-face__action--danger"
            title={deleteLabel}
            aria-label={deleteLabel}
            onClick={event => {
              event.preventDefault()
              event.stopPropagation()
              onDelete()
            }}
            onPointerDown={event => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onPointerUp={event => event.stopPropagation()}
          >
            <Icon name="trash" size={11} />
          </button>
        ) : null}
      </div>
    </div>
    <div className="plane-mini-face__body">
      <span className="plane-mini-face__status" title={statusLabel}>{statusLabel}</span>
    </div>
    {children ? (
      <div className="plane-mini-face__nodes">
        {children}
      </div>
    ) : null}
  </div>
)
