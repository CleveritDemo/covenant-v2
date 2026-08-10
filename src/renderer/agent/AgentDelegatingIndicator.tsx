import React from 'react'
import { Tooltip } from '../components/ui/Tooltip'
import './AgentDelegatingIndicator.css'

export interface AgentDelegatingListItem {
  id: string
  label: string
  /** Texto ya traducido, p. ej. "réplica". */
  replicaBadge?: string
  /** Texto ya traducido: running | done. */
  statusLabel: string
  status: 'running' | 'done'
  worktreeHint?: string
}

export interface AgentDelegatingIndicatorProps {
  label: string
  sublabel?: string
  items?: readonly AgentDelegatingListItem[]
}

/**
 * Estado de orquestación: el agente emitió delegaciones y espera a especialistas.
 * Flush en el stream (sin card); acento solo en estado running/done.
 */
export const AgentDelegatingIndicator: React.FC<AgentDelegatingIndicatorProps> = ({
  label,
  sublabel,
  items = [],
}) => (
  <div className="agent-delegating" role="status" aria-live="polite">
    <div className="agent-delegating__orbit" aria-hidden="true">
      <span className="agent-delegating__ring" />
      <span className="agent-delegating__core" />
      <span className="agent-delegating__sat agent-delegating__sat--a" />
      <span className="agent-delegating__sat agent-delegating__sat--b" />
      <span className="agent-delegating__sat agent-delegating__sat--c" />
    </div>
    <div className="agent-delegating__copy">
      <p className="agent-delegating__label">{label}</p>
      {sublabel ? (
        <p className="agent-delegating__sublabel">{sublabel}</p>
      ) : null}
      {items.length > 0 ? (
        <ul className="agent-delegating__list">
          {items.map(item => {
            const row = (
              <span
                className={[
                  'agent-delegating__item',
                  item.status === 'done'
                    ? 'agent-delegating__item--done'
                    : 'agent-delegating__item--running',
                ].join(' ')}
              >
                <span className="agent-delegating__dot" aria-hidden="true" />
                <span className="agent-delegating__agent">{item.label}</span>
                {item.replicaBadge ? (
                  <span className="agent-delegating__badge">{item.replicaBadge}</span>
                ) : null}
                <span className="agent-delegating__status">{item.statusLabel}</span>
              </span>
            )
            return (
              <li key={item.id} className="agent-delegating__row">
                {item.worktreeHint ? (
                  <Tooltip content={item.worktreeHint}>{row}</Tooltip>
                ) : (
                  row
                )}
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  </div>
)
