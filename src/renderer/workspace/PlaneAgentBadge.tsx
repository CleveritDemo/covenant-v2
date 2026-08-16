import React, { useEffect, useRef, useState } from 'react'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
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

const DOT_EXIT_MS = 520

/** Badge: selected = borde accent; activityDot = presencia en el plano. */
export const PlaneAgentBadge: React.FC<PlaneAgentBadgeProps> = ({
  name,
  selected = false,
  activityDot = null,
  onSelect,
}) => {
  const tapRef = useRef<{ x: number; y: number; pointerId: number } | null>(null)
  const mountedDotRef = useRef<PlaneActivityDotKind | null>(activityDot)
  const [mountedDot, setMountedDot] = useState<PlaneActivityDotKind | null>(activityDot)
  const [dotExiting, setDotExiting] = useState(false)

  mountedDotRef.current = mountedDot

  useEffect(() => {
    if (activityDot) {
      setDotExiting(false)
      setMountedDot(activityDot)
      return
    }
    if (!mountedDotRef.current) return

    setDotExiting(true)
    const timer = window.setTimeout(() => {
      setMountedDot(null)
      setDotExiting(false)
    }, DOT_EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [activityDot])

  const dotExpanded = Boolean(activityDot || mountedDot)

  return (
  <button
    type="button"
    className={[
      'plane-agent-badge',
      selected ? 'plane-agent-badge--selected plane-chat-active' : '',
      dotExpanded ? 'plane-agent-badge--busy' : '',
      dotExiting ? 'plane-agent-badge--dot-exiting' : '',
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
    <span className="plane-agent-badge__dot-wrap" aria-hidden={!dotExpanded}>
      {mountedDot ? (
        <PlaneBusyDot variant={mountedDot} size="sm" />
      ) : null}
    </span>
  </button>
  )
}
