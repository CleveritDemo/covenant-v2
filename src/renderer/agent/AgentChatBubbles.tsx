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
import { isAiMessagesNearBottom, scrollAiMessagesToBottom } from '../components/ai/aiMessagesScroll'
import { AiMarkdown } from '../components/AiMarkdown'
import { AiCodeBlock } from '../components/AiCodeBlock'
import { IaNucleus } from './IaNucleus'

/** Primer lote (cola) y cada ampliación al acercarse al tope. */
const CHAT_BATCH_SIZE = 10
/** px desde el tope para pedir el lote anterior. */
const LOAD_EARLIER_TOP_PX = 80

type AgentBodySegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

function splitAgentBody(raw: string): AgentBodySegment[] {
  const segments: AgentBodySegment[] = []
  const pushText = (chunk: string): void => {
    if (chunk.trim()) segments.push({ type: 'text', content: chunk.replace(/\s+$/, '') })
  }
  let i = 0
  while (i < raw.length) {
    const fence = raw.indexOf('```', i)
    if (fence === -1) {
      pushText(raw.slice(i))
      break
    }
    if (fence > i) pushText(raw.slice(i, fence))
    const langEnd = raw.indexOf('\n', fence + 3)
    if (langEnd === -1) {
      segments.push({ type: 'code', lang: raw.slice(fence + 3).trim(), content: '' })
      break
    }
    const lang = raw.slice(fence + 3, langEnd).trim()
    const contentStart = langEnd + 1
    const close = raw.indexOf('\n```', contentStart)
    if (close === -1) {
      segments.push({ type: 'code', lang, content: raw.slice(contentStart) })
      break
    }
    segments.push({ type: 'code', lang, content: raw.slice(contentStart, close).replace(/\s+$/, '') })
    i = close + 4
  }
  return segments
}

const AssistantBody: React.FC<{ content: string; live: boolean }> = ({ content, live }) => {
  const segments = splitAgentBody(content)
  return (
    <div className={live ? 'agent-pane__stream' : undefined}>
      {segments.map((segment, index) =>
        segment.type === 'code' ? (
          <AiCodeBlock
            key={index}
            lang={segment.lang}
            content={segment.content}
            isStreaming={live}
            isLastSegment={index === segments.length - 1}
            onInsert={() => undefined}
          />
        ) : (
          <AiMarkdown
            key={index}
            content={segment.content}
            showCursor={live && index === segments.length - 1}
          />
        ),
      )}
    </div>
  )
}

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
  onEnteringAnimationEnd?: (id: string) => void
  onMaterializingAnimationEnd?: (id: string) => void
}

const AgentChatBubbleRow: React.FC<AgentChatBubbleRowProps> = ({
  message,
  busy,
  activeAssistantId,
  enteringIds,
  materializingIds,
  settlingId,
  onEnteringAnimationEnd,
  onMaterializingAnimationEnd,
}) => {
  const live = busy &&
    message.role === 'assistant' &&
    message.id === activeAssistantId
  const landing = !live && settlingId === message.id
  const entering = enteringIds.has(message.id)
  const materializing = materializingIds.has(message.id)
  const nucleusOnly = live && !message.content

  // Sin animación de zoom: liberar flags al montar (animationEnd ya no corre).
  useEffect(() => {
    if (!entering) return
    onEnteringAnimationEnd?.(message.id)
  }, [entering, message.id, onEnteringAnimationEnd])

  useEffect(() => {
    if (!materializing) return
    onMaterializingAnimationEnd?.(message.id)
  }, [materializing, message.id, onMaterializingAnimationEnd])

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
      <div
        className={[
          `agent-pane__bubble agent-pane__bubble--${message.role}`,
          live ? 'agent-pane__bubble--live' : '',
          landing ? 'agent-pane__bubble--landing' : '',
          nucleusOnly ? 'agent-pane__bubble--nucleus' : '',
          materializing ? 'agent-pane__bubble--materialize' : '',
        ].filter(Boolean).join(' ')}
      >
        {message.role === 'user' && message.images && message.images.length > 0 && (
          <div className="agent-pane__bubble-images">
            {message.images.map((image, index) => (
              <img
                key={`${message.id}-img-${index}`}
                className="agent-pane__bubble-image"
                src={image.dataUrl}
                alt={image.name}
                title={image.name}
              />
            ))}
          </div>
        )}
        {message.content
          ? (
              message.role === 'assistant'
                ? <AssistantBody content={message.content} live={live} />
                : (
                    <span className={live ? 'agent-pane__stream' : undefined}>
                      {message.content}
                      {live && <span className="agent-pane__caret" aria-hidden="true" />}
                    </span>
                  )
            )
          : live
            ? (
                <span className="agent-pane__nucleus">
                  <IaNucleus size="solo" />
                </span>
              )
            : ''}
      </div>
    </div>
  )
}

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

/** Lista de burbujas user/assistant + Nucleus de espera (panel / plano). */
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
  const rowsLengthRef = useRef(rows.length)
  const visibleCountRef = useRef(visibleCount)
  const loadingEarlierRef = useRef(false)
  /** Evita que el trim del jump-to-end dispare load-earlier (scrollTop≈0). */
  const jumpToEndRef = useRef(false)
  const pendingScrollAdjustRef = useRef<{ prevHeight: number; prevTop: number } | null>(null)
  visibleCountRef.current = visibleCount

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
    jumpToEndRef.current = true
    const target = Math.min(CHAT_BATCH_SIZE, rowsLengthRef.current)
    flushSync(() => {
      setVisibleCount(target)
    })
    const el = scrollRef?.current
    if (el) scrollAiMessagesToBottom(el, true)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight
        jumpToEndRef.current = false
      })
    })
  }, [scrollRef])

  useImperativeHandle(ref, () => ({ scrollToEnd }), [scrollToEnd])

  const rowProps = {
    busy,
    activeAssistantId,
    enteringIds,
    materializingIds,
    settlingId,
    onEnteringAnimationEnd,
    onMaterializingAnimationEnd,
  }

  const rootClass = [
    'agent-chat-bubbles',
    surface === 'plane' ? 'agent-chat-bubbles--plane' : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={rootClass}>
      {visibleRows.map(message => (
        <AgentChatBubbleRow key={message.id} message={message} {...rowProps} />
      ))}
    </div>
  )
})
