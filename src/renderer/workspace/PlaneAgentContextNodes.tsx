import React from 'react'
import type { TabContextKind } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'
import { PlaneContextCard } from './PlaneContextCard'
import './PlaneAgentContextNodes.css'

export interface PlaneAgentContextChip {
  id: string
  name: string
  kind: TabContextKind
  kindLabel: string
  icon: IconName
  color: string
  shared: boolean
}

export interface PlaneAgentContextNodesProps {
  contexts: PlaneAgentContextChip[]
  /** Clic en un contexto = misma acción que clic en el agente (config). */
  onOpenAgent: () => void
}

/** Contextos anidados del agente como fila de íconos (sin tooltip). */
export const PlaneAgentContextNodes: React.FC<PlaneAgentContextNodesProps> = ({
  contexts,
  onOpenAgent,
}) => {
  if (contexts.length === 0) return null

  return (
    <ul className="plane-agent-context-nodes" role="list">
      {contexts.map(ctx => (
        <li key={ctx.id} className="plane-agent-context-nodes__item" role="listitem">
          <PlaneContextCard
            name={ctx.name}
            icon={ctx.icon}
            color={ctx.color}
            shared={ctx.shared}
            onOpen={onOpenAgent}
          />
        </li>
      ))}
    </ul>
  )
}
