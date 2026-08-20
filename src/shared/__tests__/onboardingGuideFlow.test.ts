import { describe, expect, it } from 'vitest'
import {
  onboardingGuideTitleKey,
  resolveOnboardingGuideStep,
} from '../onboardingGuideFlow'

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

  it('does not reopen open_brainstorm after human spoke with overlay closed', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: false,
        humanSpokeInRoom: true,
      }),
    ).toBeNull()
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

  it('write_goal con OK apagado mientras el objetivo está vacío', () => {
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
      dismissible: true,
      dismissDisabled: true,
    })
  })

  it('write_goal habilita el OK al haber texto, pero no avanza solo', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        brainstormGoalFilled: true,
      }),
    ).toEqual({
      step: 'write_goal',
      anchor: 'brainstorm-goal',
      messageKey: 'tabs.onboardingGuide.writeGoal',
      dismissible: true,
    })
  })

  it('pick_participants in setup after the goal OK until two seats', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        doneSteps: ['write_goal'],
      }),
    ).toEqual({
      step: 'pick_participants',
      anchor: 'brainstorm-participants',
      messageKey: 'tabs.onboardingGuide.pickParticipants',
    })
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        doneSteps: ['write_goal'],
        brainstormParticipantCount: 1,
      }),
    ).toEqual({
      step: 'pick_participants',
      anchor: 'brainstorm-participants',
      messageKey: 'tabs.onboardingGuide.pickParticipants',
    })
  })

  it('start_ceremony in setup after the goal OK, two seats and ceremony picked', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        doneSteps: ['write_goal'],
        brainstormParticipantCount: 2,
      }),
    ).toEqual({
      step: 'pick_ceremony',
      anchor: 'brainstorm-ceremony',
      messageKey: 'tabs.onboardingGuide.pickCeremony',
    })
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'setup',
        doneSteps: ['write_goal'],
        brainstormParticipantCount: 2,
        brainstormCeremonyPicked: true,
      }),
    ).toEqual({
      step: 'start_ceremony',
      anchor: 'brainstorm-start',
      messageKey: 'tabs.onboardingGuide.startCeremony',
    })
  })

  it('join_round is dismissible while the room is live (sending optional)', () => {
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
      dismissible: true,
    })
  })

  it('after join_round and stop_room OK, stays quiet while the room still runs', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomLive: true,
        brainstormRoomStoppable: true,
        doneSteps: ['join_round', 'stop_room'],
      }),
    ).toBeNull()
  })

  it('stop_room after join_round OK while the room is still running', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomLive: true,
        brainstormRoomStoppable: true,
        doneSteps: ['join_round'],
      }),
    ).toEqual({
      step: 'stop_room',
      anchor: 'brainstorm-stop',
      messageKey: 'tabs.onboardingGuide.stopRoom',
      dismissible: true,
    })
  })

  it('after stop_room OK the room stopping brings finish_room', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomFinishable: true,
        doneSteps: ['join_round', 'stop_room'],
      })?.step,
    ).toBe('finish_room')
  })

  it('finish_room after join_round OK when the room stopped running', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomFinishable: true,
        doneSteps: ['join_round'],
      }),
    ).toEqual({
      step: 'finish_room',
      anchor: 'brainstorm-finish',
      messageKey: 'tabs.onboardingGuide.finishRoom',
      dismissible: true,
    })
  })

  it('finish_room also comes after the human spoke', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomFinishable: true,
        humanSpokeInRoom: true,
      })?.step,
    ).toBe('finish_room')
  })

  it('no finish_room before join_round OK or speaking', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'room-1',
        brainstormRoomFinishable: true,
      }),
    ).toBeNull()
  })

  it('after finish_room OK the ladder moves on to saved_rooms', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        doneSteps: ['join_round', 'finish_room'],
      })?.step,
    ).toBe('saved_rooms')
  })

  it('saved_rooms is dismissible after join_round OK on rooms view', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        doneSteps: ['join_round'],
      }),
    ).toEqual({
      step: 'saved_rooms',
      anchor: 'brainstorm-module-tabs',
      messageKey: 'tabs.onboardingGuide.savedRooms',
      dismissible: true,
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

  it('live room view after speaking: sin tip de intervenir y sin ancla de pestañas, null', () => {
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

  it('business ladder se agota en rooms tras cerrar saved_rooms', () => {
    // Aquí termina el recorrido de Planear: si en su lugar volviera «crea una
    // sala», la escalera no se agotaría nunca y el onboarding no cerraría
    // (ver shouldCompleteByGuideExhausted en onboardingAppWiring).
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: true,
        brainstormView: 'rooms',
        humanSpokeInRoom: true,
        doneSteps: ['saved_rooms'],
      }),
    ).toBeNull()
  })

  it('closing the module after join_round OK does not reopen open_brainstorm', () => {
    expect(
      resolveOnboardingGuideStep({
        ...businessReady,
        brainstormOverlayOpen: false,
        doneSteps: ['join_round'],
      }),
    ).toBeNull()
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

  it('send_message espera el envío real: sin OK', () => {
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

  it('dentro del modal: tipo, nombre y guardar, en ese orden', () => {
    const inModal = {
      ...baseReady,
      openChatAgentId: 'agent-1',
      sentFirstMessage: true,
      contextsModalOpen: true,
    }
    expect(resolveOnboardingGuideStep(inModal)).toEqual({
      step: 'pick_context_kind',
      anchor: 'context-kind',
      messageKey: 'tabs.onboardingGuide.pickContextKind',
    })
    expect(
      resolveOnboardingGuideStep({ ...inModal, contextKindPicked: true }),
    ).toEqual({
      step: 'name_context',
      anchor: 'context-name',
      messageKey: 'tabs.onboardingGuide.nameContext',
    })
    expect(
      resolveOnboardingGuideStep({
        ...inModal,
        contextKindPicked: true,
        contextNameFilled: true,
      }),
    ).toEqual({
      step: 'create_context',
      anchor: 'context-save',
      messageKey: 'tabs.onboardingGuide.createContext',
    })
  })

  it('new_context espera el «+»: sin OK y muere al abrirse el modal', () => {
    const afterSend = {
      ...baseReady,
      openChatAgentId: 'agent-1',
      sentFirstMessage: true,
    }
    expect(resolveOnboardingGuideStep(afterSend)).toEqual({
      step: 'new_context',
      anchor: 'context-new',
      messageKey: 'tabs.onboardingGuide.newContext',
    })
    // Con el modal abierto manda el paso del formulario: el «+» queda detrás.
    expect(
      resolveOnboardingGuideStep({ ...afterSend, contextsModalOpen: true })?.step,
    ).toBe('pick_context_kind')
  })

  it('al cerrar el modal, con el «+» ya pulsado, toca arrastrar (sin OK)', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        doneSteps: ['new_context'],
      }),
    ).toEqual({
      step: 'assign_context',
      anchor: 'context-pool',
      messageKey: 'tabs.onboardingGuide.assignContext',
    })
  })

  it('assign_context espera la asignación real, sin OK', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        doneSteps: ['new_context'],
      }),
    ).toEqual({
      step: 'assign_context',
      anchor: 'context-pool',
      messageKey: 'tabs.onboardingGuide.assignContext',
    })
  })

  it('open_terminal is dismissible after a context is assigned', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        assignedAnyContext: true,
        doneSteps: ['new_context'],
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
        doneSteps: ['new_context', 'open_terminal'],
      }),
    ).toBeNull()
  })

  it('sin asignación real no se pasa a la terminal, aunque esté en doneSteps', () => {
    expect(
      resolveOnboardingGuideStep({
        ...baseReady,
        openChatAgentId: 'agent-1',
        sentFirstMessage: true,
        doneSteps: ['new_context', 'assign_context'],
      })?.step,
    ).toBe('assign_context')
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
        doneSteps: ['write_goal'],
        brainstormParticipantCount: 2,
        brainstormCeremonyPicked: true,
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

describe('onboardingGuideTitleKey', () => {
  it('deriva el título del mensaje con sufijo Title', () => {
    const step = resolveOnboardingGuideStep({ ...baseReady, path: '' })
    expect(step?.messageKey).toBe('tabs.onboardingGuide.choosePath')
    expect(onboardingGuideTitleKey(step!)).toBe('tabs.onboardingGuide.choosePathTitle')
  })
})
