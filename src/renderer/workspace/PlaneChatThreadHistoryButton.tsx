import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button, Icon, Tooltip } from '../components/ui'
import { useT } from '@i18n/useT'
import {
  paginateThreadHistory,
  threadHistoryCandidates,
  type AgentThread,
} from '@shared/agentThreads'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneChatThreadHistoryButton.css'

const HISTORY_PAGE_SIZE = 5
const SCROLL_LOAD_THRESHOLD = 8

export interface PlaneChatThreadHistoryButtonProps {
  threads: readonly AgentThread[]
  activeThreadId: string
  runningThreadIds: readonly string[]
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

/** Popover paginado con todas las conversaciones del agente. */
export const PlaneChatThreadHistoryButton: React.FC<PlaneChatThreadHistoryButtonProps> = ({
  threads,
  activeThreadId,
  runningThreadIds,
  threadSelectionLocked = false,
  onSelectThread,
}) => {
  const { t } = useT()
  const panelId = `thread-history-panel-${useId().replace(/:/g, '')}`
  const triggerRef = useRef<HTMLSpanElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
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
      setOpen(nowOpen)
      if (nowOpen) {
        setVisibleLimit(HISTORY_PAGE_SIZE)
        const trigger = triggerRef.current?.getBoundingClientRect()
        if (trigger) {
          const { top, bottom, maxHeight } = panelPlacement(trigger)
          setBox({
            top,
            bottom,
            left: 'auto',
            right: window.innerWidth - trigger.right,
            maxHeight,
          })
        }
      }
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  }, [])

  const close = (): void => {
    setOpen(false)
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
    <>
      <span ref={triggerRef}>
        <Tooltip content={t('agentPane.threadHistory')} hint={t('agentPane.threadHistoryHint')}>
          <Button
            variant="icon"
            size="sm"
            aria-label={t('agentPane.threadHistoryAria')}
            aria-haspopup="listbox"
            aria-expanded={open}
            popovertarget={panelId}
          >
            <Icon name="history" size={13} />
          </Button>
        </Tooltip>
      </span>

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
        <div className="plane-chat-thread-history__header">{t('agentPane.threadHistory')}</div>
        <div className="plane-chat-thread-history__list">
          {items.map(thread => {
            const isActive = thread.id === activeThreadId
            const isRunning = runningThreadIds.includes(thread.id)
            const title = thread.title || t('agentPane.threadUntitled')
            const switchDisabled = threadSelectionLocked && !isActive

            return (
              <button
                key={thread.id}
                type="button"
                role="option"
                aria-selected={isActive}
                className={[
                  'plane-chat-thread-history__row',
                  isActive ? 'plane-chat-thread-history__row--active' : '',
                ].filter(Boolean).join(' ')}
                disabled={switchDisabled}
                onPointerDown={event => {
                  event.preventDefault()
                }}
                onClick={event => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!switchDisabled && !isActive) pick(thread.id)
                }}
              >
                <span className="plane-chat-thread-history__check" aria-hidden>
                  {isActive ? <Icon name="check" size={11} /> : null}
                </span>
                <span className="plane-chat-thread-history__body">
                  {isRunning ? <PlaneBusyDot size="sm" /> : null}
                  <span className="plane-chat-thread-history__label">{title}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
