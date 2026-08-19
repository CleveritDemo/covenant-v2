import { describe, expect, it } from 'vitest'
import {
  buildGuideResolveArgs,
  shouldCompleteByGuideExhausted,
  type OnboardingGuideTabSnapshot,
} from '../onboardingAppWiring'

const engineerReady: OnboardingGuideTabSnapshot = {
  incomplete: true,
  path: 'engineer',
  projectFolder: '/tmp/project',
  paneKinds: { 'pane-1': 'agent' },
  planeOpenChatAgentId: 'agent-1',
  brainstormView: null,
  sentFirstMessage: true,
  assignedAnyContext: true,
  doneSteps: ['open_terminal'],
}

describe('buildGuideResolveArgs', () => {
  it('maps folder, agents, open chat, overlay/view, draft, live, spoke and the three signals', () => {
    const args = buildGuideResolveArgs({
      incomplete: true,
      path: 'business',
      projectFolder: '  /tmp/ws  ',
      paneKinds: { a: 'agent', t: 'terminal' },
      planeOpenChatAgentId: 'pane-9',
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: true, participantCount: 2 },
      brainstormRooms: [{ id: 'room-1' }, { id: 'room-2' }],
      liveRoomIds: ['room-2'],
      humanSpokeByRoom: { 'room-1': true },
      sentFirstMessage: true,
      assignedAnyContext: true,
      doneSteps: ['saved_rooms'],
    })
    expect(args).toEqual({
      incomplete: true,
      path: 'business',
      hasFolder: true,
      hasAgents: true,
      openChatAgentId: 'pane-9',
      brainstormOverlayOpen: true,
      brainstormView: 'setup',
      brainstormGoalFilled: true,
      brainstormParticipantCount: 2,
      brainstormRoomLive: true,
      humanSpokeInRoom: true,
      sentFirstMessage: true,
      assignedAnyContext: true,
      doneSteps: ['saved_rooms'],
    })
  })

  it('treats blank folder, missing agents and empty view as unset', () => {
    const args = buildGuideResolveArgs({
      incomplete: true,
      path: '',
      projectFolder: '   ',
      paneKinds: { t: 'terminal' },
      planeOpenChatAgentId: null,
      brainstormView: null,
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: [],
    })
    expect(args.hasFolder).toBe(false)
    expect(args.hasAgents).toBe(false)
    expect(args.openChatAgentId).toBeNull()
    expect(args.brainstormOverlayOpen).toBe(false)
    expect(args.brainstormRoomLive).toBe(false)
    expect(args.humanSpokeInRoom).toBe(false)
  })
})

describe('shouldCompleteByGuideExhausted', () => {
  it('returns true when the engineer ladder is exhausted', () => {
    expect(
      shouldCompleteByGuideExhausted({
        resolveArgs: buildGuideResolveArgs(engineerReady),
        cliAllMissing: false,
      }),
    ).toBe(true)
  })

  it('returns false when path is empty', () => {
    expect(
      shouldCompleteByGuideExhausted({
        resolveArgs: buildGuideResolveArgs({ ...engineerReady, path: '' }),
        cliAllMissing: false,
      }),
    ).toBe(false)
  })

  it('returns false when every CLI is missing', () => {
    expect(
      shouldCompleteByGuideExhausted({
        resolveArgs: buildGuideResolveArgs(engineerReady),
        cliAllMissing: true,
      }),
    ).toBe(false)
  })

  it('returns false when a guide step is still pending', () => {
    expect(
      shouldCompleteByGuideExhausted({
        resolveArgs: buildGuideResolveArgs({
          ...engineerReady,
          sentFirstMessage: false,
          doneSteps: [],
        }),
        cliAllMissing: false,
      }),
    ).toBe(false)
  })
})
