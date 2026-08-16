import { describe, expect, it } from 'vitest'
import { MAX_LANES_PER_PANE, resolveDelegationLane } from '../delegationLanes'
import type { OrchestrationAgentRef } from '../agentOrchestration'

const targets: OrchestrationAgentRef[] = [
  { agentId: 'frontend', paneId: 'pane-frontend', name: 'Frontend' },
]

describe('resolveDelegationLane', () => {
  it('returns lane when the agent exists', () => {
    expect(resolveDelegationLane({
      toAgentId: 'frontend',
      targets,
      activeLanesByPane: new Map(),
    })).toEqual({
      kind: 'lane',
      paneId: 'pane-frontend',
      agentId: 'frontend',
    })
  })

  it('returns lane even when activeLanesByPane marks 50 active lanes on that pane (never defer)', () => {
    expect(resolveDelegationLane({
      toAgentId: 'frontend',
      targets,
      activeLanesByPane: new Map([['pane-frontend', 50]]),
    })).toEqual({
      kind: 'lane',
      paneId: 'pane-frontend',
      agentId: 'frontend',
    })
    expect(MAX_LANES_PER_PANE).toBe(Number.POSITIVE_INFINITY)
  })

  it('returns fail with reason not_found when agentId is not in targets', () => {
    expect(resolveDelegationLane({
      toAgentId: 'missing',
      targets,
      activeLanesByPane: new Map(),
    })).toEqual({ kind: 'fail', reason: 'not_found' })
  })
})
