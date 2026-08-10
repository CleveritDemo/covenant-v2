/**
 * Estado puro de jobs de orquestación (lineal ≤1 job vivo tras cleanup;
 * turbo N jobs concurrentes entre mensajes humanos).
 * App.tsx posee los refs; este módulo no toca React/electron.
 */

import type { DelegateRequest, DelegateResult } from './agentOrchestration'
import { orchestrationRoundsAtCap } from './agentOrchestration'
import type { OrchestrationAwaitingItemInput } from './orchestrationAwaiting'

export type {
  OrchestrationWorkStyle,
} from './agentOrchestration'
export {
  resolveOrchestrationWorkStyle,
  sanitizeOrchestrationWorkStyle,
  shouldAbortOnHumanTurn,
} from './agentOrchestration'

/** Wake del job solo cuando no quedan pending ni deferred. */
export function shouldWakeJob(pendingRemaining: number, deferredRemaining = 0): boolean {
  return pendingRemaining <= 0 && deferredRemaining <= 0
}

export interface OrchestrationJobPendingMeta {
  toPaneId: string
  toAgentId: string
  baseAgentId?: string
  /**
   * True when the target pane has been busy at least once while this pending
   * was live. Reconcile-idle must not complete a brand-new pending with an old
   * chat snippet before the specialist starts the new objective.
   */
  sawBusy?: boolean
}

export interface OrchestrationDeferredItem {
  tabId: string
  delegation: DelegateRequest
  toPaneId: string
  toAgentId: string
}

export interface OrchestrationPendingMerge {
  delegationId: string
  completedAt: number
  result: DelegateResult
  info: {
    fromPaneId: string
    toPaneId: string
    worktreePath: string
    branch: string
    baseCwd: string
    baseBranch: string
    baseAgentId?: string
  }
}

export interface OrchestrationJob {
  jobId: string
  fromPaneId: string
  /** Oleadas de este job (mensaje humano raíz + redelegaciones). */
  round: number
  pending: Map<string, OrchestrationJobPendingMeta>
  deferred: OrchestrationDeferredItem[]
  waveItems: OrchestrationAwaitingItemInput[]
  completedResults: DelegateResult[]
  pendingMerges: OrchestrationPendingMerge[]
  hasDelegated: boolean
  /**
   * Marcado al empezar un nuevo turno humano (antes de abort/clear).
   * Completions tardías no deben encolar follow-up de Delegation.
   */
  superseded?: boolean
}

function newJobId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function createOrchestrationJob(
  fromPaneId: string,
  jobId?: string,
): OrchestrationJob {
  return {
    jobId: jobId?.trim() || newJobId(),
    fromPaneId,
    round: 0,
    pending: new Map(),
    deferred: [],
    waveItems: [],
    completedResults: [],
    pendingMerges: [],
    hasDelegated: false,
  }
}

/**
 * Linear (cleanup al nuevo turno humano, ola ya cerrada): marca jobs como superseded.
 * No usar en turbo — los jobs previos deben seguir entregando follow-ups.
 */
export function supersedeOrchestrationJobsForHumanTurn(
  jobs: Map<string, OrchestrationJob>,
): void {
  for (const job of jobs.values()) {
    job.superseded = true
  }
}

/**
 * True solo si el job sigue vivo en el mapa y no está superseded.
 * Usar antes de encolar formatDelegationResultFollowUp / batch wake.
 */
export function shouldDeliverOrchestrationJobFollowUp(
  jobsMap: ReadonlyMap<string, OrchestrationJob> | undefined,
  job: OrchestrationJob,
): boolean {
  if (job.superseded) return false
  return jobsMap?.get(job.jobId) === job
}

export function findJobByDelegation(
  jobs: Iterable<OrchestrationJob>,
  delegationId: string,
): OrchestrationJob | undefined {
  const id = delegationId.trim()
  if (!id) return undefined
  for (const job of jobs) {
    if (job.pending.has(id)) return job
    if (job.deferred.some(item => item.delegation.id === id)) return job
    if (job.waveItems.some(item => item.delegationId === id)) return job
    if (job.pendingMerges.some(item => item.delegationId === id)) return job
    if (job.completedResults.some(item => item.id === id)) return job
  }
  return undefined
}

