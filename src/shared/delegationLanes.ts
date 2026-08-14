import type { OrchestrationAgentRef } from './agentOrchestration'
import { parseExpertReplicaRequest } from './expertReplicas'

export const MAX_LANES_PER_PANE = 3

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
 * Resuelve el pane destino y si hay carril libre (sin spawn de réplicas).
 * Función pura: el host cuenta carriles activos por pane.
 */
export function resolveDelegationLane(input: {
  toAgentId: string
  targets: readonly OrchestrationAgentRef[]
  activeLanesByPane: ReadonlyMap<string, number>
  maxLanesPerPane?: number
}): DelegationLaneDecision {
  const parsed = parseExpertReplicaRequest(input.toAgentId)
  if (!parsed.requestedId) return { kind: 'fail', reason: 'not_found' }

  const cap = input.maxLanesPerPane ?? MAX_LANES_PER_PANE
  const exact = findTargetByAgentId(input.targets, parsed.requestedId)
  const match = exact ?? findTargetByAgentId(input.targets, parsed.baseId)
  if (!match) return { kind: 'fail', reason: 'not_found' }

  const { paneId, agentId } = match
  if ((input.activeLanesByPane.get(paneId) ?? 0) >= cap) {
    return { kind: 'defer', paneId, agentId }
  }
  return { kind: 'lane', paneId, agentId }
}
