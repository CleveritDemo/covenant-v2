/**
 * Estado puro de jobs de orquestación (lineal ≤1 job vivo tras cleanup;
 * turbo N jobs concurrentes entre mensajes humanos).
 * App.tsx posee los refs; este módulo no toca React/electron.
 */

import type { DelegateRequest, DelegateResult, OrchestrationWorkStyle } from './agentOrchestration'
import { orchestrationRoundsAtCap, resolveOrchestrationWorkStyle } from './agentOrchestration'
import type { OrchestrationAwaitingItemInput } from './orchestrationAwaiting'
import {
  getDelegationRuntime,
  type DelegationRuntimeRegistry,
} from './delegationRuntimeRegistry'

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
  /** Carril de hilo del experto base que ejecuta la delegación. */
  toThreadId?: string
  /**
   * True when the target pane has been busy at least once while this pending
   * was live. Reconcile-idle must not complete a brand-new pending with an old
   * chat snippet before the specialist starts the new objective.
   */
  sawBusy?: boolean
  /** epoch ms del alta del pending; habilita la salida por antigüedad. */
  startedAt?: number
}

export interface OrchestrationDeferredItem {
  tabId: string
  delegation: DelegateRequest
  toPaneId: string
  toAgentId: string
  parentDelegationId?: string
}

export interface OrchestrationPendingMerge {
  delegationId: string
  completedAt: number
  result: DelegateResult
  info: {
    fromPaneId: string
    toPaneId: string
    toThreadId: string
    worktreePath: string
    branch: string
    baseCwd: string
    baseBranch: string
  }
}

export interface OrchestrationJob {
  jobId: string
  fromPaneId: string
  /** Hilo del orquestador que abrió este job (linear / turbo). */
  fromThreadId?: string
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
  /**
   * Identifica la delegación padre cuando este job lo emitió un orquestador que
   * corre dentro de un carril (subtarea con threadId).
   */
  parentDelegationId?: string
}

/** Delegación de carril para encolar follow-ups al hilo del orquestador padre. */
export type LaneDelegationForJob = {
  id: string
  fromPaneId: string
  toAgentId: string
  orchestrationJobId: string
  threadId: string
}

/**
 * Resuelve la delegación de carril padre para un follow-up al orquestador.
 * Devuelve undefined si el job no corre en carril o el registry no coincide.
 */
export function laneDelegationForJob(
  job: Pick<OrchestrationJob, 'parentDelegationId' | 'fromPaneId'>,
  registry: DelegationRuntimeRegistry,
): LaneDelegationForJob | undefined {
  const parentId = job.parentDelegationId?.trim()
  if (!parentId) return undefined
  const entry = getDelegationRuntime(registry, parentId)
  if (!entry) return undefined
  if (entry.toPaneId !== job.fromPaneId) return undefined
  const threadId = entry.toThreadId?.trim()
  if (!threadId) return undefined
  return {
    id: entry.delegationId,
    fromPaneId: entry.fromPaneId,
    toAgentId: entry.toAgentId,
    orchestrationJobId: entry.jobId,
    threadId,
  }
}

