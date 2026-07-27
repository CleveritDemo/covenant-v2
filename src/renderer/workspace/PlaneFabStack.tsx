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
  /** Title/aria largo del FAB bootstrap (roles). */
  bootstrapAgentsTitle?: string
  bootstrapAgentsDisabledTitle?: string
  showBootstrapAgents?: boolean
  canBootstrapAgents?: boolean
  onBootstrapAgents?: () => void
}

export const PlaneFabStack: React.FC<PlaneFabStackProps> = ({
  canAdd,
  canAddAgent = true,
  canAddTerminal = true,
  agentTitle,
  terminalTitle,
  onAddAgent,
  onAddTerminal,
  bootstrapAgentsTitle,
  bootstrapAgentsDisabledTitle,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
}) => (
  <div className="plane-fab-stack">
    {showBootstrapAgents && bootstrapAgentsTitle && onBootstrapAgents ? (
      <PlaneFab
        kind="bootstrap"
        label={bootstrapAgentsTitle}
        disabled={!canBootstrapAgents}
        disabledTitle={bootstrapAgentsDisabledTitle}
        onClick={onBootstrapAgents}
      />
    ) : null}
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
