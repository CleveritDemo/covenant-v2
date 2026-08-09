import { describe, expect, it } from 'vitest'
import { canDrainAgentQueue, isAgentHumanInputBlocked } from '../agentInputGuards'

const idleBase = {
  loaded: true,
  busy: false,
  loopActive: false,
  awaitingDelegations: false,
  delegationWorkActive: false,
  systemFollowUpsPending: false,
} as const

describe('agent input anti-collision guards', () => {
  it('blocks human input only while the local loop is active', () => {
    expect(isAgentHumanInputBlocked({ loopActive: true })).toBe(true)
    expect(isAgentHumanInputBlocked({ loopActive: false })).toBe(false)
  })

  it('does not block human input when orchestrator is busy or awaiting', () => {
    expect(isAgentHumanInputBlocked({ loopActive: false })).toBe(false)
  })

  it('does not drain the user queue while awaiting delegations', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      awaitingDelegations: true,
    })).toBe(false)
  })

  it('drains while awaiting when orchestrationWorkStyle is turbo', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      awaitingDelegations: true,
      orchestrationWorkStyle: 'turbo',
    })).toBe(true)
  })

  it('still blocks awaiting drain in linear work style', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      awaitingDelegations: true,
      orchestrationWorkStyle: 'linear',
    })).toBe(false)
  })

  it('turbo still blocks drain when busy', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      busy: true,
      awaitingDelegations: true,
      orchestrationWorkStyle: 'turbo',
    })).toBe(false)
  })

  it('does not drain while system follow-ups are pending', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      systemFollowUpsPending: true,
    })).toBe(false)
  })

  it('drains only when idle without system follow-ups', () => {
    expect(canDrainAgentQueue({ ...idleBase })).toBe(true)
  })

  it('blocks human-head drain while delegationWorkActive', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      delegationWorkActive: true,
    })).toBe(false)
    expect(canDrainAgentQueue({
      ...idleBase,
      delegationWorkActive: true,
      headIsDelegation: false,
    })).toBe(false)
  })

  it('allows drain when delegationWorkActive and head is a delegation', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      delegationWorkActive: true,
      headIsDelegation: true,
    })).toBe(true)
  })

  it('still blocks delegation-head drain when busy or loop active', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      busy: true,
      delegationWorkActive: true,
      headIsDelegation: true,
    })).toBe(false)
    expect(canDrainAgentQueue({
      ...idleBase,
      loopActive: true,
      delegationWorkActive: true,
      headIsDelegation: true,
    })).toBe(false)
  })
})
