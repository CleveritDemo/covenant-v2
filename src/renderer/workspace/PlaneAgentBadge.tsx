import React from 'react'
import { PlaneBusyDot } from './PlaneBusyDot'
import { PlaneInstanceTag } from './PlaneInstanceTag'
import './PlaneAgentBadge.css'
import './PlaneChatActive.css'

export interface PlaneAgentBadgeProps {
  name: string
  /** Réplica temporal del experto: `R2`, `R3`… */
  instanceTag?: string
  /** Experto base: réplicas suyas vivas ahora mismo. */
  replicaCount?: number
  selected?: boolean
  busy?: boolean
  onSelect: () => void
}

/** Badge: selected = borde accent; busy = dot multicolor del tema. */
export const PlaneAgentBadge: React.FC<PlaneAgentBadgeProps> = ({
  name,
  instanceTag,
  replicaCount,
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
    aria-label={instanceTag ? `${name} ${instanceTag}` : name}
    aria-pressed={selected}
    onClick={onSelect}
  >
    <span className="plane-agent-badge__name">{name}</span>
    {instanceTag ? <PlaneInstanceTag text={instanceTag} /> : null}
    {!instanceTag && replicaCount ? (
      <PlaneInstanceTag text={`+${replicaCount}`} variant="count" />
    ) : null}
    {busy ? <PlaneBusyDot /> : null}
  </button>
)
