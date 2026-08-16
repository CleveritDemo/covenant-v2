import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import {
  paginateThreadHistory,
  threadHistoryCandidates,
  type AgentThread,
} from '@shared/agentThreads'
import { resolveThreadChipActivityDot } from '../agent/paneWorkActive'
import { PlaneBusyDot } from '../components/ui/PlaneBusyDot'
import './PlaneChatThreadHistoryButton.css'

const HISTORY_PAGE_SIZE = 5
const SCROLL_LOAD_THRESHOLD = 8
const HOVER_OPEN_DELAY_MS = 90
const HOVER_CLOSE_DELAY_MS = 160
const PANEL_CLOSE_ANIM_MS = 180

export interface PlaneChatThreadHistoryAnchorProps {
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFocusCapture: () => void
  onBlurCapture: (event: React.FocusEvent<HTMLElement>) => void
}

export interface PlaneChatThreadHistoryButtonProps {
  panelId: string
  /** Ancla de posición del popover (chip del thread activo). */
  triggerRef: React.RefObject<HTMLElement | null>
  /** Zona hover/focus del chip activo (render prop). */
  anchor: (props: PlaneChatThreadHistoryAnchorProps) => React.ReactNode
  threads: readonly AgentThread[]
  activeThreadId: string
  runningThreadIds: readonly string[]
  awaitingDelegations?: boolean
  awaitingDelegationThreadIds?: readonly string[]
  paneCliBusy?: boolean
  threadSelectionLocked?: boolean
  onSelectThread: (threadId: string) => void
  onOpenChange?: (open: boolean) => void
}

