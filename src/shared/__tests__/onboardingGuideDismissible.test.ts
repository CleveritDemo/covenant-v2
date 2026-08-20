import { describe, expect, it } from 'vitest'
import {
  DISMISSIBLE_GUIDE_STEPS,
  isDismissibleGuideStep,
  resolveOnboardingGuideStep,
} from '../onboardingGuideFlow'

const ACTION_GUIDE_STEPS = [
  'choose_path',
  'pick_folder',
  'create_team',
  'open_brainstorm',
  'pick_ceremony',
  'start_ceremony',
  'select_agent',
  'send_message',
  'pick_participants',
  'new_context',
  'pick_context_kind',
  'name_context',
  'create_context',
  'assign_context',
] as const

const baseReady = {
  incomplete: true,
  path: 'engineer' as const,
  hasFolder: true,
  hasAgents: true,
  openChatAgentId: null,
  brainstormOverlayOpen: false,
}

describe('isDismissibleGuideStep', () => {
  it('returns true for each dismissible guide step', () => {
    for (const step of DISMISSIBLE_GUIDE_STEPS) {
      expect(isDismissibleGuideStep(step)).toBe(true)
    }
  })

  it('returns false for each action guide step', () => {
    for (const step of ACTION_GUIDE_STEPS) {
      expect(isDismissibleGuideStep(step)).toBe(false)
    }
  })

  it('returns false for unknown and empty strings', () => {
    expect(isDismissibleGuideStep('not_a_step')).toBe(false)
    expect(isDismissibleGuideStep('')).toBe(false)
  })

  it('lista los pasos informativos, y solo esos', () => {
    // write_goal lleva OK pero deshabilitado hasta que hay texto; assign_context
    // salió de la lista: ahora espera el arrastre real.
    expect(DISMISSIBLE_GUIDE_STEPS).toEqual([
      'write_goal',
      'join_round',
      'stop_room',
      'finish_room',
      'saved_rooms',
      'open_terminal',
    ])
  })
})

describe('resolveOnboardingGuideStep dismissible derivation', () => {
  it('omits dismissible for action steps such as send_message', () => {
    const step = resolveOnboardingGuideStep({
      ...baseReady,
      openChatAgentId: 'agent-1',
    })
    expect(step).toEqual({
      step: 'send_message',
      anchor: 'composer-input',
      messageKey: 'tabs.onboardingGuide.sendMessage',
    })
    expect(step).not.toHaveProperty('dismissible')
  })

  it('omits dismissible for assign_context: espera el arrastre real', () => {
    const step = resolveOnboardingGuideStep({
      ...baseReady,
      openChatAgentId: 'agent-1',
      sentFirstMessage: true,
      doneSteps: ['new_context'],
    })
    expect(step).toEqual({
      step: 'assign_context',
      anchor: 'context-pool',
      messageKey: 'tabs.onboardingGuide.assignContext',
    })
  })

  it('includes dismissible for open_terminal', () => {
    const step = resolveOnboardingGuideStep({
      ...baseReady,
      openChatAgentId: 'agent-1',
      sentFirstMessage: true,
      assignedAnyContext: true,
      doneSteps: ['new_context'],
    })
    expect(step).toEqual({
      step: 'open_terminal',
      anchor: 'plane-terminal-fab',
      messageKey: 'tabs.onboardingGuide.openTerminal',
      dismissible: true,
    })
  })
})
