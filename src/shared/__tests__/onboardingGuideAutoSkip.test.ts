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
        doneSteps: ['new_context'],
      }),
    ).toBeNull()
  })

  it('engineer sin terminal abierto pide open_terminal dismissible', () => {
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        terminalOpen: false,
        doneSteps: ['new_context'],
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
        doneSteps: ['new_context', 'open_terminal'],
      }),
    ).toBeNull()
  })

  it('assign_context no se cierra con doneSteps: espera el arrastre real', () => {
    expect(
      resolveOnboardingGuideStep({
        ...engineerLate,
        assignedAnyContext: false,
        terminalOpen: false,
        doneSteps: ['new_context', 'assign_context'],
      })?.step,
    ).toBe('assign_context')
  })

  it('buildGuideResolveArgs deriva terminalOpen desde paneKinds', () => {
    const withTerminal = buildGuideResolveArgs({
      incomplete: true,
      path: 'engineer',
      paneKinds: { p1: 'agent', p2: 'terminal' },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: ['new_context'],
    })
    expect(withTerminal.terminalOpen).toBe(true)

    const withoutTerminal = buildGuideResolveArgs({
      incomplete: true,
      path: 'engineer',
      paneKinds: { p1: 'agent' },
      sentFirstMessage: false,
      assignedAnyContext: false,
      doneSteps: ['new_context'],
    })
    expect(withoutTerminal.terminalOpen).toBe(false)
  })
})
