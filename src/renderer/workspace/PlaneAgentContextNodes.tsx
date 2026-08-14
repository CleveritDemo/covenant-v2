import React from 'react'
import { useT } from '@i18n/useT'
import type { TabContextKind } from '@shared/tabContext'
import type { IconName } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
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
  /** Clic en un contexto = misma acción que clic en el agente (abrir chat). */
  onOpenAgent: () => void
  /** Carpeta del proyecto: la usa el chip jira para pedir su preview vía IPC. */
  cwd?: string
  /** Sube cuando los contextos se rematerializan; el chip jira relee su snapshot. */
  contextsRevision?: number
}

function contextTooltipHint(
  ctx: PlaneAgentContextChip,
  sharedLabel: string,
  inputRoleLabel: string,
  resultRoleLabel: string,
): string {
  const role = ctx.kind === 'agentResult' ? resultRoleLabel : inputRoleLabel
  const parts = [role, ctx.kindLabel]
  if (ctx.shared) parts.push(sharedLabel)
  return parts.filter(Boolean).join(' · ')
}

function renderContextItem(
  ctx: PlaneAgentContextChip,
  onOpenAgent: () => void,
  cwd: string,
  contextsRevision: number,
  sharedLabel: string,
  inputRoleLabel: string,
  resultRoleLabel: string,
) {
  const isJira = ctx.kind === 'jira' && Boolean((ctx.issueKey ?? '').trim())
  const card = (
    <PlaneContextCard
      name={ctx.name}
      icon={ctx.icon}
      color={ctx.color}
      shared={ctx.shared}
      iconOnly
      onOpen={onOpenAgent}
      kind={ctx.kind}
      issueKey={ctx.issueKey}
      monogram={ctx.monogram}
      cwd={cwd}
      contextsRevision={contextsRevision}
    />
  )

  return (
    <li
      key={ctx.id}
      className={[
        'plane-agent-context-nodes__item',
        ctx.kind === 'agentResult'
          ? 'plane-agent-context-nodes__item--result'
          : 'plane-agent-context-nodes__item--input',
      ].join(' ')}
      role="listitem"
    >
      {isJira ? (
        card
      ) : (
        <Tooltip
          content={ctx.name}
          hint={contextTooltipHint(ctx, sharedLabel, inputRoleLabel, resultRoleLabel)}
        >
          {card}
        </Tooltip>
      )}
    </li>
  )
}

/** Contextos del agente en grilla de íconos (auto por ancho) con tooltip al hover. */
export const PlaneAgentContextNodes: React.FC<PlaneAgentContextNodesProps> = ({
  contexts,
  onOpenAgent,
  cwd = '',
  contextsRevision = 0,
}) => {
  const { t } = useT()
  if (contexts.length === 0) return null

  const sharedLabel = t('tabs.planeSharedContext')
  const inputRoleLabel = t('tabs.planeContextRoleInput')
  const resultRoleLabel = t('tabs.planeContextRoleResult')

  const normal = contexts.filter(ctx => ctx.kind !== 'agentResult')
  const results = contexts.filter(ctx => ctx.kind === 'agentResult')
  const ordered = [...normal, ...results]

  return (
    <ul className="plane-agent-context-nodes" role="list">
      {ordered.map(ctx => renderContextItem(
        ctx, onOpenAgent, cwd, contextsRevision, sharedLabel, inputRoleLabel, resultRoleLabel,
      ))}
    </ul>
  )
}
