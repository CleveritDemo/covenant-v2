import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '@shared/onboardingGuideFlow'
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
  doneSteps: ['new_context', 'open_terminal'],
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
      brainstormDraft: { goalFilled: true, participantCount: 2, ceremonyPicked: true },
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
      brainstormCeremonyPicked: true,
      brainstormRoomLive: true,
      brainstormRoomStoppable: false,
      brainstormRoomFinishable: false,
      humanSpokeInRoom: true,
      contextsModalOpen: false,
      contextKindPicked: false,
      contextNameFilled: false,
      sentFirstMessage: true,
      assignedAnyContext: true,
      doneSteps: ['saved_rooms'],
      terminalOpen: true,
    })
  })

  it('marks the viewed room finishable only when it stopped running', () => {
    const viewing = (view: string, liveRoomIds: string[]) => buildGuideResolveArgs({
      incomplete: true,
      path: 'business',
      projectFolder: '/tmp/ws',
      paneKinds: { a: 'agent' },
      planeOpenChatAgentId: null,
      brainstormView: view,
      brainstormRooms: [{ id: 'room-1' }],
      liveRoomIds,
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: [],
    })

    expect(viewing('room-1', []).brainstormRoomFinishable).toBe(true)
    expect(viewing('room-1', ['room-1']).brainstormRoomFinishable).toBe(false)
    expect(viewing('room-1', ['room-1']).brainstormRoomStoppable).toBe(true)
    expect(viewing('room-1', []).brainstormRoomStoppable).toBe(false)
    expect(viewing('rooms', ['room-1']).brainstormRoomStoppable).toBe(false)
    expect(viewing('rooms', []).brainstormRoomFinishable).toBe(false)
    expect(viewing('setup', []).brainstormRoomFinishable).toBe(false)
    expect(viewing('room-9', []).brainstormRoomFinishable).toBe(false)
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
    expect(args.terminalOpen).toBe(true)
  })

  it('keeps humanSpokeInRoom after the room left the tab list', () => {
    const args = buildGuideResolveArgs({
      incomplete: true,
      path: 'business',
      projectFolder: '/tmp/ws',
      paneKinds: { a: 'agent' },
      brainstormView: null,
      brainstormRooms: [],
      humanSpokeByRoom: { 'room-finished': true },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: [],
    })
    expect(args.humanSpokeInRoom).toBe(true)
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

  it('does not close Planear inside the room before saved_rooms', () => {
    const resolveArgs = buildGuideResolveArgs({
      incomplete: true,
      path: 'business',
      projectFolder: '/tmp/ws',
      paneKinds: { a: 'agent' },
      planeOpenChatAgentId: null,
      brainstormView: 'room-1',
      brainstormRooms: [{ id: 'room-1' }],
      liveRoomIds: [],
      humanSpokeByRoom: { 'room-1': true },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: ['join_round', 'finish_room'],
    })

    expect(resolveOnboardingGuideStep(resolveArgs)).toBeNull()
    expect(shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false })).toBe(false)
  })

  it('closes Planear once saved_rooms is dismissed', () => {
    const resolveArgs = buildGuideResolveArgs({
      incomplete: true,
      path: 'business',
      projectFolder: '/tmp/ws',
      paneKinds: { a: 'agent' },
      planeOpenChatAgentId: null,
      brainstormView: 'rooms',
      brainstormRooms: [],
      liveRoomIds: [],
      humanSpokeByRoom: { 'room-1': true },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: ['join_round', 'finish_room', 'saved_rooms'],
    })

    expect(shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false })).toBe(true)
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
