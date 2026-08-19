import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '../onboardingGuideFlow'
import { buildGuideResolveArgs } from '../../renderer/onboardingAppWiring'

const engineerLate = {
  incomplete: true,
  path: 'engineer' as const,
  hasFolder: true,
  hasAgents: true,
  openChatAgentId: 'agent-1',
  brainstormOverlayOpen: false,
  sentFirstMessage: true,
  assignedAnyContext: true,
}

describe('onboardingGuideAutoSkip', () => {
  it('engineer con terminal abierto agota la escalera sin open_terminal', () => {
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        terminalOpen: true,
        doneSteps: [],
      }),
    ).toBeNull()
  })

  it('engineer sin terminal abierto pide open_terminal dismissible', () => {
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        terminalOpen: false,
        doneSteps: [],
      }),
    ).toEqual({
      step: 'open_terminal',
      anchor: 'plane-terminal-fab',
      messageKey: 'tabs.onboardingGuide.openTerminal',
      dismissible: true,
    })
  })

  it('engineer con open_terminal en doneSteps agota la escalera aunque no haya terminal', () => {
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        terminalOpen: false,
        doneSteps: ['open_terminal'],
      }),
    ).toBeNull()
  })

  it('dismiss de assign_context no lo reabre; avanza a open_terminal', () => {
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        assignedAnyContext: false,
        terminalOpen: false,
        doneSteps: ['assign_context'],
      })?.step,
    ).toBe('open_terminal')
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        assignedAnyContext: false,
        terminalOpen: false,
        doneSteps: ['assign_context'],
      })?.step,
    ).not.toBe('assign_context')
  })

  it('business con saved_rooms dismissido no reaparece saved_rooms', () => {
    expect(
      resolveOnboardingGuideStep({
        incomplete: true,
        path: 'business',
        hasFolder: true,
        hasAgents: true,
        openChatAgentId: null,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        humanSpokeInRoom: true,
        doneSteps: ['saved_rooms'],
      }),
    ).toBeNull()
  })

  it('buildGuideResolveArgs deriva terminalOpen desde paneKinds', () => {
    const withTerminal = buildGuideResolveArgs({
      incomplete: true,
      path: 'engineer',
      paneKinds: { p1: 'agent', p2: 'terminal' },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: [],
    })
    expect(withTerminal.terminalOpen).toBe(true)

    const withoutTerminal = buildGuideResolveArgs({
      incomplete: true,
      path: 'engineer',
      paneKinds: { p1: 'agent' },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: [],
    })
    expect(withoutTerminal.terminalOpen).toBe(false)
  })
})
