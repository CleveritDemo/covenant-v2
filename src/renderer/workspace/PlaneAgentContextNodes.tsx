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
  /** Solo jira: clave real de la issue, para pedir su preview (resumen/estado/frescura). */
  issueKey?: string
}

export interface PlaneAgentContextNodesProps {
  contexts: PlaneAgentContextChip[]
  /** Clic en un contexto = misma acción que clic en el agente (abrir chat). */
  onOpenAgent: () => void
  /** Carpeta del proyecto: la usa el chip jira para pedir su preview vía IPC. */
  cwd?: string
  /** Sube cuando los contextos se remateralizan; el chip jira relee su snapshot. */
  contextsRevision?: number
}

function renderContextItem(
  ctx: PlaneAgentContextChip,
  onOpenAgent: () => void,
  cwd: string,
  contextsRevision: number,
) {
  return (
    <li key={ctx.id} className="plane-agent-context-nodes__item" role="listitem">
      <PlaneContextCard
        name={ctx.name}
        icon={ctx.icon}
        color={ctx.color}
        shared={ctx.shared}
        showName
        onOpen={onOpenAgent}
        kind={ctx.kind}
        issueKey={ctx.issueKey}
        cwd={cwd}
        contextsRevision={contextsRevision}
      />
    </li>
  )
}

/** Contextos del agente en lista vertical con nombre. */
export const PlaneAgentContextNodes: React.FC<PlaneAgentContextNodesProps> = ({
  contexts,
  onOpenAgent,
  cwd = '',
  contextsRevision = 0,
}) => {
  if (contexts.length === 0) return null

  const normal = contexts.filter(ctx => ctx.kind !== 'agentResult')
  const results = contexts.filter(ctx => ctx.kind === 'agentResult')
  const showSeparator = normal.length > 0 && results.length > 0

  return (
    <ul className="plane-agent-context-nodes" role="list">
      {normal.map(ctx => renderContextItem(ctx, onOpenAgent, cwd, contextsRevision))}
      {showSeparator ? (
        <li className="plane-agent-context-nodes__sep" aria-hidden="true" />
      ) : null}
      {results.map(ctx => renderContextItem(ctx, onOpenAgent, cwd, contextsRevision))}
    </ul>
  )
}
