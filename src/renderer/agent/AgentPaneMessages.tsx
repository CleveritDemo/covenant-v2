import React from 'react'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import type { OrchestrationAwaitingView } from '@shared/orchestrationAwaiting'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'
import { resolveQueuedTurnPreview } from '@shared/queuedTurnPreview'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { AgentChatBubbles, type AgentChatBubblesHandle } from './AgentChatBubbles'
import { AgentDelegatingIndicator } from './AgentDelegatingIndicator'
import { Gravity } from './Gravity'
import { QueuedTurnPreviewLabel } from './QueuedTurnPreviewLabel'
import './AgentChatBubbles.css'

export interface AgentPaneQueuedTurn {
  id: string
  text: string
  images: Array<{
    id: string
    previewUrl: string
    name: string
  }>
  orchestrationFollowUp?: boolean
  delegation?: { id: string; fromPaneId: string; toAgentId: string }
}

export interface AgentPaneMessagesProps {
  scrollRef: React.RefObject<HTMLDivElement>
  bubblesRef?: React.Ref<AgentChatBubblesHandle>
  messages: AgentChatEntry[]
  busy: boolean
  activity: string
  /** Orquestador esperando resultados de sub-agentes. */
  awaitingDelegations: boolean
  orchestrationAwaiting?: OrchestrationAwaitingView | null
  queuedTurns: AgentPaneQueuedTurn[]
  /** Turnos sin delegation/follow-up: con 2+ se ofrece fusionar. */
  mergeableCount: number
  nearBottom: boolean
  activeAssistantId: string | null
  enteringIds: ReadonlySet<string>
  materializingIds: ReadonlySet<string>
  settlingId: string | null
  onEnteringAnimationEnd: (id: string) => void
  onMaterializingAnimationEnd: (id: string) => void
  onRemoveQueuedTurn: (id: string) => void
  onEditQueuedTurn: (id: string) => void
  onMergeQueuedTurns: () => void
  onScrollToBottom: () => void
  /** Stop por fila en Waiting (solo esa delegación). */
  onAbortDelegation?: (delegationId: string) => void
  projectAgents?: ProjectAgentDefinition[]
}

export const AgentPaneMessages: React.FC<AgentPaneMessagesProps> = ({
  scrollRef,
  bubblesRef,
  messages,
  busy,
  activity,
  awaitingDelegations,
  orchestrationAwaiting = null,
  queuedTurns,
  mergeableCount,
  nearBottom,
  activeAssistantId,
  enteringIds,
  materializingIds,
  settlingId,
  onEnteringAnimationEnd,
  onMaterializingAnimationEnd,
  onRemoveQueuedTurn,
  onEditQueuedTurn,
  onMergeQueuedTurns,
  onScrollToBottom,
  onAbortDelegation,
  projectAgents = [],
}) => {
  const { t } = useT()
  const waveLabel = orchestrationAwaiting
    ? t('agentPane.awaitingWaveProgress', {
      done: orchestrationAwaiting.done,
      total: orchestrationAwaiting.total,
    })
    : t('agentPane.delegatingTitle')

  return (
    <div className="agent-pane__messages-wrap">
      <div ref={scrollRef} className="agent-pane__messages">
        {messages.length === 0 && (
          <div className="agent-pane__empty">
            <Gravity size="solo" />
            <strong>{t('agentPane.emptyTitle')}</strong>
            <p>{t('agentPane.empty')}</p>
          </div>
        )}
        <AgentChatBubbles
          ref={bubblesRef}
          messages={messages}
          busy={busy}
          activeAssistantId={activeAssistantId}
          enteringIds={enteringIds}
          materializingIds={materializingIds}
          settlingId={settlingId}
          onEnteringAnimationEnd={onEnteringAnimationEnd}
          onMaterializingAnimationEnd={onMaterializingAnimationEnd}
          surface="pane"
          scrollRef={scrollRef}
          projectAgents={projectAgents}
        />
        {awaitingDelegations ? (
          <div className="agent-pane__delegating">
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
        ) : (busy || activity !== '') && (
          <div
            className={[
              'agent-pane__activity',
              activity === '' ? 'agent-pane__activity--idle' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="agent-pane__activity-dot" aria-hidden="true" />
            <span className="agent-pane__activity-text" key={activity}>
              {activity === '' ? '\u00A0' : activity}
            </span>
          </div>
        )}
        {queuedTurns.length > 0 && (
          <div
            className="agent-pane__queue"
            aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
          >
            {mergeableCount >= 2 && (
              <div className="agent-pane__queue-header">
                <button
                  type="button"
                  className="agent-pane__queue-merge"
                  aria-label={t('agentPane.queueMerge')}
                  onClick={onMergeQueuedTurns}
                >
                  {t('agentPane.queueMerge')}
                </button>
              </div>
            )}
            {queuedTurns.map((item, index) => {
              const preview = resolveQueuedTurnPreview(item, projectAgents)
              const queueText = preview.kind === 'human'
                ? (preview.fallbackText ?? item.text)
                : null
              return (
              <div key={item.id} className="agent-pane__queue-bubble">
                <button
                  type="button"
                  className="agent-pane__queue-open"
                  aria-label={t('agentPane.queueEditHint')}
                  onClick={() => onEditQueuedTurn(item.id)}
                >
                  <span className="agent-pane__queue-pos" aria-hidden="true">{index + 1}</span>
                  {item.images.length > 0 && (
                    <span className="agent-pane__queue-images">
                      {item.images.map(image => (
                        <img
                          key={image.id}
                          className="agent-pane__queue-image"
                          src={image.previewUrl}
                          alt={image.name}
                        />
                      ))}
                    </span>
                  )}
                  {(queueText || preview.kind !== 'human' || item.images.length === 0) && (
                    <span className="agent-pane__queue-text">
                      {preview.kind !== 'human'
                        ? <QueuedTurnPreviewLabel preview={preview} />
                        : (queueText || t('agentPane.imageOnlyMessage'))}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="agent-pane__queue-remove"
                  onClick={() => onRemoveQueuedTurn(item.id)}
                  aria-label={t('agentPane.queueRemove')}
                >
                  ×
                </button>
              </div>
              )
            })}
          </div>
        )}
      </div>
      {!nearBottom && messages.length > 0 && (
        <button
          type="button"
          className="agent-pane__scroll-bottom"
          aria-label={t('agentPane.scrollToBottom')}
          onClick={onScrollToBottom}
        >
          <Icon name="chevron-down" size={16} />
        </button>
      )}
    </div>
  )
}
