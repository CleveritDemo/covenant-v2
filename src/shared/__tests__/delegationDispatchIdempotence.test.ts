import { describe, expect, it } from 'vitest'
import {
  createOrchestrationJob,
  delegationDispatchKey,
  findTrackedDelegationThreadId,
} from '../orchestrationJobs'

describe('findTrackedDelegationThreadId', () => {
  it('returns threadId from pending', () => {
    const job = createOrchestrationJob('orch')
    job.pending.set('del-1', {
      toPaneId: 'pane',
      toAgentId: 'frontend',
      toThreadId: 'thread-pending',
    })
    expect(findTrackedDelegationThreadId(job, 'del-1')).toBe('thread-pending')
  })

  it('returns threadId from waveItems when not in pending', () => {
    const job = createOrchestrationJob('orch')
    job.waveItems.push({
      delegationId: 'del-2',
      toAgentId: 'frontend',
      toThreadId: 'thread-wave',
      status: 'running',
    })
    expect(findTrackedDelegationThreadId(job, 'del-2')).toBe('thread-wave')
  })

  it('returns threadId from completedResults', () => {
    const job = createOrchestrationJob('orch')
    job.completedResults.push({
      id: 'del-3',
      status: 'ok',
      summary: 'done',
      fromPaneId: 'orch',
      orchestrationJobId: job.jobId,
      toThreadId: 'thread-done',
    })
    expect(findTrackedDelegationThreadId(job, 'del-3')).toBe('thread-done')
  })

  it('returns undefined for unknown id', () => {
    const job = createOrchestrationJob('orch')
    expect(findTrackedDelegationThreadId(job, 'missing')).toBeUndefined()
  })
})

describe('delegationDispatchKey', () => {
  it('collapses internal whitespace in objective', () => {
    const spaced = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'do  something',
    })
    const compact = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'do something',
    })
    expect(spaced).toBe(compact)
    expect(spaced).not.toBe('')
  })

  it('ignores contextIds order', () => {
    const first = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'task',
      contextIds: ['b', 'a'],
    })
    const second = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'task',
      contextIds: ['a', 'b'],
    })
    expect(first).toBe(second)
  })

  it('normalizes toAgentId case and surrounding spaces', () => {
    const spaced = delegationDispatchKey({
      toAgentId: ' FrontEnd ',
      objective: 'task',
    })
    const compact = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'task',
    })
    expect(spaced).toBe(compact)
  })

  it('differs when objective differs', () => {
    const first = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'task a',
    })
    const second = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'task b',
    })
    expect(first).not.toBe(second)
  })

  it('returns empty for missing toAgentId or objective', () => {
    expect(delegationDispatchKey({ toAgentId: '', objective: 'x' })).toBe('')
    expect(delegationDispatchKey({ toAgentId: 'frontend', objective: '' })).toBe('')
    expect(delegationDispatchKey({})).toBe('')
  })
})
