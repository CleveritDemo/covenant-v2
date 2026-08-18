import { describe, expect, it } from 'vitest'
import { resolveOnboardingGuideStep } from '../onboardingGuideFlow'

const baseReady = {
  incomplete: true,
  path: 'engineer' as const,
  hasFolder: true,
  hasAgents: true,
  openChatAgentId: null,
  brainstormOverlayOpen: false,
}

describe('resolveOnboardingGuideStep', () => {
  it('returns null when onboarding is complete', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        incomplete: false,
        openChatAgentId: 'agent-1',
      }),
    ).toBeNull()
  })

  it('choose_path when path is empty', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: '',
      }),
    ).toEqual({
      step: 'choose_path',
      anchor: 'path-picker',
      messageKey: 'tabs.onboardingGuide.choosePath',
    })
  })

  it('pick_folder when folder is missing', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        hasFolder: false,
      }),
    ).toEqual({
      step: 'pick_folder',
      anchor: 'project-folder',
      messageKey: 'tabs.onboardingGuide.pickFolder',
    })
  })

  it('create_team when agents are missing', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        hasAgents: false,
      }),
    ).toEqual({
      step: 'create_team',
      anchor: 'create-team',
      messageKey: 'tabs.onboardingGuide.createTeam',
    })
  })

  it('open_brainstorm for business before overlay opens', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: 'business',
        brainstormOverlayOpen: false,
      }),
    ).toEqual({
      step: 'open_brainstorm',
      anchor: 'brainstorm-rail',
      messageKey: 'tabs.onboardingGuide.openBrainstorm',
    })
  })

  it('start_ceremony for business with overlay open', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: 'business',
        brainstormOverlayOpen: true,
      }),
    ).toEqual({
      step: 'start_ceremony',
      anchor: 'brainstorm-start',
      messageKey: 'tabs.onboardingGuide.startCeremony',
    })
  })

  it('select_agent for engineer without open chat agent', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: null,
      }),
    ).toEqual({
      step: 'select_agent',
      anchor: 'composer-agents',
      messageKey: 'tabs.onboardingGuide.selectAgent',
    })
  })

  it('send_message for engineer with open chat agent', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
      }),
    ).toEqual({
      step: 'send_message',
      anchor: 'composer-input',
      messageKey: 'tabs.onboardingGuide.sendMessage',
    })
  })

  it('engineer never returns send_message without openChatAgentId', () => {
    const withoutAgent = resolveOnboardingGuideStep({
      ...baseReady,
      openChatAgentId: null,
    })
    expect(withoutAgent?.step).not.toBe('send_message')

    const emptyAgent = resolveOnboardingGuideStep({
      ...baseReady,
      openChatAgentId: '',
    })
    expect(emptyAgent?.step).not.toBe('send_message')
    expect(emptyAgent?.step).toBe('select_agent')
  })

  it('earlier rules win over later engineer steps', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: '',
        openChatAgentId: 'agent-1',
        brainstormOverlayOpen: true,
      })?.step,
    ).toBe('choose_path')

    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        hasFolder: false,
        openChatAgentId: 'agent-1',
      })?.step,
    ).toBe('pick_folder')

    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        hasAgents: false,
        openChatAgentId: 'agent-1',
      })?.step,
    ).toBe('create_team')
  })

  it('business brainstorm steps win over engineer send when path is business', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: 'business',
        openChatAgentId: 'agent-1',
        brainstormOverlayOpen: false,
      })?.step,
    ).toBe('open_brainstorm')

    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: 'business',
        openChatAgentId: 'agent-1',
        brainstormOverlayOpen: true,
      })?.step,
    ).toBe('start_ceremony')
  })

  it('returns null for unrecognized path after setup gates', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        path: 'unknown' as 'engineer',
      }),
    ).toBeNull()
  })
})
