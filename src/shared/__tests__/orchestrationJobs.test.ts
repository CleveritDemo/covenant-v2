import { describe, expect, it } from 'vitest'
import {
  awaitingOrchestratorPaneIds,
  abortOneDelegationInJob,
  canReconcileIdlePending,
  createOrchestrationJob,
  findJobByDelegation,
  findPendingDelegationByToPane,
  flattenAwaitingItemsFromJobs,
  jobRoundsAtCap,
  markPendingSawBusyForPane,
  occupiedPaneIdsAcrossJobs,
  pendingOrchestratorIdsFromJobs,
  resolveOrchestrationWorkStyle,
  sanitizeOrchestrationWorkStyle,
  shouldAbortOnHumanTurn,
  shouldDeliverOrchestrationJobFollowUp,
  shouldWakeJob,
  supersedeOrchestrationJobsForHumanTurn,
  upsertOrchestrationWaveItem,
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
    expect(shouldAbortOnHumanTurn()).toBe(true)
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

  it('flattens deferred replicas with baseAgentId and pane for Waiting Stop', () => {
    const job = createOrchestrationJob('orch')
    job.deferred.push({
      tabId: 'tab',
      delegation: { id: 'd-replica', toAgentId: 'frontend#2', objective: 'x' },
      toPaneId: 'pane-replica',
      toAgentId: 'frontend-2',
      baseAgentId: 'frontend',
    })
    expect(flattenAwaitingItemsFromJobs([job])).toEqual([
      {
        delegationId: 'd-replica',
        toAgentId: 'frontend-2',
        toPaneId: 'pane-replica',
        baseAgentId: 'frontend',
        status: 'running',
      },
    ])
  })

  it('upserts wave items with replica metadata instead of dropping pane/base info', () => {
    const job = createOrchestrationJob('orch')
    upsertOrchestrationWaveItem(job, {
      delegationId: 'd-replica',
      toAgentId: 'frontend-2',
      toPaneId: 'pane-replica',
      baseAgentId: 'frontend',
      status: 'running',
    })
    upsertOrchestrationWaveItem(job, {
      delegationId: 'd-replica',
      toAgentId: 'frontend-2',
      toPaneId: 'pane-replica-new',
      baseAgentId: 'frontend',
      status: 'running',
    })
    expect(job.waveItems).toEqual([
      {
        delegationId: 'd-replica',
        toAgentId: 'frontend-2',
        toPaneId: 'pane-replica-new',
        baseAgentId: 'frontend',
        status: 'running',
      },
    ])
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

describe('findPendingDelegationByToPane', () => {
  it('returns the pending entry for a specialist pane', () => {
    const byPane = new Map<string, Map<string, ReturnType<typeof createOrchestrationJob>>>()
    const jobs = new Map<string, ReturnType<typeof createOrchestrationJob>>()
    const job = jobWithPending('orch', 'd1', 'pane-front')
    jobs.set(job.jobId, job)
    byPane.set('orch', jobs)
    expect(findPendingDelegationByToPane(byPane, 'pane-front')).toMatchObject({
      fromPaneId: 'orch',
      delegationId: 'd1',
      sawBusy: false,
    })
    expect(findPendingDelegationByToPane(byPane, 'missing')).toBeNull()
  })
})

describe('pending sawBusy / idle reconcile gate', () => {
  it('markPendingSawBusyForPane arms reconcile; fresh pending stays blocked', () => {
    const byPane = new Map<string, Map<string, ReturnType<typeof createOrchestrationJob>>>()
    const jobs = new Map<string, ReturnType<typeof createOrchestrationJob>>()
    const job = jobWithPending('orch', 'd-new', 'pane-be')
    jobs.set(job.jobId, job)
    byPane.set('orch', jobs)

    const fresh = findPendingDelegationByToPane(byPane, 'pane-be')
    expect(fresh?.sawBusy).toBe(false)
    expect(canReconcileIdlePending(fresh?.sawBusy)).toBe(false)

    markPendingSawBusyForPane(byPane, 'pane-be')
    const armed = findPendingDelegationByToPane(byPane, 'pane-be')
    expect(armed?.sawBusy).toBe(true)
    expect(canReconcileIdlePending(armed?.sawBusy)).toBe(true)
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

  it('returns baseAgentId when aborting a deferred replica', () => {
    const job = createOrchestrationJob('orch')
    job.deferred.push({
      tabId: 't',
      delegation: { id: 'd-replica', toAgentId: 'frontend#2', objective: 'x' },
      toPaneId: 'pane-replica',
      toAgentId: 'frontend-2',
      baseAgentId: 'frontend',
    })
    expect(abortOneDelegationInJob(job, 'd-replica')).toMatchObject({
      ok: true,
      wasDeferred: true,
      toPaneId: 'pane-replica',
      toAgentId: 'frontend-2',
      baseAgentId: 'frontend',
    })
  })
})

describe('linear cleanup vs turbo parallel human jobs', () => {
  it('linear supersede blocks prior job follow-up after cleanup', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const oldJob = jobWithPending('orch', 'd-old', 'pane-a')
    oldJob.jobId = 'job-linear-old'
    jobs.set(oldJob.jobId, oldJob)

    supersedeOrchestrationJobsForHumanTurn(jobs)
    expect(oldJob.superseded).toBe(true)
    expect(shouldDeliverOrchestrationJobFollowUp(jobs, oldJob)).toBe(false)

    jobs.clear()
    const newJob = createOrchestrationJob('orch', 'job-linear-new')
    jobs.set(newJob.jobId, newJob)
    expect(shouldDeliverOrchestrationJobFollowUp(jobs, oldJob)).toBe(false)
    expect(shouldDeliverOrchestrationJobFollowUp(jobs, newJob)).toBe(true)
  })

  it('turbo human turn keeps prior job deliverable alongside the new job', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const prior = jobWithPending('orch', 'd-old', 'pane-a')
    prior.jobId = 'd8e89d1b'
    jobs.set(prior.jobId, prior)

    // Turbo: no supersede/abort — solo añade el job del nuevo mensaje humano.
    expect(shouldAbortOnHumanTurn('turbo')).toBe(false)
    const next = createOrchestrationJob('orch', 'job-new')
    next.pending.set('d-new', { toPaneId: 'pane-b', toAgentId: 'frontend' })
    jobs.set(next.jobId, next)

    expect(shouldDeliverOrchestrationJobFollowUp(jobs, prior)).toBe(true)
    expect(shouldDeliverOrchestrationJobFollowUp(jobs, next)).toBe(true)
    expect(prior.superseded).toBeFalsy()
  })
})
