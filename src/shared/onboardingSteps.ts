import type { OrchestratorPath } from './onboarding'

export type OnboardingStepId =
  | 'welcome'
  | 'account'
  | 'requirements'
  | 'folder'
  | 'team'
  | 'brainstorm'
  | 'firstMessage'

const ENGINEER_STEPS: OnboardingStepId[] = [
  'welcome',
  'account',
  'requirements',
  'folder',
  'team',
  'brainstorm',
  'firstMessage',
]

/** Pasos del wizard según el path elegido y si faltan CLIs. */
export function onboardingStepsForPath(
  path: OrchestratorPath | '',
  opts: { clisMissing: boolean },
): OnboardingStepId[] {
  if (path === 'business') {
    const steps: OnboardingStepId[] = ['welcome', 'account']
    if (opts.clisMissing) steps.push('requirements')
    steps.push('folder', 'team', 'brainstorm', 'firstMessage')
    return steps
  }
  return [...ENGINEER_STEPS]
}
