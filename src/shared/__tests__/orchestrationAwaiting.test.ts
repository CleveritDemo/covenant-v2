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
    ])
    expect(view).toMatchObject({ done: 1, total: 2 })
    expect(view?.items[0]).toMatchObject({
      agentLabel: 'frontend',
      status: 'done',
      worktreeHint: 't1/d1',
    })
    expect(view?.items[1]).toMatchObject({
      agentLabel: 'frontend-2',
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
