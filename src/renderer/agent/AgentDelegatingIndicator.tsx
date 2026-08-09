import React from 'react'
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
 * Markup propio (BEM); sin UI-kit / sin className externo.
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
      <span className="agent-delegating__label">{label}</span>
      {sublabel ? (
        <span className="agent-delegating__sublabel">{sublabel}</span>
      ) : null}
      {items.length > 0 ? (
        <ul className="agent-delegating__list">
          {items.map(item => (
            <li
              key={item.id}
              className={[
                'agent-delegating__row',
                item.status === 'done' ? 'agent-delegating__row--done' : '',
              ].filter(Boolean).join(' ')}
            >
              <span className="agent-delegating__agent">{item.label}</span>
              {item.replicaBadge ? (
                <span className="agent-delegating__badge">{item.replicaBadge}</span>
              ) : null}
              <span className="agent-delegating__status">{item.statusLabel}</span>
              {item.worktreeHint ? (
                <span className="agent-delegating__wt" title={item.worktreeHint}>
                  {item.worktreeHint}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  </div>
)
