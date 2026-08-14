import React from 'react'
import { PlaneFab } from './PlaneFab'

export interface PlaneFabStackProps {
  canAdd: boolean
  canAddAgent?: boolean
  canAddTerminal?: boolean
  agentTitle: string
  terminalTitle: string
  /** Motivo cuando el FAB de agente está deshabilitado por falta de cwd. */
  agentDisabledTitle?: string
  /** Motivo cuando el FAB de terminal está deshabilitado por falta de cwd. */
  terminalDisabledTitle?: string
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
  canAddAgent = true,
  canAddTerminal = true,
  agentTitle,
  terminalTitle,
  agentDisabledTitle,
  terminalDisabledTitle,
  onAddAgent,
  onAddTerminal,
  bootstrapAgentsTitle,
  bootstrapAgentsDisabledTitle,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
}) => (
  <>
    <div className="plane-fab-stack plane-fab-stack--left">
      <PlaneFab
        kind="terminal"
        label={terminalTitle}
        disabled={!canAddTerminal}
        disabledTitle={terminalDisabledTitle}
        onClick={onAddTerminal}
      />
    </div>
    <div className="plane-fab-stack plane-fab-stack--right">
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
        disabled={!canAddAgent}
        disabledTitle={agentDisabledTitle}
        onClick={onAddAgent}
      />
    </div>
  </>
)
