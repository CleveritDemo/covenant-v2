import React, { useCallback, useEffect, useRef, useState } from 'react'
import { resolveComposerAgentActivityDot } from '../agent/paneWorkActive'
import { PlaneAgentBadge } from './PlaneAgentBadge'
import type { PlaneChatAgentOption } from './PlaneChatComposer'
import './PlaneChatComposer.css'

export interface PlaneChatComposerAgentsProps {
  agents: PlaneChatAgentOption[]
  selectedAgentId: string | null
  emptyAgentsHint: string
  sendLabel: string
  onSelectAgent: (paneId: string) => void
}

/**
 * Carril horizontal de agentes del composer: scroll suave y fades laterales
 * solo cuando hay contenido oculto.
 */
export const PlaneChatComposerAgents: React.FC<PlaneChatComposerAgentsProps> = ({
  agents,
  selectedAgentId,
  emptyAgentsHint,
  sendLabel,
  onSelectAgent,
}) => {
  const listRef = useRef<HTMLDivElement>(null)
  const [fadeStart, setFadeStart] = useState(false)
  const [fadeEnd, setFadeEnd] = useState(false)

  const syncFade = useCallback((): void => {
    const el = listRef.current
    if (!el) return
    const overflow = el.scrollWidth - el.clientWidth > 1
    if (!overflow) {
      setFadeStart(false)
      setFadeEnd(false)
      return
    }
    setFadeStart(el.scrollLeft > 1)
    setFadeEnd(el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
  }, [])

  useEffect(() => {
    syncFade()
    const el = listRef.current
    if (!el) return

    el.addEventListener('scroll', syncFade, { passive: true })
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(syncFade)
      : null
    ro?.observe(el)

    return () => {
      el.removeEventListener('scroll', syncFade)
      ro?.disconnect()
    }
  }, [agents.length, syncFade])

  return (
    <div
      className="plane-chat-composer__agents-wrap"
      data-fade-start={fadeStart ? '' : undefined}
      data-fade-end={fadeEnd ? '' : undefined}
    >
      <div
        ref={listRef}
        className="plane-chat-composer__agents"
        role="listbox"
        aria-label={sendLabel}
      >
        {agents.length === 0 ? (
          <span className="plane-chat-composer__empty">{emptyAgentsHint}</span>
        ) : (
          agents.map((agent, index) => (
            <span
              key={agent.paneId}
              className="plane-chat-composer__agent-slot"
              style={{ '--agent-stagger': index } as React.CSSProperties}
            >
              <PlaneAgentBadge
                name={agent.title}
                selected={agent.paneId === selectedAgentId}
                activityDot={resolveComposerAgentActivityDot(agent)}
                onSelect={() => onSelectAgent(agent.paneId)}
              />
            </span>
          ))
        )}
      </div>
    </div>
  )
}
