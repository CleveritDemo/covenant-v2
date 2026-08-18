import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui'
import { AgentChatBubbles, type AgentChatBubblesHandle } from '../agent/AgentChatBubbles'
import { AgentDelegatingIndicator } from '../agent/AgentDelegatingIndicator'
import { PlaneActivityLine } from './PlaneActivityLine'
import '../agent/AgentPane.css'
import '../agent/AgentChatBubbles.css'
import './PlaneQuickChat.css'

export interface PlaneQuickChatProps {
  messages: AgentChatEntry[]
  busy: boolean
  activity?: string
  activityKey?: string
  activityStartedAtMs?: number
  awaitingDelegations?: boolean
  orchestrationAwaiting?: OrchestrationAwaitingView | null
  activeAssistantId: string | null
  fontSize?: number
  enteringIds?: readonly string[]
  materializingIds?: readonly string[]
  settlingId?: string | null
  /** true solo mientras hay burbujas visibles en el plano. */
  onShowingChange?: (showing: boolean) => void
  /** Stop por fila en Waiting (solo esa delegación). */
  onAbortDelegation?: (delegationId: string) => void
  projectAgents?: ProjectAgentDefinition[]
  onInsertCommand?: (cmd: string) => void
}

/** Conversación user/assistant del plano (sin system). */
function planeConversation(messages: AgentChatEntry[]): AgentChatEntry[] {
  return messages.filter(entry => entry.role === 'user' || entry.role === 'assistant')
}

/**
 * Chat del plano: burbujas del AgentPane.
 * El padre solo lo monta cuando hay chat visible y con `key` del agente.
 */
export const PlaneQuickChat: React.FC<PlaneQuickChatProps> = ({
  messages,
  busy,
  activity = '',
  activityKey = '',
  activityStartedAtMs = 0,
  awaitingDelegations = false,
  orchestrationAwaiting = null,
  activeAssistantId,
  fontSize = 13,
  enteringIds = [],
  materializingIds = [],
  settlingId = null,
  onShowingChange,
  onAbortDelegation,
  projectAgents = [],
  onInsertCommand,
}) => {
  const { t } = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const bubblesRef = useRef<AgentChatBubblesHandle>(null)
  const [nearBottom, setNearBottom] = useState(true)

  const conversation = useMemo(() => planeConversation(messages), [messages])
  const enteringSet = useMemo(() => new Set(enteringIds), [enteringIds])
  const materializingSet = useMemo(() => new Set(materializingIds), [materializingIds])

  // Montado no es lo mismo que visible: el chat se monta con el agente abierto
  // aunque su conversación esté vacía, y ahí no debe pintar nada ni apagar la
  // gravedad de reposo del plano.
  const hasContent = conversation.length > 0
    || busy
    || awaitingDelegations
    || Boolean(orchestrationAwaiting)
    || activity.trim() !== ''

  useEffect(() => {
    if (!hasContent) {
      onShowingChange?.(false)
      return undefined
    }
    onShowingChange?.(true)
    return () => { onShowingChange?.(false) }
  }, [onShowingChange, hasContent])

  const scrollToBottom = useCallback((): void => {
    bubblesRef.current?.scrollToEnd()
    setNearBottom(true)
  }, [])

  useEffect(() => {
    if (!nearBottom) return
    scrollToBottom()
  }, [
    conversation,
    busy,
    awaitingDelegations,
    orchestrationAwaiting,
    activeAssistantId,
    nearBottom,
    scrollToBottom,
  ])

  const activityText = activity.trim()
  const waveLabel = orchestrationAwaiting
    ? t('agentPane.awaitingWaveProgress', {
      done: orchestrationAwaiting.done,
      total: orchestrationAwaiting.total,
    })
    : t('agentPane.delegatingTitle')

  if (!hasContent) return null

  return (
    <div className="plane-quick-chat-shell" aria-live="polite">
      <div
        className="plane-quick-chat agent-pane"
        style={{
          '--agent-chat-font-size': `${fontSize}px`,
        } as React.CSSProperties}
      >
      <div className="plane-quick-chat__enter">
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
                ref={bubblesRef}
                messages={conversation}
                busy={busy}
                activeAssistantId={activeAssistantId}
                enteringIds={enteringSet}
                materializingIds={materializingSet}
                settlingId={settlingId}
                surface="pane"
                scrollRef={scrollRef}
                projectAgents={projectAgents}
                onInsertCommand={onInsertCommand}
              />
              {awaitingDelegations ? (
                <div className="plane-quick-chat__delegating">
                  <AgentDelegatingIndicator
                    label={waveLabel}
                    sublabel={
                      orchestrationAwaiting
                        ? t('agentPane.awaitingWaveSublabel')
                        : t('agentPane.delegatingSubtitle')
                    }
                    items={(orchestrationAwaiting?.items ?? []).map(item => ({
                      id: item.delegationId,
                      label: item.agentLabel,
                      status: item.status,
                      statusLabel: item.status === 'done'
                        ? t('agentPane.awaitingStatusDone')
                        : item.status === 'deferred'
                          ? t('agentPane.awaitingStatusDeferred')
                        : t('agentPane.awaitingStatusRunning'),
                      ...(item.worktreeHint ? { worktreeHint: item.worktreeHint } : {}),
                    }))}
                    stopItemLabel={t('agentPane.awaitingStopSpecialist')}
                    onStopItem={onAbortDelegation}
                  />
                </div>
              ) : (busy || activityText !== '') ? (
                <PlaneActivityLine
                  label={activityText}
                  activityKey={activityKey}
                  startedAtMs={activityStartedAtMs}
                />
              ) : null}
            </div>
            {!nearBottom && conversation.length > 0 && (
              <button
                type="button"
                className="agent-pane__scroll-bottom"
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
    </div>
  )
}
