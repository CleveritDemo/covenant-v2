import { describe, expect, it } from 'vitest'
import {
  buildOrchestrationAwaitingView,
  isReplicaAgentId,
  shortWorktreeHint,
  shouldDisposeReplicaOnComplete,
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

describe('shouldDisposeReplicaOnComplete', () => {
  it('never disposes the base expert', () => {
    expect(shouldDisposeReplicaOnComplete({
      toAgentId: 'frontend',
      baseAgentId: 'frontend',
    })).toBe(false)
    expect(shouldDisposeReplicaOnComplete({ toAgentId: 'frontend' })).toBe(false)
  })

  it('disposes spawned replicas with baseAgentId', () => {
    expect(shouldDisposeReplicaOnComplete({
      toAgentId: 'frontend-2',
      baseAgentId: 'frontend',
    })).toBe(true)
  })

  it('ignores -N heuristic alone (no spawn marker)', () => {
    expect(shouldDisposeReplicaOnComplete({ toAgentId: 'frontend-2' })).toBe(false)
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