function newJobId(): string {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) return uuid
  return `job-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function dedupeDelegateResultsById(
  results: readonly DelegateResult[],
): DelegateResult[] {
  const seen = new Set<string>()
  const out: DelegateResult[] = []
  for (const r of results) {
    const id = r.id?.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(r)
  }
  return out
}

export function createOrchestrationJob(
  fromPaneId: string,
  jobId?: string,
  fromThreadId?: string,
): OrchestrationJob {
  const trimmedThreadId = fromThreadId?.trim()
  return {
    jobId: jobId?.trim() || newJobId(),
    fromPaneId,
    ...(trimmedThreadId ? { fromThreadId: trimmedThreadId } : {}),
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
 * Prioridad de jobId para un turno: el explícito del follow-up/request gana
 * sobre el “activo” del pane (que puede fliparse al despertar otro job en turbo).
 */
export function resolveOrchestrationJobIdForTurn(
  optionsJobId?: string | null,
  activeJobId?: string | null,
): string | undefined {
  const fromOptions = optionsJobId?.trim()
  if (fromOptions) return fromOptions
  const fromActive = activeJobId?.trim()
  return fromActive || undefined
}

export type JobForTurnDecision =
  | { kind: 'existing'; jobId: string }
  | { kind: 'reuseOnly'; jobId: string }
  | { kind: 'fresh'; staleJobId?: string }

function listAliveJobs(
  jobs: ReadonlyMap<string, OrchestrationJob>,
): OrchestrationJob[] {
  return [...jobs.values()].filter(job => !job.superseded)
}

/**
 * Decide qué job usar para un turno sin reutilizar ids que ya no existen en el mapa.
 */
export function decideJobForTurn(options: {
  jobs: ReadonlyMap<string, OrchestrationJob>
  wantedJobId?: string | null
  activeJobId?: string | null
  workStyle?: OrchestrationWorkStyle
}): JobForTurnDecision {
  const wanted = options.wantedJobId?.trim()
  if (wanted && options.jobs.has(wanted)) {
    return { kind: 'existing', jobId: wanted }
  }
  if (wanted) {
    return { kind: 'fresh', staleJobId: wanted }
  }

  const workStyle = resolveOrchestrationWorkStyle(options.workStyle)
  const alive = listAliveJobs(options.jobs)
  if (workStyle !== 'turbo' && alive.length === 1) {
    return { kind: 'reuseOnly', jobId: alive[0].jobId }
  }

  return { kind: 'fresh' }
}

export interface AbortedDelegationTarget {
  toPaneId: string
  toThreadId?: string
}

/**
 * Cierra un solo job: vacía pending/deferred y devuelve destinos que quedaban vivos.
 * No toca otros jobs del mismo orquestador.
 */
export function abortOrchestrationJob(
  jobs: Map<string, OrchestrationJob>,
  jobId: string,
): { ok: boolean; abortedTargets: AbortedDelegationTarget[] } {
  const id = jobId.trim()
  if (!id) return { ok: false, abortedTargets: [] }

  const job = jobs.get(id)
  if (!job) return { ok: false, abortedTargets: [] }

  const abortedTargets: AbortedDelegationTarget[] = []

  for (const meta of job.pending.values()) {
    abortedTargets.push({
      toPaneId: meta.toPaneId,
      ...(meta.toThreadId ? { toThreadId: meta.toThreadId } : {}),
    })
  }
  for (const item of job.deferred) {
    abortedTargets.push({
      toPaneId: item.toPaneId,
    })
  }

  job.pending.clear()
  job.deferred = []
  job.waveItems = []
  job.pendingMerges = []
  job.superseded = true

  return { ok: true, abortedTargets }
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
      out.push({
        ...item,
        toAgentId: live?.toAgentId ?? item.toAgentId,
        ...(live?.toPaneId
          ? { toPaneId: live.toPaneId }
          : item.toPaneId
            ? { toPaneId: item.toPaneId }
            : {}),
        status: pendingIds.has(item.delegationId)
          ? 'running'
          : deferredIds.has(item.delegationId)
            ? 'deferred'
            : 'done',
      })
    }
    for (const [delegationId, meta] of job.pending.entries()) {
      if (out.some(item => item.delegationId === delegationId)) continue
      out.push({
        delegationId,
        toAgentId: meta.toAgentId,
        toPaneId: meta.toPaneId,
        status: 'running',
      })
    }
    for (const deferred of job.deferred) {
      if (out.some(item => item.delegationId === deferred.delegation.id)) continue
      out.push({
        delegationId: deferred.delegation.id,
        toAgentId: deferred.toAgentId,
        toPaneId: deferred.toPaneId,
        status: 'deferred',
      })
    }
  }
  return out
}

export function upsertOrchestrationWaveItem(
  job: OrchestrationJob,
  input: OrchestrationAwaitingItemInput,
): void {
  const id = input.delegationId.trim()
  if (!id) return
  const next: OrchestrationAwaitingItemInput = {
    delegationId: id,
    toAgentId: input.toAgentId,
    status: input.status,
    ...(input.toPaneId?.trim() ? { toPaneId: input.toPaneId.trim() } : {}),
    ...(input.toThreadId?.trim() ? { toThreadId: input.toThreadId.trim() } : {}),
    ...(input.worktreePath?.trim() ? { worktreePath: input.worktreePath.trim() } : {}),
  }
  const idx = job.waveItems.findIndex(item => item.delegationId === id)
  if (idx >= 0) {
    job.waveItems[idx] = { ...job.waveItems[idx], ...next }
    return
  }
  job.waveItems.push(next)
}

/** Hilos del orquestador con job awaiting, agrupados por pane (sin duplicar ids). */
export function awaitingOrchestratorThreadIdsByPane(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [paneId, jobs] of byPane.entries()) {
    for (const job of jobs.values()) {
      if (!isJobAwaiting(job)) continue
      const fromThreadId = job.fromThreadId?.trim()
      if (!fromThreadId) continue
      const existing = out.get(paneId)
      if (existing) {
        if (!existing.includes(fromThreadId)) existing.push(fromThreadId)
      } else {
        out.set(paneId, [fromThreadId])
      }
    }
  }
  return out
}

/** Panes con job awaiting sin fromThreadId (fallback pane-level en el gate). */
export function orchestratorAwaitingHasLegacyByPane(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const out = new Set<string>()
  for (const [paneId, jobs] of byPane.entries()) {
    for (const job of jobs.values()) {
      if (isJobAwaiting(job) && !job.fromThreadId?.trim()) {
        out.add(paneId)
        break
      }
    }
  }
  return out
}

/** Panes especialista con pending sin toThreadId (fallback pane-level en el gate). */
export function specialistPendingHasLegacyByPane(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const out = new Set<string>()
  for (const jobs of byPane.values()) {
    for (const job of jobs.values()) {
      for (const meta of job.pending.values()) {
        if (!meta.toThreadId?.trim()) {
          out.add(meta.toPaneId)
        }
      }
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

/** Hilos destino ocupados por pending, agrupados por pane (sin duplicar ids). */
export function occupiedTargetThreadIdsByPane(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const jobs of byPane.values()) {
    for (const job of jobs.values()) {
      for (const meta of job.pending.values()) {
        const toPaneId = meta.toPaneId?.trim()
        const toThreadId = meta.toThreadId?.trim()
        if (!toPaneId || !toThreadId) continue
        const existing = out.get(toPaneId)
        if (existing) {
          if (!existing.includes(toThreadId)) existing.push(toThreadId)
        } else {
          out.set(toPaneId, [toThreadId])
        }
      }
    }
  }
  return out
}

/** Orquestadores con pending o deferred (para descartar FIFO de subtareas abortadas). */
export function pendingOrchestratorIdsFromJobs(
  byPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
): Set<string> {
  const out = new Set<string>()
  for (const [paneId, jobs] of byPane.entries()) {
    for (const job of jobs.values()) {
      if (job.pending.size > 0 || job.deferred.length > 0) {
        out.add(paneId)
        break
      }
    }
  }
  return out
}

/** Orquestadores con al menos una deferred hacia `freedPaneId` (orden de inserción, sin duplicados). */
export function orchestratorPanesWithDeferredForPane(
  jobsByPane: ReadonlyMap<string, ReadonlyMap<string, OrchestrationJob>>,
  freedPaneId: string,
): string[] {
  const wanted = freedPaneId.trim()
  if (!wanted) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const [fromPaneId, jobs] of jobsByPane.entries()) {
    if (seen.has(fromPaneId)) continue
    for (const job of jobs.values()) {
      if (job.deferred.some(item => item.toPaneId === wanted)) {
        out.push(fromPaneId)
        seen.add(fromPaneId)
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
  startedAt?: number
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
            ...(typeof meta.startedAt === 'number' ? { startedAt: meta.startedAt } : {}),
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

/**
 * Cuánto se espera antes de cerrar un pending que nunca se vio ocupado.
 * Holgado a propósito: el precio de equivocarse por abajo es cerrar una
 * subtarea que estaba por arrancar.
 */
export const IDLE_PENDING_GRACE_MS = 60_000

/**
 * Reconciliar idle pide haber visto al target ocupado con este pending: cerrar
 * antes usaría el snippet del turno anterior.
 *
 * La salida por antigüedad existe porque `sawBusy` era una puerta de una sola
 * dirección: si el turno nunca llegó a verse ocupado —no arrancó, o empezó y
 * terminó entre dos publicaciones de estado— la fila se quedaba en "running"
 * para siempre con el especialista parado, sin más salida que el Stop.
 */
export function canReconcileIdlePending(
  sawBusy: boolean | undefined,
  age?: { startedAt?: number; nowMs: number },
): boolean {
  if (sawBusy === true) return true
  const startedAt = age?.startedAt
  if (typeof startedAt !== 'number' || !age) return false
  return age.nowMs - startedAt >= IDLE_PENDING_GRACE_MS
}

export interface IdleReconcileOutcome {
  status: 'ok' | 'fail'
  summary: string
}

/**
 * Resultado de reconcile-idle: nunca ok si el especialista no llegó a verse busy.
 * sawBusy false/undefined implica que el snippet del chat puede ser de otro turno.
 */
export function resolveIdleReconcileOutcome(input: {
  failed: boolean
  sawBusy: boolean | undefined
  summary: string
  emptyFallback: string
  unconfirmedLabel: string
}): IdleReconcileOutcome {
  if (input.failed) {
    return {
      status: 'fail',
      summary: input.summary.trim() || input.unconfirmedLabel,
    }
  }
  if (input.sawBusy !== true) {
    return { status: 'fail', summary: input.unconfirmedLabel }
  }
  const trimmed = input.summary.trim()
  if (!trimmed || trimmed === input.emptyFallback) {
    return { status: 'fail', summary: input.unconfirmedLabel }
  }
  return { status: 'ok', summary: trimmed }
}

export interface AbortOneDelegationResult {
  ok: boolean
  toPaneId?: string
  toAgentId?: string
  wasPending: boolean
  wasDeferred: boolean
  remainingPending: number
  remainingDeferred: number
}

/**
 * Quita una delegación de pending/deferred/waveItems del job.
 * App se encarga de stop del pane, worktree y follow-up.
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

  return {
    ok: true,
    ...(toPaneId ? { toPaneId } : {}),
    ...(toAgentId ? { toAgentId } : {}),
    wasPending: Boolean(pendingMeta),
    wasDeferred: Boolean(deferred),
    remainingPending: job.pending.size,
    remainingDeferred: job.deferred.length,
  }
}

export interface CancelledDeferredDelegation {
  fromPaneId: string
  job: OrchestrationJob
  delegationId: string
  toAgentId: string
  tabId: string
}

/**
 * Quita delegaciones diferidas cuyo destino es el pane detenido (Stop humano).
 * No toca pending ni runtime; App notifica al orquestador y limpia el registry.
 */
export function cancelDeferredDelegationsForStoppedPane(
  jobsByPane: Map<string, Map<string, OrchestrationJob>>,
  stoppedPaneId: string,
): CancelledDeferredDelegation[] {
  const paneId = stoppedPaneId.trim()
  if (!paneId) return []

  const cancelled: CancelledDeferredDelegation[] = []
  for (const [fromPaneId, jobsMap] of jobsByPane.entries()) {
    for (const job of jobsMap.values()) {
      const kept: OrchestrationJob['deferred'] = []
      for (const item of job.deferred) {
        if (item.toPaneId === paneId) {
          const delegationId = item.delegation.id
          job.waveItems = job.waveItems.filter(wave => wave.delegationId !== delegationId)
          cancelled.push({
            fromPaneId,
            job,
            delegationId,
            toAgentId: item.toAgentId,
            tabId: item.tabId,
          })
        } else {
          kept.push(item)
        }
      }
      job.deferred = kept
    }
  }
  return cancelled
}
