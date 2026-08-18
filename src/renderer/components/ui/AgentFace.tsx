import React from 'react'
import type { AgentCliProvider } from '@shared/agentCliProviders'
import { BrandIcon } from './BrandIcon'
import './AgentFace.css'

export interface AgentFaceProps {
  monogram: string
  provider?: AgentCliProvider
  color: string
  size?: 'sm' | 'md'
  stacked?: boolean
}

/** Cara de agente: monograma teñido + badge del CLI. */
export const AgentFace: React.FC<AgentFaceProps> = ({
  monogram,
  provider,
  color,
  size = 'md',
  stacked = false,
}) => (
  <span
    className={`agent-face${size === 'sm' ? ' agent-face--sm' : ''}${stacked ? ' agent-face--stacked' : ''}`}
    style={{ '--agent-face-color': color } as React.CSSProperties}
    aria-hidden
  >
    {monogram.toUpperCase()}
    {provider ? (
      <span className="agent-face__brand">
        <BrandIcon provider={provider} size={size === 'sm' ? 7 : 8} />
      </span>
    ) : null}
  </span>
)
