/**
 * End-to-end de correlación PO → Orquestador → Especialista → PO.
 *
 * Slice 4: no toca React ni electron. Modela el ciclo completo sobre las
 * primitivas puras que ya usan AgentPane y App:
 *   - orchestrationJobs (registro por pane de jobs vivos).
 *   - delegationRuntimeRegistry (mapa central de delegaciones vivas).
 *   - resolveOrchestrationJobIdForTurn (correlación follow-up ↔ job).
 */

import { describe, expect, it } from 'vitest'
import {
  createOrchestrationJob,
  findJobByDelegation,
  resolveOrchestrationJobIdForTurn,
  type OrchestrationJob,
} from '../orchestrationJobs'
import {
  deleteDelegationRuntime,
  getDelegationRuntime,
  listNestedDelegations,
  markDelegationRuntimeStatus,
  registerDelegationRuntime,
  type DelegationRuntimeRegistry,
} from '../delegationRuntimeRegistry'

type JobsByPane = Map<string, Map<string, OrchestrationJob>>

function ensureJobsMap(byPane: JobsByPane, paneId: string): Map<string, OrchestrationJob> {
  let map = byPane.get(paneId)
  if (!map) {
    map = new Map()
    byPane.set(paneId, map)
  }
  return map
}

describe('flujo PO → Orquestador → Especialista → PO', () => {
  it('correlaciona parentDelegationId, orchestrationJobId y cierra registry limpio', () => {
    const registry: DelegationRuntimeRegistry = new Map()
    const jobsByPane: JobsByPane = new Map()

    const poPane = 'p-po'
    const orqPane = 'p-orq'
    const specPane = 'p-spec'

    const poJob = createOrchestrationJob(poPane, 'job-po')
    ensureJobsMap(jobsByPane, poPane).set(poJob.jobId, poJob)
    const poDelegationId = 'd-po-to-orq'
    poJob.pending.set(poDelegationId, { toPaneId: orqPane, toAgentId: 'orchestrator' })
    poJob.hasDelegated = true
    poJob.round = 1
    registerDelegationRuntime(registry, {
      delegationId: poDelegationId,
      fromPaneId: poPane,
      toPaneId: orqPane,
      toAgentId: 'orchestrator',
      jobId: poJob.jobId,
    })

    expect(getDelegationRuntime(registry, poDelegationId)?.parentDelegationId).toBeUndefined()
    expect(findJobByDelegation(ensureJobsMap(jobsByPane, poPane).values(), poDelegationId)?.jobId)
      .toBe('job-po')

    const orqJob = createOrchestrationJob(orqPane, 'job-orq')
    ensureJobsMap(jobsByPane, orqPane).set(orqJob.jobId, orqJob)
    orqJob.round = 1
    orqJob.hasDelegated = true
    const nestedId = 'd-orq-to-spec'
    orqJob.pending.set(nestedId, {
      toPaneId: specPane,
      toAgentId: 'frontend',
      toThreadId: 'thread-spec-1',
    })
    registerDelegationRuntime(registry, {
      delegationId: nestedId,
      fromPaneId: orqPane,
      toPaneId: specPane,
      toAgentId: 'frontend',
      toThreadId: 'thread-spec-1',
      jobId: orqJob.jobId,
      parentDelegationId: poDelegationId,
    })

    expect(findJobByDelegation(ensureJobsMap(jobsByPane, orqPane).values(), nestedId)?.jobId)
      .toBe('job-orq')
    expect(findJobByDelegation(ensureJobsMap(jobsByPane, poPane).values(), nestedId))
      .toBeUndefined()

    expect(listNestedDelegations(registry, poDelegationId).map(item => item.delegationId))
      .toEqual([nestedId])

    orqJob.pending.delete(nestedId)
    orqJob.completedResults.push({
      id: nestedId,
      status: 'ok',
      summary: 'work done',
      fromPaneId: orqPane,
      orchestrationJobId: orqJob.jobId,
      toAgentId: 'frontend',
      toPaneId: specPane,
    })
    markDelegationRuntimeStatus(registry, nestedId, 'completed')
    deleteDelegationRuntime(registry, nestedId)
    expect(getDelegationRuntime(registry, nestedId)).toBeUndefined()

    const followUpJobId = resolveOrchestrationJobIdForTurn(orqJob.jobId, 'job-otro-turbo')
    expect(followUpJobId).toBe('job-orq')
    const fallback = resolveOrchestrationJobIdForTurn(undefined, orqJob.jobId)
    expect(fallback).toBe('job-orq')
    expect(fallback).not.toBe(poJob.jobId)

    expect(orqJob.pending.size).toBe(0)
    poJob.pending.delete(poDelegationId)
    poJob.completedResults.push({
      id: poDelegationId,
      status: 'ok',
      summary: 'orchestrator returned findings',
      fromPaneId: poPane,
      orchestrationJobId: poJob.jobId,
      toAgentId: 'orchestrator',
      toPaneId: orqPane,
    })
    deleteDelegationRuntime(registry, poDelegationId)

    const poFollowUpJobId = resolveOrchestrationJobIdForTurn(poJob.jobId, 'job-po')
    expect(poFollowUpJobId).toBe('job-po')

    expect(registry.size).toBe(0)
    expect(poJob.pending.size).toBe(0)
    expect(orqJob.pending.size).toBe(0)
    expect(poJob.completedResults.map(item => item.id)).toEqual([poDelegationId])
    expect(orqJob.completedResults.map(item => item.id)).toEqual([nestedId])
  })

  it('follow-up de ronda anterior en turbo no cae al último request humano', () => {
    const jobRound1 = createOrchestrationJob('p-orq', 'job-r1')
    const jobRound2 = createOrchestrationJob('p-orq', 'job-r2')
    const activeAfterHumanTurn = jobRound2.jobId

    const resolvedForFollowUp = resolveOrchestrationJobIdForTurn(
      jobRound1.jobId,
      activeAfterHumanTurn,
    )
    expect(resolvedForFollowUp).toBe('job-r1')

    const resolvedWithoutExplicit = resolveOrchestrationJobIdForTurn(undefined, activeAfterHumanTurn)
    expect(resolvedWithoutExplicit).toBe('job-r2')

    const nestedInR1 = 'd-r1-nested'
    jobRound1.pending.set(nestedInR1, { toPaneId: 'p-spec', toAgentId: 'qa' })
    const jobs = new Map<string, OrchestrationJob>([
      [jobRound1.jobId, jobRound1],
      [jobRound2.jobId, jobRound2],
    ])
    expect(findJobByDelegation(jobs.values(), nestedInR1)?.jobId).toBe('job-r1')
  })

  it('resultado huérfano (job desaparecido) sigue rescatable por registry', () => {
    const registry: DelegationRuntimeRegistry = new Map()
    registerDelegationRuntime(registry, {
      delegationId: 'd-nested',
      fromPaneId: 'p-orq',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      toThreadId: 'thread-orphan',
      jobId: 'job-orq',
      parentDelegationId: 'd-parent',
    })
    const entry = getDelegationRuntime(registry, 'd-nested')
    expect(entry?.parentDelegationId).toBe('d-parent')
    expect(entry?.jobId).toBe('job-orq')
    markDelegationRuntimeStatus(registry, 'd-nested', 'orphaned')
    deleteDelegationRuntime(registry, 'd-nested')
    expect(registry.size).toBe(0)
  })
})
