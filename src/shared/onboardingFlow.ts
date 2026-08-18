import { ONBOARDING_VERSION, type OrchestratorPath } from './onboarding'

export function isOnboardingIncomplete(completedVersion: string): boolean {
  return completedVersion.trim() !== ONBOARDING_VERSION
}

export type OnboardingCompleteTrigger =
  | 'engineer_human_send'
  | 'business_ceremony'
  | 'org_workspace_tab'

export function canCompleteOnboarding(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  trigger: OnboardingCompleteTrigger
  cliAllMissing: boolean
}): boolean {
  if (!args.incomplete) return false
  if (args.trigger === 'org_workspace_tab') return true
  if (args.trigger === 'engineer_human_send') {
    return args.path === 'engineer' && !args.cliAllMissing
  }
  if (args.trigger === 'business_ceremony') {
    return args.path === 'business'
  }
  return false
}

export function onboardingChromeHidden(incomplete: boolean): {
  hideTabAdd: boolean
  hideOrganizations: boolean
  hidePulse: boolean
  hideWiki: boolean
  hideLoops: boolean
} {
  return {
    hideTabAdd: incomplete,
    hideOrganizations: incomplete,
    hidePulse: incomplete,
    hideWiki: incomplete,
    hideLoops: incomplete,
  }
}

export function onboardingLockedSurface(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  hasFolder: boolean
  hasAgents: boolean
}): {
  showPathPicker: boolean
  showFolderCta: boolean
  showTeamFab: boolean
  showInviteCta: boolean
  showComposer: boolean
  autoOpenCeremonyOverlay: boolean
} {
  if (!args.incomplete) {
    return {
      showPathPicker: false,
      showFolderCta: false,
      showTeamFab: false,
      showInviteCta: false,
      showComposer: args.hasAgents,
      autoOpenCeremonyOverlay: false,
    }
  }
  return {
    showPathPicker: args.path === '',
    showFolderCta: args.path !== '' && !args.hasFolder,
    showTeamFab: args.path !== '' && args.hasFolder && !args.hasAgents,
    showInviteCta: true,
    showComposer: args.path === 'engineer' && args.hasAgents,
    autoOpenCeremonyOverlay: args.path === 'business' && args.hasAgents,
  }
}

export function shouldWarnComposerMissingCli(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  cliAllMissing: boolean
}): boolean {
  return args.incomplete && args.path === 'engineer' && args.cliAllMissing
}
