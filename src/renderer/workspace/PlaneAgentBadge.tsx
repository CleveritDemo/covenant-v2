import React from 'react'
import './PlaneAgentBadge.css'

export interface PlaneAgentBadgeProps {
  name: string
  color: string
  selected?: boolean
  busy?: boolean
  onSelect: () => void
}

/** Badge seleccionable de agente para el chat del plano. */
export const PlaneAgentBadge: React.FC<PlaneAgentBadgeProps> = ({
  name,
  color,
  selected = false,
  busy = false,
  onSelect,
}) => (
  <button
    type="button"
    className={[
      'plane-agent-badge',
      selected ? 'plane-agent-badge--selected' : '',
      busy ? 'plane-agent-badge--busy' : '',
    ].filter(Boolean).join(' ')}
    style={{ '--agent-color': color } as React.CSSProperties}
    title={name}
    aria-label={name}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {busy ? <span className="plane-agent-badge__dot" aria-hidden="true" /> : null}
    <span className="plane-agent-badge__name">{name}</span>
  </button>
)
