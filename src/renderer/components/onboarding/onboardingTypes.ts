/** Fila local del paso de requisitos (no importar de shared/onboarding). */
export type OnboardingCliRow = {
  provider: string
  label: string
  command: string
  installed: boolean
  version: string | null
}

export const ONBOARDING_STEP_COUNT = 6

export type OnboardingStepIndex = 0 | 1 | 2 | 3 | 4 | 5
