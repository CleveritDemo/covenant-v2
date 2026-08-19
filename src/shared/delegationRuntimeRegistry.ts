/**
 * Registry central de delegaciones vivas para el orquestador (App.tsx).
 */

import type { DelegateResult } from './agentOrchestration'

export type DelegationRuntimeStatus =
  | 'pending'
  | 'awaiting_merge'
  | 'completed'
  | 'orphaned'
  | 'superseded'

export type DelegationRuntimeWorktreeInfo = {
  worktreePath: string
  branch: string
  baseCwd: string
  baseBranch: string
}

export type DelegationRuntimeEntry = {
  delegationId: string
  fromPaneId: string
  toPaneId: string
  toAgentId: string
  /** Carril de hilo del experto base que ejecuta la delegación. */
  toThreadId?: string
  jobId: string
  baseAgentId?: string
  /**
   * delegationId del padre (PO→Orq) cuando esta delegación fue emitida por un
   * orquestador anidado. Se preserva hasta que el registry libere la entry:
   * mantiene el vínculo mientras el orquestador espera resultados anidados y
   * facilita rastreo/limpieza si el job "oficial" ya no existe.
   */
  parentDelegationId?: string
  worktreeInfo?: DelegationRuntimeWorktreeInfo
  status: DelegationRuntimeStatus
  registeredAt: number
  /** Objetivo del fence; vacío si el registro legacy no lo trajo. */
  objective: string
}

export type DelegationRuntimeRegistry = Map<string, DelegationRuntimeEntry>

export type RegisterDelegationRuntimeInput = {
  delegationId: string
  fromPaneId: string
  toPaneId: string
  toAgentId: string
  toThreadId?: string
  jobId: string
  baseAgentId?: string
  parentDelegationId?: string
  worktreeInfo?: DelegationRuntimeWorktreeInfo
  objective?: string
}

export function registerDelegationRuntime(
  registry: DelegationRuntimeRegistry,
  input: RegisterDelegationRuntimeInput,
  now: number = Date.now(),
): DelegationRuntimeEntry {
  const entry: DelegationRuntimeEntry = {
    delegationId: input.delegationId,
    fromPaneId: input.fromPaneId,
    toPaneId: input.toPaneId,
    toAgentId: input.toAgentId,
    jobId: input.jobId,
    ...(input.toThreadId ? { toThreadId: input.toThreadId } : {}),
    ...(input.baseAgentId ? { baseAgentId: input.baseAgentId } : {}),
    ...(input.parentDelegationId ? { parentDelegationId: input.parentDelegationId } : {}),
    ...(input.worktreeInfo ? { worktreeInfo: input.worktreeInfo } : {}),
    status: 'pending',
    registeredAt: now,
    objective: input.objective ?? '',
  }
  registry.set(input.delegationId, entry)
  return entry
}

export function getDelegationRuntime(
  registry: DelegationRuntimeRegistry,
  delegationId: string,
): DelegationRuntimeEntry | undefined {
  return registry.get(delegationId)
}

export function attachDelegationWorktree(
  registry: DelegationRuntimeRegistry,
  delegationId: string,
  worktreeInfo: DelegationRuntimeWorktreeInfo,
): void {
  const entry = registry.get(delegationId)
  if (!entry) return
  entry.worktreeInfo = worktreeInfo
}

export function markDelegationRuntimeStatus(
  registry: DelegationRuntimeRegistry,
  delegationId: string,
  status: DelegationRuntimeStatus,
): DelegationRuntimeEntry | undefined {
  const entry = registry.get(delegationId)
  if (!entry) return undefined
  entry.status = status
  return entry
}

export function deleteDelegationRuntime(
  registry: DelegationRuntimeRegistry,
  delegationId: string,
): boolean {
  return registry.delete(delegationId)
}

/**
 * Lista todas las delegaciones anidadas vivas de un padre. Útil para
 * inspección/limpieza si el orquestador se destruye antes que sus anidadas.
 */
export function listNestedDelegations(
  registry: DelegationRuntimeRegistry,
  parentDelegationId: string,
): DelegationRuntimeEntry[] {
  const parent = parentDelegationId.trim()
  if (!parent) return []
  const out: DelegationRuntimeEntry[] = []
  for (const entry of registry.values()) {
    if (entry.parentDelegationId === parent) out.push(entry)
  }
  return out
}

export type DelegationDeliveryResolution =
  | { kind: 'deliver'; entry: DelegationRuntimeEntry }
  | { kind: 'mismatch'; entry: DelegationRuntimeEntry; reason: 'fromPaneId' | 'jobId' | 'id' }
  | { kind: 'unknown' }

/**
 * Valida dirección de un resultado antes de entregarlo al orquestador emisor.
 * Solo devuelve `deliver` cuando fromPaneId, orchestrationJobId e id coinciden
 * exactamente con la entry registrada.
 */
export function resolveDelegationDelivery(
  registry: DelegationRuntimeRegistry,
  result: DelegateResult,
): DelegationDeliveryResolution {
  const id = result.id?.trim()
  if (!id) return { kind: 'unknown' }

  const entry = registry.get(id)
  if (!entry) return { kind: 'unknown' }

  const fromPaneId = result.fromPaneId?.trim()
  const jobId = result.orchestrationJobId?.trim()

  if (!fromPaneId || entry.fromPaneId !== fromPaneId) {
    return { kind: 'mismatch', entry, reason: 'fromPaneId' }
  }
  if (!jobId || entry.jobId !== jobId) {
    return { kind: 'mismatch', entry, reason: 'jobId' }
  }
  if (entry.delegationId !== id) {
    return { kind: 'mismatch', entry, reason: 'id' }
  }

  return { kind: 'deliver', entry }
}
