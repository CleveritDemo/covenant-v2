/**
 * Registry central de delegaciones vivas para el orquestador (App.tsx).
 *
 * Antes: `handleDelegationTurnComplete` buscaba el job recorriendo
 * `orchestrationJobsByPaneRef`; si no lo encontraba (resultado tardío, job
 * superseded, remount), hacía `console.warn` y retornaba sin cerrar la réplica
 * ni limpiar el worktree. Ese silencio dejaba paneles fantasma.
 *
 * Este módulo es puro (map<delegationId, entry>). El renderer lo mantiene en
 * un ref y consulta aquí el estado terminal cuando el job "oficial" ya no
 * existe. La disposición efectiva de la réplica sigue corriendo en App.tsx
 * (necesita `handleClosePane` + `tabsRef`); acá sólo decidimos qué hacer y
 * marcamos idempotencia.
 */

export type DelegationRuntimeStatus =
  | 'pending'
  | 'awaiting_merge'
  | 'completed'
  | 'orphaned'
  | 'superseded'
  | 'replica_disposed'

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
  disposeReplica: boolean
  status: DelegationRuntimeStatus
  registeredAt: number
  /** Bandera para no cerrar dos veces la misma réplica. */
  replicaDisposed: boolean
}

export type DelegationRuntimeRegistry = Map<string, DelegationRuntimeEntry>

export type RegisterDelegationRuntimeInput = {
  delegationId: string
  fromPaneId: string
  toPaneId: string
  toAgentId: string
  jobId: string
  baseAgentId?: string
  parentDelegationId?: string
  disposeReplica: boolean
  worktreeInfo?: DelegationRuntimeWorktreeInfo
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
    ...(input.baseAgentId ? { baseAgentId: input.baseAgentId } : {}),
    ...(input.parentDelegationId ? { parentDelegationId: input.parentDelegationId } : {}),
    ...(input.worktreeInfo ? { worktreeInfo: input.worktreeInfo } : {}),
    disposeReplica: input.disposeReplica,
    status: 'pending',
    registeredAt: now,
    replicaDisposed: false,
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
 * Decide si corresponde cerrar la réplica ahora. Idempotente: si ya se cerró
 * (o el entry no tiene disposeReplica), devuelve false y no altera nada.
 * Marca `replicaDisposed=true` cuando devuelve true, para bloquear reentradas.
 */
export function claimReplicaDispose(
  registry: DelegationRuntimeRegistry,
  delegationId: string,
): DelegationRuntimeEntry | undefined {
  const entry = registry.get(delegationId)
  if (!entry) return undefined
  if (!entry.disposeReplica) return undefined
  if (entry.replicaDisposed) return undefined
  entry.replicaDisposed = true
  entry.status = 'replica_disposed'
  return entry
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
