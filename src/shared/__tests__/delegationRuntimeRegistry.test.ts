import { describe, expect, it } from 'vitest'
import {
  attachDelegationWorktree,
  claimReplicaDispose,
  collectWaveReplicaDelegationIds,
  deleteDelegationRuntime,
  getDelegationRuntime,
  listNestedDelegations,
  markDelegationRuntimeStatus,
  registerDelegationRuntime,
  type DelegationRuntimeRegistry,
} from '../delegationRuntimeRegistry'

function makeRegistry(): DelegationRuntimeRegistry {
  return new Map()
}

describe('delegationRuntimeRegistry', () => {
  it('registra una delegación pending con toPaneId y jobId', () => {
    const reg = makeRegistry()
    const entry = registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: true,
    })
    expect(entry.status).toBe('pending')
    expect(entry.replicaDisposed).toBe(false)
    expect(getDelegationRuntime(reg, 'd1')).toBe(entry)
  })

  it('claimReplicaDispose es idempotente: la segunda llamada no retorna entry', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: true,
    })
    const first = claimReplicaDispose(reg, 'd1')
    expect(first).toBeDefined()
    expect(first?.replicaDisposed).toBe(true)
    expect(first?.status).toBe('replica_disposed')
    const second = claimReplicaDispose(reg, 'd1')
    expect(second).toBeUndefined()
  })

  it('claimReplicaDispose devuelve undefined si disposeReplica=false', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: false,
    })
    expect(claimReplicaDispose(reg, 'd1')).toBeUndefined()
  })

  it('claimReplicaDispose devuelve undefined para delegación desconocida', () => {
    const reg = makeRegistry()
    expect(claimReplicaDispose(reg, 'nope')).toBeUndefined()
  })

  it('attachDelegationWorktree adjunta info al entry existente', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: true,
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
      disposeReplica: true,
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
      disposeReplica: true,
    })
    expect(deleteDelegationRuntime(reg, 'd1')).toBe(true)
    expect(getDelegationRuntime(reg, 'd1')).toBeUndefined()
  })

  it('sella replicaDisposed manualmente para simular cierre externo (abort)', () => {
    const reg = makeRegistry()
    const entry = registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: true,
    })
    entry.replicaDisposed = true
    expect(claimReplicaDispose(reg, 'd1')).toBeUndefined()
  })

  it('flujo típico pendingMerge: pending → awaiting_merge → replica_disposed (una sola vez)', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: true,
    })
    markDelegationRuntimeStatus(reg, 'd1', 'awaiting_merge')
    expect(getDelegationRuntime(reg, 'd1')?.status).toBe('awaiting_merge')
    // Un cleanup temprano no debe cerrar mientras esté awaiting_merge... la
    // política se implementa en el consumidor (App.tsx); acá comprobamos que
    // el estado es fielmente rastreable.
    const claimed = claimReplicaDispose(reg, 'd1')
    expect(claimed?.status).toBe('replica_disposed')
    // Un segundo intento (por ejemplo, resultado huérfano tardío) es no-op.
    expect(claimReplicaDispose(reg, 'd1')).toBeUndefined()
  })

  it('flujo huérfano: registry conocido tras purgar el job permite cleanup terminal', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'd1',
      fromPaneId: 'p-o',
      toPaneId: 'p-s',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: true,
    })
    // El job "oficial" desaparece (superseded, remount). El registry sigue
    // permitiendo lookup + claim.
    const entry = getDelegationRuntime(reg, 'd1')
    expect(entry).toBeDefined()
    markDelegationRuntimeStatus(reg, 'd1', 'orphaned')
    const claimed = claimReplicaDispose(reg, 'd1')
    expect(claimed).toBeDefined()
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
      disposeReplica: true,
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
      disposeReplica: true,
    })
    registerDelegationRuntime(reg, {
      delegationId: 'n2',
      fromPaneId: 'p-orq',
      toPaneId: 'p-b',
      toAgentId: 'qa',
      jobId: 'j-orq',
      parentDelegationId: 'parent-po',
      disposeReplica: true,
    })
    registerDelegationRuntime(reg, {
      delegationId: 'solo',
      fromPaneId: 'p-orq',
      toPaneId: 'p-c',
      toAgentId: 'backend',
      jobId: 'j-orq',
      disposeReplica: true,
    })
    const nested = listNestedDelegations(reg, 'parent-po')
    expect(nested.map(item => item.delegationId).sort()).toEqual(['n1', 'n2'])
    expect(listNestedDelegations(reg, 'unknown')).toEqual([])
    expect(listNestedDelegations(reg, '')).toEqual([])
  })

  it('collectWaveReplicaDelegationIds filtra disposeReplica vivo y omite ya dispuesto', () => {
    const reg = makeRegistry()
    registerDelegationRuntime(reg, {
      delegationId: 'r1',
      fromPaneId: 'p-o',
      toPaneId: 'p-r1',
      toAgentId: 'frontend-2',
      jobId: 'j1',
      baseAgentId: 'frontend',
      disposeReplica: true,
    })
    registerDelegationRuntime(reg, {
      delegationId: 'base',
      fromPaneId: 'p-o',
      toPaneId: 'p-base',
      toAgentId: 'frontend',
      jobId: 'j1',
      disposeReplica: false,
    })
    registerDelegationRuntime(reg, {
      delegationId: 'r2',
      fromPaneId: 'p-o',
      toPaneId: 'p-r2',
      toAgentId: 'frontend-3',
      jobId: 'j1',
      baseAgentId: 'frontend',
      disposeReplica: true,
    })
    claimReplicaDispose(reg, 'r2')
    const ids = collectWaveReplicaDelegationIds(reg, ['r1', 'base', 'r2', 'missing'])
    expect(ids).toEqual(['r1'])
  })
})
