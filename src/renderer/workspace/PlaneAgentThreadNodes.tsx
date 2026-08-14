import React from 'react'
import { useT } from '@i18n/useT'
import { PlaneBusyDot } from './PlaneBusyDot'
import './PlaneAgentThreadNodes.css'

export interface PlaneAgentThreadNode {
  id: string
  title: string
  running: boolean
  active: boolean
}

export interface PlaneAgentThreadNodesProps {
  threads: PlaneAgentThreadNode[]
  expanded: boolean
  onToggleExpanded: () => void
  onOpenThread: (threadId: string) => void
}

/** Hilos del agente en lista vertical bajo la card mini del plano. */
export const PlaneAgentThreadNodes: React.FC<PlaneAgentThreadNodesProps> = ({
  threads,
  expanded,
  onToggleExpanded,
  onOpenThread,
}) => {
  const { t } = useT()
  const visibleThreads = threads.filter(thread => !thread.active)

  if (visibleThreads.length === 0) return null

  const runningCount = visibleThreads.filter(thread => thread.running).length

  if (!expanded) {
    return (
      <div className="plane-agent-thread-nodes">
        <button
          type="button"
          className="plane-agent-thread-nodes__stack"
          aria-expanded={false}
          onClick={event => {
            event.stopPropagation()
            onToggleExpanded()
          }}
        >
          {runningCount > 0 ? <PlaneBusyDot /> : null}
          <span className="plane-agent-thread-nodes__stack-label">
            {runningCount > 0
              ? t('tabs.planeAgentThreadsWorking', { count: runningCount })
              : t('tabs.planeAgentThreadsConversations', { count: visibleThreads.length })}
          </span>
        </button>
      </div>
    )
  }

  return (
    <ul className="plane-agent-thread-nodes plane-agent-thread-nodes--expanded" role="list">
      {visibleThreads.map(thread => (
        <li key={thread.id} className="plane-agent-thread-nodes__item" role="listitem">
          <button
            type="button"
            className={[
              'plane-agent-thread-nodes__card',
              thread.active ? 'plane-agent-thread-nodes__card--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={event => {
              event.stopPropagation()
              onOpenThread(thread.id)
            }}
          >
            <span className="plane-agent-thread-nodes__card-title">
              {thread.title.trim() || t('tabs.planeAgentThreadUntitled')}
            </span>
            {thread.running ? <PlaneBusyDot /> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}
