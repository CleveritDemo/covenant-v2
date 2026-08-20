import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '@shared/onboardingGuideFlow'
import {
  buildGuideResolveArgs,
  shouldCompleteByGuideExhausted,
  type OnboardingGuideTabSnapshot,
} from '../onboardingAppWiring'

/** Tab con equipo montado: escenario que hoy se rompe aguas arriba. */
const teamTabBase: Pick<
  OnboardingGuideTabSnapshot,
  'incomplete' | 'projectFolder' | 'paneKinds'
> = {
  incomplete: true,
  projectFolder: '/tmp/project',
  paneKinds: { p1: 'agent' },
}

function resolveStep(tab: OnboardingGuideTabSnapshot): string | null {
  return resolveOnboardingGuideStep(buildGuideResolveArgs(tab))?.step ?? null
}

function guideExhausted(tab: OnboardingGuideTabSnapshot): boolean {
  return shouldCompleteByGuideExhausted({
    resolveArgs: buildGuideResolveArgs(tab),
    cliAllMissing: false,
  })
}

describe('track engineer con equipo montado', () => {
  it('sin chat abierto pide select_agent', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'engineer',
        planeOpenChatAgentId: null,
        sentFirstMessage: false,
        assignedAnyContext: false,
        doneSteps: [],
      }),
    ).toBe('select_agent')
  })

  it('con chat abierto y sin primer envío pide send_message', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'engineer',
        planeOpenChatAgentId: 'agent-1',
        sentFirstMessage: false,
        assignedAnyContext: false,
        doneSteps: [],
      }),
    ).toBe('send_message')
  })

  it('tras el primer envío pide assign_context', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'engineer',
        planeOpenChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: false,
        doneSteps: ['new_context'],
      }),
    ).toBe('assign_context')
  })

  it('con contexto asignado pide open_terminal', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'engineer',
        planeOpenChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: true,
        doneSteps: ['new_context'],
      }),
    ).toBe('open_terminal')
  })

  it('con open_terminal cerrado agota la escalera', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'engineer',
        planeOpenChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: true,
        doneSteps: ['new_context', 'open_terminal'],
      }),
    ).toBeNull()
  })

  it('con pane terminal abierto auto-salta open_terminal y agota la escalera', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        paneKinds: { p1: 'agent', p2: 'terminal' },
        path: 'engineer',
        planeOpenChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: true,
        doneSteps: ['new_context'],
      }),
    ).toBeNull()
  })

  it('shouldCompleteByGuideExhausted solo es true al agotar la escalera', () => {
    const step1: OnboardingGuideTabSnapshot = {
      ...teamTabBase,
      path: 'engineer',
      planeOpenChatAgentId: null,
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: [],
    }
    const step2: OnboardingGuideTabSnapshot = {
      ...step1,
      planeOpenChatAgentId: 'agent-1',
    }
    const step3: OnboardingGuideTabSnapshot = {
      ...step2,
      sentFirstMessage: true,
    }
    const step4: OnboardingGuideTabSnapshot = {
      ...step3,
      assignedAnyContext: true,
      doneSteps: ['new_context'],
    }
    const step5: OnboardingGuideTabSnapshot = {
      ...step4,
      doneSteps: ['new_context', 'open_terminal'],
    }

    expect(guideExhausted(step1)).toBe(false)
    expect(guideExhausted(step2)).toBe(false)
    expect(guideExhausted(step3)).toBe(false)
    expect(guideExhausted(step4)).toBe(false)
    expect(guideExhausted(step5)).toBe(true)
  })
})

describe('track business con equipo montado', () => {
  it('sin overlay ni sala viva pide open_brainstorm', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'business',
        brainstormView: null,
        doneSteps: [],
      }),
    ).toBe('open_brainstorm')
  })

  it('en setup sin objetivo pide write_goal', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'business',
        brainstormView: 'setup',
        brainstormDraft: { goalFilled: false, participantCount: 0 },
        doneSteps: [],
      }),
    ).toBe('write_goal')
  })

  it('en setup con objetivo y sin participantes pide pick_participants', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'business',
        brainstormView: 'setup',
        brainstormDraft: { goalFilled: true, participantCount: 0 },
        doneSteps: ['write_goal'],
      }),
    ).toBe('pick_participants')
  })

  it('en setup con objetivo y participantes pide start_ceremony', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'business',
        brainstormView: 'setup',
        brainstormDraft: { goalFilled: true, participantCount: 2, ceremonyPicked: true },
        doneSteps: ['write_goal'],
      }),
    ).toBe('start_ceremony')
  })

  it('con sala viva en rooms sin intervención humana pide openLiveRoom', () => {
    expect(
      resolveStep({
        ...teamTabBase,
        path: 'business',
        brainstormView: 'rooms',
        brainstormRooms: [{ id: 'room-1' }],
        liveRoomIds: ['room-1'],
        humanSpokeByRoom: {},
        doneSteps: [],
      }),
    ).toBe('open_brainstorm')
  })

  it('tras hablar pide saved_rooms y con eso agota la escalera', () => {
    const spokeTab: OnboardingGuideTabSnapshot = {
      ...teamTabBase,
      path: 'business',
      brainstormView: 'rooms',
      brainstormRooms: [{ id: 'room-1' }],
      liveRoomIds: ['room-1'],
      humanSpokeByRoom: { 'room-1': true },
      doneSteps: [],
    }

    expect(resolveStep(spokeTab)).toBe('saved_rooms')
    expect(
      resolveStep({
        ...spokeTab,
        doneSteps: ['saved_rooms'],
      }),
    ).toBeNull()
  })
})
