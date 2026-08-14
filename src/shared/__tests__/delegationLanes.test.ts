import { describe, expect, it } from 'vitest'
import { MAX_LANES_PER_PANE, resolveDelegationLane } from '../delegationLanes'
import type { OrchestrationAgentRef } from '../agentOrchestration'

const targets: OrchestrationAgentRef[] = [
  { agentId: 'frontend', paneId: 'pane-fe', name: 'Frontend' },
  { agentId: 'backend', paneId: 'pane-be', name: 'Backend' },
]

describe('resolveDelegationLane', () => {
  it('resuelve id exacto con carril libre', () => {
    const decision = resolveDelegationLane({
      toAgentId: 'frontend',
      targets,
      activeLanesByPane: new Map(),
    })
    expect(decision).toEqual({ kind: 'lane', paneId: 'pane-fe', agentId: 'frontend' })
  })

  it('frontend#2 y frontend-2 apuntan al mismo pane base', () => {
    const lanes = new Map<string, number>()
    for (const toAgentId of ['frontend#2', 'frontend-2']) {
      const decision = resolveDelegationLane({
        toAgentId,
        targets,
        activeLanesByPane: lanes,
      })
      expect(decision).toEqual({ kind: 'lane', paneId: 'pane-fe', agentId: 'frontend' })
    }
  })

  it('cap alcanzado → defer', () => {
    const decision = resolveDelegationLane({
      toAgentId: 'frontend',
      targets,
      activeLanesByPane: new Map([['pane-fe', MAX_LANES_PER_PANE]]),
    })
    expect(decision).toEqual({ kind: 'defer', paneId: 'pane-fe', agentId: 'frontend' })
  })

  it('id inexistente → fail', () => {
    const decision = resolveDelegationLane({
      toAgentId: 'qa',
      targets,
      activeLanesByPane: new Map(),
    })
    expect(decision).toEqual({ kind: 'fail', reason: 'not_found' })
  })
})
