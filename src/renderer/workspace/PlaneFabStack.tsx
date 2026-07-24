import React from 'react'
import { PlaneFab } from './PlaneFab'

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
    <PlaneFab
      kind="agent"
      label={agentTitle}
      disabled={!canAdd || !canAddAgent}
      onClick={onAddAgent}
    />
    <PlaneFab
      kind="terminal"
      label={terminalTitle}
      disabled={!canAdd || !canAddTerminal}
      onClick={onAddTerminal}
    />
  </div>
)
