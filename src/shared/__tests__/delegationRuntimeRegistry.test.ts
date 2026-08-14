import { describe, expect, it } from 'vitest'
import {
  attachDelegationWorktree,
  deleteDelegationRuntime,
  getDelegationRuntime,
  listNestedDelegations,
  markDelegationRuntimeStatus,
  registerDelegationRuntime,
  resolveDelegationDelivery,
  type DelegationRuntimeRegistry,
} from '../delegationRuntimeRegistry'
import type { DelegateResult } from '../agentOrchestration'

function makeRegistry(): DelegationRuntimeRegistry {
  return new Map()
}

describe('delegationRuntimeRegistry', () => {
  it('registra una delegación pending con toPaneId, toThreadId y jobId', () => {
    const reg = makeRegistry()
    const entry = registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      toThreadId: 'thread-1',
      jobId: 'j1',
    })
    expect(entry.status).toBe('pending')
    expect(entry.toThreadId).toBe('thread-1')
    expect(getDelegationRuntime(reg, 'd1')).toBe(entry)
  })

  it('attachDelegationWorktree adjunta info al entry existente', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    attachDelegationWorktree(reg, 'd1', {
      worktreePath: '/tmp/wt',
      branch: 'delegation-d1',
      baseCwd: '/tmp/base',
      baseBranch: 'main',
    })
    const entry = getDelegationRuntime(reg, 'd1')
    expect(entry?.worktreeInfo?.worktreePath).toBe('/tmp/wt')
  })

  it('markDelegationRuntimeStatus actualiza el status', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    markDelegationRuntimeStatus(reg, 'd1', 'awaiting_merge')
    expect(getDelegationRuntime(reg, 'd1')?.status).toBe('awaiting_merge')
  })

  it('deleteDelegationRuntime remueve el entry', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    expect(deleteDelegationRuntime(reg, 'd1')).toBe(true)
    expect(getDelegationRuntime(reg, 'd1')).toBeUndefined()
  })

  it('flujo típico pendingMerge: pending → awaiting_merge → completed', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    markDelegationRuntimeStatus(reg, 'd1', 'awaiting_merge')
    expect(getDelegationRuntime(reg, 'd1')?.status).toBe('awaiting_merge')
    markDelegationRuntimeStatus(reg, 'd1', 'completed')
    expect(getDelegationRuntime(reg, 'd1')?.status).toBe('completed')
  })

  it('flujo huérfano: registry conocido tras purgar el job permite cleanup terminal', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    const entry = getDelegationRuntime(reg, 'd1')
    expect(entry).toBeDefined()
    markDelegationRuntimeStatus(reg, 'd1', 'orphaned')
    deleteDelegationRuntime(reg, 'd1')
    expect(getDelegationRuntime(reg, 'd1')).toBeUndefined()
  })

  it('registra parentDelegationId cuando la delegación viene de un orquestador anidado', () => {
    const reg = makeRegistry()
    const entry = registerDelegationRuntime(reg, {
      delegationId: 'nested-1',
      fromPaneId: 'p-orq',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      jobId: 'j-orq',
      parentDelegationId: 'parent-po',
    })
    expect(entry.parentDelegationId).toBe('parent-po')
    expect(getDelegationRuntime(reg, 'nested-1')?.parentDelegationId).toBe('parent-po')
  })

  it('listNestedDelegations agrupa por parentDelegationId', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'n1',
      fromPaneId: 'p-orq',
      toPaneId: 'p-a',
      toAgentId: 'frontend',
      jobId: 'j-orq',
      parentDelegationId: 'parent-po',
    })
    registerDelegationRuntime(reg, {
      delegationId: 'n2',
      fromPaneId: 'p-orq',
      toPaneId: 'p-b',
      toAgentId: 'qa',
      jobId: 'j-orq',
      parentDelegationId: 'parent-po',
    })
    registerDelegationRuntime(reg, {
      delegationId: 'solo',
      fromPaneId: 'p-orq',
      toPaneId: 'p-c',
      toAgentId: 'backend',
      jobId: 'j-orq',
    })
    const nested = listNestedDelegations(reg, 'parent-po')
    expect(nested.map(item => item.delegationId).sort()).toEqual(['n1', 'n2'])
    expect(listNestedDelegations(reg, 'unknown')).toEqual([])
    expect(listNestedDelegations(reg, '')).toEqual([])
  })

})

describe('resolveDelegationDelivery', () => {
  function makeResult(partial: Partial<DelegateResult> & Pick<DelegateResult, 'id'>): DelegateResult {
    return {
      status: 'ok',
      summary: 'done',
      fromPaneId: 'p-o',
      orchestrationJobId: 'j1',
      ...partial,
    }
  }

  it('delivers when fromPaneId, jobId and id match the registry entry', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    const resolution = resolveDelegationDelivery(reg, makeResult({ id: 'd1' }))
    expect(resolution.kind).toBe('deliver')
    if (resolution.kind === 'deliver') {
      expect(resolution.entry.delegationId).toBe('d1')
    }
  })

  it('mismatches when fromPaneId belongs to another orchestrator', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    const resolution = resolveDelegationDelivery(reg, makeResult({
      id: 'd1',
      fromPaneId: 'p-other',
    }))
    expect(resolution).toMatchObject({ kind: 'mismatch', reason: 'fromPaneId' })
  })

  it('mismatches when orchestrationJobId is stale', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
    })
    const resolution = resolveDelegationDelivery(reg, makeResult({
      id: 'd1',
      orchestrationJobId: 'j-old',
    }))
    expect(resolution).toMatchObject({ kind: 'mismatch', reason: 'jobId' })
  })

  it('returns unknown for an unregistered delegation id', () => {
    const reg = makeRegistry()
    expect(resolveDelegationDelivery(reg, makeResult({ id: 'missing' })).kind).toBe('unknown')
  })

  it('does not confuse two orchestrators targeting the same specialist pane', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd-orq-a',
      fromPaneId: 'p-orq-a',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      jobId: 'job-a',
    })
    registerDelegationRuntime(reg, {
      delegationId: 'd-orq-b',
      fromPaneId: 'p-orq-b',
      toPaneId: 'p-spec',
      toAgentId: 'frontend',
      jobId: 'job-b',
    })
    const resolution = resolveDelegationDelivery(reg, makeResult({
      id: 'd-orq-b',
      fromPaneId: 'p-orq-a',
      orchestrationJobId: 'job-b',
    }))
    expect(resolution).toMatchObject({ kind: 'mismatch', reason: 'fromPaneId' })
    expect(resolveDelegationDelivery(reg, makeResult({
      id: 'd-orq-b',
      fromPaneId: 'p-orq-b',
      orchestrationJobId: 'job-b',
    })).kind).toBe('deliver')
  })
})
