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
  /** Solo agentResult: monograma del agente dueño del contexto de results. */
  monogram?: string
}

export interface PlaneAgentContextNodesProps {
  contexts: PlaneAgentContextChip[]
  /**
   * Brainstorm: clic en chip = abrir agente.
   * Plano: omitir — los chips son decorativos y el clic va a la card.
   */
  onOpenAgent?: () => void
  /** Carpeta del proyecto: la usa el chip jira para pedir su preview vía IPC. */
  cwd?: string
  /** Sube cuando los contextos se rematerializan; el chip jira relee su snapshot. */
  contextsRevision?: number
}

function renderContextItem(
  ctx: PlaneAgentContextChip,
  cwd: string,
  contextsRevision: number,
  interactive: boolean,
  onOpenAgent: (() => void) | undefined,
) {
  return (
    <li
      key={ctx.id}
      data-agent-context-chip={ctx.id}
      className={[
        'plane-agent-context-nodes__item',
        ctx.kind === 'agentResult'
          ? 'plane-agent-context-nodes__item--result'
          : 'plane-agent-context-nodes__item--input',
      ].join(' ')}
      role="listitem"
    >
      <PlaneContextCard
        name={ctx.name}
        icon={ctx.icon}
        color={ctx.color}
        shared={ctx.shared}
        iconOnly
        density={ctx.kind === 'agentResult' ? 'default' : 'compact'}
        showTooltip={false}
        decorative={!interactive}
        onOpen={interactive ? onOpenAgent : undefined}
        kind={ctx.kind}
        issueKey={ctx.issueKey}
        monogram={ctx.monogram}
        cwd={cwd}
        contextsRevision={contextsRevision}
      />
    </li>
  )
}

/** Contextos del agente en grilla de íconos (inputs / results). */
export const PlaneAgentContextNodes: React.FC<PlaneAgentContextNodesProps> = ({
  contexts,
  onOpenAgent,
  cwd = '',
  contextsRevision = 0,
}) => {
  if (contexts.length === 0) return null

  const interactive = Boolean(onOpenAgent)
  const normal = contexts.filter(ctx => ctx.kind !== 'agentResult')
  const results = contexts.filter(ctx => ctx.kind === 'agentResult')

  const renderSection = (items: PlaneAgentContextChip[], sectionClass: string) => {
    if (items.length === 0) return null
    return (
      <ul
        className={`plane-agent-context-nodes ${sectionClass}`}
        role="list"
      >
        {items.map(ctx => renderContextItem(
          ctx,
          cwd,
          contextsRevision,
          interactive,
          onOpenAgent,
        ))}
      </ul>
    )
  }

  return (
    <div
      className={[
        'plane-agent-context-nodes-stack',
        !interactive ? 'plane-agent-context-nodes-stack--decorative' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden={!interactive ? true : undefined}
    >
      {renderSection(normal, 'plane-agent-context-nodes--inputs')}
      {renderSection(results, 'plane-agent-context-nodes--results')}
    </div>
  )
}
