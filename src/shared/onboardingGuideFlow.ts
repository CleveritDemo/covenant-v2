import type { OrchestratorPath } from './onboarding'

export type OnboardingGuideAnchor =
  | 'path-picker'
  | 'project-folder'
  | 'create-team'
  | 'brainstorm-rail'
  | 'brainstorm-start'
  | 'composer-agents'
  | 'composer-input'

export type OnboardingGuideStep = {
  anchor: OnboardingGuideAnchor
  messageKey: string
}

export function resolveOnboardingGuideStep(args: {
  path: OrchestratorPath | ''
  projectFolder: string
  hasAgents: boolean
  openChatAgentId: string | null
  brainstormOverlayOpen: boolean
  brainstormView?: 'rooms' | 'setup' | string | null
}): OnboardingGuideStep | null {
  const hasFolder = Boolean(args.projectFolder.trim())

  if (args.path === '') {
    return { anchor: 'path-picker', messageKey: 'tabs.onboardingGuide.choosePath' }
  }
  if (!hasFolder) {
    return { anchor: 'project-folder', messageKey: 'tabs.onboardingGuide.pickFolder' }
  }
  if (!args.hasAgents) {
    return { anchor: 'create-team', messageKey: 'tabs.onboardingGuide.createTeam' }
  }

  if (args.path === 'business') {
    if (!args.brainstormOverlayOpen) {
      return { anchor: 'brainstorm-rail', messageKey: 'tabs.onboardingGuide.openBrainstorm' }
    }
    if (args.brainstormView === 'setup') {
      return { anchor: 'brainstorm-start', messageKey: 'tabs.onboardingGuide.startCeremony' }
    }
    return null
  }

  if (args.path === 'engineer') {
    if (!args.openChatAgentId) {
      return { anchor: 'composer-agents', messageKey: 'tabs.onboardingGuide.selectAgent' }
    }
    return { anchor: 'composer-input', messageKey: 'tabs.onboardingGuide.sendMessage' }
  }

  return null
}
