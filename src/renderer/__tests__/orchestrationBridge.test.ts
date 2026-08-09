import { describe, expect, it } from 'vitest'
import {
  listOrchestrationTargets,
  resolveDelegationTargetPaneId,
} from '../workspace/orchestrationBridge'

describe('listOrchestrationTargets', () => {
  it('skips orchestrators, product owners, and agents that decline delegations', () => {
    const targets = listOrchestrationTargets([
      {
        paneId: 'p-orch',
        meta: {
          id: 'boss',
          provider: 'claude',
          permissionMode: 'auto',
          coordination: 'orchestrator',
          name: 'Boss',
        },
      },
      {
        paneId: 'p-po',
        meta: {
          id: 'po',
          provider: 'claude',
          permissionMode: 'auto',
          coordination: 'productOwner',
          name: 'PO',
        },
      },
      {
        paneId: 'p-qa',
        meta: {
          id: 'qa',
          provider: 'claude',
          permissionMode: 'auto',
          name: 'QA',
          role: 'Tester',
        },
      },
      {
        paneId: 'p-solo',
        meta: {
          id: 'solo',
          provider: 'cursor',
          permissionMode: 'auto',
          name: 'Solo',
          acceptDelegations: false,
        },
      },
    ], 'p-orch')
    expect(targets).toEqual([
      { agentId: 'qa', paneId: 'p-qa', name: 'QA', role: 'Tester' },
    ])
  })
})

describe('resolveDelegationTargetPaneId', () => {
  it('matches agentId case-insensitively', () => {
    expect(resolveDelegationTargetPaneId(
      [{ agentId: 'qa', paneId: 'p1', name: 'QA' }],
      { toAgentId: 'QA' },
    )).toBe('p1')
    expect(resolveDelegationTargetPaneId(
      [{ agentId: 'qa', paneId: 'p1', name: 'QA' }],
      { toAgentId: 'missing' },
    )).toBeNull()
  })
})
