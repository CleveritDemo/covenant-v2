import { describe, expect, it } from 'vitest'
import {
  canDrainAgentQueue,
  canStartHumanTurnNow,
  isAgentHumanInputBlocked,
  shouldPromoteHumanSendToVisibleQueue,
  shouldShowComposerStop,
} from '../agentInputGuards'

const idleBase = {
  loaded: true,
  busy: false,
  awaitingDelegations: false,
  delegationWorkActive: false,
  systemFollowUpsPending: false,
} as const

describe('agent input anti-collision guards', () => {
  it('does not block human input in the pane composer', () => {
    expect(isAgentHumanInputBlocked()).toBe(false)
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

  it('turbo still blocks drain when system follow-ups are pending', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      awaitingDelegations: true,
      systemFollowUpsPending: true,
      orchestrationWorkStyle: 'turbo',
    })).toBe(false)
  })

  it('turbo still blocks human-head drain when delegationWorkActive', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      awaitingDelegations: true,
      delegationWorkActive: true,
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

  it('still blocks delegation-head drain when busy', () => {
    expect(canDrainAgentQueue({
      ...idleBase,
      busy: true,
      delegationWorkActive: true,
      headIsDelegation: true,
    })).toBe(false)
  })
})

describe('canStartHumanTurnNow', () => {
  it('allows human turn in turbo while awaiting delegations', () => {
    expect(canStartHumanTurnNow({
      ...idleBase,
      awaitingDelegations: true,
      orchestrationWorkStyle: 'turbo',
    })).toBe(true)
  })

  it('blocks human turn in linear while awaiting delegations', () => {
    expect(canStartHumanTurnNow({
      ...idleBase,
      awaitingDelegations: true,
      orchestrationWorkStyle: 'linear',
    })).toBe(false)
  })

  it('blocks human turn when system follow-ups are pending', () => {
    expect(canStartHumanTurnNow({
      ...idleBase,
      systemFollowUpsPending: true,
      orchestrationWorkStyle: 'turbo',
    })).toBe(false)
  })
})

describe('shouldShowComposerStop', () => {
  it('ignores awaitingDelegations for the red Composer Stop', () => {
    expect(shouldShowComposerStop({
      busy: false,
      awaitingDelegations: true,
    })).toBe(false)
  })

  it('shows Stop for own busy', () => {
    expect(shouldShowComposerStop({ busy: true })).toBe(true)
  })

  it('shows Stop for a selected delegation target in the plane composer', () => {
    expect(shouldShowComposerStop({
      busy: false,
      delegationWorkActive: true,
    })).toBe(true)
  })
})

describe('shouldPromoteHumanSendToVisibleQueue', () => {
  const idleStatus = {
    busy: false,
    awaitingDelegations: false,
    delegationWorkActive: false,
    systemFollowUpsPending: false,
  } as const

  it('promotes when the pane is busy', () => {
    expect(shouldPromoteHumanSendToVisibleQueue({
      ...idleStatus,
      busy: true,
    })).toBe(true)
  })

  it('promotes in linear while awaiting delegations even if not busy', () => {
    expect(shouldPromoteHumanSendToVisibleQueue({
      ...idleStatus,
      awaitingDelegations: true,
    }, 'linear')).toBe(true)
  })

  it('does not promote when idle and can start a human turn', () => {
    expect(shouldPromoteHumanSendToVisibleQueue(idleStatus, 'turbo')).toBe(false)
  })

  it('promotes when system follow-ups are pending', () => {
    expect(shouldPromoteHumanSendToVisibleQueue({
      ...idleStatus,
      systemFollowUpsPending: true,
    }, 'turbo')).toBe(true)
  })
})
