import { describe, expect, it } from 'vitest'
import {
  buildExpertReplicaDefinition,
  hasSingleActiveWorktreePerPane,
  parseExpertReplicaRequest,
  resolveExpertDelegationTarget,
  shouldDeferOccupiedPaneWithoutReplicas,
  shouldFinalizeWorktreeFromOrchestrator,
  shouldHoldWakeForSerializedDelegations,
} from '../expertReplicas'
import type { ProjectAgentDefinition } from '../projectAgentCatalog'
import { planDelegationWorktrees, planWorktreeMergeOrder } from '../worktreeDelegation'

const frontend: ProjectAgentDefinition = {
  id: 'frontend',
  provider: 'claude',
  permissionMode: 'ask',
  name: 'Frontend',
  role: 'frontend engineer',
  emitResults: true,
}

describe('parseExpertReplicaRequest', () => {
  it('treats plain ids as base', () => {
    expect(parseExpertReplicaRequest('frontend')).toEqual({
      requestedId: 'frontend',
      baseId: 'frontend',
      explicitReplica: false,
    })
  })

  it('parses #n and -n as explicit replicas', () => {
    expect(parseExpertReplicaRequest('frontend#2')).toMatchObject({
      baseId: 'frontend',
      explicitReplica: true,
    })
    expect(parseExpertReplicaRequest('frontend-3')).toMatchObject({
      baseId: 'frontend',
      explicitReplica: true,
    })
  })
})

describe('resolveExpertDelegationTarget', () => {
  const targets = [
    { agentId: 'frontend', paneId: 'pane-fe', name: 'Frontend' },
    { agentId: 'backend', paneId: 'pane-be', name: 'Backend' },
  ]

  it('reuses a free expert pane', () => {
    const decision = resolveExpertDelegationTarget({
      toAgentId: 'frontend',
      allowExpertReplicas: true,
      targets,
      occupiedPaneIds: new Set(),
      existingAgentIds: new Set(['frontend', 'backend']),
    })
    expect(decision).toEqual({
      kind: 'reuse',
      paneId: 'pane-fe',
      agentId: 'frontend',
    })
  })

  it('spawns when expert is occupied and flag is on', () => {
    const decision = resolveExpertDelegationTarget({
      toAgentId: 'frontend',
      allowExpertReplicas: true,
      targets,
      occupiedPaneIds: new Set(['pane-fe']),
      existingAgentIds: new Set(['frontend', 'backend']),
    })
    expect(decision.kind).toBe('spawn')
    if (decision.kind === 'spawn') {
      expect(decision.baseAgentId).toBe('frontend')
      expect(decision.preferredSlug).toBe('frontend-2')
    }
  })

  it('defers when expert is occupied and flag is off (no parallel reuse)', () => {
    const decision = resolveExpertDelegationTarget({
      toAgentId: 'frontend',
      allowExpertReplicas: false,
      targets,
      occupiedPaneIds: new Set(['pane-fe']),
      existingAgentIds: new Set(['frontend']),
    })
    expect(decision).toEqual({
      kind: 'defer',
      paneId: 'pane-fe',
      agentId: 'frontend',
    })
  })

  it('serializes two same-agent decisions: first reuse, second defer when flag off', () => {
    const occupied = new Set<string>()
    const first = resolveExpertDelegationTarget({
      toAgentId: 'frontend',
      allowExpertReplicas: false,
      targets,
      occupiedPaneIds: occupied,
      existingAgentIds: new Set(['frontend']),
    })
    expect(first).toEqual({ kind: 'reuse', paneId: 'pane-fe', agentId: 'frontend' })
    if (first.kind === 'reuse') occupied.add(first.paneId)
    const second = resolveExpertDelegationTarget({
      toAgentId: 'frontend',
      allowExpertReplicas: false,
      targets,
      occupiedPaneIds: occupied,
      existingAgentIds: new Set(['frontend']),
    })
    expect(second).toEqual({ kind: 'defer', paneId: 'pane-fe', agentId: 'frontend' })
    expect(shouldDeferOccupiedPaneWithoutReplicas({
      allowExpertReplicas: false,
      paneOccupied: true,
    })).toBe(true)
    expect(shouldDeferOccupiedPaneWithoutReplicas({
      allowExpertReplicas: true,
      paneOccupied: true,
    })).toBe(false)
    // Solo la activa tiene worktree; la diferida espera → un path por pane.
    const activeOnlyFirst = [
      { paneId: 'pane-fe', worktreePath: '/repo/.gravity/worktrees/tab/dlg-1' },
    ]
    expect(hasSingleActiveWorktreePerPane(activeOnlyFirst)).toBe(true)
    expect(hasSingleActiveWorktreePerPane([
      ...activeOnlyFirst,
      { paneId: 'pane-fe', worktreePath: '/repo/.gravity/worktrees/tab/dlg-2' },
    ])).toBe(false)
    expect(shouldHoldWakeForSerializedDelegations({
      pendingRemaining: 0,
      deferredRemaining: 1,
    })).toBe(true)
    expect(shouldHoldWakeForSerializedDelegations({
      pendingRemaining: 0,
      deferredRemaining: 0,
    })).toBe(false)
  })

  it('spawns on explicit replica id when flag is on', () => {
    const decision = resolveExpertDelegationTarget({
      toAgentId: 'frontend#2',
      allowExpertReplicas: true,
      targets,
      occupiedPaneIds: new Set(),
      existingAgentIds: new Set(['frontend']),
    })
    expect(decision.kind).toBe('spawn')
    if (decision.kind === 'spawn') {
      expect(decision.baseAgentId).toBe('frontend')
    }
  })
})

