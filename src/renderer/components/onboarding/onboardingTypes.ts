/** Fila local del paso de requisitos (no importar de shared/onboarding). */
export type OnboardingCliRow = {
  provider: string
  label: string
  command: string
  installed: boolean
  version: string | null
}