/** Panes destino ocupados por pending o deferred de todos los jobs. */
export function occupiedPaneIdsAcrossJobs(
  jobs: Iterable<OrchestrationJob>,
): Set<string> {
  const occupied = new Set<string>()
  for (const job of jobs) {
    for (const meta of job.pending.values()) {
      occupied.add(meta.toPaneId)
    }
    for (const item of job.deferred) {
      occupied.add(item.toPaneId)
    }
  }
  return occupied
}

export function isJobAwaiting(job: OrchestrationJob): boolean {
  return job.pending.size > 0 || job.deferred.length > 0
}

export function listJobsForPane(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
  fromPaneId: string,
): OrchestrationJob[] {
  const jobs = byPane.get(fromPaneId)
  return jobs ? [...jobs.values()] : []
}

/** Tope de olas: se evalúa con el round del job (no global del pane). */
export function jobRoundsAtCap(job: Pick<OrchestrationJob, 'round'>, maxRounds: number): boolean {
  return orchestrationRoundsAtCap(job.round, maxRounds)
}

/**
 * Items de awaiting en lista plana (todos los jobs del orquestador).
 * Conserva el orden de jobs y, dentro, el de waveItems.
 */
export function flattenAwaitingItemsFromJobs(
  jobs: Iterable<OrchestrationJob>,
): OrchestrationAwaitingItemInput[] {
  const out: OrchestrationAwaitingItemInput[] = []
  for (const job of jobs) {
    const pendingIds = new Set(job.pending.keys())
    const deferredIds = new Set(job.deferred.map(item => item.delegation.id))
    for (const item of job.waveItems) {
      const live = job.pending.get(item.delegationId)
      const stillActive = pendingIds.has(item.delegationId) || deferredIds.has(item.delegationId)
      out.push({
        ...item,
        toAgentId: live?.toAgentId ?? item.toAgentId,
        baseAgentId: live?.baseAgentId ?? item.baseAgentId,
        ...(live?.toPaneId
          ? { toPaneId: live.toPaneId }
          : item.toPaneId
            ? { toPaneId: item.toPaneId }
            : {}),
        status: stillActive ? 'running' : 'done',
      })
    }
    for (const [delegationId, meta] of job.pending.entries()) {
      if (out.some(item => item.delegationId === delegationId)) continue
      out.push({
        delegationId,
        toAgentId: meta.toAgentId,
        toPaneId: meta.toPaneId,
        ...(meta.baseAgentId ? { baseAgentId: meta.baseAgentId } : {}),
        status: 'running',
      })
    }
    for (const deferred of job.deferred) {
      if (out.some(item => item.delegationId === deferred.delegation.id)) continue
      out.push({
        delegationId: deferred.delegation.id,
        toAgentId: deferred.toAgentId,
        toPaneId: deferred.toPaneId,
        status: 'running',
      })
    }
  }
  return out
}

/** Panes orquestadores con al menos un job awaiting. */
export function awaitingOrchestratorPaneIds(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const out = new Set<string>()
  for (const [paneId, jobs] of byPane.entries()) {
    for (const job of jobs.values()) {
      if (isJobAwaiting(job)) {
        out.add(paneId)
        break
      }
    }
  }
  return out
}

export function occupiedTargetPaneIdsAcrossAllJobs(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const out = new Set<string>()
  for (const jobs of byPane.values()) {
    for (const paneId of occupiedPaneIdsAcrossJobs(jobs.values())) {
      out.add(paneId)
    }
  }
  return out
}

/** Orquestadores con pending (para descartar FIFO de subtareas abortadas). */
export function pendingOrchestratorIdsFromJobs(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const out = new Set<string>()
  for (const [paneId, jobs] of byPane.entries()) {
    for (const job of jobs.values()) {
      if (job.pending.size > 0) {
        out.add(paneId)
        break
      }
    }
  }
  return out
}

