import React from 'react'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneAgentBadge.css'
import './PlaneChatActive.css'

export interface PlaneAgentBadgeProps {
  name: string
  selected?: boolean
  busy?: boolean
  onSelect: () => void
}

/** Badge: selected = borde accent; busy = dot multicolor del tema. */
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
      selected ? 'plane-agent-badge--selected plane-chat-active' : '',
      busy ? 'plane-agent-badge--busy' : '',
    ].filter(Boolean).join(' ')}
    aria-label={name}
    aria-pressed={selected}
    onClick={onSelect}
  >
    {busy ? <PlaneBusyDot /> : null}
    <span className="plane-agent-badge__name">{name}</span>
  </button>
)
