import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '@shared/onboardingGuideFlow'
import {
  buildGuideResolveArgs,
  shouldCompleteByGuideExhausted,
  type OnboardingGuideTabSnapshot,
} from '../onboardingAppWiring'

type SnapshotOverrides = Partial<
  Pick<
    OnboardingGuideTabSnapshot,
    | 'brainstormView'
    | 'brainstormDraft'
    | 'brainstormRooms'
    | 'liveRoomIds'
    | 'humanSpokeByRoom'
    | 'doneSteps'
  >
>

function businessSnapshot(overrides: SnapshotOverrides = {}): OnboardingGuideTabSnapshot {
  return {
    incomplete: true,
    path: 'business',
    projectFolder: '/repo',
    paneKinds: { a1: 'agent' },
    planeOpenChatAgentId: null,
    brainstormView: overrides.brainstormView ?? null,
    brainstormDraft: overrides.brainstormDraft,
    brainstormRooms: overrides.brainstormRooms,
    liveRoomIds: overrides.liveRoomIds,
    humanSpokeByRoom: overrides.humanSpokeByRoom,
    sentFirstMessage: false,
    assignedAnyContext: false,
    doneSteps: overrides.doneSteps ?? [],
  }
}

function resolveBusiness(overrides: SnapshotOverrides = {}) {
  const resolveArgs = buildGuideResolveArgs(businessSnapshot(overrides))
  return {
    stepId: resolveOnboardingGuideStep(resolveArgs)?.step ?? null,
    complete: shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
  }
}

describe('onboarding business exhaust matrix (App snapshot contract)', () => {
  it('a) closed module without rooms → open_brainstorm, not complete', () => {
    const { stepId, complete } = resolveBusiness({ brainstormView: null })
    expect(stepId).toBe('open_brainstorm')
    expect(complete).toBe(false)
  })

  it("b) setup with empty goal → write_goal, not complete", () => {
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: false, participantCount: 0 },
    })
    expect(stepId).toBe('write_goal')
    expect(complete).toBe(false)
  })

  it("c) setup with goal and no participants → pick_participants, not complete", () => {
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: true, participantCount: 0 },
    })
    expect(stepId).toBe('pick_participants')
    expect(complete).toBe(false)
  })

  it("d) setup ready to start → start_ceremony, not complete", () => {
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'setup',
      brainstormDraft: { goalFilled: true, participantCount: 2 },
    })
    expect(stepId).toBe('start_ceremony')
    expect(complete).toBe(false)
  })

  it("e) rooms library with live room → open_brainstorm, not complete", () => {
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'rooms',
      brainstormRooms: [{ id: 'r1' }],
      liveRoomIds: ['r1'],
    })
    expect(stepId).toBe('open_brainstorm')
    expect(complete).toBe(false)
  })

  it("f) live room without human speak → join_round, not complete", () => {
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'r1',
      brainstormRooms: [{ id: 'r1' }],
      liveRoomIds: ['r1'],
      humanSpokeByRoom: {},
    })
    expect(stepId).toBe('join_round')
    expect(complete).toBe(false)
  })

  it('g) ended room without human speak → null step AND not complete (transient null)', () => {
    // Bug in 773e9ee without backend guard: shouldCompleteByGuideExhausted returns true here.
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'r1',
      brainstormRooms: [{ id: 'r1' }],
      liveRoomIds: [],
      humanSpokeByRoom: {},
      doneSteps: [],
    })
    expect(stepId).toBe(null)
    expect(complete).toBe(false)
  })

  it("h) live room after speak with saved_rooms done → null and complete", () => {
    const { stepId, complete } = resolveBusiness({
      brainstormView: 'r1',
      brainstormRooms: [{ id: 'r1' }],
      liveRoomIds: ['r1'],
      humanSpokeByRoom: { r1: true },
      doneSteps: ['saved_rooms'],
    })
    expect(stepId).toBe(null)
    expect(complete).toBe(true)
  })
})