/** Primera pending cuyo especialista es `toPaneId` (reconcile idle). */
export function findPendingDelegationByToPane(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
  toPaneId: string,
): {
  fromPaneId: string
  job: OrchestrationJob
  delegationId: string
  toAgentId: string
  sawBusy: boolean
} | null {
  const wanted = toPaneId.trim()
  if (!wanted) return null
  for (const [fromPaneId, jobs] of byPane.entries()) {
    for (const job of jobs.values()) {
      for (const [delegationId, meta] of job.pending.entries()) {
        if (meta.toPaneId === wanted) {
          return {
            fromPaneId,
            job,
            delegationId,
            toAgentId: meta.toAgentId,
            sawBusy: meta.sawBusy === true,
          }
        }
      }
    }
  }
  return null
}

/** Marca pending del especialista como “ya estuvo busy” (listo para reconcile). */
export function markPendingSawBusyForPane(
  byPane: ReadonlyMap<string, Map<string, OrchestrationJob>>,
  toPaneId: string,
): void {
  const wanted = toPaneId.trim()
  if (!wanted) return
  for (const jobs of byPane.values()) {
    for (const job of jobs.values()) {
      for (const meta of job.pending.values()) {
        if (meta.toPaneId === wanted) meta.sawBusy = true
      }
    }
  }
}

/** Solo reconciliar idle si el target ya corrió un turno con este pending. */
export function canReconcileIdlePending(sawBusy: boolean | undefined): boolean {
  return sawBusy === true
}

export interface AbortOneDelegationResult {
  ok: boolean
  toPaneId?: string
  toAgentId?: string
  baseAgentId?: string
  wasPending: boolean
  wasDeferred: boolean
  remainingPending: number
  remainingDeferred: number
}

/**
 * Quita una delegación de pending/deferred/waveItems del job.
 * App se encarga de stop del pane, réplica, worktree y follow-up.
 */
export function abortOneDelegationInJob(
  job: OrchestrationJob,
  delegationId: string,
): AbortOneDelegationResult {
  const id = delegationId.trim()
  if (!id) {
    return {
      ok: false,
      wasPending: false,
      wasDeferred: false,
      remainingPending: job.pending.size,
      remainingDeferred: job.deferred.length,
    }
  }

  const pendingMeta = job.pending.get(id)
  const deferredIdx = job.deferred.findIndex(item => item.delegation.id === id)
  const deferred = deferredIdx >= 0 ? job.deferred[deferredIdx] : undefined
  if (!pendingMeta && !deferred) {
    const hadWave = job.waveItems.some(item => item.delegationId === id)
    if (hadWave) {
      job.waveItems = job.waveItems.filter(item => item.delegationId !== id)
    }
    return {
      ok: hadWave,
      wasPending: false,
      wasDeferred: false,
      remainingPending: job.pending.size,
      remainingDeferred: job.deferred.length,
    }
  }

  if (pendingMeta) job.pending.delete(id)
  if (deferredIdx >= 0) job.deferred.splice(deferredIdx, 1)
  job.waveItems = job.waveItems.filter(item => item.delegationId !== id)
  job.pendingMerges = job.pendingMerges.filter(item => item.delegationId !== id)

  const toPaneId = pendingMeta?.toPaneId ?? deferred?.toPaneId
  const toAgentId = pendingMeta?.toAgentId ?? deferred?.toAgentId
  const baseAgentId = pendingMeta?.baseAgentId

  return {
    ok: true,
    ...(toPaneId ? { toPaneId } : {}),
    ...(toAgentId ? { toAgentId } : {}),
    ...(baseAgentId ? { baseAgentId } : {}),
    wasPending: Boolean(pendingMeta),
    wasDeferred: Boolean(deferred),
    remainingPending: job.pending.size,
    remainingDeferred: job.deferred.length,
  }
}
