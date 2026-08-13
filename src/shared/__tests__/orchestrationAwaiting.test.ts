import { describe, expect, it } from 'vitest'
import {
  buildOrchestrationAwaitingView,
  isReplicaAgentId,
  matchReplicaPane,
  orchestrationAwaitingSignature,
  shortWorktreeHint,
  shouldDeferReplicaDisposeForWave,
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

describe('shouldDeferReplicaDisposeForWave', () => {
  it('difiere si quedan pending o deferred', () => {
    expect(shouldDeferReplicaDisposeForWave(1, 0)).toBe(true)
    expect(shouldDeferReplicaDisposeForWave(0, 1)).toBe(true)
    expect(shouldDeferReplicaDisposeForWave(2, 3)).toBe(true)
  })

  it('no difiere cuando la ola terminó', () => {
    expect(shouldDeferReplicaDisposeForWave(0, 0)).toBe(false)
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

  it('disposes localOnly replica without baseAgentId', () => {
    expect(shouldDisposeReplicaOnComplete({
      toAgentId: 'frontend-2',
      localOnly: true,
    })).toBe(true)
  })
})

describe('matchReplicaPane', () => {
  const panes = [
    { paneId: 'pane-base', agentId: 'frontend' },
    { paneId: 'pane-r2', agentId: 'frontend-2', localOnly: true },
  ]

  it('matches by toPaneId even without localOnly', () => {
    expect(matchReplicaPane({ toPaneId: 'pane-base', panes })).toEqual(panes[0])
  })

  it('returns the paneId when the pane is already gone', () => {
    expect(matchReplicaPane({ toPaneId: 'pane-missing', panes })).toEqual({
      paneId: 'pane-missing',
    })
  })

  it('falls back to localOnly binding with the replica agent id', () => {
    expect(matchReplicaPane({ toAgentId: 'frontend-2', panes })).toEqual(panes[1])
  })

  it('does not match a base expert by agent id alone', () => {
    expect(matchReplicaPane({ toAgentId: 'frontend', panes })).toBeUndefined()
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
      status: 'done',
      worktreeHint: 't1/d1',
    })
    expect(view?.items[0]?.instanceTag).toBeUndefined()
    // La réplica se muestra como el experto + su tag, no como el id crudo.
    expect(view?.items[1]).toMatchObject({
      agentLabel: 'frontend',
      instanceTag: 'R2',
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
    expect(orchestrationAwaitingSignature(a)).toBe('0/2:d1:running,d2:running')
    expect(orchestrationAwaitingSignature(b)).toBe('1/2:d1:done,d2:running')
  })

  it('null y vacío son la misma firma', () => {
    expect(orchestrationAwaitingSignature(null)).toBe('')
    expect(orchestrationAwaitingSignature(undefined)).toBe('')
  })
})
