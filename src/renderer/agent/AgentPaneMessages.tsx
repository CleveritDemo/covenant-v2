import React from 'react'
import type { AgentChatEntry } from '@shared/agentCliTypes'
import { useT } from '@i18n/useT'
import { Icon } from '../components/ui/Icon'
import { AgentChatBubbles } from './AgentChatBubbles'
import './AgentChatBubbles.css'

export interface AgentPaneQueuedTurn {
  id: string
  text: string
  images: Array<{
    id: string
    previewUrl: string
    name: string
  }>
}

export interface AgentPaneMessagesProps {
  scrollRef: React.Ref<HTMLDivElement>
  messages: AgentChatEntry[]
  busy: boolean
  activity: string
  loopActive: boolean
  loopIteration: number
  queuedTurns: AgentPaneQueuedTurn[]
  nearBottom: boolean
  activeAssistantId: string | null
  enteringIds: ReadonlySet<string>
  materializingIds: ReadonlySet<string>
  settlingId: string | null
  onEnteringAnimationEnd: (id: string) => void
  onMaterializingAnimationEnd: (id: string) => void
  onRemoveQueuedTurn: (id: string) => void
  onScrollToBottom: () => void
}

export const AgentPaneMessages: React.FC<AgentPaneMessagesProps> = ({
  scrollRef,
  messages,
  busy,
  activity,
  loopActive,
  loopIteration,
  queuedTurns,
  nearBottom,
  activeAssistantId,
  enteringIds,
  materializingIds,
  settlingId,
  onEnteringAnimationEnd,
  onMaterializingAnimationEnd,
  onRemoveQueuedTurn,
  onScrollToBottom,
}) => {
  const { t } = useT()

  return (
    <div className="agent-pane__messages-wrap">
      <div ref={scrollRef} className="agent-pane__messages">
        {messages.length === 0 && (
          <div className="agent-pane__empty">
            <span className="agent-pane__empty-icon" aria-hidden="true">
              <Icon name="sparkles" size={22} />
            </span>
            <strong>{t('agentPane.emptyTitle')}</strong>
            <p>{t('agentPane.empty')}</p>
          </div>
        )}
        <AgentChatBubbles
          messages={messages}
          busy={busy}
          activeAssistantId={activeAssistantId}
          enteringIds={enteringIds}
          materializingIds={materializingIds}
          settlingId={settlingId}
          onEnteringAnimationEnd={onEnteringAnimationEnd}
          onMaterializingAnimationEnd={onMaterializingAnimationEnd}
          surface="pane"
        />
        {(busy || activity !== '') && (() => {
          const activityText = activity
            ? (loopActive
                ? `${t('agentPane.loopBadge', { n: loopIteration })} · ${activity}`
                : activity)
            : (loopActive ? t('agentPane.loopWorking', { n: loopIteration }) : '')
          return (
            <div
              className={[
                'agent-pane__activity',
                activityText === '' ? 'agent-pane__activity--idle' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="agent-pane__activity-dot" aria-hidden="true" />
              <span className="agent-pane__activity-text" key={activityText}>
                {activityText === '' ? '\u00A0' : activityText}
              </span>
            </div>
          )
        })()}
        {queuedTurns.length > 0 && (
          <div
            className="agent-pane__queue"
            aria-label={t('agentPane.queueLabel', { n: queuedTurns.length })}
          >
            {queuedTurns.map((item, index) => (
              <div key={item.id} className="agent-pane__queue-bubble" title={item.text}>
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
                {(item.text || item.images.length === 0) && (
                  <span className="agent-pane__queue-text">
                    {item.text || t('agentPane.imageOnlyMessage')}
                  </span>
                )}
                <button
                  type="button"
                  className="agent-pane__queue-remove"
                  onClick={() => onRemoveQueuedTurn(item.id)}
                  title={t('agentPane.queueRemove')}
                  aria-label={t('agentPane.queueRemove')}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {!nearBottom && messages.length > 0 && (
        <button
          type="button"
          className="agent-pane__scroll-bottom"
          title={t('agentPane.scrollToBottom')}
          aria-label={t('agentPane.scrollToBottom')}
          onClick={onScrollToBottom}
        >
          <Icon name="chevron-down" size={16} />
        </button>
      )}
    </div>
  )
}
