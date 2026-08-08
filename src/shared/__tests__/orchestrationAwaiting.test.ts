import { describe, expect, it } from 'vitest'
import {
  buildOrchestrationAwaitingView,
  isReplicaAgentId,
  shortWorktreeHint,
} from '../orchestrationAwaiting'

describe('isReplicaAgentId', () => {
  it('uses explicit base when provided', () => {
    expect(isReplicaAgentId('frontend-2', 'frontend')).toBe(true)
    expect(isReplicaAgentId('frontend', 'frontend')).toBe(false)
  })

  it('falls back to -N suffix heuristic', () => {
    expect(isReplicaAgentId('frontend-2')).toBe(true)
    expect(isReplicaAgentId('frontend')).toBe(false)
  })
})

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
  it('returns null for empty input', () => {
    expect(buildOrchestrationAwaitingView([])).toBeNull()
  })

  it('counts done/total and marks replicas for parallel experts', () => {
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
        baseAgentId: 'frontend',
        status: 'running',
        worktreePath: '/repo/.gravity/worktrees/t1/d2',
      },
    ])
    expect(view).toMatchObject({ done: 1, total: 2 })
    expect(view?.items[0]).toMatchObject({
      agentLabel: 'frontend',
      isReplica: false,
      status: 'done',
      worktreeHint: 't1/d1',
    })
    expect(view?.items[1]).toMatchObject({
      agentLabel: 'frontend-2',
      isReplica: true,
      status: 'running',
      worktreeHint: 't1/d2',
    })
  })
})
