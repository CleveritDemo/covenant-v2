import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  paginateThreadHistory,
  threadHistoryCandidates,
  type AgentThread,
} from '@shared/agentThreads'
import { resolveThreadChipActivityDot } from '../agent/paneWorkActive'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneChatThreadHistoryButton.css'

const HISTORY_PAGE_SIZE = 5
const SCROLL_LOAD_THRESHOLD = 8

export interface PlaneChatThreadHistoryButtonProps {
  panelId: string
  /** Ancla de posición del popover (chip del thread activo). */
  triggerRef: React.RefObject<HTMLElement | null>
  threads: readonly AgentThread[]
  activeThreadId: string
  runningThreadIds: readonly string[]
  awaitingDelegations?: boolean
  awaitingDelegationThreadIds?: readonly string[]
  paneCliBusy?: boolean
  threadSelectionLocked?: boolean
  onSelectThread: (threadId: string) => void
}

function panelPlacement(trigger: DOMRect): {
  top: number | 'auto'
  bottom: number | 'auto'
  maxHeight: number
} {
  const GAP = 4
  const below = window.innerHeight - trigger.bottom - GAP * 2
  const above = trigger.top - GAP * 2
  if (below < 180 && above > below) {
    return {
      top: 'auto',
      bottom: window.innerHeight - trigger.top + GAP,
      maxHeight: Math.min(above, 320),
    }
  }
  return { top: trigger.bottom + GAP, bottom: 'auto', maxHeight: Math.min(below, 320) }
}

function centeredPanelLeft(trigger: DOMRect, panelWidth: number): number {
  const inset = 8
  const ideal = trigger.left + (trigger.width - panelWidth) / 2
  return Math.max(inset, Math.min(ideal, window.innerWidth - panelWidth - inset))
}

/** Popover paginado con todas las conversaciones del agente. */
export const PlaneChatThreadHistoryButton: React.FC<PlaneChatThreadHistoryButtonProps> = ({
  panelId,
  triggerRef,
  threads,
  activeThreadId,
  runningThreadIds,
  awaitingDelegations = false,
  awaitingDelegationThreadIds,
  paneCliBusy = false,
  threadSelectionLocked = false,
  onSelectThread,
}) => {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const [visibleLimit, setVisibleLimit] = useState(HISTORY_PAGE_SIZE)
  const [box, setBox] = useState<React.CSSProperties>({})

  const candidates = useMemo(
    () => threadHistoryCandidates(threads, activeThreadId, runningThreadIds),
    [threads, activeThreadId, runningThreadIds],
  )

  const { items, hasMore } = useMemo(
    () => paginateThreadHistory(candidates, visibleLimit),
    [candidates, visibleLimit],
  )

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onToggle = (event: Event): void => {
      const nowOpen = (event as ToggleEvent).newState === 'open'
      if (nowOpen) {
        setVisibleLimit(HISTORY_PAGE_SIZE)
        const syncPosition = (): void => {
          const trigger = triggerRef.current?.getBoundingClientRect()
          const panelEl = panelRef.current
          if (!trigger || !panelEl) return
          const { top, bottom, maxHeight } = panelPlacement(trigger)
          const panelWidth = panelEl.getBoundingClientRect().width
          setBox({
            top,
            bottom,
            left: centeredPanelLeft(trigger, panelWidth),
            right: 'auto',
            maxHeight,
          })
        }
        requestAnimationFrame(syncPosition)
      }
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  }, [triggerRef])

  const close = (): void => {
    const panel = panelRef.current
    if (!panel) return
    try {
      if (typeof panel.hidePopover === 'function') panel.hidePopover()
    } catch {
      /* popover ya cerrado / no soportado */
    }
  }

  const pick = (threadId: string): void => {
    if (threadId !== activeThreadId) onSelectThread(threadId)
    close()
  }

  const handleScroll = (event: React.UIEvent<HTMLDivElement>): void => {
    if (!hasMore) return
    const target = event.currentTarget
    if (target.scrollTop + target.clientHeight >= target.scrollHeight - SCROLL_LOAD_THRESHOLD) {
      setVisibleLimit(limit => limit + HISTORY_PAGE_SIZE)
    }
  }

  if (threads.length === 0) return null

  return (
    <div
      ref={panelRef}
      id={panelId}
      popover="auto"
      className="plane-chat-thread-history__panel"
      style={box}
      role="listbox"
      tabIndex={-1}
      aria-label={t('agentPane.threadHistoryAria')}
      onScroll={handleScroll}
    >
      {items.map(thread => {
          const rowDot = resolveThreadChipActivityDot(
            thread.id,
            activeThreadId,
            awaitingDelegations,
            runningThreadIds,
            paneCliBusy,
            awaitingDelegationThreadIds,
          )
          const title = thread.title || t('agentPane.threadUntitled')
          const switchDisabled = threadSelectionLocked

          return (
            <button
              key={thread.id}
              type="button"
              role="option"
              aria-selected={false}
              className="plane-chat-thread-history__row"
              disabled={switchDisabled}
              onPointerDown={event => {
                event.preventDefault()
              }}
              onClick={event => {
                event.preventDefault()
                event.stopPropagation()
                if (!switchDisabled) pick(thread.id)
              }}
            >
              {rowDot ? <PlaneBusyDot size="sm" variant={rowDot} /> : null}
              <span className="plane-chat-thread-history__label">{title}</span>
            </button>
          )
        })}
    </div>
  )
}
