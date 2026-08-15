import React, { useRef } from 'react'
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
}) => {
  const tapRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)

  return (
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
    {busy ? <PlaneBusyDot /> : null}
  </button>
  )
}