function panelPlacement(trigger: DOMRect): {
  top: number | 'auto'
  bottom: number | 'auto'
  maxHeight: number
} {
  const GAP = 3
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
  anchor,
  threads,
  activeThreadId,
  runningThreadIds,
  awaitingDelegations = false,
  awaitingDelegationThreadIds,
  paneCliBusy = false,
  threadSelectionLocked = false,
  onSelectThread,
  onOpenChange,
}) => {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)
  const [visibleLimit, setVisibleLimit] = useState(HISTORY_PAGE_SIZE)
  const [box, setBox] = useState<React.CSSProperties>({})
  const [closing, setClosing] = useState(false)
  const openTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const closeAnimTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const isOpenRef = useRef(false)

  const candidates = useMemo(
    () => threadHistoryCandidates(threads, activeThreadId, runningThreadIds),
    [threads, activeThreadId, runningThreadIds],
  )

  const { items, hasMore } = useMemo(
    () => paginateThreadHistory(candidates, visibleLimit),
    [candidates, visibleLimit],
  )

  const syncPanelPosition = useCallback((): void => {
    const trigger = triggerRef.current?.getBoundingClientRect()
    const panelEl = panelRef.current
    if (!trigger || !panelEl) return
    const { top, bottom, maxHeight } = panelPlacement(trigger)
    const measuredWidth = panelEl.getBoundingClientRect().width
    const layoutWidth = Math.max(measuredWidth, trigger.width)
    setBox({
      top,
      bottom,
      left: centeredPanelLeft(trigger, layoutWidth),
      right: 'auto',
      minWidth: trigger.width,
      maxHeight,
    })
  }, [triggerRef])

  const syncPanelPositionAfterLayout = useCallback((): void => {
    requestAnimationFrame(() => {
      syncPanelPosition()
      requestAnimationFrame(syncPanelPosition)
    })
  }, [syncPanelPosition])

  const openPanel = useCallback((): void => {
    const panel = panelRef.current
    if (!panel || isOpenRef.current) return
    panel.classList.add('plane-chat-thread-history__panel--open')
    try {
      if (typeof panel.showPopover === 'function') panel.showPopover()
    } catch {
      /* popover no soportado */
    }
    isOpenRef.current = true
    setClosing(false)
    onOpenChange?.(true)
    setVisibleLimit(HISTORY_PAGE_SIZE)
    requestAnimationFrame(syncPanelPositionAfterLayout)
  }, [onOpenChange, syncPanelPositionAfterLayout])

  const closePanel = useCallback((animated = true): void => {
    const panel = panelRef.current
    if (!panel || !isOpenRef.current) return

    const finishClose = (): void => {
      panel.classList.remove('plane-chat-thread-history__panel--open')
      try {
        if (typeof panel.hidePopover === 'function') panel.hidePopover()
      } catch {
        /* popover ya cerrado / no soportado */
      }
      setClosing(false)
      isOpenRef.current = false
      onOpenChange?.(false)
    }

    if (!animated) {
      finishClose()
      return
    }

    setClosing(true)
    closeAnimTimerRef.current = window.setTimeout(finishClose, PANEL_CLOSE_ANIM_MS)
  }, [onOpenChange])

  const cancelScheduledOpen = useCallback((): void => {
    if (openTimerRef.current !== undefined) {
      window.clearTimeout(openTimerRef.current)
      openTimerRef.current = undefined
    }
  }, [])

  const cancelScheduledClose = useCallback((): void => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = undefined
    }
    if (closeAnimTimerRef.current !== undefined) {
      window.clearTimeout(closeAnimTimerRef.current)
      closeAnimTimerRef.current = undefined
    }
    setClosing(false)
  }, [])

  const scheduleOpen = useCallback((): void => {
    cancelScheduledClose()
    if (isOpenRef.current) return
    cancelScheduledOpen()
    openTimerRef.current = window.setTimeout(() => {
      openTimerRef.current = undefined
      openPanel()
    }, HOVER_OPEN_DELAY_MS)
  }, [cancelScheduledClose, cancelScheduledOpen, openPanel])

  const scheduleClose = useCallback((): void => {
    cancelScheduledOpen()
    if (!isOpenRef.current) return
    if (closeTimerRef.current !== undefined) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = undefined
      closePanel(true)
    }, HOVER_CLOSE_DELAY_MS)
  }, [cancelScheduledOpen, closePanel])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const onToggle = (event: Event): void => {
      const nowOpen = (event as ToggleEvent).newState === 'open'
      isOpenRef.current = nowOpen
      onOpenChange?.(nowOpen)
      if (nowOpen) {
        panel.classList.add('plane-chat-thread-history__panel--open')
        setVisibleLimit(HISTORY_PAGE_SIZE)
        requestAnimationFrame(syncPanelPositionAfterLayout)
        return
      }
      panel.classList.remove('plane-chat-thread-history__panel--open')
      setClosing(false)
    }
    panel.addEventListener('toggle', onToggle)
    return () => panel.removeEventListener('toggle', onToggle)
  }, [onOpenChange, syncPanelPositionAfterLayout])

  const onBlurCapture = useCallback((event: React.FocusEvent<HTMLElement>): void => {
    const panel = panelRef.current
    const next = event.relatedTarget
    if (next instanceof Node && panel?.contains(next)) return
    scheduleClose()
  }, [scheduleClose])

  const anchorProps = useMemo<PlaneChatThreadHistoryAnchorProps>(() => ({
    onMouseEnter: scheduleOpen,
    onMouseLeave: scheduleClose,
    onFocusCapture: scheduleOpen,
    onBlurCapture,
  }), [onBlurCapture, scheduleClose, scheduleOpen])

  useEffect(() => () => {
    cancelScheduledOpen()
    cancelScheduledClose()
  }, [cancelScheduledClose, cancelScheduledOpen])

  useEffect(() => {
    if (!isOpenRef.current) return
    syncPanelPositionAfterLayout()
  }, [items.length, syncPanelPositionAfterLayout])

  const close = (): void => {
    cancelScheduledOpen()
    cancelScheduledClose()
    closePanel(false)
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
      {anchor(anchorProps)}
    <div
      ref={panelRef}
      id={panelId}
      popover="manual"
      className={[
        'plane-chat-thread-history__panel',
        closing ? 'plane-chat-thread-history__panel--closing' : '',
      ].filter(Boolean).join(' ')}
      style={box}
      role="listbox"
      tabIndex={-1}
      aria-label={t('agentPane.threadHistoryAria')}
      onMouseEnter={cancelScheduledClose}
      onMouseLeave={scheduleClose}
    >
      <div
        className="plane-chat-thread-history__list"
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
    </div>
    </>
  )
}
