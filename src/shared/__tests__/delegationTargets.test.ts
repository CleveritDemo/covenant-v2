import { describe, expect, it } from 'vitest'
import {
  parseExpertReplicaRequest,
  shouldFinalizeWorktreeFromOrchestrator,
  shouldSyncOrgWorkspaceAgentDefinition,
} from '../delegationTargets'
import { planDelegationWorktrees, planWorktreeMergeOrder } from '../worktreeDelegation'

describe('parseExpertReplicaRequest', () => {
  it('treats plain ids as base', () => {
    expect(parseExpertReplicaRequest('frontend')).toEqual({
      requestedId: 'frontend',
      baseId: 'frontend',
      explicitReplica: false,
    })
  })

  it('parses #n and -n as explicit aliases to the base expert', () => {
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

describe('shouldSyncOrgWorkspaceAgentDefinition', () => {
  it('syncs catalog agents but not localOnly parallel lanes', () => {
    expect(shouldSyncOrgWorkspaceAgentDefinition({ expertReplica: false })).toBe(true)
    expect(shouldSyncOrgWorkspaceAgentDefinition({ expertReplica: true })).toBe(false)
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

describe('planDelegationWorktrees + parallel lane isolation', () => {
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

  it('gives a parallel lane delegation a worktreePath distinct from the base expert', () => {
    const planned = planDelegationWorktrees({
      baseCwd: '/repo',
      tabId: 'tab-1',
      delegationIds: ['dlg-base', 'dlg-lane'],
    })
    expect(planned[0]!.worktreePath).not.toBe(planned[1]!.worktreePath)
    expect(planned[1]!.relPath).toContain('dlg-lane')
  })

  it('orders orchestrator merges deterministically via planWorktreeMergeOrder', () => {
    const order = planWorktreeMergeOrder([
      { delegationId: 'dlg-lane', completedAt: 200 },
      { delegationId: 'dlg-base', completedAt: 100 },
    ])
    expect(order).toEqual(['dlg-base', 'dlg-lane'])
  })
})
