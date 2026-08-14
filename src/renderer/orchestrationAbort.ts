/** Limpieza de preferSend / FIFO / cola local al abortar orquestación. */

import { buildRunKey } from '@shared/agentRunKey'

export interface OrchestrationPlaneSendLike {
  orchestrationFollowUp?: boolean
  delegation?: {
    id?: string
    fromPaneId: string
  }
}

export interface OrchestrationQueuedTurnLike extends OrchestrationPlaneSendLike {
  id: string
}

/** Quita preferSend del orquestador y de subtareas ya ofrecidas. */
export function clearPlaneSendsForOrchestrationAbort<T extends OrchestrationPlaneSendLike>(
  prev: Record<string, T>,
  fromPaneId: string,
): Record<string, T> {
  const next = { ...prev }
  delete next[fromPaneId]
  for (const [paneId, payload] of Object.entries(next)) {
    if (payload?.delegation?.fromPaneId === fromPaneId) {
      delete next[paneId]
      continue
    }
    if (payload?.orchestrationFollowUp && paneId === fromPaneId) {
      delete next[paneId]
    }
  }
  return next
}

/**
 * True si el head FIFO es una subtarea de un orquestador ya abortado
 * (ya no figura en pending).
 */
export function shouldDiscardAbortedDelegationFifoHead(
  head: OrchestrationPlaneSendLike | undefined,
  pendingOrchestratorIds: ReadonlySet<string> | Map<string, unknown>,
): boolean {
  const fromPaneId = head?.delegation?.fromPaneId
  if (!fromPaneId) return false
  return !pendingOrchestratorIds.has(fromPaneId)
}

/**
 * Filtra la cola local tras abort: quita subtareas del orquestador y
 * follow-ups solo si este pane es el orquestador abortado.
 */
export function filterQueuedTurnsAfterOrchestrationAbort<T extends OrchestrationQueuedTurnLike>(
  queue: readonly T[],
  paneId: string,
  fromPaneId: string,
): { kept: T[]; removed: T[] } {
  const kept: T[] = []
  const removed: T[] = []
  for (const item of queue) {
    const dropDelegation = item.delegation?.fromPaneId === fromPaneId
    const dropLocalFollowUp = item.orchestrationFollowUp === true && paneId === fromPaneId
    if (dropDelegation || dropLocalFollowUp) removed.push(item)
    else kept.push(item)
  }
  return { kept, removed }
}

/**
 * Quita de la cola local la subtarea con este delegationId (Stop por fila).
 */
export function filterQueuedTurnsAfterSingleDelegationAbort<T extends OrchestrationQueuedTurnLike>(
  queue: readonly T[],
  delegationId: string,
): { kept: T[]; removed: T[] } {
  const id = delegationId.trim()
  const kept: T[] = []
  const removed: T[] = []
  for (const item of queue) {
    if (id && item.delegation?.id === id) removed.push(item)
    else kept.push(item)
  }
  return { kept, removed }
}

/** Quita preferSend ya ofrecido para una sola subtarea (Stop por fila). */
export function clearPlaneSendsForSingleDelegationAbort<T extends OrchestrationPlaneSendLike>(
  prev: Record<string, T>,
  delegationId: string,
): Record<string, T> {
  const id = delegationId.trim()
  if (!id) return prev
  const next = { ...prev }
  for (const [paneId, payload] of Object.entries(next)) {
    if (payload?.delegation?.id === id) delete next[paneId]
  }
  return next
}

export interface DelegationLaneStopTarget {
  toPaneId: string
  toThreadId?: string
}

/** Resuelve el carril concreto a parar para una delegación pending. */
export function resolveSingleDelegationLaneStop(input: {
  pendingToThreadId?: string
  registryToThreadId?: string
  toPaneId: string
}): DelegationLaneStopTarget {
  const toPaneId = input.toPaneId.trim()
  const toThreadId = input.pendingToThreadId?.trim() || input.registryToThreadId?.trim()
  return toThreadId ? { toPaneId, toThreadId } : { toPaneId }
}

/** Pares únicos pane+hilo de delegaciones pending de un orquestador. */
export function collectOrchestratorPendingLaneStops(
  pending: ReadonlyArray<{ toPaneId: string; toThreadId?: string }>,
): DelegationLaneStopTarget[] {
  const seen = new Set<string>()
  const targets: DelegationLaneStopTarget[] = []
  for (const meta of pending) {
    const toPaneId = meta.toPaneId.trim()
    if (!toPaneId) continue
    const toThreadId = meta.toThreadId?.trim()
    const key = `${toPaneId}::${toThreadId ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    targets.push(toThreadId ? { toPaneId, toThreadId } : { toPaneId })
  }
  return targets
}

/** Para una delegación: runKey si hay hilo; fallback a stop por pane. */
export function applyDelegationLaneStop(
  target: DelegationLaneStopTarget,
  input: { delegationId?: string },
  hooks: {
    stopRunKey: (runKey: string) => void
    stopPane: (paneId: string) => void
    warn: (payload: Record<string, unknown>) => void
  },
): void {
  const toPaneId = target.toPaneId.trim()
  const toThreadId = target.toThreadId?.trim()
  if (toThreadId) {
    hooks.stopRunKey(buildRunKey(toPaneId, toThreadId))
    return
  }
  hooks.warn({
    ...(input.delegationId ? { delegationId: input.delegationId } : {}),
    toPaneId,
    reason: 'abort_lane_threadid_missing',
  })
  hooks.stopPane(toPaneId)
}