describe('buildExpertReplicaDefinition', () => {
  it('clones specialist without coordination and accepts delegations', () => {
    const replica = buildExpertReplicaDefinition(frontend, 'frontend-2')
    expect(replica.id).toBe('frontend-2')
    expect(replica.coordination).toBeUndefined()
    expect(replica.allowExpertReplicas).toBeUndefined()
    expect(replica.acceptDelegations).toBeUndefined()
    expect(replica.name).toContain('Frontend')
    expect(replica.role).toBe('frontend engineer')
  })
})

describe('shouldFinalizeWorktreeFromOrchestrator', () => {
  it('only allows finalize from the owning orchestrator pane', () => {
    expect(shouldFinalizeWorktreeFromOrchestrator({
      orchestratorPaneId: 'orch-1',
      worktreeOwnerPaneId: 'orch-1',
    })).toBe(true)
    expect(shouldFinalizeWorktreeFromOrchestrator({
      orchestratorPaneId: 'orch-1',
      worktreeOwnerPaneId: 'specialist-pane',
    })).toBe(false)
    expect(shouldFinalizeWorktreeFromOrchestrator({
      orchestratorPaneId: null,
      worktreeOwnerPaneId: 'orch-1',
    })).toBe(false)
  })
})

describe('planDelegationWorktrees + parallel / replica isolation', () => {
  it('gives each parallel delegation a distinct worktreePath and branch', () => {
    const planned = planDelegationWorktrees({
      baseCwd: '/repo',
      tabId: 'tab-1',
      delegationIds: ['dlg-a', 'dlg-b'],
    })
    expect(planned).toHaveLength(2)
    expect(planned[0]!.worktreePath).not.toBe(planned[1]!.worktreePath)
    expect(planned[0]!.branch).not.toBe(planned[1]!.branch)
    expect(planned[0]!.worktreePath).toContain('.gravity/worktrees')
  })

  it('gives a replica delegation a worktreePath distinct from the base expert', () => {
    const planned = planDelegationWorktrees({
      baseCwd: '/repo',
      tabId: 'tab-1',
      delegationIds: ['dlg-base', 'dlg-replica'],
    })
    expect(planned[0]!.worktreePath).not.toBe(planned[1]!.worktreePath)
    expect(planned[1]!.relPath).toContain('dlg-replica')
  })

  it('orders orchestrator merges deterministically via planWorktreeMergeOrder', () => {
    const order = planWorktreeMergeOrder([
      { delegationId: 'dlg-replica', completedAt: 200 },
      { delegationId: 'dlg-base', completedAt: 100 },
    ])
    expect(order).toEqual(['dlg-base', 'dlg-replica'])
  })
})
