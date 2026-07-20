import React from 'react'
import type { AgentCliProvider } from '@shared/tabSession'
import { Icon } from '../components/ui/Icon'
import './PlaneMiniFace.css'

export interface PlaneMiniFaceProps {
  name: string
  busy?: boolean
  provider?: AgentCliProvider
  statusLabel: string
  /** Contextos anidados (íconos) debajo del cuerpo. */
  children?: React.ReactNode
}

/** Cara mini del agente: card con proveedor, estado y contextos. */
export const PlaneMiniFace: React.FC<PlaneMiniFaceProps> = ({
  name,
  busy = false,
  provider = 'claude',
  statusLabel,
  children,
}) => (
  <div
    className={[
      'plane-mini-face',
      busy ? 'plane-mini-face--busy' : '',
      provider === 'cursor' ? 'plane-mini-face--cursor' : 'plane-mini-face--claude',
    ].filter(Boolean).join(' ')}
  >
    <div className="plane-mini-face__glow" aria-hidden="true" />
    <div className="plane-mini-face__header">
      <span className="plane-mini-face__provider">
        <Icon name={provider === 'cursor' ? 'sparkles' : 'bot'} size={9} aria-hidden />
        {provider === 'cursor' ? 'Cursor' : 'Claude'}
      </span>
      <span
        className={[
          'plane-mini-face__pulse',
          busy ? 'plane-mini-face__pulse--on' : '',
        ].filter(Boolean).join(' ')}
        aria-hidden="true"
      />
    </div>
    <div className="plane-mini-face__body">
      <span className="plane-mini-face__name" title={name}>{name}</span>
      <span className="plane-mini-face__status" title={statusLabel}>{statusLabel}</span>
    </div>
    {children ? (
      <div className="plane-mini-face__nodes">
        {children}
      </div>
    ) : null}
  </div>
)
