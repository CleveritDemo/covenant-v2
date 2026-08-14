import { describe, expect, it } from 'vitest'
import {
  awaitingOrchestratorPaneIds,
  abortOneDelegationInJob,
  abortOrchestrationJob,
  cancelDeferredDelegationsForStoppedPane,
  canReconcileIdlePending,
  createOrchestrationJob,
  decideJobForTurn,
  dedupeDelegateResultsById,
  findJobByDelegation,
  findPendingDelegationByToPane,
  IDLE_PENDING_GRACE_MS,
  flattenAwaitingItemsFromJobs,
  jobRoundsAtCap,
  markPendingSawBusyForPane,
  occupiedPaneIdsAcrossJobs,
  pendingOrchestratorIdsFromJobs,
  resolveOrchestrationWorkStyle,
  sanitizeOrchestrationWorkStyle,
  resolveOrchestrationJobIdForTurn,
  shouldAbortOnHumanTurn,
  shouldDeliverOrchestrationJobFollowUp,
  shouldWakeJob,
  supersedeOrchestrationJobsForHumanTurn,
  upsertOrchestrationWaveItem,
  type OrchestrationJob,
} from '../orchestrationJobs'
import { ORCHESTRATION_UNLIMITED_ROUNDS, type DelegateResult } from '../agentOrchestration'

function stubResult(
  partial: Partial<DelegateResult> & Pick<DelegateResult, 'id' | 'status' | 'summary'>,
): DelegateResult {
  return {
    fromPaneId: 'orch',
    orchestrationJobId: 'job-1',
    ...partial,
  }
}

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

