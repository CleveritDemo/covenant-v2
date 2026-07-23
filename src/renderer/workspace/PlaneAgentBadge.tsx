import React from 'react'
import './PlaneAgentBadge.css'
import './PlaneChromaticBusyBorder.css'

export interface PlaneAgentBadgeProps {
  name: string
  selected?: boolean
  busy?: boolean
  onSelect: () => void
}

/** Badge seleccionable de agente para el chat del plano (colores del tema). */
export const PlaneAgentBadge: React.FC<PlaneAgentBadgeProps> = ({
  name,
  selected = false,
  busy = false,
  onSelect,
}) => (
  <button
    type="button"
    className={[
      'plane-agent-badge',
      selected ? 'plane-agent-badge--selected' : '',
      busy ? 'plane-agent-badge--busy plane-chromatic-busy-border' : '',
    ].filter(Boolean).join(' ')}
    title={name}
    aria-label={name}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {busy ? <span className="plane-agent-badge__dot" aria-hidden="true" /> : null}
    <span className="plane-agent-badge__name">{name}</span>
  </button>
)
