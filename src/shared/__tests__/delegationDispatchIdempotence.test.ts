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

describe('dispatch key repeat guard', () => {
  function releaseDelegateDispatchKeyForJob(
    keysByJob: Map<string, string>,
    delegationId: string,
  ): void {
    for (const [key, value] of keysByJob.entries()) {
      if (value === delegationId) keysByJob.delete(key)
    }
  }

  it('bloquea cuando la clave ya está en el mapa aunque el job no rastree el hilo', () => {
    const job = createOrchestrationJob('orch')
    const existingDelegationId = 'del-first'
    const dispatchKey = delegationDispatchKey({
      toAgentId: 'qa',
      objective: 'auditar el fix de delegación',
    })
    const keysByJob = new Map<string, string>([[dispatchKey, existingDelegationId]])

    expect(findTrackedDelegationThreadId(job, existingDelegationId)).toBeUndefined()
    expect(job.pending.size).toBe(0)
    expect(job.waveItems).toHaveLength(0)
    expect(job.completedResults).toHaveLength(0)
    expect(keysByJob.get(dispatchKey)).toBe(existingDelegationId)
    expect(Boolean(
      keysByJob.get(dispatchKey) && findTrackedDelegationThreadId(job, existingDelegationId!),
    )).toBe(false)
    expect(Boolean(keysByJob.get(dispatchKey))).toBe(true)
  })

  it('no bloquea cuando la clave aún no está en el mapa del job', () => {
    const dispatchKey = delegationDispatchKey({
      toAgentId: 'qa',
      objective: 'auditar el fix de delegación',
    })
    const keysByJob = new Map<string, string>()

    expect(keysByJob.get(dispatchKey)).toBeUndefined()
  })

  it('libera la clave tras resultado fail y permite re-despachar el mismo objetivo', () => {
    const dispatchKey = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'añade JumpToLatest button al acta del pane',
    })
    const firstDelegationId = 'del-fail'
    const keysByJob = new Map<string, string>([[dispatchKey, firstDelegationId]])

    expect(keysByJob.get(dispatchKey)).toBe(firstDelegationId)

    releaseDelegateDispatchKeyForJob(keysByJob, firstDelegationId)

    expect(keysByJob.get(dispatchKey)).toBeUndefined()
    keysByJob.set(dispatchKey, 'del-retry')
    expect(keysByJob.get(dispatchKey)).toBe('del-retry')
  })

  it('libera la clave tras resultado aborted y permite re-despachar el mismo objetivo', () => {
    const dispatchKey = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'escribe tests del guard de duplicados',
    })
    const firstDelegationId = 'del-aborted'
    const keysByJob = new Map<string, string>([[dispatchKey, firstDelegationId]])

    releaseDelegateDispatchKeyForJob(keysByJob, firstDelegationId)

    expect(keysByJob.get(dispatchKey)).toBeUndefined()
    keysByJob.set(dispatchKey, 'del-retry')
    expect(keysByJob.get(dispatchKey)).toBe('del-retry')
  })

  it('mantiene la clave tras resultado ok y sigue bloqueando re-despacho', () => {
    const dispatchKey = delegationDispatchKey({
      toAgentId: 'frontend',
      objective: 'añade JumpToLatest button al acta del pane',
    })
    const firstDelegationId = 'del-ok'
    const keysByJob = new Map<string, string>([[dispatchKey, firstDelegationId]])

    expect(keysByJob.get(dispatchKey)).toBe(firstDelegationId)
    expect(Boolean(keysByJob.get(dispatchKey))).toBe(true)
  })
})
