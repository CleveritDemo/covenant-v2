import { describe, expect, it } from 'vitest'
import { canDrainAgentQueue, isAgentHumanInputBlocked } from '../agentInputGuards'

describe('agent input anti-collision guards', () => {
  it('does not drain the user queue while awaiting delegations', () => {
    expect(canDrainAgentQueue({
      loaded: true,
      busy: false,
      loopActive: false,
      awaitingDelegations: true,
      delegationWorkActive: false,
    })).toBe(false)
  })

  it('blocks human enqueue while an orchestrator is busy', () => {
    expect(isAgentHumanInputBlocked({
      loopActive: false,
      awaitingDelegations: false,
      delegationWorkActive: false,
      orchestratorBusy: true,
    })).toBe(true)
  })

  it('blocks composer and drain for a pending delegation target', () => {
    expect(isAgentHumanInputBlocked({
      loopActive: false,
      awaitingDelegations: false,
      delegationWorkActive: true,
      orchestratorBusy: false,
    })).toBe(true)
    expect(canDrainAgentQueue({
      loaded: true,
      busy: false,
      loopActive: false,
      awaitingDelegations: false,
      delegationWorkActive: true,
    })).toBe(false)
  })
})
