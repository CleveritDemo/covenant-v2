import React, { useRef } from 'react'
import { PlaneBusyDot } from './PlaneBusyDot'
import type { PlaneActivityDotKind } from '../agent/paneWorkActive'
import './PlaneAgentBadge.css'
import './PlaneChatActive.css'

export interface PlaneAgentBadgeProps {
  name: string
  selected?: boolean
  /** Dot de actividad: busy (CLI) o delegating (ola). */
  activityDot?: PlaneActivityDotKind | null
  onSelect: () => void
}

/** Badge: selected = borde accent; activityDot = presencia en el plano. */
export const PlaneAgentBadge: React.FC<PlaneAgentBadgeProps> = ({
  name,
  selected = false,
  activityDot = null,
  onSelect,
}) => {
  const tapRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  return (
  <button
    type="button"
    className={[
      'plane-agent-badge',
      selected ? 'plane-agent-badge--selected plane-chat-active' : '',
      activityDot ? 'plane-agent-badge--busy' : '',
    ].filter(Boolean).join(' ')}
    aria-label={name}
    aria-pressed={selected}
    onClick={onSelect}
    onPointerDown={event => {
      if (event.button !== 0) return
      tapRef.current = {
        x: event.clientX,
        y: event.clientY,
        pointerId: event.pointerId,
      }
    }}
    onPointerUp={event => {
      if (event.button !== 0 || event.pointerType !== 'touch') return
      const start = tapRef.current
      tapRef.current = null
      if (!start || start.pointerId !== event.pointerId) return
      const dx = event.clientX - start.x
      const dy = event.clientY - start.y
      if (dx * dx + dy * dy > 144) return
      event.preventDefault()
      onSelect()
    }}
    onPointerCancel={() => { tapRef.current = null }}
  >
    <span className="plane-agent-badge__name">{name}</span>
    {activityDot ? (
      <PlaneBusyDot variant={activityDot} />
    ) : null}
  </button>
  )
}
