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
  'start_ceremony',
  'select_agent',
  'send_message',
  'write_goal',
  'pick_participants',
  'join_round',
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

  it('lists exactly three dismissible steps', () => {
    expect(DISMISSIBLE_GUIDE_STEPS).toEqual([
      'saved_rooms',
      'assign_context',
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

  it('includes dismissible for assign_context', () => {
    const step = resolveOnboardingGuideStep({
      ...baseReady,
      openChatAgentId: 'agent-1',
      sentFirstMessage: true,
    })
    expect(step).toEqual({
      step: 'assign_context',
      anchor: 'context-pool',
      messageKey: 'tabs.onboardingGuide.assignContext',
      dismissible: true,
    })
  })
})
