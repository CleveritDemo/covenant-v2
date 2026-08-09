/**
 * Estado puro de jobs de orquestación (lineal ≤1 job; turbo N jobs concurrentes).
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
        status: stillActive ? 'running' : 'done',
      })
    }
    for (const [delegationId, meta] of job.pending.entries()) {
      if (out.some(item => item.delegationId === delegationId)) continue
      out.push({
        delegationId,
        toAgentId: meta.toAgentId,
        ...(meta.baseAgentId ? { baseAgentId: meta.baseAgentId } : {}),
        status: 'running',
      })
    }
    for (const deferred of job.deferred) {
      if (out.some(item => item.delegationId === deferred.delegation.id)) continue
      out.push({
        delegationId: deferred.delegation.id,
        toAgentId: deferred.toAgentId,
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
