import type { OrchestratorPath } from './onboarding'

export type OnboardingGuideAnchor =
  | 'path-picker'
  | 'project-folder'
  | 'create-team'
  | 'brainstorm-rail'
  | 'brainstorm-start'
  | 'composer-agents'
  | 'composer-input'
  | 'brainstorm-goal'
  | 'brainstorm-participants'
  | 'brainstorm-module-tabs'
  | 'brainstorm-human-composer'
  | 'context-pool'
  | 'plane-terminal-fab'

export type OnboardingGuideStepId =
  | 'choose_path'
  | 'pick_folder'
  | 'create_team'
  | 'open_brainstorm'
  | 'start_ceremony'
  | 'select_agent'
  | 'send_message'
  | 'write_goal'
  | 'pick_participants'
  | 'join_round'
  | 'saved_rooms'
  | 'assign_context'
  | 'open_terminal'

export const DISMISSIBLE_GUIDE_STEPS: readonly OnboardingGuideStepId[] = [
  'saved_rooms',
  'assign_context',
  'open_terminal',
]

export function isDismissibleGuideStep(step: string): boolean {
  return (DISMISSIBLE_GUIDE_STEPS as readonly string[]).includes(step)
}

export type OnboardingGuideStep = {
  step: OnboardingGuideStepId
  anchor: OnboardingGuideAnchor
  messageKey: string
  /** true solo si step ∈ DISMISSIBLE_GUIDE_STEPS; el coach mark avanza con «Entendido». */
  dismissible?: boolean
}

export type OnboardingGuideResolveArgs = {
  path: OrchestratorPath | ''
  projectFolder?: string
  hasFolder?: boolean
  hasAgents: boolean
  openChatAgentId: string | null
  brainstormOverlayOpen: boolean
  brainstormView?: 'rooms' | 'setup' | string | null
  incomplete?: boolean
  brainstormGoalFilled?: boolean
  brainstormParticipantCount?: number
  brainstormRoomLive?: boolean
  humanSpokeInRoom?: boolean
  sentFirstMessage?: boolean
  assignedAnyContext?: boolean
  doneSteps?: readonly string[]
}

function guideStep(
  step: OnboardingGuideStepId,
  anchor: OnboardingGuideAnchor,
  messageCamel: string,
): OnboardingGuideStep {
  return {
    step,
    anchor,
    messageKey: `tabs.onboardingGuide.${messageCamel}`,
    ...(isDismissibleGuideStep(step) ? { dismissible: true } : {}),
  }
}

export function resolveOnboardingGuideStep(
  args: OnboardingGuideResolveArgs,
): OnboardingGuideStep | null {
  if (args.incomplete === false) return null

  const hasFolder = args.hasFolder ?? Boolean((args.projectFolder ?? '').trim())
  const doneSteps = args.doneSteps ?? []
  const participantCount = args.brainstormParticipantCount ?? 0

  if (args.path === '') {
    return guideStep('choose_path', 'path-picker', 'choosePath')
  }
  if (!hasFolder) {
    return guideStep('pick_folder', 'project-folder', 'pickFolder')
  }
  if (!args.hasAgents) {
    return guideStep('create_team', 'create-team', 'createTeam')
  }

  if (args.path === 'business') {
    const viewUnsetAndRoomIdle = args.brainstormView == null && !args.brainstormRoomLive
    if (!args.brainstormOverlayOpen || viewUnsetAndRoomIdle) {
      return guideStep('open_brainstorm', 'brainstorm-rail', 'openBrainstorm')
    }
    if (args.brainstormView === 'setup' && !args.brainstormGoalFilled) {
      return guideStep('write_goal', 'brainstorm-goal', 'writeGoal')
    }
    if (
      args.brainstormView === 'setup'
      && args.brainstormGoalFilled
      && participantCount === 0
    ) {
      return guideStep('pick_participants', 'brainstorm-participants', 'pickParticipants')
    }
    if (
      args.brainstormView === 'setup'
      && args.brainstormGoalFilled
      && participantCount > 0
    ) {
      return guideStep('start_ceremony', 'brainstorm-start', 'startCeremony')
    }
    if (args.brainstormRoomLive && !args.humanSpokeInRoom) {
      return guideStep('join_round', 'brainstorm-human-composer', 'joinRound')
    }
    if (args.humanSpokeInRoom && !doneSteps.includes('saved_rooms')) {
      return guideStep('saved_rooms', 'brainstorm-module-tabs', 'savedRooms')
    }
    return null
  }

  if (args.path === 'engineer') {
    if (!args.openChatAgentId) {
      return guideStep('select_agent', 'composer-agents', 'selectAgent')
    }
    if (!args.sentFirstMessage) {
      return guideStep('send_message', 'composer-input', 'sendMessage')
    }
    if (!args.assignedAnyContext && !doneSteps.includes('assign_context')) {
      return guideStep('assign_context', 'context-pool', 'assignContext')
    }
    if (!doneSteps.includes('open_terminal')) {
      return guideStep('open_terminal', 'plane-terminal-fab', 'openTerminal')
    }
    return null
  }

  return null
}
