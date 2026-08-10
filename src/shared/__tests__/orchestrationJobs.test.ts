import { describe, expect, it } from 'vitest'
import {
  awaitingOrchestratorPaneIds,
  abortOneDelegationInJob,
  createOrchestrationJob,
  findJobByDelegation,
  flattenAwaitingItemsFromJobs,
  jobRoundsAtCap,
  occupiedPaneIdsAcrossJobs,
  pendingOrchestratorIdsFromJobs,
  resolveOrchestrationWorkStyle,
  sanitizeOrchestrationWorkStyle,
  shouldAbortOnHumanTurn,
  shouldWakeJob,
  type OrchestrationJob,
} from '../orchestrationJobs'
import { ORCHESTRATION_UNLIMITED_ROUNDS } from '../agentOrchestration'

function jobWithPending(
  fromPaneId: string,
  delegationId: string,
  toPaneId: string,
): OrchestrationJob {
  const job = createOrchestrationJob(fromPaneId)
  job.pending.set(delegationId, { toPaneId, toAgentId: 'frontend' })
  job.waveItems.push({
    delegationId,
    toAgentId: 'frontend',
    status: 'running',
  })
  return job
}

describe('orchestrationWorkStyle helpers', () => {
  it('sanitizes turbo vs linear default', () => {
    expect(sanitizeOrchestrationWorkStyle('turbo')).toBe('turbo')
    expect(sanitizeOrchestrationWorkStyle('linear')).toBe('linear')
    expect(sanitizeOrchestrationWorkStyle(undefined)).toBe('linear')
    expect(resolveOrchestrationWorkStyle('turbo')).toBe('turbo')
    expect(resolveOrchestrationWorkStyle(null)).toBe('linear')
  })

  it('aborts on human turn only in linear', () => {
    expect(shouldAbortOnHumanTurn('linear')).toBe(true)
    expect(shouldAbortOnHumanTurn('turbo')).toBe(false)
  })
})

describe('createOrchestrationJob / findJobByDelegation', () => {
  it('creates empty job with id and zero round', () => {
    const job = createOrchestrationJob('orch-1', 'job-fixed')
    expect(job.jobId).toBe('job-fixed')
    expect(job.fromPaneId).toBe('orch-1')
    expect(job.round).toBe(0)
    expect(job.pending.size).toBe(0)
    expect(job.deferred).toEqual([])
    expect(job.hasDelegated).toBe(false)
  })

  it('finds job by pending, deferred, or wave item', () => {
    const a = jobWithPending('orch', 'd1', 'pane-a')
    const b = createOrchestrationJob('orch')
    b.deferred.push({
      tabId: 'tab',
      delegation: { id: 'd2', toAgentId: 'backend', objective: 'x' },
      toPaneId: 'pane-b',
      toAgentId: 'backend',
    })
    expect(findJobByDelegation([a, b], 'd1')?.jobId).toBe(a.jobId)
    expect(findJobByDelegation([a, b], 'd2')?.jobId).toBe(b.jobId)
    expect(findJobByDelegation([a, b], 'missing')).toBeUndefined()
  })
})

describe('occupiedPaneIdsAcrossJobs', () => {
  it('unions pending and deferred panes across jobs', () => {
    const j1 = jobWithPending('orch', 'd1', 'pane-fe')
    const j2 = createOrchestrationJob('orch')
    j2.pending.set('d2', { toPaneId: 'pane-be', toAgentId: 'backend' })
    j2.deferred.push({
      tabId: 't',
      delegation: { id: 'd3', toAgentId: 'frontend', objective: 'y' },
      toPaneId: 'pane-fe-2',
      toAgentId: 'frontend',
    })
    expect([...occupiedPaneIdsAcrossJobs([j1, j2])].sort()).toEqual(
      ['pane-be', 'pane-fe', 'pane-fe-2'].sort(),
    )
  })
})

describe('shouldWakeJob / jobRoundsAtCap', () => {
  it('wakes only when pending and deferred are empty', () => {
    expect(shouldWakeJob(0, 0)).toBe(true)
    expect(shouldWakeJob(1, 0)).toBe(false)
    expect(shouldWakeJob(0, 1)).toBe(false)
  })

  it('caps rounds per job', () => {
    const job = createOrchestrationJob('orch')
    job.round = 2
    expect(jobRoundsAtCap(job, 3)).toBe(false)
    job.round = 3
    expect(jobRoundsAtCap(job, 3)).toBe(true)
    expect(jobRoundsAtCap(job, ORCHESTRATION_UNLIMITED_ROUNDS)).toBe(false)
  })
})

describe('flattenAwaitingItemsFromJobs / pane id sets', () => {
  it('flattens items from all jobs', () => {
    const j1 = jobWithPending('orch', 'd1', 'pane-a')
    const j2 = jobWithPending('orch', 'd2', 'pane-b')
    const items = flattenAwaitingItemsFromJobs([j1, j2])
    expect(items.map(item => item.delegationId)).toEqual(['d1', 'd2'])
    expect(items.every(item => item.status === 'running')).toBe(true)
    expect(items.map(item => item.toPaneId)).toEqual(['pane-a', 'pane-b'])
  })

  it('tracks awaiting and pending orchestrator panes', () => {
    const byPane = new Map<string, Map<string, OrchestrationJob>>()
    const jobs = new Map<string, OrchestrationJob>()
    const j1 = jobWithPending('orch-1', 'd1', 'pane-a')
    jobs.set(j1.jobId, j1)
    byPane.set('orch-1', jobs)
    const idle = new Map<string, OrchestrationJob>()
    const jIdle = createOrchestrationJob('orch-2')
    idle.set(jIdle.jobId, jIdle)
    byPane.set('orch-2', idle)

    expect([...awaitingOrchestratorPaneIds(byPane)]).toEqual(['orch-1'])
    expect([...pendingOrchestratorIdsFromJobs(byPane)]).toEqual(['orch-1'])
  })
})

describe('abortOneDelegationInJob', () => {
  it('removes one pending item and leaves the other', () => {
    const job = jobWithPending('orch', 'd1', 'pane-a')
    job.pending.set('d2', { toPaneId: 'pane-b', toAgentId: 'backend' })
    job.waveItems.push({
      delegationId: 'd2',
      toAgentId: 'backend',
      status: 'running',
    })
    const result = abortOneDelegationInJob(job, 'd1')
    expect(result).toMatchObject({
      ok: true,
      wasPending: true,
      toPaneId: 'pane-a',
      remainingPending: 1,
    })
    expect(job.pending.has('d1')).toBe(false)
    expect(job.pending.has('d2')).toBe(true)
    expect(job.waveItems.map(item => item.delegationId)).toEqual(['d2'])
  })

  it('removes deferred-only delegation without touching other pending', () => {
    const job = jobWithPending('orch', 'd1', 'pane-a')
    job.deferred.push({
      tabId: 't',
      delegation: { id: 'd3', toAgentId: 'qa', objective: 'x' },
      toPaneId: 'pane-qa',
      toAgentId: 'qa',
    })
    const result = abortOneDelegationInJob(job, 'd3')
    expect(result).toMatchObject({
      ok: true,
      wasDeferred: true,
      toPaneId: 'pane-qa',
      remainingPending: 1,
      remainingDeferred: 0,
    })
    expect(job.pending.has('d1')).toBe(true)
  })
})
