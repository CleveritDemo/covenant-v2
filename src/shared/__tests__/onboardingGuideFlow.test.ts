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

const businessReady = {
  ...baseReady,
  path: 'business' as const,
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

  it('hasFolder wins over a blank projectFolder', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        hasFolder: true,
        projectFolder: '   ',
        openChatAgentId: 'agent-1',
      })?.step,
    ).toBe('send_message')
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        hasFolder: false,
        projectFolder: '/tmp/project',
      })?.step,
    ).toBe('pick_folder')
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
        ...businessReady,
        brainstormOverlayOpen: false,
      }),
    ).toEqual({
      step: 'open_brainstorm',
      anchor: 'brainstorm-rail',
      messageKey: 'tabs.onboardingGuide.openBrainstorm',
    })
  })

  it('open_brainstorm when overlay is open but view is unset and room is idle', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
      }),
    ).toEqual({
      step: 'open_brainstorm',
      anchor: 'brainstorm-rail',
      messageKey: 'tabs.onboardingGuide.openBrainstorm',
    })
  })

  it('write_goal in setup before the goal is filled', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
      }),
    ).toEqual({
      step: 'write_goal',
      anchor: 'brainstorm-goal',
      messageKey: 'tabs.onboardingGuide.writeGoal',
    })
  })

  it('pick_participants in setup after goal with no seats', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        brainstormGoalFilled: true,
      }),
    ).toEqual({
      step: 'pick_participants',
      anchor: 'brainstorm-participants',
      messageKey: 'tabs.onboardingGuide.pickParticipants',
    })
  })

  it('start_ceremony in setup after goal and at least one participant', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        brainstormGoalFilled: true,
        brainstormParticipantCount: 1,
      }),
    ).toEqual({
      step: 'start_ceremony',
      anchor: 'brainstorm-start',
      messageKey: 'tabs.onboardingGuide.startCeremony',
    })
  })

  it('join_round when the room is live and the human has not spoken', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomLive: true,
      }),
    ).toEqual({
      step: 'join_round',
      anchor: 'brainstorm-human-composer',
      messageKey: 'tabs.onboardingGuide.joinRound',
    })
  })

  it('saved_rooms is dismissible after the human spoke', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        humanSpokeInRoom: true,
      }),
    ).toEqual({
      step: 'saved_rooms',
      anchor: 'brainstorm-module-tabs',
      messageKey: 'tabs.onboardingGuide.savedRooms',
      dismissible: true,
    })
  })

  it('rooms view without live room guides to create a new room', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        brainstormRoomLive: false,
      }),
    ).toEqual({
      step: 'open_brainstorm',
      anchor: 'brainstorm-module-tabs',
      messageKey: 'tabs.onboardingGuide.newRoom',
    })
  })

  it('rooms view with live room guides to open it before speaking', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        brainstormRoomLive: true,
        humanSpokeInRoom: false,
      }),
    ).toEqual({
      step: 'open_brainstorm',
      anchor: 'brainstorm-rooms-list',
      messageKey: 'tabs.onboardingGuide.openLiveRoom',
    })
  })

  it('live room view after speaking returns null (no tabs anchor)', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomLive: true,
        humanSpokeInRoom: true,
      }),
    ).toBeNull()
  })

  it('setup view after speaking offers saved_rooms dismissible', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        humanSpokeInRoom: true,
      }),
    ).toEqual({
      step: 'saved_rooms',
      anchor: 'brainstorm-module-tabs',
      messageKey: 'tabs.onboardingGuide.savedRooms',
      dismissible: true,
    })
  })

  it('business ladder continues with newRoom after saved_rooms is dismissed in rooms', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        humanSpokeInRoom: true,
        doneSteps: ['saved_rooms'],
      }),
    ).toEqual({
      step: 'open_brainstorm',
      anchor: 'brainstorm-module-tabs',
      messageKey: 'tabs.onboardingGuide.newRoom',
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

  it('send_message for engineer with open chat agent before first send', () => {
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

  it('assign_context is dismissible after the first send', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
      }),
    ).toEqual({
      step: 'assign_context',
      anchor: 'context-pool',
      messageKey: 'tabs.onboardingGuide.assignContext',
      dismissible: true,
    })
  })

  it('open_terminal is dismissible after a context is assigned', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: true,
      }),
    ).toEqual({
      step: 'open_terminal',
      anchor: 'plane-terminal-fab',
      messageKey: 'tabs.onboardingGuide.openTerminal',
      dismissible: true,
    })
  })

  it('engineer ladder is exhausted after terminal step is dismissed', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: true,
        doneSteps: ['open_terminal'],
      }),
    ).toBeNull()
  })

  it('dismissing assign_context skips it even without an assigned context', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        doneSteps: ['assign_context'],
      })?.step,
    ).toBe('open_terminal')
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
        ...businessReady,
        openChatAgentId: 'agent-1',
        brainstormOverlayOpen: false,
      })?.step,
    ).toBe('open_brainstorm')

    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        openChatAgentId: 'agent-1',
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        brainstormGoalFilled: true,
        brainstormParticipantCount: 2,
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
