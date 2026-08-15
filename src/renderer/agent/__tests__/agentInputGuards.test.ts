import { describe, expect, it } from 'vitest'
import {
  canDrainAgentQueue,
  canStartHumanTurnNow,
  describeAgentQueueDrainBlock,
  describeOrchestrationFifoSkip,
  isAgentHumanInputBlocked,
  isSystemFollowUpsPendingForPane,
  preferSendSlotIsSystemWork,
  shouldPromoteHumanSendToVisibleQueue,
  shouldShowComposerStop,
  threadScopedFlag,
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

describe('isSystemFollowUpsPendingForPane', () => {
  it('is true when only orchestration FIFO has items', () => {
    expect(isSystemFollowUpsPendingForPane(2, false)).toBe(true)
  })

  it('is true when only preferSend slot is occupied', () => {
    expect(isSystemFollowUpsPendingForPane(0, true)).toBe(true)
  })

  it('is false when FIFO is empty and preferSend is free', () => {
    expect(isSystemFollowUpsPendingForPane(0, false)).toBe(false)
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

  it('does not promote when idle with unified systemFollowUpsPending false (no humanTurnBlocked shortcut)', () => {
    const fifoLength = 0
    const hasPreferSendSlot = false
    const systemFollowUpsPending = isSystemFollowUpsPendingForPane(fifoLength, hasPreferSendSlot)
    expect(systemFollowUpsPending).toBe(false)
    expect(shouldPromoteHumanSendToVisibleQueue({
      busy: false,
      awaitingDelegations: false,
      delegationWorkActive: false,
      systemFollowUpsPending,
    }, 'linear')).toBe(false)
  })
})

describe('preferSendSlotIsSystemWork', () => {
  it('a human send in the slot does not count as pending system work', () => {
    expect(preferSendSlotIsSystemWork({ })).toBe(false)
    expect(preferSendSlotIsSystemWork(null)).toBe(false)
    expect(preferSendSlotIsSystemWork(undefined)).toBe(false)
  })

  it('delegations and orchestration follow-ups do count', () => {
    expect(preferSendSlotIsSystemWork({ delegation: { id: 'd1' } })).toBe(true)
    expect(preferSendSlotIsSystemWork({ orchestrationFollowUp: true })).toBe(true)
  })

  it('idle pane + own human slot no longer self-blocks canStartHumanTurnNow', () => {
    // Antes: el slot humano contaba como systemFollowUpsPending y el intake
    // nunca podía despachar directo — todo envío a un pane idle iba a chip.
    const systemFollowUpsPending = isSystemFollowUpsPendingForPane(
      0,
      preferSendSlotIsSystemWork({ text: 'hola' } as { delegation?: unknown }),
    )
    expect(systemFollowUpsPending).toBe(false)
    expect(canStartHumanTurnNow({
      busy: false,
      awaitingDelegations: false,
      delegationWorkActive: false,
      systemFollowUpsPending,
      orchestrationWorkStyle: 'linear',
    })).toBe(true)
  })
})

describe('threadScopedFlag', () => {
  it('scopes a pane flag to the active thread', () => {
    expect(threadScopedFlag(true, ['t1', 't2'], 't1')).toBe(true)
    expect(threadScopedFlag(true, ['t1', 't2'], 't3')).toBe(false)
    expect(threadScopedFlag(false, ['t1'], 't1')).toBe(false)
  })

  it('falls back to the pane flag without a thread list', () => {
    expect(threadScopedFlag(true, undefined, 't1')).toBe(true)
    expect(threadScopedFlag(true, [], 't1')).toBe(true)
  })

  it('legacy fallback keeps the pane-level flag', () => {
    expect(threadScopedFlag(true, ['t2'], 't1', true)).toBe(true)
    expect(threadScopedFlag(false, ['t1'], 't1', true)).toBe(false)
  })
})

describe('describeAgentQueueDrainBlock', () => {
  it('no reporta motivo cuando la cola puede drenar', () => {
    expect(describeAgentQueueDrainBlock({ ...idleBase })).toBeNull()
  })

  it('nombra el gate que frena, en el mismo orden que el drenaje', () => {
    expect(describeAgentQueueDrainBlock({ ...idleBase, loaded: false })).toBe('not_loaded')
    expect(describeAgentQueueDrainBlock({ ...idleBase, busy: true })).toBe('busy')
    expect(describeAgentQueueDrainBlock({
      ...idleBase,
      awaitingDelegations: true,
    })).toBe('awaiting_delegations')
    expect(describeAgentQueueDrainBlock({
      ...idleBase,
      awaitingDelegations: true,
      orchestrationWorkStyle: 'turbo',
      delegationWorkActive: true,
    })).toBe('delegation_work_active')
    expect(describeAgentQueueDrainBlock({
      ...idleBase,
      systemFollowUpsPending: true,
    })).toBe('system_follow_ups_pending')
  })

  it('coincide siempre con canDrainAgentQueue', () => {
    const flags = [false, true]
    for (const loaded of flags) {
      for (const busy of flags) {
        for (const awaitingDelegations of flags) {
          for (const delegationWorkActive of flags) {
            for (const systemFollowUpsPending of flags) {
              for (const headIsDelegation of flags) {
                for (const workStyle of ['linear', 'turbo'] as const) {
                  const state = {
                    loaded,
                    busy,
                    awaitingDelegations,
                    delegationWorkActive,
                    systemFollowUpsPending,
                    headIsDelegation,
                    orchestrationWorkStyle: workStyle,
                  }
                  expect(canDrainAgentQueue(state))
                    .toBe(describeAgentQueueDrainBlock(state) === null)
                }
              }
            }
          }
        }
      }
    }
  })
})

describe('describeOrchestrationFifoSkip', () => {
  const base = {
    hasPreferSendSlot: false,
    paneBusy: false,
    visibleQueued: 0,
    maxVisibleQueued: 10,
    headIsLaneDelegation: false,
  }

  it('ofrece el envío a un pane idle con el slot libre', () => {
    expect(describeOrchestrationFifoSkip({ ...base })).toBeNull()
  })

  it('respeta el slot único de preferSend, también para carriles', () => {
    expect(describeOrchestrationFifoSkip({ ...base, hasPreferSendSlot: true }))
      .toBe('prefer_send_slot_busy')
    expect(describeOrchestrationFifoSkip({
      ...base,
      hasPreferSendSlot: true,
      headIsLaneDelegation: true,
    })).toBe('prefer_send_slot_busy')
  })

  it('retiene follow-ups mientras el hilo visible trabaja', () => {
    expect(describeOrchestrationFifoSkip({ ...base, paneBusy: true })).toBe('pane_busy')
    expect(describeOrchestrationFifoSkip({ ...base, visibleQueued: 10 }))
      .toBe('visible_queue_full')
  })

  it('entrega la delegación con hilo propio aunque el pane esté ocupado', () => {
    // Sin esto la subtarea se quedaba en la FIFO detrás del turno visible del
    // especialista: Pulse la pintaba "en curso" y nunca arrancaba.
    expect(describeOrchestrationFifoSkip({
      ...base,
      paneBusy: true,
      visibleQueued: 10,
      headIsLaneDelegation: true,
    })).toBeNull()
  })
})