describe('dedupeDelegateResultsById', () => {
  it('keeps first occurrence per id and drops blanks/duplicates', () => {
    const first = stubResult({ id: 'd1', status: 'ok', summary: 'a', toAgentId: 'fe' })
    const dup = stubResult({ id: 'd1', status: 'ok', summary: 'b', toAgentId: 'fe' })
    const second = stubResult({ id: 'd2', status: 'ok', summary: 'c', toAgentId: 'be' })
    expect(dedupeDelegateResultsById([first, dup, second])).toEqual([first, second])
    expect(dedupeDelegateResultsById([
      stubResult({ id: '  ', status: 'ok', summary: 'x', toAgentId: 'fe' }),
      second,
    ])).toEqual([second])
    expect(dedupeDelegateResultsById([])).toEqual([])
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

  it('flattens deferred items with pane and thread for Waiting Stop', () => {
    const job = createOrchestrationJob('orch')
    job.deferred.push({
      tabId: 'tab',
      delegation: { id: 'd-lane', toAgentId: 'frontend', objective: 'x' },
      toPaneId: 'pane-front',
      toAgentId: 'frontend',
    })
    upsertOrchestrationWaveItem(job, {
      delegationId: 'd-lane',
      toAgentId: 'frontend',
      toPaneId: 'pane-front',
      toThreadId: 'thread-lane-1',
      status: 'deferred',
    })
    expect(flattenAwaitingItemsFromJobs([job])).toEqual([
      {
        delegationId: 'd-lane',
        toAgentId: 'frontend',
        toPaneId: 'pane-front',
        toThreadId: 'thread-lane-1',
        status: 'deferred',
      },
    ])
  })

  it('upserts wave items with pane and thread instead of dropping lane info', () => {
    const job = createOrchestrationJob('orch')
    upsertOrchestrationWaveItem(job, {
      delegationId: 'd-lane',
      toAgentId: 'frontend',
      toPaneId: 'pane-front',
      toThreadId: 'thread-lane-1',
      status: 'running',
    })
    upsertOrchestrationWaveItem(job, {
      delegationId: 'd-lane',
      toAgentId: 'frontend',
      toPaneId: 'pane-front-new',
      toThreadId: 'thread-lane-2',
      status: 'running',
    })
    expect(job.waveItems).toEqual([
      {
        delegationId: 'd-lane',
        toAgentId: 'frontend',
        toPaneId: 'pane-front-new',
        toThreadId: 'thread-lane-2',
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

  // `sawBusy` era una puerta de una sola dirección: si el turno nunca se vio
  // ocupado, la fila quedaba en "running" para siempre con el pane parado.
  it('un pending viejo se puede reconciliar aunque nunca se lo viera ocupado', () => {
    const startedAt = 1_000_000
    expect(canReconcileIdlePending(false, { startedAt, nowMs: startedAt })).toBe(false)
    expect(canReconcileIdlePending(false, {
      startedAt,
      nowMs: startedAt + IDLE_PENDING_GRACE_MS - 1,
    })).toBe(false)
    expect(canReconcileIdlePending(false, {
      startedAt,
      nowMs: startedAt + IDLE_PENDING_GRACE_MS,
    })).toBe(true)
  })

  it('sin startedAt sigue mandando sawBusy: nada se cierra por accidente', () => {
    expect(canReconcileIdlePending(false, { nowMs: 9_999_999 })).toBe(false)
    expect(canReconcileIdlePending(undefined)).toBe(false)
    expect(canReconcileIdlePending(true)).toBe(true)
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

  it('returns pane and thread when aborting a deferred item', () => {
    const job = createOrchestrationJob('orch')
    job.deferred.push({
      tabId: 't',
      delegation: { id: 'd-lane', toAgentId: 'frontend', objective: 'x' },
      toPaneId: 'pane-front',
      toAgentId: 'frontend',
    })
    expect(abortOneDelegationInJob(job, 'd-lane')).toMatchObject({
      ok: true,
      wasDeferred: true,
      toPaneId: 'pane-front',
      toAgentId: 'frontend',
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

  it('resolveOrchestrationJobIdForTurn prefers explicit follow-up over flipped active', () => {
    expect(resolveOrchestrationJobIdForTurn('job-owner', 'job-other-active')).toBe('job-owner')
    expect(resolveOrchestrationJobIdForTurn(undefined, 'job-active')).toBe('job-active')
    expect(resolveOrchestrationJobIdForTurn('  ', 'job-active')).toBe('job-active')
    expect(resolveOrchestrationJobIdForTurn(null, null)).toBeUndefined()
  })

  it('findJobByDelegation routes follow-ups to the owning turbo job only', () => {
    const jobA = jobWithPending('orch', 'd-a', 'pane-a')
    jobA.jobId = 'job-a'
    const jobB = jobWithPending('orch', 'd-b', 'pane-b')
    jobB.jobId = 'job-b'
    expect(findJobByDelegation([jobA, jobB], 'd-a')?.jobId).toBe('job-a')
    expect(findJobByDelegation([jobA, jobB], 'd-b')?.jobId).toBe('job-b')
  })
})

describe('cancelDeferredDelegationsForStoppedPane', () => {
  it('quita todas las diferidas del pane detenido y deja vivas las de otros panes', () => {
    const job = createOrchestrationJob('p-orq')
    job.pending.set('d-live', {
      toPaneId: 'pane-fe',
      toAgentId: 'frontend',
      toThreadId: 'thread-live',
      startedAt: Date.now(),
    })
    job.deferred.push(
      {
        tabId: 'tab-1',
        delegation: { id: 'd-def-1', toAgentId: 'frontend', objective: 'one' },
        toPaneId: 'pane-fe',
        toAgentId: 'frontend',
      },
      {
        tabId: 'tab-1',
        delegation: { id: 'd-def-2', toAgentId: 'frontend', objective: 'two' },
        toPaneId: 'pane-fe',
        toAgentId: 'frontend',
      },
      {
        tabId: 'tab-1',
        delegation: { id: 'd-other', toAgentId: 'backend', objective: 'other' },
        toPaneId: 'pane-be',
        toAgentId: 'backend',
      },
    )
    for (const id of ['d-live', 'd-def-1', 'd-def-2', 'd-other']) {
      upsertOrchestrationWaveItem(job, {
        delegationId: id,
        toAgentId: id === 'd-other' ? 'backend' : 'frontend',
        toPaneId: id === 'd-other' ? 'pane-be' : 'pane-fe',
        status: id === 'd-live' ? 'running' : 'deferred',
      })
    }

    const jobsByPane = new Map([['p-orq', new Map([[job.jobId, job]])]])
    const cancelled = cancelDeferredDelegationsForStoppedPane(jobsByPane, 'pane-fe')

    expect(job.pending.size).toBe(1)
    expect(job.deferred).toHaveLength(1)
    expect(job.deferred[0].delegation.id).toBe('d-other')
    expect(cancelled.map(item => item.delegationId).sort()).toEqual(['d-def-1', 'd-def-2'])
    expect(cancelled.every(item => item.fromPaneId === 'p-orq')).toBe(true)
    expect(job.waveItems.some(item => item.delegationId === 'd-def-1')).toBe(false)
    expect(job.waveItems.some(item => item.delegationId === 'd-def-2')).toBe(false)
    expect(job.waveItems.some(item => item.delegationId === 'd-live')).toBe(true)
    expect(job.waveItems.some(item => item.delegationId === 'd-other')).toBe(true)
  })
})

describe('decideJobForTurn', () => {
  it('returns existing when wanted id is in the map', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const job = createOrchestrationJob('orch', 'job-live')
    jobs.set(job.jobId, job)
    expect(decideJobForTurn({ jobs, wantedJobId: 'job-live', workStyle: 'turbo' }))
      .toEqual({ kind: 'existing', jobId: 'job-live' })
  })

  it('returns reuseOnly in linear when exactly one alive job exists', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const job = createOrchestrationJob('orch', 'job-linear')
    jobs.set(job.jobId, job)
    expect(decideJobForTurn({ jobs, workStyle: 'linear' }))
      .toEqual({ kind: 'reuseOnly', jobId: 'job-linear' })
  })

  it('returns fresh with staleJobId when wanted id is missing', () => {
    const jobs = new Map<string, OrchestrationJob>()
    expect(decideJobForTurn({ jobs, wantedJobId: 'job-ghost', workStyle: 'turbo' }))
      .toEqual({ kind: 'fresh', staleJobId: 'job-ghost' })
    expect(decideJobForTurn({ jobs, wantedJobId: 'job-ghost', workStyle: 'linear' }))
      .toEqual({ kind: 'fresh', staleJobId: 'job-ghost' })
  })

  it('returns fresh in turbo when no wanted id even with alive jobs', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const a = createOrchestrationJob('orch', 'job-a')
    const b = createOrchestrationJob('orch', 'job-b')
    jobs.set(a.jobId, a)
    jobs.set(b.jobId, b)
    expect(decideJobForTurn({ jobs, workStyle: 'turbo' })).toEqual({ kind: 'fresh' })
  })

  it('never reuses a missing wanted id as existing', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const alive = createOrchestrationJob('orch', 'job-alive')
    jobs.set(alive.jobId, alive)
    const decision = decideJobForTurn({
      jobs,
      wantedJobId: 'job-missing',
      workStyle: 'linear',
    })
    expect(decision).toEqual({ kind: 'fresh', staleJobId: 'job-missing' })
    expect(decision).not.toEqual({ kind: 'existing', jobId: 'job-missing' })
  })
})

describe('abortOrchestrationJob', () => {
  it('aborts one turbo job without touching a sibling job on the same orchestrator', () => {
    const jobs = new Map<string, OrchestrationJob>()
    const jobA = createOrchestrationJob('orch', 'job-a')
    jobA.pending.set('d-a', {
      toPaneId: 'pane-a',
      toAgentId: 'frontend',
      toThreadId: 'thread-a',
    })
    const jobB = createOrchestrationJob('orch', 'job-b')
    jobB.pending.set('d-b', {
      toPaneId: 'pane-b',
      toAgentId: 'backend',
      toThreadId: 'thread-b',
    })
    jobB.deferred.push({
      tabId: 'tab',
      delegation: { id: 'd-def', toAgentId: 'qa', objective: 'wait' },
      toPaneId: 'pane-qa',
      toAgentId: 'qa',
    })
    jobs.set(jobA.jobId, jobA)
    jobs.set(jobB.jobId, jobB)

    const aborted = abortOrchestrationJob(jobs, 'job-a')
    expect(aborted.ok).toBe(true)
    expect(aborted.abortedTargets).toEqual([{ toPaneId: 'pane-a', toThreadId: 'thread-a' }])
    expect(jobA.pending.size).toBe(0)
    expect(jobA.deferred).toEqual([])
    expect(jobA.superseded).toBe(true)

    expect(jobB.pending.size).toBe(1)
    expect(jobB.deferred).toHaveLength(1)
    expect(jobB.superseded).toBeFalsy()
    expect(jobs.has('job-a')).toBe(true)
    expect(jobs.has('job-b')).toBe(true)
  })
})
