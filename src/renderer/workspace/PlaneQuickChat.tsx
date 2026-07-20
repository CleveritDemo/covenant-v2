import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui'
import { AgentChatBubbles } from '../agent/AgentChatBubbles'
import '../agent/AgentPane.css'
import '../agent/AgentChatBubbles.css'
import './PlaneQuickChat.css'

export interface PlaneQuickChatProps {
  messages: AgentChatEntry[]
  busy: boolean
  activity?: string
  activeAssistantId: string | null
  /** Color del agente activo (acentos del chat). */
  agentColor: string
  fontSize?: number
  enteringIds?: readonly string[]
  materializingIds?: readonly string[]
  settlingId?: string | null
  /** true solo mientras hay burbujas visibles en el plano. */
  onShowingChange?: (showing: boolean) => void
}

/** Conversación user/assistant del plano (sin system). */
function planeConversation(messages: AgentChatEntry[]): AgentChatEntry[] {
  return messages.filter(entry => entry.role === 'user' || entry.role === 'assistant')
}

const ENTER_MS = 720
const ENTER_EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

/**
 * Chat del plano: burbujas del AgentPane.
 * El padre solo lo monta cuando hay chat visible y con `key` del agente.
 * Entrada: Web Animations API (fiable en Electron; CSS filter/overflow fallaban).
 */
export const PlaneQuickChat: React.FC<PlaneQuickChatProps> = ({
  messages,
  busy,
  activity = '',
  activeAssistantId,
  agentColor,
  fontSize = 13,
  enteringIds = [],
  materializingIds = [],
  settlingId = null,
  onShowingChange,
}) => {
  const { t } = useT()
  const enterRef = useRef<HTMLDivElement>(null)
  const bloomRef = useRef<HTMLSpanElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nearBottom, setNearBottom] = useState(true)

  const conversation = useMemo(() => planeConversation(messages), [messages])
  const enteringSet = useMemo(() => new Set(enteringIds), [enteringIds])
  const materializingSet = useMemo(() => new Set(materializingIds), [materializingIds])

  useEffect(() => {
    onShowingChange?.(true)
    return () => { onShowingChange?.(false) }
  }, [onShowingChange])

  // Implosión + fade al montar (misma idea que el morph de PaneWindow).
  useLayoutEffect(() => {
    const node = enterRef.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    node.style.opacity = '0'
    node.style.transform = 'scale(1.45)'
    // Fuerza estilo inicial antes del primer paint animado.
    void node.offsetWidth

    const enter = node.animate(
      [
        { opacity: 0, transform: 'scale(1.45)' },
        { opacity: 1, transform: 'scale(0.98)', offset: 0.72 },
        { opacity: 1, transform: 'scale(1)' },
      ],
      { duration: ENTER_MS, easing: ENTER_EASE, fill: 'forwards' },
    )

    const bloom = bloomRef.current
    const bloomAnim = bloom
      ? bloom.animate(
        [
          { opacity: 0, transform: 'scale(1.4)' },
          { opacity: 0.9, transform: 'scale(1.05)', offset: 0.3 },
          { opacity: 0, transform: 'scale(0.9)' },
        ],
        { duration: ENTER_MS + 120, easing: ENTER_EASE, fill: 'forwards' },
      )
      : null

    const settle = (): void => {
      node.style.opacity = '1'
      node.style.transform = 'none'
      try { enter.cancel() } catch { /* ignore */ }
      try { bloomAnim?.cancel() } catch { /* ignore */ }
      if (bloom) {
        bloom.style.opacity = ''
        bloom.style.transform = ''
      }
    }

    void enter.finished.then(settle).catch(() => { /* cancelled */ })

    return () => {
      try { enter.cancel() } catch { /* ignore */ }
      try { bloomAnim?.cancel() } catch { /* ignore */ }
      node.style.opacity = ''
      node.style.transform = ''
      if (bloom) {
        bloom.style.opacity = ''
        bloom.style.transform = ''
      }
    }
  }, [])

  const scrollToBottom = (): void => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    setNearBottom(true)
  }

  useEffect(() => {
    if (!nearBottom) return
    scrollToBottom()
  }, [conversation, busy, activeAssistantId, nearBottom])

  const activityText = activity.trim()

  return (
    <div
      className="plane-quick-chat agent-pane"
      aria-live="polite"
      style={{
        '--agent-chat-font-size': `${fontSize}px`,
        '--agent-beam': agentColor,
      } as React.CSSProperties}
    >
      <div ref={enterRef} className="plane-quick-chat__enter">
        <span ref={bloomRef} className="plane-quick-chat__bloom" aria-hidden="true" />
        <div className="plane-quick-chat__frame">
          <div className="plane-quick-chat__stream agent-pane__messages-wrap">
            <div
              ref={scrollRef}
              className="plane-quick-chat__scroll agent-pane__messages"
              onScroll={event => {
                const node = event.currentTarget
                const distance = node.scrollHeight - node.scrollTop - node.clientHeight
                setNearBottom(distance < 48)
              }}
            >
              <AgentChatBubbles
                messages={conversation}
                busy={busy}
                activeAssistantId={activeAssistantId}
                enteringIds={enteringSet}
                materializingIds={materializingSet}
                settlingId={settlingId}
                surface="pane"
              />
              {(busy || activityText !== '') && (
                <div
                  className={[
                    'agent-pane__activity',
                    activityText === '' ? 'agent-pane__activity--idle' : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className="agent-pane__activity-dot" aria-hidden="true" />
                  <span className="agent-pane__activity-text" key={activityText || 'idle'}>
                    {activityText === '' ? '\u00A0' : activityText}
                  </span>
                </div>
              )}
            </div>
            {!nearBottom && conversation.length > 0 && (
              <button
                type="button"
                className="agent-pane__scroll-bottom"
                title={t('agentPane.scrollToBottom')}
                aria-label={t('agentPane.scrollToBottom')}
                onClick={scrollToBottom}
              >
                <Icon name="chevron-down" size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
