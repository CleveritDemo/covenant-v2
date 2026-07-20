import React, { useEffect, useMemo, useRef, useState } from 'react'
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

/**
 * Chat del plano: burbujas del AgentPane.
 * El padre solo lo monta cuando hay chat visible y con `key` del agente.
 * Entrada: CSS keyframes (WAAPI + Strict Mode cancelaba la animación al remount).
 */
export const PlaneQuickChat: React.FC<PlaneQuickChatProps> = ({
  messages,
  busy,
  activity = '',
  activeAssistantId,
  fontSize = 13,
  enteringIds = [],
  materializingIds = [],
  settlingId = null,
  onShowingChange,
}) => {
  const { t } = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [nearBottom, setNearBottom] = useState(true)

  const conversation = useMemo(() => planeConversation(messages), [messages])
  const enteringSet = useMemo(() => new Set(enteringIds), [enteringIds])
  const materializingSet = useMemo(() => new Set(materializingIds), [materializingIds])

  useEffect(() => {
    onShowingChange?.(true)
    return () => { onShowingChange?.(false) }
  }, [onShowingChange])

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
      } as React.CSSProperties}
    >
      <div className="plane-quick-chat__enter">
        <span className="plane-quick-chat__bloom" aria-hidden="true" />
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
