import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import {
  looksLikeDelegationResultFollowUp,
  parseDelegationResultCards,
} from '@shared/delegationResultCards'
import { DelegationResultCard } from './DelegationResultCard'
import { PendingImageThumb } from '../components/PendingImageThumb'
import { useT } from '@i18n/useT'
import { isAiMessagesNearBottom, scrollAiMessagesToBottom } from '../components/ai/aiMessagesScroll'
import { AssistantFormattedBody } from '../components/ai/AssistantFormattedBody'
import { ChatBubble } from '../components/ai/ChatBubble'
import { Gravity } from './Gravity'

/** Primer lote (cola) y cada ampliación al acercarse al tope. */
const CHAT_BATCH_SIZE = 10
/** px desde el tope para pedir el lote anterior. */
const LOAD_EARLIER_TOP_PX = 80
/** Colapsar si el texto supera este tamaño (caracteres). */
const BUBBLE_COLLAPSE_CHARS = 1200
/** Colapsar si el texto supera este número de líneas. */
const BUBBLE_COLLAPSE_LINES = 24

function isLongBubbleContent(content: string): boolean {
  if (content.length > BUBBLE_COLLAPSE_CHARS) return true
  let lines = 1
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++
  }
  return lines > BUBBLE_COLLAPSE_LINES
}

const BubbleBodyInner: React.FC<{
  content: string
  live: boolean
  role: 'user' | 'assistant'
}> = ({ content, live, role }) => {
  // Usuario: texto literal. Nunca AiMarkdown / splitChatSentences.
  if (role === 'user') {
    // Salvo el follow-up de una delegación: ese no lo escribió una persona, lo
    // arma el host, y en crudo se lee como un volcado con los pipes a la vista.
    if (looksLikeDelegationResultFollowUp(content)) {
      const cards = parseDelegationResultCards(content)
      if (cards.length > 0) {
        return (
          <div className="agent-pane__bubble-cards">
            {cards.map((card, index) => (
              <ChatBubble key={card.id || `card-${index}`} variant="assistant" solid>
                <DelegationResultCard data={card} />
              </ChatBubble>
            ))}
          </div>
        )
      }
    }
    return <div className="agent-pane__bubble-plain">{content}</div>
  }
  return (
    <div className={live ? 'agent-pane__stream' : undefined}>
      <AssistantFormattedBody content={content} live={live} />
    </div>
  )
}

const BubbleBody = React.memo(BubbleBodyInner, (prev, next) => {
  if (prev.live || next.live) return false
  return prev.content === next.content && prev.role === next.role
})

function isRenderableChatRow(
  message: AgentChatEntry,
  busy: boolean,
  activeAssistantId: string | null,
): boolean {
  if (message.role === 'system') return false
  const live = busy &&
    message.role === 'assistant' &&
    message.id === activeAssistantId
  if (message.role === 'assistant' && !message.content && !live) return false
  return message.role === 'user' || message.role === 'assistant'
}

const EMPTY_IDS = new Set<string>()

interface AgentChatBubbleRowProps {
  message: AgentChatEntry
  busy: boolean
  activeAssistantId: string | null
  enteringIds: ReadonlySet<string>
  materializingIds: ReadonlySet<string>
  settlingId: string | null
  expanded: boolean
  /** Última fila renderizable: no colapsar (el usuario lee el mensaje actual). */
  isLatestRenderable: boolean
  onToggleExpand: (id: string) => void
  scrollRef?: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement>
  onEnteringAnimationEnd?: (id: string) => void
  onMaterializingAnimationEnd?: (id: string) => void
}

