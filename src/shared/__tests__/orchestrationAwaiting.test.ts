import { describe, expect, it } from 'vitest'
import {
  buildOrchestrationAwaitingView,
  orchestrationAwaitingSignature,
  shortWorktreeHint,
} from '../orchestrationAwaiting'

describe('shortWorktreeHint', () => {
  it('returns tab/delegation under worktrees', () => {
    expect(shortWorktreeHint('/repo/.gravity/worktrees/tab-1/dlg-a')).toBe('tab-1/dlg-a')
  })

  it('returns undefined for empty', () => {
    expect(shortWorktreeHint('')).toBeUndefined()
    expect(shortWorktreeHint(undefined)).toBeUndefined()
  })
})

describe('buildOrchestrationAwaitingView', () => {
  const catalog = [
    {
      id: 'frontend',
      provider: 'claude' as const,
      permissionMode: 'auto' as const,
      name: 'David',
      role: 'frontend engineer',
    },
    {
      id: 'backend',
      provider: 'claude' as const,
      permissionMode: 'auto' as const,
      name: 'Cristian',
      role: 'backend engineer',
    },
  ]

  it('returns null for empty input', () => {
    expect(buildOrchestrationAwaitingView([])).toBeNull()
  })

  it('uses agentId as label and counts done/total', () => {
    const view = buildOrchestrationAwaitingView([
      {
        delegationId: 'd1',
        toAgentId: 'frontend',
        status: 'done',
        worktreePath: '/repo/.gravity/worktrees/t1/d1',
      },
      {
        delegationId: 'd2',
        toAgentId: 'frontend-2',
        status: 'running',
        worktreePath: '/repo/.gravity/worktrees/t1/d2',
      },
    ], { catalog })
    expect(view).toMatchObject({ done: 1, total: 2 })
    expect(view?.items[0]).toMatchObject({
      agentLabel: 'David · frontend engineer',
      status: 'done',
      worktreeHint: 't1/d1',
    })
    expect(view?.items[1]).toMatchObject({
      agentLabel: 'frontend-2',
      status: 'running',
      worktreeHint: 't1/d2',
    })
  })

  it('sin catálogo conserva el slug interno', () => {
    const view = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running' },
    ])
    expect(view?.items[0]?.agentLabel).toBe('frontend')
  })

  it('propagates toPaneId for Stop-per-row wiring', () => {
    const view = buildOrchestrationAwaitingView([
      {
        delegationId: 'd1',
        toAgentId: 'frontend',
        toPaneId: 'pane-fe',
        status: 'running',
      },
    ])
    expect(view?.items[0]?.toPaneId).toBe('pane-fe')
  })
})

describe('orchestrationAwaitingSignature', () => {
  it('cambia cuando solo un item pasa a done (awaitingDelegations seguiría true)', () => {
    const a = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running' },
      { delegationId: 'd2', toAgentId: 'backend', status: 'running' },
    ])
    const b = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'done' },
      { delegationId: 'd2', toAgentId: 'backend', status: 'running' },
    ])
    expect(orchestrationAwaitingSignature(a)).not.toBe(orchestrationAwaitingSignature(b))
    expect(orchestrationAwaitingSignature(a)).toBe('0/2::d1:running,:d2:running')
    expect(orchestrationAwaitingSignature(b)).toBe('1/2::d1:done,:d2:running')
  })

  it('null y vacío son la misma firma', () => {
    expect(orchestrationAwaitingSignature(null)).toBe('')
    expect(orchestrationAwaitingSignature(undefined)).toBe('')
  })

  it('distingue dos olas con los mismos delegationId en jobs distintos', () => {
    const waveA = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running', jobId: 'job-aaaa-1111' },
      { delegationId: 'd2', toAgentId: 'backend', status: 'running', jobId: 'job-aaaa-1111' },
    ])
    const waveB = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running', jobId: 'job-bbbb-2222' },
      { delegationId: 'd2', toAgentId: 'backend', status: 'running', jobId: 'job-bbbb-2222' },
    ])
    expect(orchestrationAwaitingSignature(waveA)).toBe('0/2:job-aaaa:d1:running,job-aaaa:d2:running')
    expect(orchestrationAwaitingSignature(waveB)).toBe('0/2:job-bbbb:d1:running,job-bbbb:d2:running')
    expect(orchestrationAwaitingSignature(waveA)).not.toBe(orchestrationAwaitingSignature(waveB))
  })
})

