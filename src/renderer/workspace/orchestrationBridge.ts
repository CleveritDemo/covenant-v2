import type { AgentPaneMeta } from '@shared/projectAgentCatalog'
import {
  listDelegationTargets,
  listOrchestrationTargets as listOrchestrationTargetsShared,
  type DelegateRequest,
  type OrchestrationAgentRef,
} from '@shared/agentOrchestration'

export interface OrchestrationPaneSnapshot {
  paneId: string
  meta: AgentPaneMeta
}

/** Compat thin wrapper → listDelegationTargets con default orchestrator. */
export function listOrchestrationTargets(
  panes: readonly OrchestrationPaneSnapshot[],
  exceptPaneId?: string,
): OrchestrationAgentRef[] {
  return listOrchestrationTargetsShared(panes, exceptPaneId)
}

/** Destinos según policy del emisor (un solo camino). */
export function listDelegationTargetsForMeta(
  panes: readonly OrchestrationPaneSnapshot[],
  fromMeta: AgentPaneMeta,
  exceptPaneId?: string,
): OrchestrationAgentRef[] {
  return listDelegationTargets(panes, fromMeta, exceptPaneId)
}

/** Resuelve paneId destino por agentId (primer match). */
export function resolveDelegationTargetPaneId(
  targets: readonly OrchestrationAgentRef[],
  delegation: Pick<DelegateRequest, 'toAgentId'>,
): string | null {
  const wanted = delegation.toAgentId.trim().toLowerCase()
  const match = targets.find(item => item.agentId.toLowerCase() === wanted)
  return match?.paneId ?? null
}
