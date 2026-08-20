import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '@shared/onboardingGuideFlow'
import { shouldCompleteByGuideExhausted } from '../onboardingAppWiring'

const businessBase = {
  incomplete: true as const,
  path: 'business' as const,
  hasFolder: true,
  hasAgents: true,
  openChatAgentId: null,
  brainstormOverlayOpen: true,
  sentFirstMessage: false,
  assignedAnyContext: false,
}

describe('shouldCompleteByGuideExhausted brainstorm guard', () => {
  it('a) ended room without speak: resolve null but do not complete', () => {
    const resolveArgs = {
      ...businessBase,
      brainstormView: 'room-1',
      brainstormRoomLive: false,
      humanSpokeInRoom: false,
      doneSteps: [],
    }
    expect(resolveOnboardingGuideStep(resolveArgs)).toBeNull()
    expect(
      shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
    ).toBe(false)
  })

  it('b) live room after speak: resolve null but do not complete', () => {
    const resolveArgs = {
      ...businessBase,
      brainstormView: 'room-1',
      brainstormRoomLive: true,
      humanSpokeInRoom: true,
      doneSteps: [],
    }
    expect(resolveOnboardingGuideStep(resolveArgs)).toBeNull()
    expect(
      shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
    ).toBe(false)
  })

  it('c) overlay closed with live room: do not complete', () => {
    const resolveArgs = {
      ...businessBase,
      brainstormView: null,
      brainstormOverlayOpen: false,
      brainstormRoomLive: true,
      humanSpokeInRoom: true,
      doneSteps: [],
    }
    expect(
      shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
    ).toBe(false)
  })

  it('d) saved_rooms already done: complete after null', () => {
    const resolveArgs = {
      ...businessBase,
      brainstormView: 'room-1',
      brainstormRoomLive: false,
      humanSpokeInRoom: false,
      doneSteps: ['saved_rooms'],
    }
    expect(
      shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
    ).toBe(true)
  })

  it("e) setup view: write_goal pending, do not complete", () => {
    const resolveArgs = {
      ...businessBase,
      brainstormView: 'setup' as const,
      brainstormRoomLive: false,
      humanSpokeInRoom: false,
      doneSteps: [],
    }
    expect(resolveOnboardingGuideStep(resolveArgs)?.step).toBe('write_goal')
    expect(
      shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
    ).toBe(false)
  })

  it('f) engineer exhausted: guard does not block', () => {
    const resolveArgs = {
      incomplete: true as const,
      path: 'engineer' as const,
      hasFolder: true,
      hasAgents: true,
      openChatAgentId: 'a1',
      brainstormOverlayOpen: false,
      brainstormView: null,
      sentFirstMessage: true,
      assignedAnyContext: true,
      terminalOpen: true,
      doneSteps: ['new_context'],
    }
    expect(
      shouldCompleteByGuideExhausted({ resolveArgs, cliAllMissing: false }),
    ).toBe(true)
  })
})