describe('orchestration awaiting groups', () => {
  it('two jobs from the same pane become groups 1 and 2 with items kept apart', () => {
    const view = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running', jobId: 'job-one' },
      { delegationId: 'd2', toAgentId: 'backend', status: 'done', jobId: 'job-two' },
      { delegationId: 'd3', toAgentId: 'frontend', status: 'deferred', jobId: 'job-one' },
    ])
    expect(view?.done).toBe(1)
    expect(view?.total).toBe(3)
    expect(view?.items.map(item => item.delegationId)).toEqual(['d1', 'd2', 'd3'])
    expect(view?.groups).toHaveLength(2)
    expect(view?.groups[0]).toMatchObject({
      jobId: 'job-one',
      index: 1,
      done: 0,
      total: 2,
    })
    expect(view?.groups[0]?.items.map(item => item.delegationId)).toEqual(['d1', 'd3'])
    expect(view?.groups[1]).toMatchObject({
      jobId: 'job-two',
      index: 2,
      done: 1,
      total: 1,
    })
    expect(view?.groups[1]?.items.map(item => item.delegationId)).toEqual(['d2'])
    expect(view?.groups[0]?.title).toBeUndefined()
    expect(view?.groups[1]?.title).toBeUndefined()
  })

  it('title comes from jobsMeta.humanRequestPreview', () => {
    const view = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running', jobId: 'job-one' },
      { delegationId: 'd2', toAgentId: 'backend', status: 'running', jobId: 'job-two' },
    ], {
      jobsMeta: [
        { jobId: 'job-one', createdAt: 10, humanRequestPreview: 'Fix login' },
        { jobId: 'job-two', createdAt: 20, humanRequestPreview: 'Ship groups' },
      ],
    })
    expect(view?.groups[0]).toMatchObject({ jobId: 'job-one', index: 1, title: 'Fix login' })
    expect(view?.groups[1]).toMatchObject({ jobId: 'job-two', index: 2, title: 'Ship groups' })
  })

  it('without jobsMeta there is no title but groups still form', () => {
    const view = buildOrchestrationAwaitingView([
      { delegationId: 'd1', toAgentId: 'frontend', status: 'running', jobId: 'job-one' },
    ])
    expect(view?.groups).toEqual([
      {
        jobId: 'job-one',
        index: 1,
        done: 0,
        total: 1,
        items: view?.items,
      },
    ])
    expect(view?.groups[0]?.title).toBeUndefined()
  })

  it('items without jobId land in a trailing group with empty jobId', () => {
    const view = buildOrchestrationAwaitingView([
      { delegationId: 'orphan-a', toAgentId: 'frontend', status: 'done' },
      { delegationId: 'd1', toAgentId: 'backend', status: 'running', jobId: 'job-one' },
      { delegationId: 'orphan-b', toAgentId: 'frontend', status: 'running' },
    ])
    expect(view?.groups).toHaveLength(2)
    expect(view?.groups[0]).toMatchObject({ jobId: 'job-one', index: 1, done: 0, total: 1 })
    expect(view?.groups[0]?.items.map(item => item.delegationId)).toEqual(['d1'])
    expect(view?.groups[1]).toMatchObject({ jobId: '', index: 2, done: 1, total: 2 })
    expect(view?.groups[1]?.title).toBeUndefined()
    expect(view?.groups[1]?.items.map(item => item.delegationId)).toEqual(['orphan-a', 'orphan-b'])
  })
})
