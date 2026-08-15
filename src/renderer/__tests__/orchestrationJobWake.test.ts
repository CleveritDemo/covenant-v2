import { describe, expect, it } from 'vitest'
import type { DelegateResult } from '../../shared/agentOrchestration'
import {
  abortOneDelegationInJob,
  createOrchestrationJob,
  type OrchestrationJob,
} from '../../shared/orchestrationJobs'
import {
  canWakeOrchestratorForJob,
  clearCompletedResultsIfDelivered,
  orchestrationFifoHasFollowUpForJob,
  prepareOrchestratorWakeBatch,
  shouldClearCompletedResultsAfterWakeEnqueue,
} from '../../shared/orchestrationJobWake'

function stubResult(
  partial: Partial<DelegateResult> & Pick<DelegateResult, 'id' | 'status' | 'summary'>,
): DelegateResult {
  return {
    fromPaneId: 'orch',
    orchestrationJobId: 'job-turbo',
    ...partial,
  }
}

function turboJobWithDelegations(
  ids: string[],
  paneById: Record<string, string> = {},
): OrchestrationJob {
  const job = createOrchestrationJob('orch', 'job-turbo')
  for (const id of ids) {
    job.pending.set(id, {
      toPaneId: paneById[id] ?? `pane-${id}`,
      toAgentId: 'frontend',
    })
    job.waveItems.push({
      delegationId: id,
      toAgentId: 'frontend',
      status: 'running',
    })
  }
  return job
}

function completeDelegation(job: OrchestrationJob, result: DelegateResult): void {
  job.pending.delete(result.id)
  job.completedResults.push(result)
}

describe('orchestrationJobWake turbo scenarios', () => {
  it('abort one of three then complete others yields wake batch of three including aborted', () => {
    const job = turboJobWithDelegations(['d1', 'd2', 'd3'])

    const abort = abortOneDelegationInJob(job, 'd1')
    expect(abort.ok).toBe(true)
    expect(job.pending.size).toBe(2)
    job.completedResults.push(stubResult({
      id: 'd1',
      status: 'aborted',
      summary: 'cancelled',
    }))

    expect(canWakeOrchestratorForJob(job)).toBe(false)

    completeDelegation(job, stubResult({ id: 'd2', status: 'ok', summary: 'b' }))
    expect(canWakeOrchestratorForJob(job)).toBe(false)

    completeDelegation(job, stubResult({ id: 'd3', status: 'ok', summary: 'c' }))
    expect(canWakeOrchestratorForJob(job)).toBe(true)

    const batch = prepareOrchestratorWakeBatch(job.completedResults)
    expect(batch.map(r => r.id)).toEqual(['d1', 'd2', 'd3'])
    expect(batch.find(r => r.id === 'd1')?.status).toBe('aborted')
  })

  it('abort last pending with prior completedResults should wake with full batch', () => {
    const job = turboJobWithDelegations(['d1', 'd2', 'd3'])
    completeDelegation(job, stubResult({ id: 'd1', status: 'ok', summary: 'a' }))
    completeDelegation(job, stubResult({ id: 'd2', status: 'ok', summary: 'b' }))
    expect(job.pending.size).toBe(1)

    const abort = abortOneDelegationInJob(job, 'd3')
    expect(abort.ok).toBe(true)
    job.completedResults.push(stubResult({
      id: 'd3',
      status: 'aborted',
      summary: 'stopped',
    }))

    expect(canWakeOrchestratorForJob(job)).toBe(true)
    expect(prepareOrchestratorWakeBatch(job.completedResults)).toHaveLength(3)
  })

  it('duplicate result after abort with pending empty still has wake batch', () => {
    const job = turboJobWithDelegations(['d1'])
    abortOneDelegationInJob(job, 'd1')
    job.completedResults.push(stubResult({
      id: 'd1',
      status: 'aborted',
      summary: 'stopped',
    }))
    expect(job.pending.size).toBe(0)
    expect(job.completedResults).toHaveLength(1)

    // Late duplicate: pending already clear; completedResults still holds the aborted row.
    expect(canWakeOrchestratorForJob(job)).toBe(true)
    const batch = prepareOrchestratorWakeBatch(job.completedResults)
    expect(batch).toHaveLength(1)
    expect(batch[0].status).toBe('aborted')
  })
})

describe('clearCompletedResultsIfDelivered', () => {
  it('does not clear completedResults when enqueue fails and FIFO has no follow-up', () => {
    const job = createOrchestrationJob('orch', 'job-fail')
    job.completedResults.push(stubResult({ id: 'd1', status: 'ok', summary: 'x' }))

    const cleared = clearCompletedResultsIfDelivered(job, false, [])
    expect(cleared).toBe(false)
    expect(job.completedResults).toHaveLength(1)
    expect(shouldClearCompletedResultsAfterWakeEnqueue(false, [], job.jobId)).toBe(false)
  })

  it('clears completedResults when enqueue fails but FIFO already has follow-up for job', () => {
    const job = createOrchestrationJob('orch', 'job-queued')
    job.completedResults.push(stubResult({ id: 'd1', status: 'ok', summary: 'x' }))
    const fifo = [{
      orchestrationFollowUp: true as const,
      orchestrationJobId: 'job-queued',
    }]

    expect(orchestrationFifoHasFollowUpForJob(fifo, 'job-queued')).toBe(true)
    const cleared = clearCompletedResultsIfDelivered(job, false, fifo)
    expect(cleared).toBe(true)
    expect(job.completedResults).toHaveLength(0)
  })

  it('clears completedResults when enqueue succeeds', () => {
    const job = createOrchestrationJob('orch', 'job-ok')
    job.completedResults.push(stubResult({ id: 'd1', status: 'ok', summary: 'x' }))

    expect(clearCompletedResultsIfDelivered(job, true, [])).toBe(true)
    expect(job.completedResults).toHaveLength(0)
  })
})
