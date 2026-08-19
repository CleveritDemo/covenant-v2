import React from 'react'
import { PlaneFab } from './PlaneFab'

export interface PlaneFabStackProps {
  canAdd: boolean
  canAddAgent?: boolean
  canAddTerminal?: boolean
  agentTitle: string
  terminalTitle: string
  /** Hint del Tooltip del FAB de agente (atajo + pista). */
  agentHint?: string
  /** Atajo que el FAB de agente muestra dentro de su píldora. */
  agentShortcut?: string
  /** Hint del Tooltip del FAB de terminal. */
  terminalHint?: string
  /** Hint del Tooltip del FAB bootstrap (sin atajo). */
  bootstrapHint?: string
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
  /** Sube el stack cuando hay un overlay del plano abierto. */
  elevated?: boolean
  /** Permite ocultar el FAB de terminal. */
  showTerminal?: boolean
}

export const PlaneFabStack: React.FC<PlaneFabStackProps> = ({
  canAddAgent = true,
  canAddTerminal = true,
  agentTitle,
  terminalTitle,
  agentHint,
  agentShortcut,
  terminalHint,
  bootstrapHint,
  agentDisabledTitle,
  terminalDisabledTitle,
  onAddAgent,
  onAddTerminal,
  bootstrapAgentsTitle,
  bootstrapAgentsDisabledTitle,
  showBootstrapAgents = false,
  canBootstrapAgents = false,
  onBootstrapAgents,
  elevated = false,
  showTerminal = true,
}) => {
  const elevatedClass = elevated ? 'plane-fab-stack--elevated' : ''
  return (
    <>
      {showTerminal ? (
        <div className={['plane-fab-stack', 'plane-fab-stack--left', elevatedClass].filter(Boolean).join(' ')}>
          <PlaneFab
            kind="terminal"
            label={terminalTitle}
            hint={terminalHint}
            disabled={!canAddTerminal}
            disabledTitle={terminalDisabledTitle}
            dataOnboarding="plane-terminal-fab"
            onClick={onAddTerminal}
          />
        </div>
      ) : null}
      <div className={['plane-fab-stack', 'plane-fab-stack--right', elevatedClass].filter(Boolean).join(' ')}>
        {showBootstrapAgents && bootstrapAgentsTitle && onBootstrapAgents ? (
          <PlaneFab
            kind="bootstrap"
            label={bootstrapAgentsTitle}
            hint={bootstrapHint}
            disabled={!canBootstrapAgents}
            disabledTitle={bootstrapAgentsDisabledTitle}
            onClick={onBootstrapAgents}
          />
        ) : null}
        <PlaneFab
          kind="agent"
          label={agentTitle}
          hint={agentHint}
          shortcut={agentShortcut}
          disabled={!canAddAgent}
          disabledTitle={agentDisabledTitle}
          onClick={onAddAgent}
        />
      </div>
    </>
  )
}