const AgentChatBubbleRowInner: React.FC<AgentChatBubbleRowProps> = ({
  message,
  busy,
  activeAssistantId,
  enteringIds,
  materializingIds,
  settlingId,
  expanded,
  isLatestRenderable,
  onToggleExpand,
  scrollRef,
  onEnteringAnimationEnd,
  onMaterializingAnimationEnd,
}) => {
  const { t } = useT()
  const live = busy &&
    message.role === 'assistant' &&
    message.id === activeAssistantId
  const landing = !live && settlingId === message.id
  const entering = enteringIds.has(message.id)
  const materializing = materializingIds.has(message.id)
  const gravityOnly = live && !message.content
  const canCollapse = !live &&
    !isLatestRenderable &&
    Boolean(message.content) &&
    isLongBubbleContent(message.content)
  const collapsed = canCollapse && !expanded
  const pinBottomAfterExpandRef = useRef(false)

  // Sin animación de zoom: liberar flags al montar (animationEnd ya no corre).
  useEffect(() => {
    if (!entering) return
    onEnteringAnimationEnd?.(message.id)
  }, [entering, message.id, onEnteringAnimationEnd])

  useEffect(() => {
    if (!materializing) return
    onMaterializingAnimationEnd?.(message.id)
  }, [materializing, message.id, onMaterializingAnimationEnd])

  useLayoutEffect(() => {
    if (!pinBottomAfterExpandRef.current) return
    pinBottomAfterExpandRef.current = false
    const el = scrollRef?.current
    if (el) scrollAiMessagesToBottom(el, true)
  }, [expanded, scrollRef])

  const handleToggleExpand = (): void => {
    const el = scrollRef?.current
    if (!expanded && el && isAiMessagesNearBottom(el)) {
      pinBottomAfterExpandRef.current = true
    }
    onToggleExpand(message.id)
  }

  return (
    <div
      className={[
        'agent-pane__row',
        `agent-pane__row--${message.role}`,
        entering ? 'agent-pane__row--enter' : '',
        live ? 'agent-pane__row--live' : '',
        landing ? 'agent-pane__row--landing' : '',
      ].filter(Boolean).join(' ')}
    >
      <ChatBubble
        variant={message.role === 'user' ? 'user' : 'assistant'}
        live={live}
        landing={landing}
        gravity={gravityOnly}
        materialize={materializing}
      >
        {message.role === 'user' && message.images && message.images.length > 0 && (
          <div className="agent-pane__bubble-images">
            {message.images.map((image, index) => (
              <PendingImageThumb
                key={`${message.id}-img-${index}`}
                src={image.dataUrl}
                name={image.name}
              />
            ))}
          </div>
        )}
        {message.content
          ? (
              <>
                <div
                  className={[
                    'agent-pane__bubble-body',
                    collapsed ? 'agent-pane__bubble-body--collapsed' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <BubbleBody
                    content={message.content}
                    live={live}
                    role={message.role === 'user' ? 'user' : 'assistant'}
                  />
                </div>
                {canCollapse && (
                  <button
                    type="button"
                    className="agent-pane__bubble-more"
                    onClick={handleToggleExpand}
                  >
                    {expanded ? t('agentPane.showLess') : t('agentPane.showMore')}
                  </button>
                )}
              </>
            )
          : live
            ? (
                <span className="agent-pane__gravity">
                  <Gravity size="solo" />
                </span>
              )
            : ''}
      </ChatBubble>
    </div>
  )
}

const AgentChatBubbleRow = React.memo(AgentChatBubbleRowInner, (prev, next) => {
  const prevLive = prev.busy &&
    prev.message.role === 'assistant' &&
    prev.message.id === prev.activeAssistantId
  const nextLive = next.busy &&
    next.message.role === 'assistant' &&
    next.message.id === next.activeAssistantId
  if (prevLive || nextLive) return false
  if (prev.message.id !== next.message.id) return false
  if (prev.message.content !== next.message.content) return false
  if (prev.message.role !== next.message.role) return false
  if (prev.expanded !== next.expanded) return false
  if (prev.isLatestRenderable !== next.isLatestRenderable) return false
  if (prev.settlingId !== next.settlingId &&
    (prev.settlingId === prev.message.id || next.settlingId === next.message.id)) {
    return false
  }
  if (prev.enteringIds.has(prev.message.id) !== next.enteringIds.has(next.message.id)) return false
  if (prev.materializingIds.has(prev.message.id) !== next.materializingIds.has(next.message.id)) {
    return false
  }
  return true
})

export interface AgentChatBubblesHandle {
  /** Ir al final real del scroll del chat. */
  scrollToEnd: () => void
}

export interface AgentChatBubblesProps {
  messages: AgentChatEntry[]
  busy: boolean
  activeAssistantId: string | null
  enteringIds?: ReadonlySet<string>
  materializingIds?: ReadonlySet<string>
  settlingId?: string | null
  onEnteringAnimationEnd?: (id: string) => void
  onMaterializingAnimationEnd?: (id: string) => void
  /** `plane`: burbujas sueltas en el plano, sin marco de panel. */
  surface?: 'pane' | 'plane'
  /** Contenedor con scroll (`.agent-pane__messages`). */
  scrollRef?: React.RefObject<HTMLElement | null> | React.RefObject<HTMLElement>
}

/** Lista de burbujas user/assistant + Gravity de espera (panel / plano). */
export const AgentChatBubbles = forwardRef<AgentChatBubblesHandle, AgentChatBubblesProps>(function AgentChatBubbles(
  {
    messages,
    busy,
    activeAssistantId,
    enteringIds = EMPTY_IDS,
    materializingIds = EMPTY_IDS,
    settlingId = null,
    onEnteringAnimationEnd,
    onMaterializingAnimationEnd,
    surface = 'pane',
    scrollRef,
  },
  ref,
) {
  const rows = useMemo(
    () => messages.filter(message => isRenderableChatRow(message, busy, activeAssistantId)),
    [messages, busy, activeAssistantId],
  )

  /** Cuántos mensajes desde el final están montados. */
  const [visibleCount, setVisibleCount] = useState(() => Math.min(CHAT_BATCH_SIZE, rows.length))
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => EMPTY_IDS)
  const rowsLengthRef = useRef(rows.length)
  const visibleCountRef = useRef(visibleCount)
  const loadingEarlierRef = useRef(false)
  /** Evita que el trim del jump-to-end dispare load-earlier (scrollTop≈0). */
  const jumpToEndRef = useRef(false)
  const pendingScrollAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null)
  const mountedRef = useRef(true)
  visibleCountRef.current = visibleCount

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Avance del chat: si el usuario sigue la cola, quedarse en los últimos N.
  // Si subió a leer historial, conservar lo ya cargado + los nuevos.
  useEffect(() => {
    const prevLen = rowsLengthRef.current
    const nextLen = rows.length
    rowsLengthRef.current = nextLen
    setVisibleCount(current => {
      if (nextLen <= CHAT_BATCH_SIZE) return nextLen
      if (prevLen === 0) return CHAT_BATCH_SIZE
      if (nextLen > prevLen) {
        const el = scrollRef?.current
        const following = !el || isAiMessagesNearBottom(el)
        if (following) return CHAT_BATCH_SIZE
        return Math.min(nextLen, current + (nextLen - prevLen))
      }
      return Math.min(current, nextLen)
    })
  }, [rows.length, scrollRef])

  const hiddenCount = Math.max(0, rows.length - visibleCount)
  const visibleRows = hiddenCount > 0 ? rows.slice(hiddenCount) : rows

  const loadEarlierBatch = useCallback((): void => {
    if (jumpToEndRef.current || loadingEarlierRef.current) return
    const el = scrollRef?.current
    const hidden = rowsLengthRef.current - visibleCountRef.current
    if (!el || hidden <= 0) return
    loadingEarlierRef.current = true
    pendingScrollAdjustRef.current = {
      prevHeight: el.scrollHeight,
      prevTop: el.scrollTop,
    }
    setVisibleCount(current => Math.min(rowsLengthRef.current, current + CHAT_BATCH_SIZE))
  }, [scrollRef])

  // Tras prepender, conservar el ancla visual.
  useLayoutEffect(() => {
    const pending = pendingScrollAdjustRef.current
    const el = scrollRef?.current
    if (!pending || !el) {
      loadingEarlierRef.current = false
      return
    }
    pendingScrollAdjustRef.current = null
    const delta = el.scrollHeight - pending.prevHeight
    el.scrollTop = pending.prevTop + delta
    loadingEarlierRef.current = false
  }, [visibleRows.length, scrollRef])

  // Si el lote no llena el viewport, no hay scroll → cargar más hasta poder scrollear o agotar.
  useLayoutEffect(() => {
    const el = scrollRef?.current
    if (!el) return
    if (jumpToEndRef.current) return
    if (rows.length <= visibleCount) return
    if (el.scrollHeight > el.clientHeight + 1) return
    // Solo auto-rellenar si el usuario está arriba (leyendo historial), no en la cola.
    if (isAiMessagesNearBottom(el)) return
    loadEarlierBatch()
  }, [loadEarlierBatch, rows.length, scrollRef, visibleCount, visibleRows.length])

  useEffect(() => {
    const el = scrollRef?.current
    if (!el) return

    const onScroll = (): void => {
      if (jumpToEndRef.current) return
      if (el.scrollTop > LOAD_EARLIER_TOP_PX) return
      // Sin overflow, scrollTop es 0 y estamos “abajo”: no reabrir el historial.
      if (isAiMessagesNearBottom(el)) return
      loadEarlierBatch()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [loadEarlierBatch, scrollRef])

  const scrollToEnd = useCallback((): void => {
    // Igual que al recibir mensajes en cola: montar solo el último lote.
    // queueMicrotask: evita flushSync durante el commit de un useEffect caller.
    jumpToEndRef.current = true
    const target = Math.min(CHAT_BATCH_SIZE, rowsLengthRef.current)
    queueMicrotask(() => {
      if (!mountedRef.current) return
      flushSync(() => {
        setVisibleCount(target)
      })
      const el = scrollRef?.current
      if (el) scrollAiMessagesToBottom(el, true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!mountedRef.current) return
          if (el) el.scrollTop = el.scrollHeight
          jumpToEndRef.current = false
        })
      })
    })
  }, [scrollRef])

  useImperativeHandle(ref, () => ({ scrollToEnd }), [scrollToEnd])

  const onToggleExpand = useCallback((id: string): void => {
    setExpandedIds(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const rowProps = {
    busy,
    activeAssistantId,
    enteringIds,
    materializingIds,
    settlingId,
    scrollRef,
    onToggleExpand,
    onEnteringAnimationEnd,
    onMaterializingAnimationEnd,
  }

  const rootClass = [
    'agent-chat-bubbles',
    surface === 'plane' ? 'agent-chat-bubbles--plane' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      {visibleRows.map((message, index) => (
        <AgentChatBubbleRow
          key={message.id}
          message={message}
          expanded={expandedIds.has(message.id)}
          isLatestRenderable={index === visibleRows.length - 1}
          {...rowProps}
        />
      ))}
    </div>
  )
})
