import type { AgentPaneMeta } from '@shared/projectAgentCatalog'
import type { DelegateRequest, OrchestrationAgentRef } from '@shared/agentOrchestration'

export interface OrchestrationPaneSnapshot {
  paneId: string
  meta: AgentPaneMeta
}

/** Especialistas del tab que pueden recibir delegaciones (no orquestadores). */
export function listOrchestrationTargets(
  panes: readonly OrchestrationPaneSnapshot[],
  exceptPaneId?: string,
): OrchestrationAgentRef[] {
  const out: OrchestrationAgentRef[] = []
  for (const pane of panes) {
    if (exceptPaneId && pane.paneId === exceptPaneId) continue
    if (pane.meta.coordination === 'orchestrator') continue
    if (pane.meta.acceptDelegations === false) continue
    out.push({
      agentId: pane.meta.id,
      paneId: pane.paneId,
      name: pane.meta.name?.trim() || pane.meta.id,
      ...(pane.meta.role?.trim() ? { role: pane.meta.role.trim() } : {}),
    })
  }
  return out
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
