/**
 * Pure helpers for orchestrator wake after delegations complete or abort.
 * App.tsx wires these into maybeWakeOrchestratorForJob; no React/electron here.
 */

import type { DelegateResult } from './agentOrchestration'
import { shouldWakeOrchestratorOnDelegationComplete } from './agentOrchestration'
import {
  dedupeDelegateResultsById,
  shouldWakeJob,
  type OrchestrationJob,
} from './orchestrationJobs'

export type OrchestrationFifoFollowUpItem = {
  orchestrationFollowUp?: boolean
  orchestrationJobId?: string
}

/** Same predicate as enqueueOrchestrationSend when a follow-up for jobId is already queued. */
export function orchestrationFifoHasFollowUpForJob(
  fifo: ReadonlyArray<OrchestrationFifoFollowUpItem>,
  jobId: string,
): boolean {
  const id = jobId.trim()
  if (!id) return false
  return fifo.some(
    item => item.orchestrationFollowUp === true
      && item.orchestrationJobId?.trim() === id,
  )
}

export function canWakeOrchestratorForJob(
  job: Pick<OrchestrationJob, 'pending' | 'deferred'>,
): boolean {
  return shouldWakeJob(job.pending.size, job.deferred.length)
    && shouldWakeOrchestratorOnDelegationComplete(job.pending.size)
}

export function prepareOrchestratorWakeBatch(
  completedResults: readonly DelegateResult[],
): DelegateResult[] {
  return dedupeDelegateResultsById([...completedResults])
}

export function shouldClearCompletedResultsAfterWakeEnqueue(
  enqueued: boolean,
  fifo: ReadonlyArray<OrchestrationFifoFollowUpItem>,
  jobId: string,
): boolean {
  if (enqueued) return true
  return orchestrationFifoHasFollowUpForJob(fifo, jobId)
}

/**
 * Clears completedResults when enqueue succeeded or the FIFO already holds the follow-up.
 * Returns whether the batch was cleared.
 */
export function clearCompletedResultsIfDelivered(
  job: OrchestrationJob,
  enqueued: boolean,
  fifo: ReadonlyArray<OrchestrationFifoFollowUpItem>,
): boolean {
  if (!shouldClearCompletedResultsAfterWakeEnqueue(enqueued, fifo, job.jobId)) {
    return false
  }
  job.completedResults.splice(0, job.completedResults.length)
  return true
}
