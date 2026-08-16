import type { OrchestrationAgentRef } from './agentOrchestration'
import { parseExpertReplicaRequest } from './delegationTargets'

/** Sin tope: un especialista acepta delegaciones simultáneas ilimitadas. */
export const MAX_LANES_PER_PANE = Number.POSITIVE_INFINITY

export type DelegationLaneDecision =
  | { kind: 'lane'; paneId: string; agentId: string }
  | { kind: 'defer'; paneId: string; agentId: string }
  | { kind: 'fail'; reason: 'not_found' }

function findTargetByAgentId(
  targets: readonly OrchestrationAgentRef[],
  agentId: string,
): OrchestrationAgentRef | undefined {
  const wanted = agentId.trim().toLowerCase()
  if (!wanted) return undefined
  return targets.find(item => item.agentId.trim().toLowerCase() === wanted)
}

/**
 * Resuelve el pane destino. Nunca difiere: el tope de carriles es ilimitado.
 * Se conserva la variante `defer` en el tipo porque App.tsx la contempla.
 */
export function resolveDelegationLane(input: {
  toAgentId: string
  targets: readonly OrchestrationAgentRef[]
  activeLanesByPane: ReadonlyMap<string, number>
  maxLanesPerPane?: number
}): DelegationLaneDecision {
  const parsed = parseExpertReplicaRequest(input.toAgentId)
  if (!parsed.requestedId) return { kind: 'fail', reason: 'not_found' }

  const exact = findTargetByAgentId(input.targets, parsed.requestedId)
  const match = exact ?? findTargetByAgentId(input.targets, parsed.baseId)
  if (!match) return { kind: 'fail', reason: 'not_found' }

  return { kind: 'lane', paneId: match.paneId, agentId: match.agentId }
}
