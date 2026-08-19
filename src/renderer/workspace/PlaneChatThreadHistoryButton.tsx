import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useT } from '@i18n/useT'
import type { TFunction } from 'i18next'
import type {
  OrchestrationAwaitingGroupView,
  OrchestrationAwaitingItemView,
  OrchestrationAwaitingView,
} from '@shared/orchestrationAwaiting'
import {
  paginateThreadHistory,
  splitThreadHistoryCandidates,
  threadDisplayTitleOr,
  type AgentThread,
} from '@shared/agentThreads'
import { resolveThreadChipActivityDot, type PlaneActivityDotKind } from '../agent/paneWorkActive'
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
  /** Ola del orquestador: filas de delegación antes del historial humano. */
  orchestrationAwaiting?: OrchestrationAwaitingView | null
  /** Petición del usuario por hilo en curso (carril de delegación). */
  runningThreadActivities?: Readonly<Record<string, string>>
  paneCliBusy?: boolean
  threadSelectionLocked?: boolean
  onSelectThread: (threadId: string) => void
  onOpenChange?: (open: boolean) => void
  /** Desde acciones derechas: el panel se desplaza hacia el centro del plano. */
  panelAlign?: 'trigger-center' | 'toward-center'
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

/** Panel anclado al trigger lateral derecho; crece hacia el centro del plano. */
function panelLeftTowardCenter(trigger: DOMRect, panelWidth: number): number {
  const inset = 8
  const gap = 6
  const ideal = trigger.left + trigger.width / 2 - panelWidth
  const anchoredLeft = trigger.left - panelWidth - gap
  const left = ideal <= anchoredLeft ? ideal : anchoredLeft
  return Math.max(inset, Math.min(left, window.innerWidth - panelWidth - inset))
}

function awaitingGroupTitle(group: OrchestrationAwaitingGroupView, t: TFunction): string {
  return group.title ?? t('agentPane.delegationGroup', { n: group.index })
}

function renderOrchestrationRow(item: OrchestrationAwaitingItemView): React.ReactNode {
  return (
    <div
      key={item.delegationId}
      className="plane-chat-thread-history__row plane-chat-thread-history__row--static"
      role="presentation"
    >
      <PlaneBusyDot
        size="sm"
        variant={
          item.status === 'done'
            ? 'done'
            : item.status === 'deferred'
              ? 'deferred'
              : 'delegating'
        }
      />
      <span className="plane-chat-thread-history__label">{item.agentLabel}</span>
    </div>
  )
}

function renderOrchestrationBlocks(
  awaiting: OrchestrationAwaitingView | null,
  t: TFunction,
): React.ReactNode {
  const items = awaiting?.items ?? []
  const groups = awaiting?.groups ?? []
  if (groups.length >= 2) {
    return groups.map(group => (
      <React.Fragment key={group.jobId || `group-${group.index}`}>
        <div className="plane-chat-thread-history__group" role="presentation">
          {awaitingGroupTitle(group, t)}
        </div>
        {group.items.map(renderOrchestrationRow)}
      </React.Fragment>
    ))
  }
  return items.map(renderOrchestrationRow)
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
  orchestrationAwaiting = null,
  runningThreadActivities = {},
  paneCliBusy = false,
  threadSelectionLocked = false,
  onSelectThread,
  onOpenChange,
  panelAlign = 'trigger-center',
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

  const { delegations, humans } = useMemo(
    () => splitThreadHistoryCandidates(threads, activeThreadId, runningThreadIds),
    [threads, activeThreadId, runningThreadIds],
  )

  const orchestrationItems = orchestrationAwaiting?.items ?? []

  const { items: humanItems, hasMore } = useMemo(
    () => paginateThreadHistory(humans, visibleLimit),
    [humans, visibleLimit],
  )

  const rowCount = orchestrationItems.length + delegations.length + humanItems.length

  const syncPanelPosition = useCallback((): void => {
    const trigger = triggerRef.current?.getBoundingClientRect()
    const panelEl = panelRef.current
    if (!trigger || !panelEl) return
    const { top, bottom, maxHeight } = panelPlacement(trigger)
    const measuredWidth = panelEl.getBoundingClientRect().width
    const layoutWidth = Math.max(measuredWidth, trigger.width)
    const panelLeft = panelAlign === 'toward-center'
      ? panelLeftTowardCenter(trigger, layoutWidth)
      : centeredPanelLeft(trigger, layoutWidth)
    setBox({
      top,
      bottom,
      left: panelLeft,
      right: 'auto',
      minWidth: trigger.width,
      maxHeight,
    })
  }, [panelAlign, triggerRef])

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
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !isOpenRef.current) return
      event.preventDefault()
      event.stopPropagation()
      cancelScheduledOpen()
      cancelScheduledClose()
      closePanel(false)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [cancelScheduledClose, cancelScheduledOpen, closePanel])

  useEffect(() => {
    if (!isOpenRef.current) return
    syncPanelPositionAfterLayout()
  }, [rowCount, syncPanelPositionAfterLayout])

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

  if (threads.length === 0 && orchestrationItems.length === 0) return null

  const renderThreadRow = (thread: AgentThread): React.ReactNode => {
    const rowDot: PlaneActivityDotKind | null = thread.origin === 'delegation'
      ? 'delegating'
      : resolveThreadChipActivityDot(
        thread.id,
        activeThreadId,
        awaitingDelegations,
        runningThreadIds,
        paneCliBusy,
        awaitingDelegationThreadIds,
      )
    const activity = runningThreadActivities[thread.id]?.trim()
    const title = thread.origin === 'delegation'
      ? (activity || t('agentPane.awaitingStatusRunning'))
      : threadDisplayTitleOr(thread.title, t('agentPane.threadUntitled'))
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
  }

  return (
    <>
      {anchor(anchorProps)}
    <div
      ref={panelRef}
      id={panelId}
      popover="manual"
      className={[
        'plane-chat-thread-history__panel',
        panelAlign === 'toward-center' ? 'plane-chat-thread-history__panel--align-center' : '',
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
      {renderOrchestrationBlocks(orchestrationAwaiting, t)}
        {awaitingDelegations
          && orchestrationItems.length === 0
          && delegations.length === 0 ? (
            <div
              className="plane-chat-thread-history__row plane-chat-thread-history__row--static"
              role="presentation"
            >
              <PlaneBusyDot size="sm" variant="delegating" />
              <span className="plane-chat-thread-history__label">
                {t('agentPane.delegatingTitle')}
              </span>
            </div>
          ) : null}
        {delegations.map(renderThreadRow)}
        {humanItems.map(renderThreadRow)}
      </div>
    </div>
    </>
  )
}
