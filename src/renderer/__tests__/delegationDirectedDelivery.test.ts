/**
 * Entrega dirigida de resultados de delegación (contrato renderer ↔ shared).
 * Replica la resolución que usa App.handleDelegationTurnComplete.
 */

import { describe, expect, it } from 'vitest'
import type { DelegateResult } from '@shared/agentOrchestration'
import {
  abortOrchestrationJob,
  createOrchestrationJob,
  decideJobForTurn,
  type OrchestrationJob,
} from '@shared/orchestrationJobs'
import {
  registerDelegationRuntime,
  resolveDelegationDelivery,
  type DelegationRuntimeRegistry,
} from '@shared/delegationRuntimeRegistry'

type JobsByPane = Map<string, Map<string, OrchestrationJob>>

function ensureJobs(byPane: JobsByPane, paneId: string): Map<string, OrchestrationJob> {
  let map = byPane.get(paneId)
  if (!map) {
    map = new Map()
    byPane.set(paneId, map)
  }
  return map
}

function tryDeliver(
  registry: DelegationRuntimeRegistry,
  jobsByPane: JobsByPane,
  result: DelegateResult,
): { delivered: boolean; job?: OrchestrationJob } {
  const resolution = resolveDelegationDelivery(registry, result)
  if (resolution.kind !== 'deliver') return { delivered: false }
  const job = jobsByPane.get(result.fromPaneId)?.get(result.orchestrationJobId)
  if (!job?.pending.has(result.id)) return { delivered: false }
  job.pending.delete(result.id)
  job.completedResults.push(result)
  return { delivered: true, job }
}

function stubResult(
  partial: Partial<DelegateResult> & Pick<DelegateResult, 'id' | 'status' | 'summary'>,
): DelegateResult {
  return {
    fromPaneId: 'p-orq-a',
    orchestrationJobId: 'job-a',
    ...partial,
  }
}

