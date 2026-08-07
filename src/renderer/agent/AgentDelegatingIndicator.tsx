import React from 'react'
import './AgentDelegatingIndicator.css'

export interface AgentDelegatingIndicatorProps {
  label: string
  sublabel?: string
}

/**
 * Estado de orquestación: el agente emitió delegaciones y espera a especialistas.
 * Markup propio (BEM); sin UI-kit.
 */
export const AgentDelegatingIndicator: React.FC<AgentDelegatingIndicatorProps> = ({
  label,
  sublabel,
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
    </div>
  </div>
)
