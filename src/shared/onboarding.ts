import type { AgentCliProvider } from './agentCliProviders'

/** Versión del flujo de onboarding; al completarlo se persiste en AppConfig. */
export const ONBOARDING_VERSION = '1'

/** Estado de un CLI de agente en la máquina, para el wizard de onboarding. */
export interface OnboardingCliStatus {
  provider: AgentCliProvider
  /** Nombre de marca desde `AGENT_CLI_PROVIDERS`. */
  label: string
  /** Ejecutable por defecto desde `AGENT_CLI_PROVIDERS`. */
  command: string
  installed: boolean
  version: string | null
}