describe('delegationDirectedDelivery', () => {
  it('dos orquestadores al mismo experto reciben cada uno su resultado', () => {
    const registry: DelegationRuntimeRegistry = new Map()
    const jobsByPane: JobsByPane = new Map()

    const jobA = createOrchestrationJob('p-orq-a', 'job-a')
    jobA.pending.set('d-a', { toPaneId: 'p-spec', toAgentId: 'frontend', toThreadId: 't-a' })
    ensureJobs(jobsByPane, 'p-orq-a').set(jobA.jobId, jobA)
    registerDelegationRuntime(registry, {
      delegationId: 'd-a',
      fromPaneId: 'p-orq-a',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      toThreadId: 't-a',
      jobId: jobA.jobId,
    })

    const jobB = createOrchestrationJob('p-orq-b', 'job-b')
    jobB.pending.set('d-b', { toPaneId: 'p-spec', toAgentId: 'frontend', toThreadId: 't-b' })
    ensureJobs(jobsByPane, 'p-orq-b').set(jobB.jobId, jobB)
    registerDelegationRuntime(registry, {
      delegationId: 'd-b',
      fromPaneId: 'p-orq-b',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      toThreadId: 't-b',
      jobId: jobB.jobId,
    })

    const resultA = stubResult({
      id: 'd-a',
      status: 'ok',
      summary: 'from A',
      fromPaneId: 'p-orq-a',
      orchestrationJobId: 'job-a',
      toThreadId: 't-a',
    })
    const resultB = stubResult({
      id: 'd-b',
      status: 'ok',
      summary: 'from B',
      fromPaneId: 'p-orq-b',
      orchestrationJobId: 'job-b',
      toThreadId: 't-b',
    })

    expect(tryDeliver(registry, jobsByPane, resultA).delivered).toBe(true)
    expect(tryDeliver(registry, jobsByPane, resultB).delivered).toBe(true)
    expect(jobA.completedResults[0]?.summary).toBe('from A')
    expect(jobB.completedResults[0]?.summary).toBe('from B')
    expect(jobA.completedResults).toHaveLength(1)
    expect(jobB.completedResults).toHaveLength(1)
  })

  it('un resultado con fromPaneId de otro orquestador no se entrega', () => {
    const registry: DelegationRuntimeRegistry = new Map()
    const jobsByPane: JobsByPane = new Map()
    const job = createOrchestrationJob('p-orq-a', 'job-a')
    job.pending.set('d-a', { toPaneId: 'p-spec', toAgentId: 'frontend' })
    ensureJobs(jobsByPane, 'p-orq-a').set(job.jobId, job)
    registerDelegationRuntime(registry, {
      delegationId: 'd-a',
      fromPaneId: 'p-orq-a',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      jobId: job.jobId,
    })

    const resolution = resolveDelegationDelivery(registry, stubResult({
      id: 'd-a',
      status: 'ok',
      summary: 'wrong sender',
      fromPaneId: 'p-orq-b',
      orchestrationJobId: 'job-a',
    }))
    expect(resolution.kind).toBe('mismatch')
    if (resolution.kind === 'mismatch') {
      expect(resolution.reason).toBe('fromPaneId')
    }
    expect(tryDeliver(registry, jobsByPane, stubResult({
      id: 'd-a',
      status: 'ok',
      summary: 'wrong sender',
      fromPaneId: 'p-orq-b',
      orchestrationJobId: 'job-a',
    })).delivered).toBe(false)
    expect(job.pending.has('d-a')).toBe(true)
  })

  it('un resultado con jobId viejo no se entrega', () => {
    const registry: DelegationRuntimeRegistry = new Map()
    const jobsByPane: JobsByPane = new Map()
    const job = createOrchestrationJob('p-orq-a', 'job-live')
    job.pending.set('d-a', { toPaneId: 'p-spec', toAgentId: 'frontend' })
    ensureJobs(jobsByPane, 'p-orq-a').set(job.jobId, job)
    registerDelegationRuntime(registry, {
      delegationId: 'd-a',
      fromPaneId: 'p-orq-a',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      jobId: job.jobId,
    })

    const resolution = resolveDelegationDelivery(registry, stubResult({
      id: 'd-a',
      status: 'ok',
      summary: 'stale job',
      fromPaneId: 'p-orq-a',
      orchestrationJobId: 'job-dead',
    }))
    expect(resolution.kind).toBe('mismatch')
    if (resolution.kind === 'mismatch') {
      expect(resolution.reason).toBe('jobId')
    }
    expect(job.pending.has('d-a')).toBe(true)
  })

  it('un fence con jobId inexistente crea job nuevo (no reutiliza el stale)', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const decision = decideJobForTurn({
      jobs,
      wantedJobId: 'job-ghost',
      workStyle: 'turbo',
    })
    expect(decision).toEqual({ kind: 'fresh', staleJobId: 'job-ghost' })
    const job = createOrchestrationJob('p-orq-a')
    jobs.set(job.jobId, job)
    expect(job.jobId).not.toBe('job-ghost')
    expect(jobs.has('job-ghost')).toBe(false)
  })

  it('abortOrchestrationJob cierra solo el job objetivo en turbo', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const jobA = createOrchestrationJob('p-orq', 'job-a')
    jobA.pending.set('d-a', {
      toPaneId: 'p-fe',
      toAgentId: 'frontend',
      toThreadId: 'thread-a',
    })
    const jobB = createOrchestrationJob('p-orq', 'job-b')
    jobB.pending.set('d-b', {
      toPaneId: 'p-be',
      toAgentId: 'backend',
      toThreadId: 'thread-b',
    })
    jobs.set(jobA.jobId, jobA)
    jobs.set(jobB.jobId, jobB)

    const aborted = abortOrchestrationJob(jobs, 'job-a')
    expect(aborted.ok).toBe(true)
    expect(aborted.abortedTargets).toEqual([{ toPaneId: 'p-fe', toThreadId: 'thread-a' }])
    expect(jobA.superseded).toBe(true)
    expect(jobB.pending.size).toBe(1)
    expect(jobB.superseded).toBeFalsy()
  })
})
