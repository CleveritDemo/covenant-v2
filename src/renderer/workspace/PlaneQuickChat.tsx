import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import { useT } from '@i18n/useT'
import { Button, Icon } from '../components/ui'
import { AgentChatBubbles } from '../agent/AgentChatBubbles'
import '../agent/AgentPane.css'
import '../agent/AgentChatBubbles.css'
import './PlaneQuickChat.css'

export interface PlaneQuickChatProps {
  messages: AgentChatEntry[]
  busy: boolean
  activity?: string
  activeAssistantId: string | null
  visible: boolean
  /** Color del agente activo (acentos del chat). */
  agentColor: string
  fontSize?: number
  enteringIds?: readonly string[]
  materializingIds?: readonly string[]
  settlingId?: string | null
  /** true solo mientras hay burbujas visibles en el plano. */
  onShowingChange?: (showing: boolean) => void
  /** Al ocultar el chat del plano (p. ej. deseleccionar el agente en el composer). */
  onDismiss?: () => void
}

/** Conversación user/assistant del plano (sin system). */
function planeConversation(messages: AgentChatEntry[]): AgentChatEntry[] {
  return messages.filter(entry => entry.role === 'user' || entry.role === 'assistant')
}

/**
 * Chat del plano: burbujas del AgentPane.
 * Sin avatar; el agente se elige en el composer.
 */
export const PlaneQuickChat: React.FC<PlaneQuickChatProps> = ({
  messages,
  busy,
  activity = '',
  activeAssistantId,
  visible,
  agentColor,
  fontSize = 13,
  enteringIds = [],
  materializingIds = [],
  settlingId = null,
  onShowingChange,
  onDismiss,
}) => {
  const { t } = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  /** Solo oculta en el plano; no borra el chat del AgentPane. */
  const [dismissedTipId, setDismissedTipId] = useState<string | null>(null)
  const [enterDone, setEnterDone] = useState(false)
  const [appearSession, setAppearSession] = useState(0)
  const [nearBottom, setNearBottom] = useState(true)
  const prevShowRef = useRef(false)

  const conversation = useMemo(() => planeConversation(messages), [messages])
  const tipId = conversation[conversation.length - 1]?.id ?? null
  const dismissed = Boolean(tipId && tipId === dismissedTipId)
  const show = visible && !dismissed && (conversation.length > 0 || busy)
  const enteringSet = useMemo(() => new Set(enteringIds), [enteringIds])
  const materializingSet = useMemo(() => new Set(materializingIds), [materializingIds])

  useEffect(() => {
    onShowingChange?.(show)
    return () => { onShowingChange?.(false) }
  }, [onShowingChange, show])

  // Al dejar de ser elegible (deselección / ventana abierta), limpia el dismiss local.
  useEffect(() => {
    if (!visible) setDismissedTipId(null)
  }, [visible])

  const scrollToBottom = (): void => {
    const node = scrollRef.current
    if (!node) return
    node.scrollTop = node.scrollHeight
    setNearBottom(true)
  }

  // Cada vez que el chat pasa a visible: nueva sesión de aparición.
  useEffect(() => {
    if (show && !prevShowRef.current) {
      setAppearSession(n => n + 1)
      setEnterDone(false)
    }
    prevShowRef.current = show
  }, [show])

  useEffect(() => {
    if (!show || !nearBottom) return
    scrollToBottom()
  }, [show, conversation, busy, activeAssistantId, nearBottom])

  if (!show) return null

  const activityText = activity.trim()
  const appearing = !enterDone

  return (
    <div
      className={[
        'plane-quick-chat',
        'agent-pane',
        appearing ? 'plane-quick-chat--appearing' : '',
      ].filter(Boolean).join(' ')}
      aria-live="polite"
      style={{
        '--agent-chat-font-size': `${fontSize}px`,
        '--agent-beam': agentColor,
      } as React.CSSProperties}
    >
      <div className="plane-quick-chat__dismiss">
        <Button
          variant="icon"
          size="sm"
          aria-label={t('tabs.planeQuickChatDismiss')}
          title={t('tabs.planeQuickChatDismiss')}
          onClick={() => {
            if (tipId) setDismissedTipId(tipId)
            onDismiss?.()
          }}
        >
          <Icon name="close" size={14} aria-hidden />
        </Button>
      </div>
      <div
        key={appearSession}
        className={[
          'plane-quick-chat__enter',
          appearing ? 'plane-quick-chat__enter--active' : '',
        ].filter(Boolean).join(' ')}
        onAnimationEnd={event => {
          if (event.target !== event.currentTarget) return
          if (!event.animationName.includes('plane-quick-chat-reveal')) return
          setEnterDone(true)
        }}
      >
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
