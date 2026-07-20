import React from 'react'
import { Icon } from '../components/ui/Icon'

export interface PlaneFabStackProps {
  canAdd: boolean
  canAddAgent?: boolean
  canAddTerminal?: boolean
  agentTitle: string
  terminalTitle: string
  onAddAgent: () => void
  onAddTerminal: () => void
}

export const PlaneFabStack: React.FC<PlaneFabStackProps> = ({
  canAdd,
  canAddAgent = true,
  canAddTerminal = true,
  agentTitle,
  terminalTitle,
  onAddAgent,
  onAddTerminal,
}) => (
  <div className="plane-fab-stack">
    <button
      type="button"
      className="plane-fab plane-fab--agent"
      disabled={!canAdd || !canAddAgent}
      title={agentTitle}
      aria-label={agentTitle}
      onClick={onAddAgent}
    >
      <Icon name="sparkles" size={18} />
    </button>
    <button
      type="button"
      className="plane-fab plane-fab--terminal"
      disabled={!canAdd || !canAddTerminal}
      title={terminalTitle}
      aria-label={terminalTitle}
      onClick={onAddTerminal}
    >
      <Icon name="terminal" size={18} />
    </button>
  </div>
)
