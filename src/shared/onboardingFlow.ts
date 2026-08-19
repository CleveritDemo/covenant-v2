import { ONBOARDING_VERSION, type OrchestratorPath } from './onboarding'
import {
  resolveOnboardingGuideStep,
  type OnboardingGuideResolveArgs,
} from './onboardingGuideFlow'

export function isOnboardingIncomplete(completedVersion: string): boolean {
  return completedVersion.trim() !== ONBOARDING_VERSION
}

export type OnboardingTabSnapshot = {
  paneKinds?: Record<string, unknown>
}

export function tabHasOrchestrationPanes(
  paneKinds: Record<string, unknown> | undefined,
): boolean {
  return Object.values(paneKinds ?? {}).some(
    kind => kind === 'agent' || kind === 'terminal',
  )
}

export function sessionHasOrchestrationPanes(
  tabs: readonly OnboardingTabSnapshot[],
): boolean {
  return tabs.some(tab => tabHasOrchestrationPanes(tab.paneKinds))
}

/** Chrome del plano (add-tab, idle gravity, composer): solo sin agentes ni terminales. No gobierna la guía. */
export function isOnboardingActive(args: {
  incomplete: boolean
  tabs: readonly OnboardingTabSnapshot[]
}): boolean {
  return args.incomplete && !sessionHasOrchestrationPanes(args.tabs)
}

/** La escalera de coach marks vive mientras el onboarding esté incompleto, haya o no panes. */
export function isOnboardingGuideActive(args: { incomplete: boolean }): boolean {
  return args.incomplete
}

/** Cierre por panes: solo sesiones heredadas que nunca eligieron rol (path vacío). */
export function shouldAutoCompleteFromPanes(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  tabs: readonly OnboardingTabSnapshot[]
}): boolean {
  return args.incomplete && args.path === '' && sessionHasOrchestrationPanes(args.tabs)
}

export type OnboardingCompleteTrigger =
  | 'guide_exhausted'
  | 'org_workspace_tab'

export function onboardingGuideExhausted(args: OnboardingGuideResolveArgs): boolean {
  return resolveOnboardingGuideStep(args) === null
}

export function canCompleteOnboarding(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  trigger: OnboardingCompleteTrigger
  cliAllMissing: boolean
}): boolean {
  if (!args.incomplete) return false
  if (args.trigger === 'org_workspace_tab') return true
  if (args.trigger === 'guide_exhausted') {
    return args.path !== '' && !args.cliAllMissing
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
  cliAllMissing: boolean
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
    autoOpenCeremonyOverlay:
      args.path === 'business' && args.hasAgents && !args.cliAllMissing,
  }
}

export function shouldWarnComposerMissingCli(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  cliAllMissing: boolean
}): boolean {
  return args.incomplete && args.path === 'engineer' && args.cliAllMissing
}

export type ComposerSendBlock = 'none' | 'cli' | 'engine'

/** Qué bloquea el envío del composer durante el onboarding del track engineer. */
export function resolveComposerSendBlock(args: {
  incomplete: boolean
  path: OrchestratorPath | ''
  cliAllMissing: boolean
  engineMissing: boolean
}): ComposerSendBlock {
  if (!args.incomplete) return 'none'
  if (args.path !== 'engineer') return 'none'
  // 'cli' gana a 'engine': sin CLI en disco elegir motor no arregla nada.
  if (args.cliAllMissing) return 'cli'
  if (args.engineMissing) return 'engine'
  return 'none'
}
